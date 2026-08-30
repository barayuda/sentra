# @sentra/ui

**Role:** platform core — kept when the reference implementation is removed.

## What it does

Vue 3 component library for Sentra. Each component has a documented accessibility
baseline and a Storybook page, grouped by role:

- **Primitives** — `Button`, `Input`, `Select`, `Checkbox`. Chosen first to establish the
  conventions the harder components inherit: prop naming, size and variant scales, how a
  label associates with a control, how an error message reaches assistive technology.
- **Forms** — `Combobox`. Async options, full keyboard interaction, ARIA correctness
  (`role="combobox"` driving a `role="listbox"` popup via `aria-activedescendant`, so DOM
  focus never leaves the input).
- **Overlays** — `Dialog`. Focus trap, teleport, scroll lock, SSR-safe mounting.
- **Data** — `DataTable`. Virtualised rows, slot-driven extensibility, a typed column API.
- **Feedback** — `Toast`. An imperative API surfaced through a plugin install.
- **Domain** — `Money`, `ProductCard`. Currency and locale formatting, domain composition.
  `ProductCard` accepts an optional `imageSrcset` prop for responsive image candidates,
  paired with `imageSrc` as the fallback source.

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

### Theme and density

Components read colour and spacing from the token custom properties `@sentra/tokens`
generates; none of them branch on a mode prop. Dark mode applies only via
`data-theme="dark"` on the document root element (`<html>`) — the generated override
block is scoped to `:root[data-theme='dark']`, which only ever matches the root, so
setting the attribute on any other ancestor has no effect. Density is not so
restricted: `data-density="compact"` swaps the spacing scale via `[data-density='compact']`,
an ordinary attribute selector that matches on any ancestor, so it may be scoped to any
subtree. Both are plain HTML attributes an application sets, not a Vue prop threaded
through the tree:

```html
<html data-theme="dark" data-density="compact"></html>
```

Storybook's Theme and Density toolbars set these same two attributes on
`document.documentElement`, which is why every story restyles live when you toggle them.

### Motion

Everything that appears and disappears — `Dialog` in both placements, `Combobox`'s
listbox, `ToastHost` — animates from a preset in `src/shared/motion.ts`. A preset is a
plain object of Vue `<Transition>` props, applied with `v-bind`, so no component holds
motion logic of its own:

```vue
<Transition v-bind="POPOVER_MOTION">
  <ul v-if="isOpen" role="listbox">…</ul>
</Transition>
```

No preset writes a millisecond value. Timing comes from `duration-[var(--duration-*)]`
and easing from the `ease-standard` / `ease-enter` / `ease-exit` utilities Tailwind
generates from `@sentra/tokens`. That is what makes the next paragraph work, and
`src/shared/motion.test.ts` fails any preset that opts out by hard-coding a duration or
reaching for a Tailwind built-in curve.

**Reduced motion needs no opt-in.** `@sentra/tokens` redeclares both animated durations
as `0ms` under `@media (prefers-reduced-motion: reduce)`, so a user who asked their
operating system for less motion gets these components with their transitions removed —
not a degraded variant, and not a second code path. One documented gap: Tailwind's
`animate-*` keyframe utilities set their own duration and are not reached by the
override, so `ProductCard`'s `animate-pulse` skeleton keeps pulsing. Both the mechanism
and the gap are recorded in [ADR 0010](../../docs/adr/0010-motion-and-reduced-motion.md).

`Select` is deliberately unanimated: it wraps a native `<select>`, whose dropdown the
browser draws outside the document.

If you write a test that asserts an overlay is gone, wait for the removal
(`waitForElementToBeRemoved`) rather than asserting it synchronously. A dismissal now
outlives the keystroke that triggered it.

### Accessibility baseline

Storybook runs the a11y addon with violations failing the build, so these are enforced
rather than claimed:

- Every control has a programmatically associated label.
- Hints and errors reach the control through `aria-describedby`.
- Errors carry `role="alert"`.
- Focus rings use `:focus-visible`, so keyboard users see them and mouse users do not.
- `aria-busy` is emitted only when true — a present-but-negative value is noise to a
  screen reader.
- Every story's play function and an axe scan run against the built Storybook in a
  dedicated CI job (`test:interactions`) that blocks merge on any violation — the a11y
  addon you see while developing is the live preview, not the whole gate.

## What it depends on

- `vue` — peer dependency, external in the build.
- `@sentra/tokens` — supplies the `@theme` block that Tailwind reads.
- `tailwindcss` — build-time only; no Tailwind runtime ships.
- `@vueuse/core` — `useScrollLock` (`Dialog`'s body scroll lock).
- `@vueuse/integrations` — `useFocusTrap` (`Dialog`'s focus containment), wrapping `focus-trap`.
- `focus-trap` — the focus-containment engine `@vueuse/integrations` wraps.
- `@tanstack/vue-virtual` — `useVirtualizer` (`DataTable`'s row windowing).
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

- **`focus-trap` via `@vueuse/integrations`** (`Dialog`): focus containment has a long
  correctness tail — nested traps, iframes, restoring focus to unmounted elements — and a
  battle-tested implementation beats a hand-rolled one on reliability alone.
- **`useScrollLock` from `@vueuse/core`** (`Dialog`): body scroll locking carries the same
  shape of accumulated edge cases (iOS Safari, scrollbar-width layout shift) as focus
  trapping — same call, use the maintained composable.
- **`@tanstack/vue-virtual`** (`DataTable`): windowing arithmetic (scroll anchoring,
  overscan, dynamic remeasure) is a solved problem; the component's own value is its typed
  column API and slot contract, not a virtualiser rewrite.
- Currency and locale formatting uses the platform's `Intl.NumberFormat`. A currency
  library would add weight to reimplement what the runtime already ships.

Click-outside-to-close on `Dialog` is deliberately hand-rolled rather than adopted: it is
one `@click` handler on the overlay element, kept outside the focus trap's boundary
(`allowOutsideClick: true`) so focus-trap's own outside-click policy does not swallow it.
