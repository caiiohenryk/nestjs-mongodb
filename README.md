# nestjs-mongodb

CRUD de pedidos com NestJS 12 e MongoDB 8 (Mongoose), feito para estudar como o MongoDB armazena e busca dados em produção e como migrar dados de um formato para outro sem downtime (`orders` → `orders_v2`).

As regras de código do projeto estão em [AGENTS.md](AGENTS.md).

## Rodando

Requisitos: Node 24+ e Docker.

```bash
npm install
cp .env.example .env
npm run db:up
npm run migrate:up
npm run start:dev
```

| Serviço | Endereço |
|---|---|
| API | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| Mongo Express (visualizar dados) | http://localhost:8081 |
| MongoDB | `mongodb://localhost:27017/nestjs_mongodb?replicaSet=rs0` |

Para entrar no shell do banco:

```bash
docker compose exec mongo mongosh nestjs_mongodb
```

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/orders` | Cria um pedido. O total é calculado no servidor. |
| `GET` | `/orders?status=PAID&customerEmail=...&limit=20&cursor=...` | Lista com paginação por cursor. |
| `GET` | `/orders/:id` | Busca um pedido. |
| `PATCH` | `/orders/:id` | Altera campos. Pedidos cancelados não podem ser alterados (422). |
| `DELETE` | `/orders/:id` | Remove (204). |

```bash
curl -X POST localhost:3000/orders -H 'content-type: application/json' -d '{
  "customerName": "Ana",
  "customerEmail": "ana@example.com",
  "items": [{ "sku": "A1", "name": "Mouse", "quantity": 2, "unitPriceCents": 5000 }]
}'
```

## Como o MongoDB armazena os dados

| Relacional | MongoDB |
|---|---|
| Database | Database |
| Tabela | Collection |
| Linha | Documento (objeto BSON, um JSON binário com mais tipos: `ObjectId`, `Date`, `Decimal128`...) |
| Coluna | Campo |
| Chave primária | `_id` (por padrão um `ObjectId`, que já carrega o timestamp de criação) |
| JOIN | Documento embutido ou `$lookup` |
| `ALTER TABLE` | Não existe. O formato é responsabilidade da aplicação (Mongoose) e, opcionalmente, de um validador `$jsonSchema` na collection. |

Um pedido em `orders` é um único documento, com os itens embutidos:

```js
{
  _id: ObjectId('6b00be361d93441c0ebd7935'),
  customerName: 'Ana',
  customerEmail: 'ana@example.com',
  items: [
    { sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 },
    { sku: 'B7', name: 'Pad', quantity: 1, unitPriceCents: 3000 }
  ],
  totalCents: 13000,
  status: 'PENDING',
  schemaVersion: 1,
  createdAt: ISODate('2026-11-20T21:40:06.482Z'),
  updatedAt: ISODate('2026-11-20T21:40:06.482Z')
}
```

Regra de modelagem: **modele pelo jeito como você lê**. Os itens sempre são lidos com o pedido, então ficam dentro dele: uma leitura, sem JOIN. Dados que crescem sem limite (os pedidos de um cliente) ficam em documentos separados, porque um documento tem limite de 16 MB.

## Como funciona em produção

**Replica set.** Em produção o MongoDB roda com pelo menos 3 nós: um primário recebe as escritas e os secundários replicam pelo oplog. Se o primário cai, uma eleição promove um secundário em segundos. Transações multi-documento só funcionam em replica set, por isso o `docker-compose.yml` sobe um replica set de 1 nó e os testes usam `MongoMemoryReplSet`.

**Write concern e read preference** (configurados em `src/database/database.module.ts`):
- `w: 'majority'`: a escrita só é confirmada depois de chegar à maioria dos nós, então sobrevive a uma troca de primário.
- `readPreference: 'primary'`: lê sempre do primário e vê a escrita mais recente. Ler de secundários alivia o primário, mas pode retornar dados um pouco atrasados.

**Índices** decidem a performance. Sem índice, o MongoDB lê a collection inteira (`COLLSCAN`). Com índice, ele percorre uma árvore B ordenada (`IXSCAN`). Em índices compostos, use a ordem **ESR**: campos de **I**gualdade, depois de **S**ort (ordenação), depois de **R**ange (intervalo).

Veja a diferença com 100 mil pedidos:

```bash
npm run seed -- --count=100000
npm run explain
```

```
paid orders, latest first  find({"status":"PAID"}).sort({"createdAt":-1,"_id":-1}).limit(21)
  with index
    plan:          IXSCAN -> FETCH -> LIMIT
    index:         status_createdAt_id
    docs examined: 21
  forcing collection scan
    plan:          COLLSCAN -> SORT
    docs examined: 100000
