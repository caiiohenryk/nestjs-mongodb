import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

type Violation = { readonly file: string; readonly line: number; readonly rule: string };

const roots = ['src', 'test', 'migrations', 'scripts'];
const rootFiles = ['vitest.config.ts', 'vitest.config.e2e.ts', 'migrate-mongo-config.ts'];
const projectRoot = process.cwd();

function collectTypeScriptFiles(directory: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return collectTypeScriptFiles(path);
    }
    return path.endsWith('.ts') ? [path] : [];
  });
}

function lineOf(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function findComments(sourceFile: ts.SourceFile, file: string): Violation[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, sourceFile.text);
  const violations: Violation[] = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      violations.push({ file, line: lineOf(sourceFile, scanner.getTokenStart()), rule: 'no-comments' });
    }
    if (token === ts.SyntaxKind.TemplateHead || token === ts.SyntaxKind.TemplateMiddle) {
      token = scanner.scan();
      continue;
    }
    if (token === ts.SyntaxKind.CloseBraceToken) {
      token = scanner.reScanTemplateToken(false);
      if (token === ts.SyntaxKind.TemplateMiddle || token === ts.SyntaxKind.TemplateTail) {
        token = scanner.scan();
        continue;
      }
    }
    if (token === ts.SyntaxKind.SlashToken || token === ts.SyntaxKind.SlashEqualsToken) {
      token = scanner.reScanSlashToken();
    }
    token = scanner.scan();
  }
  return violations;
}

function findEnums(sourceFile: ts.SourceFile, file: string): Violation[] {
  const violations: Violation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isEnumDeclaration(node)) {
      violations.push({ file, line: lineOf(sourceFile, node.getStart(sourceFile)), rule: 'no-enum' });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function checkFile(path: string): Violation[] {
  const file = relative(projectRoot, path);
  const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  return [...findComments(sourceFile, file), ...findEnums(sourceFile, file)];
}

const files = [
  ...roots.flatMap((root) => collectTypeScriptFiles(join(projectRoot, root))),
  ...rootFiles
    .map((file) => join(projectRoot, file))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    }),
];

const violations = files.flatMap(checkFile);

for (const violation of violations) {
  process.stderr.write(`${violation.file}:${violation.line} ${violation.rule}\n`);
}

if (violations.length > 0) {
  process.stderr.write(`\n${violations.length} violation(s) of AGENTS.md rules\n`);
  process.exit(1);
}
