import type { Document, Filter, Sort } from 'mongodb';
import { connectScriptDatabase, write } from './support/database.ts';

type PlanSummary = {
  readonly stages: string[];
  readonly indexName: string | null;
  readonly keysExamined: number;
  readonly docsExamined: number;
  readonly returned: number;
  readonly millis: number;
};

type Scenario = {
  readonly title: string;
  readonly filter: Filter<Document>;
  readonly sort: Sort;
};

const SCENARIOS: Scenario[] = [
  { title: 'latest orders', filter: {}, sort: { createdAt: -1, _id: -1 } },
  { title: 'paid orders, latest first', filter: { status: 'PAID' }, sort: { createdAt: -1, _id: -1 } },
  {
    title: 'orders of one customer, latest first',
    filter: { customerEmail: 'customer42@example.com' },
    sort: { createdAt: -1, _id: -1 },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === 'number' ? value : 0;
}

function collectStages(plan: unknown, stages: string[] = []): string[] {
  if (!isRecord(plan)) {
    return stages;
  }
  if (typeof plan.stage === 'string') {
    stages.push(plan.stage);
  }
  collectStages(plan.queryPlan, stages);
  collectStages(plan.inputStage, stages);
  if (Array.isArray(plan.inputStages)) {
    plan.inputStages.forEach((input) => collectStages(input, stages));
  }
  return stages;
}

function findIndexName(plan: unknown): string | null {
  if (!isRecord(plan)) {
    return null;
  }
  if (typeof plan.indexName === 'string') {
    return plan.indexName;
  }
  return findIndexName(plan.queryPlan) ?? findIndexName(plan.inputStage);
}

function summarize(explain: Document): PlanSummary {
  const planner: unknown = explain.queryPlanner;
  const winningPlan = isRecord(planner) ? planner.winningPlan : null;
  const stats: unknown = explain.executionStats;
  const executionStats = isRecord(stats) ? stats : {};
  return {
    stages: collectStages(winningPlan).toReversed(),
    indexName: findIndexName(winningPlan),
    keysExamined: readNumber(executionStats, 'totalKeysExamined'),
    docsExamined: readNumber(executionStats, 'totalDocsExamined'),
    returned: readNumber(executionStats, 'nReturned'),
    millis: readNumber(executionStats, 'executionTimeMillis'),
  };
}

function print(label: string, summary: PlanSummary): void {
  write(`  ${label}`);
  write(`    plan:          ${summary.stages.join(' -> ')}`);
  write(`    index:         ${summary.indexName ?? 'none'}`);
  write(`    keys examined: ${summary.keysExamined}`);
  write(`    docs examined: ${summary.docsExamined}`);
  write(`    returned:      ${summary.returned}`);
  write(`    time:          ${summary.millis} ms`);
}

async function explainOrders(): Promise<void> {
  const database = await connectScriptDatabase();
  const orders = database.db.collection('orders');
  try {
    write(`orders: ${await orders.estimatedDocumentCount()} documents\n`);
    for (const scenario of SCENARIOS) {
      write(
        `${scenario.title}  find(${JSON.stringify(scenario.filter)}).sort(${JSON.stringify(scenario.sort)}).limit(21)`,
      );
      const withIndex = await orders.find(scenario.filter).sort(scenario.sort).limit(21).explain('executionStats');
      print('with index', summarize(withIndex));
      const withoutIndex = await orders
        .find(scenario.filter)
        .sort(scenario.sort)
        .limit(21)
        .hint({ $natural: 1 })
        .explain('executionStats');
      print('forcing collection scan', summarize(withoutIndex));
      write('');
    }
  } finally {
    await database.close();
  }
}

await explainOrders();
