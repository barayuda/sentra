import DOMPurify from 'dompurify'
import type { SafeHtml, UnsafeHtml } from './types.ts'

/**
 * The sanitisation boundary for merchant-authored HTML.
 *
 * This is a real vulnerability class, not a hypothetical. `Product.
 * descriptionHtml` is authored in the Shopify admin by whoever has a merchant
 * account — which in a multi-vendor or agency-managed store is not the same
 * trust domain as the storefront's own developers. Rendering it directly is
 * stored XSS: the payload lives in the merchant's data, executes in every
 * visitor's session, and inherits the origin's cookies and tokens.
 *
 * The design choices behind this module:
 *
 * 1. **Allowlist, never denylist.** Enumerating dangerous tags loses to the
 *    next HTML feature; enumerating the handful of formatting tags a product
 *    description legitimately needs does not.
 * 2. **DOMPurify, not a regex.** HTML parsing is adversarial — mutation XSS
 *    exploits the gap between what a regex thinks it read and what the browser
 *    parser actually builds. DOMPurify sanitises the parsed tree, using the
 *    same parser the browser will.
 * 3. **A type boundary, not a convention.** {@link UnsafeHtml} cannot be passed
 *    where {@link SafeHtml} is required, so the compiler enforces that every
 *    path from the API to the DOM runs through this function.
 * 4. **A DOM is required, and not every DOM will do.** `DOMPurify.isSupported`
 *    is not evidence that sanitisation works: measured with dompurify@3.4.14,
 *    happy-dom reports `isSupported: true` while passing every payload through
 *    untouched. The unit tests therefore run under jsdom, and the real proof is
 *    the Playwright assertion in a real browser.
 */

/** Formatting tags a product description may use. */
export const SANITIZE_ALLOWED_TAGS: readonly string[] = [
  'p',
  'br',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]

/**
 * Attributes that survive sanitisation.
 *
 * `style` is deliberately absent: a merchant-supplied `style` can position an
 * element over the page and turn a description into a clickjacking surface,
 * which no amount of tag filtering prevents.
 */
export const SANITIZE_ALLOWED_ATTR: readonly string[] = [
  'href',
  'title',
  'target',
  'rel',
  'src',
  'alt',
  'width',
  'height',
  'colspan',
  'rowspan',
]

/**
 * Forces `rel="noopener noreferrer"` on links that open a new context.
 *
 * Without `noopener`, the opened page receives a `window.opener` handle to this
 * one and can navigate it — reverse tabnabbing, which turns a benign outbound
 * link in a description into a credential-phishing vector.
 *
 * Safe by construction: the input has already been sanitised, and assigning to
 * a detached `<template>`'s `innerHTML` never executes script.
 *
 * @param html - Already-sanitised HTML.
 */
function hardenLinks(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  for (const anchor of template.content.querySelectorAll('a[target]')) {
    anchor.setAttribute('rel', 'noopener noreferrer')
  }
  return template.innerHTML
}

/**
 * A payload every working sanitiser must neutralise.
 *
 * Multi-root by necessity, not by style. Measured against dompurify@3.4.14:
 * under happy-dom, every SINGLE-root payload — a lone `<script>`, a lone
 * `<iframe>`, a lone `javascript:` href, a lone inline handler — is stripped
 * correctly, and only a payload with more than one root node exposes the
 * failure. A single-element probe therefore reports health in precisely the
 * environment that is broken. It also carries two markers, one requiring node
 * removal and one requiring attribute removal, so a partial failure cannot
 * slip through either.
 */
export const SELF_TEST_PROBE = '<p>a</p><script>1</script><img src=x onerror=1>'

/** Set once the environment has been proven to sanitise. */
let sanitiserVerified = false

/**
 * Verifies DOMPurify actually works in this environment, once per process.
 *
 * `DOMPurify.isSupported` is NOT sufficient evidence: measured with
 * dompurify@3.4.14 under happy-dom, `isSupported` is `true` while every
 * payload — script elements, inline handlers, `javascript:` URLs, iframes —
 * passes through completely untouched. A silent no-op in the only control
 * standing between merchant-authored HTML and the DOM is the worst failure
 * this module can have, so it refuses to run rather than pass content through
 * unchecked. Failing closed shows the reader an error state; failing open
 * shows them someone else's script.
 *
 * @throws When the environment's DOM cannot support sanitisation.
 */
function assertSanitiserWorks(): void {
  if (sanitiserVerified) return
  const probe = String(
    DOMPurify.sanitize(SELF_TEST_PROBE, { ALLOWED_TAGS: ['p', 'img'], ALLOWED_ATTR: ['src'] }),
  )
  if (probe.includes('<script') || probe.includes('onerror')) {
    throw new Error(
      'sanitizeProductHtml: DOMPurify is not sanitising in this environment. ' +
        'Refusing to render merchant-authored HTML. Note that DOMPurify.isSupported ' +
        'can report true while sanitisation silently no-ops (observed with happy-dom).',
    )
  }
  sanitiserVerified = true
}

/**
 * Sanitises merchant-authored HTML for rendering.
 *
 * Requires a DOM. That is a deliberate constraint rather than an oversight: the
 * only correct way to sanitise HTML is with a real parser, so this function
 * belongs to the browser half of the SDK. Server-side rendering would supply a
 * DOM implementation the same way the tests do.
 *
 * @param html - Raw HTML from the Storefront API.
 * @returns HTML safe to render, branded so the type system can tell.
 */
export function sanitizeProductHtml(html: UnsafeHtml): SafeHtml {
  assertSanitiserWorks()
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...SANITIZE_ALLOWED_TAGS],
    ALLOWED_ATTR: [...SANITIZE_ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    /* Return a string, not a DOM node — the caller renders it. */
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    /* KEEP_CONTENT is left at DOMPurify's default (true) deliberately, even
       though "drop the contents of removed elements" sounds like it wants
       false. It doesn't: 'script', 'style', 'iframe' and the rest of
       DOMPurify's built-in FORBID_CONTENTS set already have their content
       dropped unconditionally, regardless of KEEP_CONTENT — a stripped
       <script>'s text can never survive as visible page copy either way.
       What KEEP_CONTENT:false actually changes is unrelated: DOMPurify only
       adds '#text' to its internal tag allowlist "in case KEEP_CONTENT is
       set to true" (dompurify's own source comment), so setting it false
       deletes every text node in the document, not just removed elements'.
       Measured directly against dompurify@3.4.14: with KEEP_CONTENT:false,
       sanitising '<p>Hi</p>' alone returns '<p></p>'. */
  })
  return hardenLinks(sanitized) as SafeHtml
}
