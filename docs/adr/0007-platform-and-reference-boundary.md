# ADR 0007 — Platform and reference boundary

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decides:** which workspace members are the base platform an adopter keeps and which
  are the reference implementation an adopter deletes, how that split is declared and
  checked, and what proves it is real rather than asserted.

## Context

Sentra ships as a base starter platform *plus* a working reference implementation —
`apps/storefront`'s commerce flow and `apps/console`'s ops screens exist to prove the
platform works, not because every adopter wants a storefront and an ops console. The
proposal's premise depends on a specific, falsifiable claim: an adopter can delete the
reference half and keep a platform that still builds, typechecks, lints, tests, and boots
in a real browser. M4 shipped one undifferentiated tree with no such boundary. M5 has to
draw the line and prove it holds under deletion, not merely describe it in prose.

## Decision

Every workspace member declares `sentra.role` in its own `package.json`, one of `platform`
or `reference`. Eleven members exist today:

| Member | Directory | Role |
| --- | --- | --- |
| `@sentra/shell` | `apps/shell` | platform |
| `@sentra/storefront` | `apps/storefront` | reference |
| `@sentra/console` | `apps/console` | reference |
| `@sentra/ui` | `packages/ui` | platform |
| `@sentra/tokens` | `packages/tokens` | platform |
| `@sentra/result` | `packages/result` | platform |
| `@sentra/config` | `packages/config` | platform |
| `@sentra/shell-contract` | `packages/shell-contract` | platform |
| `@sentra/plugin-analytics` | `packages/plugin-analytics` | platform |
| `@sentra/sdk-commerce` | `packages/sdk-commerce` | reference |
| `@sentra/sdk-ops` | `packages/sdk-ops` | reference |

