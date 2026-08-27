/**
 * A terminal token value. Numbers are permitted for ergonomics (durations,
 * z-index layers) and are stringified during flattening.
 */
export type TokenValue = string | number

/**
 * An arbitrarily nested tree of design tokens.
 *
 * Nesting depth is not constrained: each level contributes one hyphen-separated
 * segment to the generated custom property name.
 */
export interface TokenTree {
  readonly [key: string]: TokenValue | TokenTree
}

/**
 * A single generated CSS custom property.
 */
export interface CssVariable {
  /** Full property name including the leading double hyphen, e.g. `--color-brand-500`. */
  readonly name: string
  /** Stringified value, ready to emit verbatim into a CSS declaration. */
  readonly value: string
}

/**
 * Converts a camelCase or PascalCase key to kebab-case.
 *
 * Purely numeric keys (`'500'`) pass through unchanged, which is what makes
 * colour scales expressible as object keys.
 *
 * @param key - A single token tree key.
 * @returns The kebab-case form.
 */
function toKebabCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Flattens a nested token tree into a list of CSS custom properties.
 *
 * This is the single transformation between the authored token source and every
 * downstream artifact, which is why it is a pure function with no filesystem or
 * CSS knowledge — {@link CssVariable} consumers decide how to render it.
 *
 * Output order follows `Object.entries` traversal order, making generation
 * deterministic so the emitted CSS produces stable diffs.
 *
 * @param tree - The token tree to flatten.
 * @returns One {@link CssVariable} per leaf value, in traversal order.
 *
 * @example
 * ```ts
 * flattenTokens({ color: { brand: { 500: '#0ea5e9' } } })
 * // => [{ name: '--color-brand-500', value: '#0ea5e9' }]
 * ```
 */
export function flattenTokens(tree: TokenTree): CssVariable[] {
  const variables: CssVariable[] = []

  const walk = (node: TokenTree, path: readonly string[]): void => {
    for (const [key, value] of Object.entries(node)) {
      const segments = [...path, toKebabCase(key)]
      if (typeof value === 'object') {
        walk(value, segments)
      } else {
        variables.push({ name: `--${segments.join('-')}`, value: String(value) })
      }
    }
  }

  walk(tree, [])
  return variables
}
