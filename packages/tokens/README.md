# @sentra/tokens

**Role:** platform core — kept when the reference implementation is removed.

## What it does

Holds the design tokens as a typed TypeScript object and **generates** CSS from them. The
generation step is the point: a token is edited in one place, and both the CSS custom
properties and the Tailwind utility classes follow from that edit.

Output is one file, `dist/tokens.css`. The light-mode values render as two blocks:

- `@theme` — tokens in a namespace Tailwind recognises (`color`, `spacing`, `radius`,
  and so on). Tailwind derives utility classes from these, so `--color-brand-600`
  produces `bg-brand-600`.
- `:root` — everything else (`duration`, `zIndex`). Valid custom properties, but Tailwind
  has no namespace for them, so they are consumed as `var(--duration-fast)`.

Beyond those two, the file also emits two mode override blocks — `:root[data-theme='dark']`
and `[data-density='compact']` — that redeclare the same custom properties with
mode-specific values. This restyles the whole system without Tailwind's involvement: every
generated utility already references `var(--...)`, so redefining the property under a mode
selector is enough; components need no change to react to it. A `@custom-variant dark`
declaration is also emitted, for consumers who prefer writing explicit `dark:` utilities
of their own against the same `[data-theme=dark]` attribute. See `packages/ui/README.md`'s
"Theme and density" section for how an application opts in.

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
