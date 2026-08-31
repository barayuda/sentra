export { createI18n } from './core.ts'
export { mergeMessages } from './merge.ts'
export type {
  Catalogue,
  CreateI18nOptions,
  I18nSource,
  Message,
  Messages,
  PluralMessage,
  TranslateParams,
} from './types.ts'
export { I18N_INJECTION_KEY, NULL_I18N, i18nPlugin, useI18n } from './vue.ts'
