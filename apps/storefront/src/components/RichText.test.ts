/**
 * `sanitizeProductHtml` refuses to run under happy-dom — its self-test detects
 * that happy-dom's DOMPurify support is a silent no-op (see
 * `packages/sdk-commerce/src/sanitize.ts`) and fails closed rather than risk
 * rendering unsanitised HTML. This is the storefront suite's default
 * environment, so this file opts into jsdom specifically, mirroring
 * `packages/sdk-commerce/src/sanitize.test.ts`.
 *
 * @vitest-environment jsdom
 */
import type { UnsafeHtml } from '@sentra/sdk-commerce'
import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import RichText from './RichText.vue'

/** Brands a raw string for the prop without importing the SDK helper. */
const raw = (value: string) => value as UnsafeHtml

describe('RichText', () => {
  it('renders allowed formatting as real elements', () => {
    const { container } = render(RichText, {
      props: { html: raw('<p>Thrown by <strong>hand</strong>.</p>') },
    })
    expect(container.querySelector('strong')?.textContent).toBe('hand')
  })

  it('does not render a script element from merchant HTML', () => {
    const { container } = render(RichText, {
      props: { html: raw('<p>Hi</p><script>window.pwned = true</script>') },
    })
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('Hi')
  })

  it('strips inline event handlers', () => {
    const { container } = render(RichText, {
      props: { html: raw('<img src="x" onerror="window.pwned = true">') },
    })
    expect(container.querySelector('img')?.hasAttribute('onerror')).toBe(false)
  })

  it('strips javascript: links', () => {
    const { container } = render(RichText, {
      props: { html: raw('<a href="javascript:alert(1)">Care</a>') },
    })
    expect(container.innerHTML).not.toContain('javascript:')
  })

  it('re-sanitises when the html prop changes', async () => {
    const { container, rerender } = render(RichText, { props: { html: raw('<p>First</p>') } })
    await rerender({ html: raw('<p>Second</p><script>x()</script>') })
    expect(container.textContent).toContain('Second')
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders nothing for an empty description', () => {
    const { container } = render(RichText, { props: { html: raw('') } })
    expect(container.querySelector('[data-testid="rich-text"]')?.innerHTML).toBe('')
  })
})
