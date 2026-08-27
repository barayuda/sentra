/**
 * A single choice in a {@link Select}.
 *
 * Declared in its own module because `<script setup>` cannot export types, and
 * consumers building option lists need this shape.
 */
export interface SelectOption {
  /** Value submitted and compared against `modelValue`. */
  readonly value: string
  /** Human-readable text shown to the user. */
  readonly label: string
  /**
   * Whether this individual choice is unavailable.
   *
   * @defaultValue `false`
   */
  readonly disabled?: boolean
}
