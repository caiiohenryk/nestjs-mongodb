# AGENTS.md

Regras obrigatórias deste repositório. Valem para humanos e agentes. "DEVE" e "NUNCA" não são sugestões. Se uma regra precisar ser quebrada, a regra é alterada neste arquivo primeiro, em um commit próprio.

## Stack

- Node.js 24 LTS, npm (sem yarn ou pnpm).
- NestJS 12, ESM puro, TypeScript em modo `strict`.
- MongoDB 8 via Mongoose (`@nestjs/mongoose`). TypeORM, Prisma e Typegoose são proibidos.
- Driver nativo `mongodb` permitido somente em `migrations/`, `scripts/`, testes e para tipos/erros em `src/`. A versão DEVE ser a mesma faixa que o Mongoose usa (`npm ls mongodb` mostra uma cópia só, `deduped`). Duas cópias quebram `instanceof MongoServerError`.
- Validação: `class-validator` + `class-transformer`.
- Configuração: `@nestjs/config` com validação de env por schema `zod` na inicialização.
- Migrations: `migrate-mongo`.
- Testes: Vitest + `mongodb-memory-server` (`MongoMemoryReplSet`). Mocks com `vi.fn()`, nunca `jest.fn()`.
- Lint: oxlint com type-aware (`.oxlintrc.json`) + `scripts/check-code-rules.ts` (comentários e `enum`).
- Formatação: Prettier (`printWidth` 120, aspas simples).
- Ambiente local: `docker compose` com MongoDB em replica set de 1 nó.

## Comandos

| Ação | Comando |
|---|---|
| Subir banco | `npm run db:up` (MongoDB em `localhost:27017`, Mongo Express em `localhost:8081`) |
| Dev | `npm run start:dev` |
| Lint | `npm run lint` (oxlint + `check:rules`) |
| Formatação | `npm run format` |
| Typecheck | `npm run typecheck` |
| Testes unitários | `npm test` |
| Testes e2e | `npm run test:e2e` |
| Migrations | `npm run migrate:create -- <nome>`, `npm run migrate:up`, `npm run migrate:down`, `npm run migrate:status` |
| Seed | `npm run seed` |

Uma tarefa só está pronta quando `lint`, `typecheck` e os testes passam. Nunca declare concluído sem rodar os três.

## Estrutura

```
src/
  main.ts
  app.module.ts
  app.setup.ts
  config/
  database/
  health/
  common/
    dto/
    filters/
    pipes/
    pagination/
  <feature>/
    <feature>.module.ts
    <feature>.controller.ts
    <feature>.service.ts
    <feature>-query.service.ts
    <feature>.repository.ts
    schemas/<entity>.schema.ts
    dto/create-<entity>.dto.ts
    dto/update-<entity>.dto.ts
    dto/query-<entity>.dto.ts
    dto/<entity>.response.ts
    <feature>.mapper.ts
    <feature>.service.spec.ts
test/
  support/
  <feature>.e2e-spec.ts
  migrations/<migration>.spec.ts
migrations/
scripts/
```

- Uma feature por pasta. A API pública de uma feature é o seu `index.ts`. Outra feature importa SOMENTE desse arquivo, nunca de arquivos internos.
- `common/` contém somente código usado por duas ou mais features.
- Proibido criar pastas `utils/`, `helpers/`, `shared/` ou `misc/`.

## Código

### Sem comentários

- NUNCA escreva comentários: nem `//`, nem `/* */`, nem JSDoc, nem TODO, nem código comentado.
- Se o código precisa de explicação, renomeie, extraia uma função ou crie um tipo.
- A regra vale também para migrations, scripts, testes e arquivos de configuração `.ts`.
- `eslint-disable` é proibido. Se o lint reclama, corrija o código.

### TypeScript

