import { inject, ref, type InjectionKey, type Plugin } from 'vue'
import type { I18nSource } from './types.ts'

/** String-keyed so tests can provide a source without importing this instance. */
export const I18N_INJECTION_KEY = 'sentra:i18n' as unknown as InjectionKey<I18nSource>

/**
 * The null object used as the `inject` default.
 *
 * `t` returns the key; `n` and `d` format with `en`. This is what lets
 * `@sentra/ui` read translations without making an i18n install mandatory for
 * every existing story and unit test.
 */
export const NULL_I18N: I18nSource = {
  locale: ref('en'),
  t(key) {
    return key
  },
  n(value, options) {
    return new Intl.NumberFormat('en', options).format(value)
  },
  d(value, options) {
    return new Intl.DateTimeFormat('en', options).format(value)
  },
}

/**
 * Vue plugin: `app.use(i18nPlugin, i18n)` provides an existing source app-wide.
 *
 * It takes an instance rather than options — unlike `analyticsPlugin`, which
 * constructs its client — because the application needs to keep the instance to
 * drive `locale.value` from a switcher and to mirror it onto `<html lang>`.
 */
export const i18nPlugin: Plugin<[I18nSource]> = {
  install(app, i18n) {
    app.provide(I18N_INJECTION_KEY, i18n)
  },
}

/**
 * Returns the app's i18n source, or {@link NULL_I18N} when none is installed.
 *
 * Deliberately does not throw, unlike `useAnalytics()`: every `@sentra/ui` unit
 * test and Storybook story renders with no i18n installed, and a throwing
 * `useI18n` would fail all of them. The dependency is genuinely optional at the
 * library's edge, which is the `NULL_BUS` situation, not the analytics one.
 */
export function useI18n(): I18nSource {
  return inject(I18N_INJECTION_KEY, NULL_I18N)
}
