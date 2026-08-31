# @sentra/i18n

**Role:** platform core.

## What it does

A minimal translation seam for Vue applications, built on `Intl` rather than a bundled
CLDR dataset. The seam is four members — `locale`, `t`, `n`, and `d` — the same four an
alternative implementation, `vue-i18n` included, would need to provide to sit behind the
injection key `'sentra:i18n'` instead:

- `locale: Ref<string>` — the active locale, mutable so a locale switcher can drive it
  directly (`i18n.locale.value = 'id'`) and have every consumer re-render.
- `t(key, params?)` — looks up `key` in the active locale, falling back to the configured
  fallback locale, then interpolates `{name}` placeholders from `params`.
- `n(value, options?)` — formats a number with `Intl.NumberFormat`.
- `d(value, options?)` — formats a date with `Intl.DateTimeFormat`.

Catalogues (`Messages`, `Catalogue`, `Message`) are plain JSON-shaped objects typed at the
package boundary — a locale's catalogue is a record of message keys to either a string or
a plural message, with no class instances or functions crossing the seam. Plural messages
branch by CLDR plural category (`one`, `few`, `many`, `other`, …), and the branch is
selected by `Intl.PluralRules`, not by a hand-rolled rule per locale. This milestone ships
exactly two locales, `en` and `id`; Indonesian has a single CLDR category (`other`), which
is why `PluralMessage` makes every branch optional rather than requiring `one`.

Nothing in this package throws, with one deliberate exception: `mergeMessages` throws on a
duplicate key within a locale, because a silently overwritten library key — an
accessibility label, say — would be invisible in every visual check. Everywhere else, a
missing key or an unmatched placeholder calls the optional `onMissing` callback and
returns a visible fallback (the raw key) instead of failing the render.

`useI18n()` never throws, even with no i18n installed: it returns `NULL_I18N`, whose `t`
returns the key unchanged (ignoring `params`, never interpolating) and whose `n`/`d`
format with `en`. This is the opposite of `@sentra/plugin-analytics`'s `useAnalytics()`,
which throws — deliberately, because analytics is required infrastructure once installed,
while translation is optional at `@sentra/ui`'s edge: every existing `@sentra/ui` unit
test and Storybook story renders with no i18n installed, and they need to keep working
unmodified.

### What this package explicitly does not do

- No message-extraction tooling (no CLI that scans source for `t()` calls and emits a
  catalogue skeleton).
- No RTL layout support.
- No gender/select message syntax (ICU `{gender, select, ...}` and similar).
- No lazy per-route catalogue splitting — catalogues are loaded whole.

An adopter who needs any of these can place `vue-i18n`, or another implementation, behind
the same `'sentra:i18n'` injection key without touching call sites that only use the four
seam members.

## How to use it

```ts
import { createI18n, i18nPlugin, mergeMessages } from '@sentra/i18n'
import { uiMessages } from '@sentra/ui'
import { appMessages } from './messages.ts'

const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: mergeMessages(uiMessages, appMessages),
  onMissing: (key, locale) => console.warn(`i18n: missing "${key}" for "${locale}"`),
})

app.use(i18nPlugin, i18n)
```

From a component:

```ts
import { useI18n } from '@sentra/i18n'

const i18n = useI18n()
i18n.t('greeting', { name: 'Ada' })
i18n.n(1234.5)
i18n.d(new Date())
```

`mergeMessages(...sources)` unions locales across catalogues and throws if two sources
define the same key in the same locale, which is how a library's catalogue and an
application's catalogue combine safely into one `Messages` object.

## What it depends on

- `vue` — peer dependency (`^3.5.0`), for `Ref`, `inject`/`provide`, and the plugin type.
- No runtime dependencies. Translation, number, and date formatting all come from the
  platform's built-in `Intl`.