- `any` é proibido. Use `unknown` e faça narrowing.
- `as` (type assertion) é proibido, exceto `as const`.
- Non-null assertion (`!`) é proibida.
- `enum` do TypeScript é proibido. Use objeto `as const` e o tipo derivado:
  ```ts
  export const OrderStatus = { Pending: 'pending', Paid: 'paid', Canceled: 'canceled' } as const;
  export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
  ```
- Retorno explícito em todo método público de service, repository e controller.
- `readonly` em toda propriedade injetada e em todo campo de DTO de resposta.
- Em `src/` e `test/`, imports relativos terminam em `.js` (ESM). Em `scripts/`, terminam em `.ts`, porque o Node executa os arquivos direto. Aliases de path são proibidos.
- Imports de tipo com `import type` ou `type` inline.
- `__dirname` não existe. Use `import.meta.dirname`.
- Exports nomeados apenas. `export default` é proibido.
- Funções com no máximo 3 parâmetros posicionais. Acima disso, um objeto tipado.
- Construtores contam: uma classe com mais de 3 dependências injetadas tem responsabilidade demais e DEVE ser dividida.
- Early return no lugar de `else` após `return` ou `throw`.

### Nomes

- Arquivos em `kebab-case` com sufixo de papel: `.controller.ts`, `.service.ts`, `.repository.ts`, `.schema.ts`, `.dto.ts`, `.response.ts`, `.mapper.ts`.
- Classes em `PascalCase` com sufixo de papel: `OrdersService`, `CreateOrderDto`, `OrderResponse`.
- Collections no plural, `snake_case`: `orders`, `orders_v2`, `customer_addresses`.
- Campos de documento em `camelCase`.
- Booleanos começam com `is`, `has` ou `can`.
- Datas terminam em `At`: `createdAt`, `paidAt`, `canceledAt`.
- Valores monetários terminam em `Cents` e são inteiros: `totalCents`, `unitPriceCents`. NUNCA armazene dinheiro como float.

## Camadas

Fluxo único: `Controller -> Service -> Repository -> Model`.

Escrita e leitura ficam em services separados: `<Feature>Service` para comandos (criar, alterar, remover) e `<Feature>QueryService` para consultas. Isso permite trocar a origem da leitura (ex.: `orders` para `orders_v2`) sem tocar na escrita.

### Controller

- Recebe DTO validado, chama um método do service, retorna um `*Response`.
- NUNCA acessa Model ou Repository.
- NUNCA contém regra de negócio, `if` de domínio ou `try/catch`.
- Rotas no plural e em `kebab-case`: `/orders`, `/orders-v2`.
- Status HTTP explícitos com `@HttpCode` quando diferentes do padrão. `POST` de criação retorna 201, `DELETE` retorna 204.
- `:id` sempre validado por `ObjectIdPipe` (`src/common/pipes/object-id.pipe.ts`) antes de chegar ao service. O service recebe `string`, nunca `Types.ObjectId`.

### Service

- Contém as regras de negócio. Não conhece `Request`, `Response` ou decorators HTTP.
- Lança exceções de domínio do Nest (`NotFoundException`, `ConflictException`, `UnprocessableEntityException`).
- NUNCA retorna documento Mongoose. Retorna tipos de domínio ou o resultado do mapper.
- Operações que escrevem em mais de uma collection DEVEM usar transação: `connection.transaction(work, TRANSACTION_OPTIONS)` (`src/database/transaction-options.ts`). O callback pode rodar mais de uma vez (retry de erro transitório), então não pode ter efeitos fora do banco.

### Repository

- Única camada que importa `Model` ou `@InjectModel`.
- Métodos com nomes de intenção: `findById`, `findPage`, `insert`, `updateById`, `deleteById`. Proibido método genérico `query(filter)` que receba filtro livre vindo de fora.
- Toda leitura usa `.lean()` e `.exec()`.
- Toda leitura de lista usa projeção explícita (`select`) e limite.

### Mapper

- Converte documento para `*Response`. Converte `_id` para `id: string`.
- `_id`, `__v` e campos internos NUNCA aparecem na resposta da API.

