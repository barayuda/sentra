# @sentra/result

## What it does

`Result<T, E>` — a discriminated union for an operation that is expected to fail
sometimes, used in place of a thrown exception: `{ ok: true; value: T } | { ok: false;
error: E }`. Branching on `ok` is mandatory in a way a `try`/`catch` around a thrown value
never is, and nothing about a thrown value tells a caller what shapes it can take; a
`Result`'s error type is written down.

This convention now lives in its own package, rather than inside one SDK, because by M4
two independent SDKs need the identical shape: `@sentra/sdk-commerce`'s `StorefrontError`
and `@sentra/sdk-ops`'s `OpsError` each declare their own error union with their own
members, but both are built on the same `Result<T, E>` type and the same `ok`/`err`/
`isOk`/`isErr` helpers. `@sentra/shell-contract` also uses it directly, for
`ManifestError`. Extracting the convention once means every consumer's narrowing behaves
identically, and a fix to how the type guards narrow benefits every consumer at once
instead of drifting across independent copies.

## How to use it

```ts
import { err, isErr, isOk, ok, type Result } from '@sentra/result'

function parseCount(input: string): Result<number, string> {
  const value = Number(input)
  return Number.isFinite(value) ? ok(value) : err(`not a number: "${input}"`)
}

const result = parseCount('42')
if (result.ok) {
  console.log(result.value) // narrowed to number
} else {
  console.error(result.error) // narrowed to string
}
```

`isOk`/`isErr` exist so an array of results narrows through `Array.prototype.filter`,
which only applies its narrowing overload to a declared type predicate — an inline arrow
does not narrow the array's element type:

```ts
const results: Result<number, string>[] = [ok(1), err('nope'), ok(2)]
results.filter(isOk).map((result) => result.value) // number[]
```

## What it depends on

Nothing. `package.json` declares no runtime `dependencies` at all — only
`devDependencies` (`@sentra/config`, `typescript`, `vitest`) for building and testing this
package itself. A convention this small, shared by every SDK and by `@sentra/shell-contract`
in the workspace, is the one place a dependency would be pure liability: anything this
package depended on would become a transitive dependency of every consumer at once.
