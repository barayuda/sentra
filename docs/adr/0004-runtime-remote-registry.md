# ADR 0004 — Runtime remote registry

**Classification: INTERNAL**

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decides:** how `apps/shell` learns which remotes exist and where they live.

## Context

A build-time `remotes` map — `federation({ remotes: { storefront: 'http://...' } })` —
makes every remote addition, removal, or re-pointing a host rebuild and redeploy. That
coupling is exactly what ADR 0001 adopted Module Federation to remove: independent deploy
cadence per remote is the whole premise, and a host that must be rebuilt whenever a
remote's URL changes has not actually bought that.

The alternative is `registerRemotes()` against a manifest fetched at boot: the host ships
once, with an empty remotes map, and learns what to load from a JSON file it fetches at
runtime.

## Decision

`apps/shell/vite.config.ts` sets `remotes: {}` — deliberately empty, not a placeholder
left by an unfinished config. `apps/shell/public/remotes.json` is fetched at boot,
validated by `@sentra/shell-contract`'s `parseRemoteManifest`, and each entry that parses
is passed to `registerRemotes(entries, { force: true })`, then loaded with
`loadRemote('<name>/remote')`. `apps/shell/src/registry/boot.ts` runs this sequence in
full before the shell's own `App` is mounted.

## The spike's findings

Task 1 built a throwaway host/remote pair outside `packages/*`/`apps/*` specifically to
answer six questions before any of this was built for real. The spike code is gone; these
are its findings, not predictions this ADR is making on paper.

1. **Runtime registration works — but only with `type: 'module'`.** The literal
   `registerRemotes([{ name, entry }])` call failed with
   `[ Federation Runtime ]: Failed to get remoteEntry exports. #RUNTIME-001` and a browser
   console error reading `Cannot use import statement outside a module`. The cause:
   `@module-federation/sdk`'s script loader defaults a remote entry to a classic
   `<script>`, while `@module-federation/vite` only ever emits an ES module. Adding
   `type: 'module'` to the registration payload — a documented field of the same API —
   produced the expected result. This is the single most useful thing the spike bought:
   the symptom names neither modules nor script types, so finding it inside a half-built
   shell would have cost hours instead of one spike run.
2. **A build-time `remotes: {}` is legal and does not block runtime registration.** The
   host built and ran with an empty map.
3. **An unknown remote rejects rather than hanging** — effectively instantly, well inside
   the "a few seconds" an error boundary would need to assume.
4. **`build.target: 'chrome89'` sufficed.** No raising of the build target was needed; the
   going-in assumption that top-level await would force a newer target did not
   materialise. This is a spike finding about what was *sufficient*, not a requirement
   carried into the shipped config — see Consequences below.
5. **Dev-mode remote serving works**, so remotes need not be pre-built for the shell to
   load them. One sharp edge: a remote package with no `tsconfig.json` does not degrade,
   it crashes its own dev server outright, through an uncaught exception in the
   federation DTS plugin's background worker. Every real remote on this platform already
   ships a `tsconfig.json`, so this is a footnote rather than a constraint — see
   `apps/shell/README.md`'s Troubleshooting section, because the crash names neither
   federation nor the missing file in a way that is obvious at 9am.
6. **`dts` generation works and is not worth its cost.** It emitted correct `.d.ts` output
   for the exposed module, but spent the overwhelming majority of a short build doing it
   for one trivial function, and logged a `rootDir` warning from inside its own scratch
   directory. This confirms the decision already taken: `dts: false` in every container's
   federation config, because remotes typecheck against `@sentra/shell-contract`'s
   hand-written `RemoteModule` and nothing downstream reads generated federation types.

Finding 1 is the one with teeth, and it is why `type: 'module'` is hardcoded at the
`registerRemotes` call site in `boot.ts` rather than threaded through as a `remotes.json`
field: every remote on this platform is Vite-built and therefore always a module, and
`remotes.json` is the one file advertised as hand-editable in a deployed `dist/`. A field
that never varies, placed in a file humans edit by hand, is a way to reproduce
`RUNTIME-001` and nothing else.

## Consequences

**What this buys:** repointing a remote is a JSON edit to the host's own static assets —
no shell rebuild, no shell redeploy. A malformed manifest, or one that cannot be fetched
at all, degrades to a shell with chrome and no remotes rather than a blank page:
`apps/shell/src/registry/boot.ts` treats manifest failure as recoverable and a single bad
entry as droppable without discarding the entries that did parse.

**What this costs:** the manifest becomes a security boundary. It names URLs the host
will fetch and execute code from, so this is a supply-chain control, not a formatting
one — `parseRemoteManifest` (`packages/shell-contract/src/manifest.ts`) allow-lists
`entry` to `http:`/`https:` only and rejects anything else (`entryUrlProblem`), and
requires `basePath` to be a genuine, non-root, non-wildcard mount point
(`basePathProblem`). Named risk area: supply chain.

**What the shipped config deliberately does not do:** neither `apps/shell/vite.config.ts`
nor either remote's config sets a `build.target` override. The Task 1 spike found
`chrome89` sufficient, but that was a finding about the spike's own scaffold, not an
instruction to raise the shipped target — the host must not compile to a different
syntax level than the remotes it loads at runtime, and since no remote here sets a
`target` either, the host leaves its own unset too. Raising one side without the other
would be exactly the kind of skew this ADR exists to avoid.

## Alternatives not taken

- **Build-time `remotes` map:** simplest, and it is what a fresh
  `@module-federation/vite` scaffold defaults to — but it re-couples every remote change
  to a host rebuild, which is the ADR 0001 premise this design exists to satisfy.
- **A remote registry service instead of a static JSON file:** would let the manifest be
  updated without touching the host's deployed assets at all, but M4 has one host and two
  remotes; a service is complexity this milestone does not need yet.