## DTOs e validação

- `ValidationPipe` global com `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Todo campo de entrada tem decorator de validação. Campo sem decorator é bug.
- `UpdateDto` deriva de `CreateDto` via `PartialType` de `@nestjs/mapped-types`.
- Strings recebem `@MaxLength`. Arrays recebem `@ArrayMaxSize`. Números recebem `@Min` e `@Max`.
- Entrada e saída são classes diferentes. Nunca reutilize o DTO de entrada como resposta.

## MongoDB e Mongoose

### Modelagem

- Modele pelo padrão de leitura. Dados lidos sempre juntos ficam embutidos no mesmo documento.
- Dados que crescem sem limite (ex.: pedidos de um cliente) ficam em collection própria, referenciados por id.
- Arrays embutidos DEVEM ter tamanho máximo validado.
- Subdocumentos embutidos usam `@Schema({ _id: false })` salvo quando precisam ser endereçados individualmente.
- Todo schema usa `timestamps: true` e `versionKey: false`. Exceção: collections derivadas de outra (ex.: `orders_v2`) usam `timestamps: false` e copiam `createdAt`/`updatedAt` da origem.
- Todo schema define `collection` explicitamente em `@Schema({ collection: 'orders' })`.
- Todo schema tem campo `schemaVersion: number` com valor padrão.
- `strict: true` (padrão) nunca é desligado. `Mixed` e `Schema.Types.Mixed` são proibidos.
- `populate` é proibido. Use `$lookup` em aggregation no repository, ou duas consultas explícitas.

### Índices

- Índices são declarados no schema com `Schema.index()` e também criados por migration. A migration é a fonte de verdade em produção.
- `autoIndex: false` fora de `NODE_ENV=development` e `test`.
- Índices compostos seguem a ordem ESR: Igualdade, Sort, Range.
- Toda consulta nova em repository exige um índice que a cubra. Verifique com `explain('executionStats')` e anexe o resultado (`IXSCAN`, `totalDocsExamined`) na descrição do PR.
- Consultas com `$regex` sem âncora `^`, `$where` e `$expr` em collections grandes são proibidas.

### Consultas

- Paginação por cursor (`_id` ou campo indexado + `_id`). `skip` é proibido em endpoints públicos.
- Limite padrão 20, máximo 100, validado no DTO de query.
- Filtros vindos do cliente são mapeados campo a campo para o filtro Mongo. NUNCA repasse `req.query` ou um objeto do cliente direto para `find`.
- `updateOne`/`findOneAndUpdate` sempre com operadores (`$set`, `$inc`, `$push`). Substituição de documento inteiro é proibida fora de migrations.
- `findOneAndUpdate`/`findByIdAndUpdate` sempre com `{ returnDocument: 'after', runValidators: true }`. A opção `new` está depreciada.
- Deleção física por padrão. Soft delete só quando um requisito explícito exigir, com campo `deletedAt`.

### Conexão

- URI única via env `MONGODB_URI`, validada no boot.
- `writeConcern: { w: 'majority' }` e `readPreference: 'primary'` como padrão. Leitura em secundário só com justificativa no PR.
- A aplicação NUNCA cria nem apaga collections ou índices em runtime de produção.

## Migrations

- Toda mudança de formato de dado, criação de índice ou nova collection é uma migration em `migrations/`.
- Nome do arquivo: gerado por `npm run migrate:create -- <descricao-em-kebab-case>`, a partir de `migrations/sample-migration.ts`.
- Migrations são TypeScript executado direto pelo Node (type stripping): exports nomeados `up` e `down`, só sintaxe apagável (sem `enum`, `namespace` ou parameter properties).
- Migrations usam o driver nativo (`db`, `client`) recebido pelo `migrate-mongo`. NUNCA importam código de `src/`, porque o schema da aplicação muda e a migration precisa continuar reproduzível.
- Toda migration DEVE:
  - ser idempotente: rodar duas vezes produz o mesmo resultado;
  - implementar `up` e `down`; quando `down` for impossível, lançar erro com mensagem clara;
  - processar em lotes (máximo 1000 documentos por `bulkWrite`) ou usar aggregation com `$merge`;
  - usar `upsert` ou `$merge` com chave de correspondência única e indexada;
  - nunca carregar a collection inteira em memória.
- Migration já aplicada em qualquer ambiente compartilhado NUNCA é editada. Correção é uma nova migration.
- Mudança de formato em produção segue sempre: dual-write -> backfill -> validação -> virada de leitura por feature flag -> remoção da versão antiga em migration separada.
- A collection nova reaproveita o `_id` da antiga. O backfill usa `$merge` com `on: '_id'` e mantém o documento mais novo por `updatedAt`.
- Feature flags de migração ficam no env (`ORDERS_DUAL_WRITE`, `ORDERS_READ_FROM_V2`), validadas no boot. Ler da versão nova sem dual-write ligado é configuração inválida.
- `$out` é proibido (substitui a collection de destino). Use `$merge`.

## Erros e logs

- Um único `ExceptionFilter` global padroniza o corpo de erro: `{ statusCode, error, message, path, timestamp }`.
- Erro de chave duplicada do Mongo (`code 11000`) é convertido para `409 Conflict` no filter.
- Use o `Logger` do Nest com contexto da classe. `console.log` é proibido.
- Nunca logue documento inteiro, payload de request ou dado pessoal.

## Configuração

- Todo acesso a env passa por um serviço de config tipado. `process.env` só aparece em `src/config/`.
- `.env` nunca é commitado. `.env.example` é sempre atualizado junto com qualquer variável nova.

## Testes

- Service: teste unitário com repository mockado.
- Repository e fluxos com transação: teste de integração com `MongoMemoryReplSet`.
- Testes e2e criam a aplicação com `createTestApp` (`test/support/`), que sobrescreve o `AppConfigService`. NUNCA configure o banco de teste alterando `process.env`: o `ConfigModule` lê o ambiente no import, antes do teste rodar.
- Corpo de resposta em e2e é validado com schema `zod` (`schema.parse(response.body)`), nunca atribuído direto de `any`.
- Todo endpoint tem teste e2e cobrindo sucesso, validação (400), não encontrado (404) e conflito quando aplicável.
- Toda migration tem teste: popula dados no formato antigo, roda `up`, verifica o formato novo, roda `up` de novo e verifica idempotência.
- Padrão AAA (arrange, act, assert) separado por linha em branco. Nome do teste descreve comportamento: `it('returns 404 when order does not exist')`.
- Proibido `it.only`, `describe.only` e `it.skip` commitados.

## Git

- Prefixos permitidos: `feat:`, `fix:`, `build:`, `chore:`. Nenhum outro.
  - `feat:` funcionalidade nova, com seus testes e documentação.
  - `fix:` correção de comportamento.
  - `build:` dependências, scripts npm, Docker, configuração de build, lint e testes.
  - `chore:` documentação, regras, refatoração sem mudança de comportamento.
- Mensagem em inglês, imperativo, minúscula, sem ponto final: `feat: add orders crud`.
- Um commit por mudança lógica. Migration vai em commit próprio.
- Nenhum commit, PR ou arquivo credita ferramentas de IA: sem `Co-Authored-By` de IA, sem "Generated with".
- Nunca commitar `.env`, dumps de banco ou `node_modules`.

## Skills

Fluxos repetíveis ficam em `.claude/skills/`. Use a skill correspondente em vez de improvisar:

- `nest-feature`: criar uma nova feature (módulo CRUD completo).
- `mongo-migration`: criar uma migration ou backfill.
- `mongo-query-review`: criar ou revisar uma consulta e seu índice.

## Agents

Agentes ficam em `.claude/agents/`:

- `idea-scout`: lê o repositório e propõe as próximas implementações priorizadas, já com mensagem de commit. Não edita arquivos.
