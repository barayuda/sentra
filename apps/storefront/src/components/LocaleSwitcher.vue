<script setup lang="ts">
import { useI18n } from '@sentra/i18n'
import { Select, type SelectOption } from '@sentra/ui'
import {
  persistLocale,
  syncDocumentLang,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../i18n/locale.ts'

/**
 * Language names shown for each option, in that language's own script.
 *
 * Deliberately not run through `t()`: a language picker conventionally shows
 * each choice in its own language (an autonym) rather than translated into
 * whichever locale currently happens to be active, so a reader who cannot
 * read the current locale can still recognise their own.
 */
const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
}

const OPTIONS: SelectOption[] = SUPPORTED_LOCALES.map((locale) => ({
  value: locale,
  label: LOCALE_LABELS[locale],
}))

const i18n = useI18n()

/** Applies a newly chosen locale everywhere it needs to take effect. */
function onChange(value: string): void {
  const locale = value as SupportedLocale
  i18n.locale.value = locale
  persistLocale(locale)
  syncDocumentLang(locale)
}
</script>

<template>
  <Select
    :model-value="i18n.locale.value"
    :label="i18n.t('storefront.localeSwitcher.label')"
    :options="OPTIONS"
    size="sm"
    @update:model-value="onChange"
  />
</template>
