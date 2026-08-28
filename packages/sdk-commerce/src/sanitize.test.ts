/**
 * @vitest-environment jsdom
 *
 * NOT happy-dom. Measured on 2026-08-28 with dompurify@3.4.14: under happy-dom
 * every payload in this file survives sanitisation untouched while
 * `DOMPurify.isSupported` still reports `true`. jsdom is the DOM implementation
 * DOMPurify's own test suite targets, and it neutralises all of them.
 */
import { describe, expect, it } from 'vitest'
import { SELF_TEST_PROBE, sanitizeProductHtml } from './sanitize.ts'
import { asUnsafeHtml } from './types.ts'

/** Sanitises a raw string, handling the branding for brevity. */
function clean(raw: string): string {
  return sanitizeProductHtml(asUnsafeHtml(raw))
}

describe('sanitizeProductHtml', () => {
  it('preserves the formatting merchants actually use', () => {
    const raw =
      '<p>Thrown by <strong>hand</strong> in <em>Bandung</em>.</p><ul><li>Dishwasher safe</li></ul>'
    expect(clean(raw)).toBe(raw)
  })

  it('preserves links and their href', () => {
    expect(clean('<a href="https://example.com/care">Care guide</a>')).toContain(
      'href="https://example.com/care"',
    )
  })

  it('removes script elements entirely', () => {
    expect(clean('<p>Hi</p><script>fetch("/steal")</script>')).toBe('<p>Hi</p>')
  })

  it('removes inline event handlers', () => {
    const result = clean('<img src="x" onerror="alert(document.cookie)">')
    expect(result).not.toContain('onerror')
  })

  it('removes javascript: URLs', () => {
    const result = clean('<a href="javascript:alert(1)">Click</a>')
    expect(result).not.toContain('javascript:')
  })

  it('removes iframes', () => {
    expect(clean('<iframe src="https://evil.example"></iframe>')).toBe('')
  })

  it('removes style attributes, which can be used to overlay the page', () => {
    const result = clean('<p style="position:fixed;inset:0">Gotcha</p>')
    expect(result).not.toContain('style')
    expect(result).toContain('Gotcha')
  })

  it('removes form controls', () => {
    const result = clean('<form action="https://evil.example"><input name="card"></form>')
    expect(result).not.toContain('<form')
    expect(result).not.toContain('<input')
  })

  it('hardens target-blank links against reverse tabnabbing', () => {
    const result = clean('<a href="https://example.com" target="_blank">Docs</a>')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it('leaves links without target untouched by the rel hardening', () => {
    expect(clean('<a href="https://example.com">Docs</a>')).not.toContain('rel=')
  })

  it('is idempotent on already-sanitised output', () => {
    const once = clean('<p>Thrown by <strong>hand</strong>.</p><script>x()</script>')
    expect(clean(once)).toBe(once)
  })

  it('handles an empty description', () => {
    expect(clean('')).toBe('')
  })

  it('survives malformed markup without throwing', () => {
    expect(() => clean('<p>unclosed <strong>bold')).not.toThrow()
  })

  it('runs its environment self-test without throwing under a working DOM', () => {
    expect(() => clean('<p>ok</p>')).not.toThrow()
  })

  it('uses a self-test probe that a broken DOM would actually fail', () => {
    /**
     * Guards the guard. The probe must be multi-root: measured against
     * dompurify@3.4.14, happy-dom sanitises every single-root payload correctly
     * and only leaks with more than one root node, so a single-element probe
     * would report health in exactly the environment that is broken.
     */
    const roots = SELF_TEST_PROBE.match(/<[a-z]/g) ?? []
    expect(roots.length).toBeGreaterThan(1)
    expect(SELF_TEST_PROBE).toContain('<script')
    expect(SELF_TEST_PROBE).toContain('onerror')
  })
})
