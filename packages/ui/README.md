# @sentra/ui

## What it does

Vue 3 component library for Sentra. M1 ships four primitives — `Button`, `Input`,
`Select`, `Checkbox` — each with a documented accessibility baseline and a Storybook page.

The primitives were chosen to establish conventions the harder components inherit: prop
naming, size and variant scales, how a label associates with a control, how an error
message reaches assistive technology.

## How to use it

Import the stylesheet once at the application entry, then import components where needed:

```ts
import '@sentra/ui/styles.css'
import { Button } from '@sentra/ui'
```

`vue` is a peer dependency and is left external in the build. The consuming application
supplies it. This is not incidental: M4 loads remotes at runtime across a federation
boundary, and a second bundled Vue would mean a second reactivity system and
`inject()` silently returning `undefined`.

### Layer strategy — why your overrides work

Every component styles itself with Tailwind utility classes, which Tailwind emits inside
`@layer utilities`. CSS gives **unlayered** styles precedence over any layered style
regardless of specificity, so an ordinary rule in your application overrides any Sentra
component without `!important` and without knowing our class names:

```css
.checkout-button {
  background: rebeccapurple;
} /* wins over bg-brand-600 */
```

The constraint this places on this package: we never write unlayered CSS here. Doing so
would outrank your unlayered rules by source order and break the guarantee.

### Accessibility baseline

Storybook runs the a11y addon with violations failing the build, so these are enforced
rather than claimed:

- Every control has a programmatically associated label.
- Hints and errors reach the control through `aria-describedby`.
- Errors carry `role="alert"`.
- Focus rings use `:focus-visible`, so keyboard users see them and mouse users do not.
- `aria-busy` is emitted only when true — a present-but-negative value is noise to a
  screen reader.

## What it depends on

- `vue` — peer dependency, external in the build.
- `@sentra/tokens` — supplies the `@theme` block that Tailwind reads.
- `tailwindcss` — build-time only; no Tailwind runtime ships.
- `@types/react` — devDependency; satisfies a transitive `@mdx-js/react` peer that
  Storybook's MDX tooling declares. No React code ships or is bundled.

### Build-vs-buy policy

Spec §5.2 requires that adopting or declining an existing library be a recorded decision.

**Declined for the primitives.** A production team should reach for PrimeVue or Vuetify
here, and this README would normally say so. This repository writes them because the
component API design _is_ the artifact under review — adopting a library would remove the
thing being demonstrated. That is a deliberate trade, and it is the honest reason.

**Adopted where the problem is solved.** Where a well-tested implementation already
exists, use it and note it here rather than reinventing:

- Focus trapping, scroll locking, and click-outside behaviour (arriving with `Dialog`)
  should come from VueUse. These have long correctness tails — nested traps, iframes,
  restoring focus to a since-unmounted element — and hand-rolling them trades real
  reliability for no gain.
- Currency and locale formatting uses the platform's `Intl.NumberFormat`. A currency
  library would add weight to reimplement what the runtime already ships.
