# @sentra/tokens

**Role:** platform core — kept when the reference implementation is removed.

## What it does

Holds the design tokens as a typed TypeScript object and **generates** CSS from them. The
generation step is the point: a token is edited in one place, and both the CSS custom
properties and the Tailwind utility classes follow from that edit.

Output is one file, `dist/tokens.css`. The light-mode values render as separate blocks:

- `@theme` — tokens in a namespace Tailwind recognises (`color`, `spacing`, `radius`,
  `ease`, and so on). Tailwind derives utility classes from these, so `--color-brand-600`
  produces `bg-brand-600` and `--ease-enter` produces `ease-enter`.
- `:root` — everything else (`duration`, `zIndex`). Valid custom properties, but Tailwind
  has no namespace for them, so they are consumed as `var(--duration-fast)`.

Which block a token lands in is decided by its top-level key, and getting it wrong is
silent: both blocks are valid CSS, and the only symptom of a misrouted token is a utility
class that never gets generated. `packages/tokens/src/tokens.test.ts` asserts the routing
per block rather than per file, so a token in the wrong place fails there instead of in a
browser.

Beyond those two, the file emits three mode override blocks — `:root[data-theme='dark']`,
`[data-density='compact']`, and `@media (prefers-reduced-motion: reduce)` — that redeclare
the same custom properties with mode-specific values. This restyles the whole system
without Tailwind's involvement: every generated utility already references `var(--...)`,
so redefining the property under a mode selector is enough; components need no change to
react to it. A `@custom-variant dark` declaration is also emitted, for consumers who prefer
writing explicit `dark:` utilities of their own against the same `[data-theme=dark]`
attribute. See `packages/ui/README.md`'s "Theme and density" section for how an
application opts in.

The reduced-motion block is emitted **last**, and that ordering is load-bearing rather
than stylistic: all the override blocks target custom properties at equal specificity, so
source order is the only thing that makes a user's operating-system preference outrank
dark mode and compact density. It collapses `--duration-fast` and `--duration-normal` to
`0ms`, which removes every transition in the platform — and in consumer code following the
same convention — without a single component branching on the preference. The limits of
that mechanism are recorded in [ADR 0010](../../docs/adr/0010-motion-and-reduced-motion.md).

## How to use it

Consume the generated stylesheet:

```css
@import '@sentra/tokens/tokens.css';
```

Or read the values in TypeScript, which is how non-CSS consumers (a Shopify Liquid theme
generator, a transactional email template) share one palette:

```ts
import { tokens } from '@sentra/tokens'
```

`dist/tokens.css` is generated and git-ignored. Run `pnpm --filter @sentra/tokens build`
before anything that imports it — `@sentra/ui` will fail to build otherwise.

## What it depends on

Nothing at runtime. The build script (`scripts/build-css.ts`) runs on Node with no
third-party runtime dependency — `@types/node` is a devDependency, but it supplies only
ambient type declarations for the build script and contributes no code to anything that
ships. The package also deliberately does not depend on Tailwind: it emits CSS that
Tailwind understands without importing Tailwind itself.
