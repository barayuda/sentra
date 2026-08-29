# @sentra/sdk-ops

## What it does

A typed client for the console's ops backend — orders and feature flags — mock-first via
MSW, in the same shape as `@sentra/sdk-commerce`: every operation returns a
`Result<T, OpsError>`, never a thrown value, and `OpsError` branches on `kind`.

`OpsError` (`packages/sdk-ops/src/errors.ts:19-23`) and `sdk-commerce`'s `StorefrontError`
(`packages/sdk-commerce/src/errors.ts`) share a **convention**, not a taxonomy: both are
four-arm discriminated unions, reviewed and documented to agree on shape, not derived
from a common base class or interface that either extends.

| `OpsError`                                                          | `StorefrontError`                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `network` — no usable response arrived, or the server itself failed | `network` — no usable response arrived, or the server itself failed |
| `auth` — the token was missing, rejected, or insufficient           | `throttled` — Shopify's cost budget is exhausted                    |
| `validation` — the server rejected the input, naming the field      | `graphql_user` — Shopify rejected the request on business grounds   |
| `schema` — the response didn't match the declared types             | `schema` — the response didn't match the generated types            |

Only `network` and `schema` are shared arms; `auth`/`validation` (a REST service behind
bearer-token authorization) have no equivalent in `throttled`/`graphql_user` (a
cost-throttled GraphQL API with mutation-level `userErrors`), because the two backends
fail in genuinely different ways. What travels between the two SDKs is the shape of the
answer — branch on `kind`, never on message text, since message text belongs to whichever
backend wrote it — not the specific arms.

`OpsMockScenario` (`src/mocks/handlers.ts`) is a separate thing entirely: it is the mock
layer's own **scenario name** (`'ok' | 'network' | 'auth' | 'validation' | 'schema_drift'`),
selecting which behaviour the MSW handlers produce for a given request. `'schema_drift'`
is a scenario that _produces_ a response matching `OpsError`'s `schema` arm — by omitting
a field the types declare non-nullable — but it is not itself a member of `OpsError`; the
two are structurally unrelated unions that happen to use similar words for related ideas.

## How to use it

```ts
import { createOpsClient, isRetryable } from '@sentra/sdk-ops'

const client = createOpsClient({ baseUrl: 'https://ops.example', token: apiToken })

const result = await client.listOrders({ limit: 20 })
if (result.ok) {
  console.log(result.value.orders.length)
} else {
  console.error(result.error.kind, result.error.message)
  if (isRetryable(result.error)) {
    /* back off and retry */
  }
}
```

Mocks, for a dev server or a test, from the `./mocks` subpath:

```ts
import { createOpsHandlers, createOpsMockControl } from '@sentra/sdk-ops/mocks'

const control = createOpsMockControl() // { scenario: 'ok', latencyMs: 0 }
const handlers = createOpsHandlers(control)
// control.scenario = 'validation' — flips every handler's behaviour live
```

## What it depends on

`@sentra/result`, as a runtime dependency, for the same `Result<T, E>` shape
`@sentra/sdk-commerce` builds on (see `packages/result/README.md`). `msw` is a
devDependency, not a runtime one — the mock handlers ship as source under `./mocks` for a
consumer's own `setupWorker`/`setupServer`, the same shape `@sentra/sdk-commerce/mocks`
uses.
