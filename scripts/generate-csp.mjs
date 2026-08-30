#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildCspPolicy, buildCspPolicyForMeta, validateSourceOwners } from './csp.mjs'

/** Repository root, derived from this file's location so cwd does not matter. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The shell's built HTML entry point. */
const HTML_PATH = join(ROOT, 'apps/shell/dist/index.html')
/** The manifest, as copied into the build by Vite's `public/` handling. */
const MANIFEST_PATH = join(ROOT, 'apps/shell/dist/remotes.json')
/** Origins belonging to code inside the remotes. Committed and reviewed. */
const SOURCES_PATH = join(ROOT, 'security/csp-sources.json')
/** Header form, for adopters who serve the app from a real server. */
const HEADERS_PATH = join(ROOT, 'apps/shell/dist/csp-headers.txt')

/**
 * Converts the committed sources file into the shape `buildCspPolicy` takes.
 *
 * The file maps each origin to the reason it is allowed, so that a reviewer
 * reading a diff sees the justification beside the change. The policy builder
 * needs only the origins, and `$comment` is documentation, not a directive.
 *
 * @param {Record<string, unknown>} file - Parsed `csp-sources.json`.
 * @returns {Record<string, string[]>} Directive name to extra sources.
 */
export function toExtraSources(file) {
  return Object.fromEntries(
    Object.entries(file)
      .filter(([name]) => !name.startsWith('$'))
      .map(([name, origins]) => [name, Object.keys(origins)]),
  )
}

/** Matches a previously injected policy so re-running replaces rather than stacks. */
const EXISTING = /\s*<meta http-equiv="Content-Security-Policy"[^>]*>/g

/**
 * Matches a document's charset declaration, in any of HTML's legal spellings:
 * the quoted attribute (`<meta charset="utf-8">`), the unquoted attribute
 * (`<meta charset=utf-8>`, valid HTML5), and the legacy
 * `http-equiv="Content-Type"` form with `charset=` inside its `content`
 * attribute (`<meta http-equiv="Content-Type" content="text/html; charset=utf-8">`).
 * Sentra ships as a base template adopters are expected to hand-edit
 * `index.html` for, so all three are plausible, not merely theoretical.
 */
const CHARSET = new RegExp(
  [
    String.raw`<meta\s+charset=(?:"[^"]*"|'[^']*'|[^\s/>]+)\s*/?>`,
    String.raw`<meta\s+http-equiv=["']?content-type["']?\s+content=["'][^"']*charset=[^"']*["']\s*/?>`,
  ].join('|'),
  'i',
)

/**
 * Injects a policy into a document's `<head>`, immediately after its
 * `<meta charset>` declaration.
 *
 * Must not precede `<meta charset>`: a browser only honours a charset
 * declaration within the first 1024 bytes of the document. This policy's
 * `content` attribute grows with every remote origin and every entry in
 * `security/csp-sources.json` — it is already long, and the design intends
 * adopters to widen it further — so injecting it before `charset` risks
 * pushing `charset` past that boundary on a large enough policy, silently
 * switching the browser to its own encoding detection for the whole document.
 *
 * There is deliberately **no fallback** to first-child-of-`<head>` when no
 * charset declaration is found. A silent fallback here would reproduce, one
 * level down, the exact defect this function exists to fix: a guard whose
 * absence is indistinguishable from its success. A document with no charset
 * declaration at all has undefined encoding no matter where the CSP lands,
 * so a fallback insertion point would not actually fix anything — it would
 * only let a broken template pass through a build that reports success. Do
 * not restore the fallback as a "robustness" improvement; throwing here is
 * the intended behaviour, not a placeholder for one.
 *
 * Still as early as possible otherwise: a policy that arrives after a script
 * has already been parsed does not govern that script.
 *
 * @param {string} html - Document source.
 * @param {string} policy - Policy string.
 * @returns {string} The document with exactly one policy meta tag.
 * @throws {Error} When the document has no `<head>` element.
 * @throws {Error} When the document has no recognisable charset declaration.
 */
export function injectMeta(html, policy) {
  const stripped = html.replace(EXISTING, '')
  if (!stripped.includes('<head>')) {
    throw new Error(`cannot inject CSP: no <head> element found`)
  }
  const charset = stripped.match(CHARSET)
  if (!charset) {
    throw new Error(
      'cannot inject CSP: no <meta charset> declaration found. A document ' +
        'with no charset declaration has undefined encoding no matter where ' +
        'the CSP is inserted, so this refuses rather than guessing an ' +
        'insertion point for a template that is already broken.',
    )
  }
  const escaped = policy.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${escaped}" />`
  return stripped.replace(charset[0], `${charset[0]}\n    ${metaTag}`)
}

/**
 * Generates the shell's CSP from its built manifest and applies it.
 *
 * Runs after the build, against `dist/`, because that is where the manifest
 * the browser will actually fetch lives. Generating from `public/` instead
 * would let a build-time transform of the manifest silently invalidate the
 * policy. Named risk area: content injection.
 *
 * Limitation, confirmed by the Task 1 spike against a real browser: a
 * `<meta>`-delivered policy cannot express `report-uri` or `report-to`, and
 * `frame-ancestors` is **ignored entirely** in meta form — Chrome prints
 * "The Content Security Policy directive 'frame-ancestors' is ignored when
 * delivered via a <meta> element" on every load of a document carrying it
 * there. Because that logged error costs a real CI gate (a zero-console-error
 * smoke check) and buys no protection at all — the browser was never going to
 * honour the directive in meta form — the two delivery forms carry different
 * policy strings: `scripts/csp.mjs`'s `buildCspPolicyForMeta` omits
 * `frame-ancestors`, `report-uri`, and `report-to` (its
 * `META_IGNORED_DIRECTIVES`) from what is injected into `dist/index.html`,
 * while `buildCspPolicy` keeps the full policy, unchanged, for
 * `dist/csp-headers.txt`. An adopter who ships only the meta tag has no
 * clickjacking protection from this policy — that was already true before
 * this split, since the directive was never enforced in meta form; the split
 * only stops the meta tag from claiming a protection it never provided.
 */
async function main() {
  const entries = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'))
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf8'))
  /* Ownership is checked at generation time, not only at strip time. A file
     that reaches a build with an unowned entry is a file the strip could not
     have pruned correctly, and the policy it produces would be wrong in a way
     nothing downstream detects. */
  validateSourceOwners(sources)
  const extra = toExtraSources(sources)
  const headerPolicy = buildCspPolicy(entries, extra)
  const metaPolicy = buildCspPolicyForMeta(entries, extra)

  const html = await readFile(HTML_PATH, 'utf8')
  let injected
  try {
    injected = injectMeta(html, metaPolicy)
  } catch (error) {
    /* `injectMeta` stays file-path-agnostic so it is trivial to unit test;
       the path is attached here, at the one call site that knows it, so a
       failure names the template that needs fixing rather than just the
       generic reason. */
    throw new Error(`${HTML_PATH}: ${error.message}`, { cause: error })
  }
  await writeFile(HTML_PATH, injected)
  await writeFile(HEADERS_PATH, `Content-Security-Policy: ${headerPolicy}\n`)

  console.log(`csp: applied to ${HTML_PATH}`)
  console.log(`csp: header form written to ${HEADERS_PATH}`)
  console.log(`csp: meta form: ${metaPolicy}`)
  console.log(`csp: header form: ${headerPolicy}`)
}

if (process.argv[1]?.endsWith('generate-csp.mjs')) await main()
