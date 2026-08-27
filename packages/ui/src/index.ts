/**
 * Public entry point for `@sentra/ui`.
 *
 * Consumers must additionally import `@sentra/ui/styles.css` once at application
 * root; components carry no bundled styles of their own.
 */
export { default as Button } from './components/Button/Button.vue'
export { buttonClasses } from './components/Button/variants.ts'
export type { Variant } from './components/Button/variants.ts'
export { default as Input } from './components/Input/Input.vue'
export { FIELD_CLASSES, FOCUS_CLASSES, SIZE_CLASSES } from './shared/controls.ts'
export type { Size } from './shared/controls.ts'
