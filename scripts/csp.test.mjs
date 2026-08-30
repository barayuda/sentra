import { describe, expect, it } from 'vitest'
import {
  buildCspPolicy,
  remoteOrigins,
  validateExtraSources,
  validateSourceOwners,
} from './csp.mjs'
import { injectMeta, toExtraSources } from './generate-csp.mjs'
import { pruneCspSources } from './strip-reference.mjs'

const ENTRIES = [
  { name: 'storefront', entry: 'http://127.0.0.1:4173/remoteEntry.js', basePath: '/shop' },
  { name: 'console', entry: 'http://127.0.0.1:4174/remoteEntry.js', basePath: '/ops' },
]

const EXTRA = {
  'connect-src': ['https://demo-shop.myshopify.com'],
  'img-src': ['https://cdn.shopify.com'],
}

describe('remoteOrigins', () => {
  it('reduces entry URLs to origins', () => {
    expect(remoteOrigins(ENTRIES)).toEqual(['http://127.0.0.1:4173', 'http://127.0.0.1:4174'])
  })

  it('collapses two remotes served from one origin', () => {
    expect(
      remoteOrigins([
        { name: 'a', entry: 'https://cdn.example/a/remoteEntry.js', basePath: '/a' },
        { name: 'b', entry: 'https://cdn.example/b/remoteEntry.js', basePath: '/b' },
      ]),
    ).toEqual(['https://cdn.example'])
  })

  it('skips an entry whose URL does not parse rather than emitting a broken source', () => {
    expect(remoteOrigins([{ name: 'a', entry: 'not a url', basePath: '/a' }])).toEqual([])
  })

  it('returns nothing for an empty manifest', () => {
    expect(remoteOrigins([])).toEqual([])
  })
})

describe('validateExtraSources', () => {
  it('accepts explicit https origins on a widenable directive', () => {
    expect(() => validateExtraSources(EXTRA)).not.toThrow()
  })

  it('refuses to widen script-src, whatever the file says', () => {
    expect(() => validateExtraSources({ 'script-src': ['https://evil.example'] })).toThrow(
      /script-src/,
    )
  })

  it('refuses a wildcard', () => {
    expect(() => validateExtraSources({ 'connect-src': ['*'] })).toThrow(/wildcard/)
    expect(() => validateExtraSources({ 'connect-src': ['https://*.example'] })).toThrow(/wildcard/)
  })

  it('refuses a bare scheme source that would allow every host on it', () => {
    expect(() => validateExtraSources({ 'connect-src': ['https:'] })).toThrow(/origin/)
  })

  it('refuses a plaintext origin that is not loopback', () => {
    expect(() => validateExtraSources({ 'img-src': ['http://cdn.example'] })).toThrow(/https/)
    expect(() => validateExtraSources({ 'img-src': ['http://127.0.0.1:4173'] })).not.toThrow()
  })

  it('refuses a source carrying a path, which CSP would silently reinterpret', () => {
    expect(() => validateExtraSources({ 'img-src': ['https://cdn.example/files'] })).toThrow(
      /origin/,
    )
  })
})