Seven platform members, four reference members. `scripts/workspace.mjs` reads every
directory under `packages/*` and `apps/*`, reads each one's `sentra.role`, and fails the
build (`pnpm verify:roles`, wired into the `platform-only` CI job as "Check every member
declares a role", run *before* the strip) if any member's role is missing or not one of
the two recognised values, or if no member at all is `platform`.

## Why the role lives in `package.json`, not a central list

The alternative is a single manifest somewhere — `sentra.config.js`, a `platform-members`
array in the root `package.json` — naming every platform and reference package in one
place. That is a second place to forget: a new package is created, its role is decided in
someone's head, and the central list is not updated because updating it is a separate
step from creating the package. Declaring the role inside the package's own
`package.json` means the fact and the thing it describes live in the same file; there is
no second artifact that can drift out of sync with the workspace it describes.

## Why a missing role is a failure, not a default

`scripts/workspace.mjs`'s `roleProblems` treats an absent `sentra.role` as an error, never
as an implicit default in either direction. Defaulting to `platform` means a new reference
package silently joins the boundary that `strip-reference.mjs` is supposed to delete, and
the delete path quietly stops deleting it — the platform grows reference code nobody
intended to ship as a template. Defaulting to `reference` means a new platform package
gets deleted by every adopter who runs the strip, and the base template silently loses a
piece of itself the day someone forgets one line. Both defaults are wrong in the direction
that matters for that kind of package, so there is no default: a member with no role fails
the build with its own name and directory named in the error, which costs the one line
that was skipped, not a shipped mistake discovered later.

## The `platform-only` job, and what it proves

`.github/workflows/ci.yml`'s `platform-only` job runs on every push and pull request. It
does not check that a strip *would* work — it actually deletes the reference
implementation and rebuilds:

1. `node scripts/workspace.mjs --check` — every member has a valid role, checked before
   the manifests that carry those roles are destroyed.
2. `node scripts/strip-reference.mjs` — deletes every `reference`-role member, prunes the
   remote manifest and `security/csp-sources.json` of reference-owned entries, and removes
   the reference-owned docs and Lighthouse config named in the root manifest.
3. `pnpm install --no-frozen-lockfile` — the one job allowed to relax the frozen-lockfile
   rule every other job enforces, because deleting workspace members necessarily changes
   the lockfile.
4. `VITE_SENTRA_MOCKS=true pnpm build`, `pnpm verify:lighthouse` (the platform Lighthouse
   budget — see ADR 0009), `pnpm typecheck`, `pnpm lint`, `pnpm test` — the platform must
   still pass every gate the full tree passes.
5. `pnpm --filter @sentra/shell e2e:platform-only` — a Playwright smoke check that the
   stripped shell actually boots in a real browser. This step exists because everything
   above it proves the stripped tree *compiles*; none of it loads a page. A runtime-only
   module-resolution defect (see below) shipped through every static check in this job
   before this step was added.

The job's own comment states the stakes plainly: "a base template whose examples cannot
be removed cleanly is not a template — it is a fork you inherit." This job is what keeps
that claim continuously true, on every push, rather than true once in a throwaway clone
that nobody re-runs.

## What actually had to be severed (Task 3)

The boundary was not free. Before the strip could work, `apps/shell` — a `platform`
member — held two kinds of dependency on `reference`-role packages that would break the
moment those packages left disk:

1. **`workspace:*` resolution at install time.** `apps/shell`'s `package.json` listed
   `@sentra/console`, `@sentra/sdk-commerce`, `@sentra/sdk-ops`, and `@sentra/storefront`
   as ordinary `dependencies`/`devDependencies`. pnpm does not tolerate a `workspace:*`
   dependency whose target does not exist in the workspace under either of those fields.
   Fixed by moving all four to `optionalDependencies`, which pnpm does tolerate when the
   target is absent.
2. **Bundler-time static resolution at build time.** `apps/shell/src/mocks/browser.ts`
   holds top-level static imports of `@sentra/sdk-commerce/mocks` and
   `@sentra/sdk-ops/mocks`, because Module Federation's one-Service-Worker-per-page
   constraint means the shell, not each remote, must own the aggregated mock worker.
   Rolldown resolves static imports eagerly, before any runtime `mocksEnabled()` gate ever
   runs, so a platform-only build reaching this module failed even though nothing in
   `build`, `typecheck`, `lint`, or `test` actually executes it at runtime. Fixed with a
   `hasReferenceSdks` existence check in `apps/shell/vite.config.ts` that externalises
   both specifiers only when the reference packages are physically absent, plus a
   companion ambient `.d.ts` (`apps/shell/src/mocks/reference-sdks.d.ts`) giving `vue-tsc`
   fallback types for the same two specifiers. Verified in both directions: a full-tree
   `typecheck` resolves the real modules, not the ambient stand-ins, and a stripped-tree
   `typecheck` succeeds without them.

This list is the evidence the boundary is real rather than a naming convention: these are
the concrete places where the platform's own code depended on the reference half, found
only by actually running the delete path against a real clone, not by inspecting the
dependency graph on paper.

## Ambiguity is resolved by making the platform generic, never by reclassifying

Both fixes above followed one rule, stated during the same task: *make the platform
generic; never reclassify a package to dodge the work.* `apps/shell` is unambiguously
`platform` — it is the host every adopter keeps. The dependencies above being on
`reference`-role packages was the actual defect, and the fix available by that rule was
never "reclassify `@sentra/sdk-commerce` as `platform`" (which would keep reference-app
plumbing in every adopter's base) or "reclassify `apps/shell` as `reference`" (which is
absurd on its face). The only fix consistent with the roles as declared was to make the
platform member itself tolerant of the reference member's absence — `optionalDependencies`
plus an existence check — which is what "generic" means in practice: code that does not
assume the thing it is generic over is present.

## Consequences

**What this buys:** a single, cheap, machine-checked fact — a string in a `package.json`
— that both drives an actual deletion (`strip-reference.mjs`) and is verified by every CI
run (`platform-only`) to still produce a working platform. The boundary cannot silently
rot, because rot is exactly what the job would catch.

**What this costs:** every new workspace member must declare a role before it typechecks
into the build (`verify:roles` runs standalone and in `platform-only`), and any platform
code that reaches into a reference package — however incidentally — has to be found and
made conditional, as Task 3 found for `apps/shell`. That is real, occasionally
non-obvious, engineering work that a boundary drawn only in documentation would never
surface.

## Alternatives not taken

- **A central `platform-members` / `reference-members` list.** Rejected for the reason
  above: it is a second place to forget, and the whole point of the boundary is that it
  cannot be forgotten silently.
- **Defaulting an undeclared role to `platform` or `reference`.** Rejected because every
  sensible default is wrong for one of the two roles, as described above; failing loudly
  costs one line and catches the mistake at the point it is made.
- **Trusting the dependency graph without an executed strip.** A `platform-only` job that
  only inspected `package.json` dependency edges for reference-role references would have
  missed the bundler-time static-import defect entirely — Rolldown's eager resolution is
  not visible in a dependency-graph read, only in an actual build against a tree with the
  reference packages physically deleted.
