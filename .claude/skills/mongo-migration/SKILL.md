---
name: mongo-migration
description: Cria migrations com migrate-mongo (índices, novas collections, mudança de formato, backfill como orders -> orders_v2) de forma idempotente, em lotes e com teste. Use sempre que um dado mudar de formato, um índice for criado ou uma collection nova surgir.
---

# Criar migration MongoDB

## Regras inegociáveis

- Driver nativo apenas (`db`, `client` do `migrate-mongo`). Nunca importe nada de `src/`.
- Idempotente. Rodar `up` duas vezes produz o mesmo estado.
- `up` e `down` implementados. Se `down` for impossível, ele lança `Error` com o motivo.
- Nunca carregar a collection inteira em memória.
- `$out` proibido. Use `$merge`.
- Zero comentários.
- Migration aplicada em ambiente compartilhado nunca é editada.

## 1. Escolher a estratégia

| Situação | Estratégia |
|---|---|
| Criar índice ou collection | `createIndex` / `createCollection` verificando existência |
| Transformação expressável em aggregation | Pipeline com `$merge` (`on` em campo com índice único) |
| Transformação com lógica que não cabe em aggregation | Cursor ordenado por `_id` + `bulkWrite` com `upsert`, lotes de no máximo 1000 |
| Mudança gradual sem collection nova | `schemaVersion` + migração lazy no repository e backfill opcional |

Explique ao usuário a estratégia escolhida em uma frase antes de escrever.

## 2. Criar o arquivo

```
npm run migrate:create -- <descricao-em-kebab-case>
```

O arquivo é TypeScript executado direto pelo Node. Exporte `up` e `down` nomeados e use só sintaxe apagável.

## 3. Modelos

### Índice

```ts
import type { Db } from 'mongodb';

export async function up(db: Db): Promise<void> {
  await db.collection('orders').createIndex({ status: 1, createdAt: -1 }, { name: 'status_createdAt' });
}

export async function down(db: Db): Promise<void> {
  await db.collection('orders').dropIndex('status_createdAt');
}
```

### Backfill com `$merge`

Antes do pipeline, garanta o índice único da chave de correspondência no destino.

```ts
import type { Db } from 'mongodb';

export async function up(db: Db): Promise<void> {
  await db.collection('orders_v2').createIndex({ orderId: 1 }, { unique: true, name: 'orderId_unique' });
  await db
    .collection('orders')
    .aggregate([
      { $project: { _id: 0, orderId: '$_id', status: { $toLower: '$status' } } },
      { $merge: { into: 'orders_v2', on: 'orderId', whenMatched: 'replace', whenNotMatched: 'insert' } },
    ])
    .toArray();
}

export async function down(db: Db): Promise<void> {
  await db.collection('orders_v2').drop();
}
```

### Lotes com `bulkWrite`

- Ordenar por `_id`, ler com `find({ _id: { $gt: lastId } }).limit(1000)`.
- Montar operações `updateOne` com `upsert: true` e `$set`.
- Repetir até o lote vir vazio.
- Logar progresso (processados / total) a cada lote.

## 4. Teste obrigatório

Em `test/migrations/<nome>.spec.ts` com `startMongoMemory` de `test/support/`:

1. Inserir documentos no formato antigo, incluindo casos de borda (campos ausentes, arrays vazios).
2. Rodar `up` e verificar formato e contagem no destino.
3. Rodar `up` de novo e verificar que nada duplicou nem mudou.
4. Rodar `down` e verificar o estado anterior.

## 5. Mudança de formato em produção

Quando a migration faz parte de uma troca de versão (ex.: `orders` -> `orders_v2`), confirme que o plano segue a ordem e que cada etapa é um PR separado:

1. dual-write no service;
2. migration de backfill;
3. script de validação comparando contagem e somatórios;
4. virada de leitura por feature flag;
5. migration que remove a versão antiga.

## 6. Verificação

`npm run lint`, `npm run typecheck`, teste da migration, depois `npm run migrate:up` e `npm run migrate:status` no banco local.