describe('validateSourceOwners', () => {
  /** A minimal well-formed file, reused so each test varies exactly one thing. */
  const wellFormed = () => ({
    $comment: 'ignored',
    'connect-src': {
      'https://api.example': { owner: 'platform', reason: 'Platform telemetry endpoint.' },
      'https://shop.example': { owner: 'reference', reason: 'Storefront commerce API.' },
    },
  })

  it('accepts a file where every entry declares a known owner and a reason', () => {
    expect(() => validateSourceOwners(wellFormed())).not.toThrow()
  })

  it('ignores $-prefixed metadata keys', () => {
    expect(() =>
      validateSourceOwners({ $comment: 'no owner here', $schema: './x.md' }),
    ).not.toThrow()
  })

  it('refuses an entry with no owner rather than assuming one', () => {
    const file = wellFormed()
    delete file['connect-src']['https://api.example'].owner
    expect(() => validateSourceOwners(file)).toThrow(/owner/)
  })

  it('refuses an unrecognised owner', () => {
    const file = wellFormed()
    file['connect-src']['https://api.example'].owner = 'shared'
    expect(() => validateSourceOwners(file)).toThrow(/platform, reference/)
  })

  it('refuses a bare string entry, the pre-owner file format', () => {
    expect(() =>
      validateSourceOwners({ 'connect-src': { 'https://api.example': 'just a reason' } }),
    ).toThrow(/owner and reason/)
  })

  it('refuses an empty reason', () => {
    const file = wellFormed()
    file['connect-src']['https://api.example'].reason = '   '
    expect(() => validateSourceOwners(file)).toThrow(/reason/)
  })

  it('refuses a non-widenable directive even when every entry is otherwise well-formed', () => {
    expect(() =>
      validateSourceOwners({
        'script-src': { 'https://evil.example': { owner: 'platform', reason: 'x' } },
      }),
    ).toThrow(/script-src/)
  })
})

