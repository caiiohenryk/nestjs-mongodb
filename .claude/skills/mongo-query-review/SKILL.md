---
name: mongo-query-review
description: Cria ou revisa consultas MongoDB no repository garantindo índice adequado (ordem ESR), projeção, paginação por cursor e evidência via explain(). Use ao adicionar filtro, ordenação, busca ou endpoint de listagem, ou quando uma consulta estiver lenta.
---

# Criar ou revisar consulta MongoDB

## 1. Descrever a consulta

Liste para cada consulta:

- campos de igualdade (`status = 'paid'`);
- campo de ordenação (`createdAt desc`);
- campos de intervalo (`createdAt >= x`, `totalCents > y`);
- campos retornados.

## 2. Definir o índice (ESR)

Ordem do índice composto: Igualdade -> Sort -> Range. Acrescente `_id` ao final quando ele for o desempate da paginação por cursor.

Exemplo: `status = ?`, ordenado por `createdAt desc`, com `createdAt >= ?` gera `{ status: 1, createdAt: -1, _id: -1 }`.

Antes de criar um índice novo, verifique se um existente já cobre a consulta por prefixo. Índice redundante é proibido.

## 3. Escrever no repository

- Filtro montado campo a campo a partir do DTO de query, nunca repassado do cliente.
- `.select()` com os campos do passo 1.
- `.sort()` igual à ordem do índice.
- `.limit(limit + 1)` para saber se existe próxima página.
- Cursor codificado como base64url de `{ sortValue, id }`.
- `.lean().exec()`.

## 4. Provar com explain

Rode no banco local com seed (`npm run seed`):

```
db.orders.find({ status: 'paid' }).sort({ createdAt: -1 }).limit(21).explain('executionStats')
```

Critérios de aprovação:

- `winningPlan` contém `IXSCAN`, sem `COLLSCAN`;
- sem estágio `SORT` em memória;
- `totalDocsExamined` próximo de `nReturned`.

Inclua o trecho relevante do explain na descrição do PR.

## 5. Índice em produção

Crie o índice também por migration usando a skill `mongo-migration`. O `Schema.index()` sozinho não basta, porque `autoIndex` fica desligado fora de desenvolvimento.

## Sinais de reprovação

- `skip` em endpoint público
- `$regex` sem `^`
- `$where` ou `$expr` em collection grande
- `populate`
- consulta sem `limit`
- filtro com objeto vindo direto do cliente