```

No shell, o equivalente é:

```js
db.orders.find({ status: 'PAID' }).sort({ createdAt: -1, _id: -1 }).limit(21).explain('executionStats')
```

O que observar: `winningPlan` com `IXSCAN`, nenhum estágio `SORT` (ordenação em memória) e `totalDocsExamined` próximo de `nReturned`.

**Paginação por cursor.** `skip(100000)` obriga o MongoDB a percorrer 100 mil entradas antes de retornar algo. O cursor (`createdAt` + `_id` do último item da página, em base64url) vira um filtro `{ createdAt < x }` que usa o índice diretamente, então toda página custa o mesmo.

**Sharding** divide uma collection entre vários replica sets por uma *shard key*. Só vale a pena com volume muito alto; a escolha da shard key (alta cardinalidade, distribuição uniforme, presente nas consultas) é a decisão mais importante e difícil de mudar.

## Migrations

Não existe `ALTER TABLE`: uma migration é um script que lê documentos e grava documentos. O projeto usa `migrate-mongo`, que registra as migrations aplicadas na collection `changelog`.

```bash
npm run migrate:status
npm run migrate:up
npm run migrate:down
npm run migrate:create -- nome-da-migration
```

| Migration | O que faz |
|---|---|
| `create-orders-indexes` | Cria `orders` e seus índices. Em produção `autoIndex` fica desligado, então índice só nasce por migration. |
| `create-orders-v2-collection` | Cria `orders_v2` com validador `$jsonSchema` (o banco rejeita documentos fora do formato) e índices. |
| `backfill-orders-v2` | Copia e transforma `orders` em `orders_v2` com um aggregation pipeline + `$merge`. |

### `orders` → `orders_v2`

O mesmo pedido no formato v2:

```js
{
  _id: ObjectId('6b00be361d93441c0ebd7935'),
  customer: { name: 'Ana', email: 'ana@example.com' },
  items: [
    { sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000, subtotalCents: 10000 },
    { sku: 'B7', name: 'Pad', quantity: 1, unitPriceCents: 3000, subtotalCents: 3000 }
  ],
  totals: { grossCents: 13000, itemCount: 3 },
  status: 'pending',
  schemaVersion: 2,
  createdAt: ISODate('2026-11-20T21:40:06.482Z'),
  updatedAt: ISODate('2026-11-20T21:40:06.482Z'),
  syncedAt: ISODate('2026-11-20T21:45:00.000Z')
}
```

O `_id` é o mesmo nas duas collections. Isso torna o `$merge` simples (`on: '_id'`, que já tem índice único) e deixa o dual-write idempotente.

Há duas formas de fazer o backfill, e o teste `test/migrations/orders-v2.spec.ts` garante que elas produzem documentos idênticos:

| Estratégia | Onde | Quando usar |
|---|---|---|
| Aggregation + `$merge` | `migrations/*-backfill-orders-v2.ts` | A transformação cabe em operadores de aggregation. Roda inteira no servidor, sem trafegar documentos (cerca de 4 s para 100 mil). |
| Cursor + `bulkWrite` em lotes | `scripts/backfill-orders-v2.ts` | A transformação precisa de lógica em TypeScript ou de chamadas externas. Grava checkpoint e retoma de onde parou (cerca de 8 s para 100 mil). |

As duas mantêm o documento mais novo: se `orders_v2` já tem uma versão com `updatedAt` maior ou igual (escrita pelo dual-write), ela não é sobrescrita.

### Passo a passo da troca sem downtime

1. **Criar a collection nova**: `npm run migrate:up` aplica `create-orders-v2-collection`.
2. **Ligar o dual-write**: `ORDERS_DUAL_WRITE=true`. Toda escrita em `orders` também grava em `orders_v2`, na mesma transação. Se a escrita no v2 falhar, a do v1 é desfeita.
3. **Backfill dos dados antigos**: `npm run migrate:up` aplica `backfill-orders-v2` (ou `npm run backfill:orders-v2` para a versão em lotes).
4. **Validar**: `npm run validate:orders-v2` compara contagem, soma dos valores, contagem por status e procura pedidos ausentes.
   ```
   OK   document count: 100001 vs 100001
   OK   gross amount: 20899826170 vs 20899826170
   OK   count by status: {...} vs {...}
   OK   orders missing in v2: none
   ```
5. **Virar a leitura**: `ORDERS_READ_FROM_V2=true`. A API continua respondendo exatamente o mesmo JSON (o teste e2e compara as respostas), agora vindo de `orders_v2`. Para voltar atrás, basta desligar a flag.
6. **Remover a versão antiga** (quando estiver estável): tornar `orders_v2` a fonte da escrita e apagar `orders` numa migration separada.

O boot recusa `ORDERS_READ_FROM_V2=true` sem `ORDERS_DUAL_WRITE=true`, porque nesse caso as leituras perderiam as escritas novas.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run lint` | oxlint com regras de tipo + verificação de comentários e `enum` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes e2e e de migrations (MongoDB em memória) |
| `npm run seed -- --count=N` | Insere N pedidos aleatórios |
| `npm run explain` | Compara planos de consulta com e sem índice |
| `npm run backfill:orders-v2` | Backfill em lotes com checkpoint |
| `npm run validate:orders-v2` | Valida `orders_v2` contra `orders` |