describe('buildCspPolicy', () => {
  it('allows script and connect from every remote origin', () => {
    const policy = buildCspPolicy(ENTRIES, {})
    expect(policy).toContain("script-src 'self' http://127.0.0.1:4173 http://127.0.0.1:4174")
    expect(policy).toContain("connect-src 'self' http://127.0.0.1:4173 http://127.0.0.1:4174")
  })

  it('allows styles from every remote origin, because federated CSS is cross-origin', () => {
    expect(buildCspPolicy(ENTRIES, {})).toContain(
      "style-src 'self' http://127.0.0.1:4173 http://127.0.0.1:4174",
    )
  })

  it("does not weaken style-src with 'unsafe-inline'", () => {
    expect(buildCspPolicy(ENTRIES, {})).not.toContain("'unsafe-inline'")
  })

  it('unions the extra sources into the directives that declare them', () => {
    const policy = buildCspPolicy(ENTRIES, EXTRA)
    expect(policy).toContain('connect-src')
    expect(policy).toMatch(/connect-src[^;]*https:\/\/demo-shop\.myshopify\.com/)
    expect(policy).toMatch(/img-src[^;]*https:\/\/cdn\.shopify\.com/)
  })

  it('leaves a directive the extra sources do not mention untouched', () => {
    expect(buildCspPolicy(ENTRIES, EXTRA)).toMatch(/img-src 'self' data: https:\/\/cdn\.shopify/)
    expect(buildCspPolicy(ENTRIES, {})).toMatch(/img-src 'self' data:;/)
  })

  it('locks down the directives that never need a remote origin', () => {
    const policy = buildCspPolicy(ENTRIES, {})
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("base-uri 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
  })

  it('emits a self-only script-src when there are no remotes', () => {
    expect(buildCspPolicy([], {})).toContain("script-src 'self'")
    expect(buildCspPolicy([], {})).not.toContain('http://')
  })

  it('never contains a semicolon-separated empty directive', () => {
    expect(
      buildCspPolicy([], {})
        .split(';')
        .map((part) => part.trim()),
    ).not.toContain('')
  })

  it('rejects extra sources rather than emitting a policy built from them', () => {
    expect(() => buildCspPolicy(ENTRIES, { 'script-src': ['https://evil.example'] })).toThrow()
  })

  it('is unaffected by a directive that extra sources emptied out during a strip', () => {
    const policy = buildCspPolicy([], { 'img-src': [] })
    expect(policy).toMatch(/img-src 'self' data:(;|$)/)
    expect(policy.split(';').map((part) => part.trim())).not.toContain('')
  })
})

describe('pruneCspSources', () => {
  const file = () => ({
    $comment: 'kept as documentation',
    'connect-src': {
      'https://api.example': { owner: 'platform', reason: 'Platform telemetry.' },
      'https://shop.example': { owner: 'reference', reason: 'Storefront commerce API.' },
    },
    'img-src': {
      'https://cdn.example': { owner: 'reference', reason: 'Product images.' },
    },
  })

  it('removes reference-owned origins and keeps platform-owned ones', () => {
    const pruned = pruneCspSources(file())
    expect(Object.keys(pruned['connect-src'])).toEqual(['https://api.example'])
  })

  it('leaves a directive that loses every origin as an empty record', () => {
    expect(pruneCspSources(file())['img-src']).toEqual({})
  })

  it('preserves $-prefixed metadata', () => {
    expect(pruneCspSources(file()).$comment).toBe('kept as documentation')
  })

  it('is a no-op on a file with no reference entries', () => {
    const platformOnly = {
      'connect-src': { 'https://api.example': { owner: 'platform', reason: 'x' } },
    }
    expect(pruneCspSources(platformOnly)).toEqual(platformOnly)
  })
})

describe('injectMeta', () => {
  const HTML = '<!doctype html>\n<html>\n  <head>\n    <title>Sentra</title>\n  </head>\n</html>\n'

  it('inserts the policy as the first element in head', () => {
    const out = injectMeta(HTML, "default-src 'self'")
    expect(out).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'" />`,
    )
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<title>'))
  })

  it('replaces an existing policy rather than adding a second one', () => {
    const once = injectMeta(HTML, "default-src 'self'")
    const twice = injectMeta(once, "default-src 'none'")
    expect(twice.match(/Content-Security-Policy/g)).toHaveLength(1)
    expect(twice).toContain("default-src 'none'")
  })

  it('throws when the document has no head element', () => {
    expect(() => injectMeta('<html></html>', "default-src 'self'")).toThrow(/head/)
  })

  it('escapes a double quote in the policy so the attribute cannot be broken out of', () => {
    expect(injectMeta(HTML, 'x "y')).toContain('x &quot;y')
  })

  /* The ampersand must be escaped before the quote. Reverse the two lines in
     `injectMeta` and `"` becomes `&quot;` and then `&amp;quot;`, which renders
     as the literal text `&quot;` instead of a quote — a corruption no
     quote-only test can see. */
  it('escapes the ampersand first, so an escaped quote is not double-escaped', () => {
    expect(injectMeta(HTML, 'a & b')).toContain('a &amp; b')
    expect(injectMeta(HTML, 'x "y')).not.toContain('&amp;quot;')
  })

  /* A `<meta charset>` declaration is only honoured within the document's
     first 1024 bytes. This policy grows with every remote origin and every
     csp-sources.json entry, so injecting it before charset risks pushing
     charset past that boundary on a large enough policy — silently switching
     the browser to its own encoding detection for the whole document. */
  it('inserts the policy after an existing meta charset, not before it', () => {
    const withCharset =
      '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <title>Sentra</title>\n  </head>\n</html>\n'
    const out = injectMeta(withCharset, "default-src 'self'")
    expect(out.indexOf('charset')).toBeLessThan(out.indexOf('Content-Security-Policy'))
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<title>'))
  })

  it('re-running against a charset document still replaces rather than stacks', () => {
    const withCharset =
      '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <title>Sentra</title>\n  </head>\n</html>\n'
    const once = injectMeta(withCharset, "default-src 'self'")
    const twice = injectMeta(once, "default-src 'none'")
    expect(twice.match(/Content-Security-Policy/g)).toHaveLength(1)
    expect(twice.indexOf('charset')).toBeLessThan(twice.indexOf('Content-Security-Policy'))
  })
})

describe('toExtraSources', () => {
  it('reduces each origin record to its origin key', () => {
    expect(
      toExtraSources({
        'connect-src': { 'https://api.example': { owner: 'platform', reason: 'x' } },
      }),
    ).toEqual({ 'connect-src': ['https://api.example'] })
  })

  /* `$comment` is documentation. Leaking it through would hand
     `validateExtraSources` a directive named `$comment`, which it refuses —
     failing the build with an error that describes the wrong problem. */
  it('drops $-prefixed metadata rather than passing it off as a directive', () => {
    expect(toExtraSources({ $comment: 'docs', 'img-src': {} })).toEqual({ 'img-src': [] })
  })
})
