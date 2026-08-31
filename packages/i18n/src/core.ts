import { ref } from 'vue'
import type {
  CreateI18nOptions,
  I18nSource,
  Message,
  PluralMessage,
  TranslateParams,
} from './types.ts'

/** Matches `{name}` placeholders. */
const PLACEHOLDER = /\{(\w+)\}/g

/**
 * Creates an i18n source.
 *
 * Nothing here throws. A missing key or an unmatched placeholder produces a
 * visible artefact and an `onMissing` report, because a raw key rendered in the
 * UI is a strictly better outcome than a white screen.
 */
export function createI18n(options: CreateI18nOptions): I18nSource {
  const locale = ref(options.locale)
  const onMissing = options.onMissing ?? (() => undefined)

  /*
   * `Intl` constructors are expensive relative to a render, and `n`/`d` are
   * called from templates. Cache by locale plus the option shape.
   */
  const numberFormats = new Map<string, Intl.NumberFormat>()
  const dateFormats = new Map<string, Intl.DateTimeFormat>()
  const pluralRules = new Map<string, Intl.PluralRules>()

  /** Active locale first, then the fallback. */
  function lookup(key: string): Message | undefined {
    return options.messages[locale.value]?.[key] ?? options.messages[options.fallbackLocale]?.[key]
  }

  /** Selects a plural branch, falling back to `other`. */
  function selectPlural(message: PluralMessage, params?: TranslateParams): string | undefined {
    if (params?.count === undefined) return message.other
    let rules = pluralRules.get(locale.value)
    if (!rules) {
      rules = new Intl.PluralRules(locale.value)
      pluralRules.set(locale.value, rules)
    }
    return message[rules.select(Number(params.count))] ?? message.other
  }

  /** Substitutes `{name}` from `params`, reporting any it cannot fill. */
  function interpolate(template: string, key: string, params?: TranslateParams): string {
    return template.replace(PLACEHOLDER, (match, name: string) => {
      const value = params?.[name]
      if (value === undefined) {
        onMissing(`${key}:${name}`, locale.value)
        return match
      }
      return String(value)
    })
  }

  return {
    locale,

    t(key, params) {
      const message = lookup(key)
      if (message === undefined) {
        onMissing(key, locale.value)
        return key
      }
      const template = typeof message === 'string' ? message : selectPlural(message, params)
      if (template === undefined) {
        onMissing(key, locale.value)
        return key
      }
      return interpolate(template, key, params)
    },

    n(value, formatOptions) {
      const cacheKey = `${locale.value}:${JSON.stringify(formatOptions ?? {})}`
      let formatter = numberFormats.get(cacheKey)
      if (!formatter) {
        formatter = new Intl.NumberFormat(locale.value, formatOptions)
        numberFormats.set(cacheKey, formatter)
      }
      return formatter.format(value)
    },

    d(value, formatOptions) {
      const cacheKey = `${locale.value}:${JSON.stringify(formatOptions ?? {})}`
      let formatter = dateFormats.get(cacheKey)
      if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale.value, formatOptions)
        dateFormats.set(cacheKey, formatter)
      }
      return formatter.format(value)
    },
  }
}
