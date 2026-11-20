---
name: nest-feature
description: Cria uma nova feature NestJS com CRUD completo sobre MongoDB (schema, repository, service, controller, DTOs, mapper, testes e migration de índices) seguindo o AGENTS.md. Use sempre que for criar um novo recurso, entidade ou módulo.
---

# Criar feature NestJS + Mongoose

Siga os passos na ordem. Não pule etapas. Todas as regras do `AGENTS.md` continuam valendo, principalmente: zero comentários, sem `any`, sem `as`.

## 1. Definir antes de escrever código

Escreva para o usuário, em poucas linhas:

- nome da feature (plural, kebab-case) e da collection (plural, snake_case);
- formato do documento, indicando o que fica embutido e o que é referência, e por quê;
- consultas que a feature vai fazer e o índice de cada uma (ordem ESR).

Só avance depois de confirmar o formato com o usuário quando ele não estiver definido na tarefa.

## 2. Arquivos, nesta ordem

1. `schemas/<entity>.schema.ts`
   - `@Schema({ collection, timestamps: true, versionKey: false })`
   - `schemaVersion` com `default`
   - subdocumentos com `@Schema({ _id: false })`
   - `Schema.index()` para cada índice definido no passo 1
   - exportar `<Entity>`, `<Entity>Document` (`HydratedDocument`) e `<Entity>Schema`
2. `dto/create-<entity>.dto.ts`, `dto/update-<entity>.dto.ts` (`PartialType`), `dto/query-<entity>.dto.ts` (cursor, limit 1..100 padrão 20, filtros permitidos)
3. `dto/<entity>.response.ts` com campos `readonly` e `id: string`
4. `<feature>.mapper.ts` com função pura `to<Entity>Response`
5. `<feature>.repository.ts` com `@InjectModel`, `.lean()`, `.exec()`, projeção e métodos de intenção
6. `<feature>.service.ts` com regras e `NotFoundException`
7. `<feature>.controller.ts` com `ParseObjectIdPipe`, `@HttpCode(201)` no POST e `@HttpCode(204)` no DELETE
8. `<feature>.module.ts` registrando o schema com `MongooseModule.forFeature`
9. Registrar o módulo em `app.module.ts`

## 3. Migration de índices

Use a skill `mongo-migration` para criar a migration que cria a collection e os índices do passo 1.

## 4. Testes

- `<feature>.service.spec.ts`: repository mockado com `vi.fn()`, cobre sucesso e not found.
- `test/<feature>.e2e-spec.ts`: `startMongoMemory` e `createTestApp` de `test/support/`, cobre 201, 200, 204, 400, 404 e paginação por cursor.

## 5. Verificação

Rode `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:e2e`. Corrija até passar. O `npm run lint` já roda `check:rules`, que falha com qualquer comentário ou `enum`.

## Checklist final

- [ ] Nenhum arquivo da feature importa internos de outra feature
- [ ] Controller não acessa repository
- [ ] Nenhuma resposta expõe `_id` ou documento Mongoose
- [ ] Toda consulta tem índice
- [ ] Dinheiro em `*Cents` inteiro
- [ ] Zero comentários
