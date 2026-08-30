import { describe, expect, it } from 'vitest'
import { parseAuditOutput, reconcile } from './check-audit.mjs'

const TODAY = new Date('2026-08-30T00:00:00Z')

/** @type {{id: string, module: string, severity: string, title: string}} */
const ADVISORY = {
  id: 'EXAMPLE-0001',
  module: 'example-lib',
  severity: 'high',
  title: 'Example advisory used only in tests',
}

describe('reconcile', () => {
  it('passes when there are no advisories and no allowlist entries', () => {
    expect(reconcile([], [], TODAY)).toEqual({ failures: [], accepted: [] })
  })

  it('fails an advisory that is not allowlisted', () => {
    const { failures } = reconcile([ADVISORY], [], TODAY)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('EXAMPLE-0001')
    expect(failures[0]).toContain('example-lib')
  })

  it('accepts an advisory whose allowlist entry has not expired', () => {
    const allowlist = [
      { id: 'EXAMPLE-0001', module: 'example-lib', reason: 'test', expires: '2026-12-31' },
    ]
    const { failures, accepted } = reconcile([ADVISORY], allowlist, TODAY)
    expect(failures).toEqual([])
    expect(accepted).toEqual(['EXAMPLE-0001'])
  })

  it('fails an allowlist entry whose expiry has passed, even when the advisory is gone', () => {
    const allowlist = [
      { id: 'EXAMPLE-0001', module: 'example-lib', reason: 'test', expires: '2026-01-01' },
    ]
    const { failures } = reconcile([], allowlist, TODAY)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('expired')
  })

  it('treats the expiry date itself as still valid', () => {
    const allowlist = [
      { id: 'EXAMPLE-0001', module: 'example-lib', reason: 'test', expires: '2026-08-30' },
    ]
    expect(reconcile([ADVISORY], allowlist, TODAY).failures).toEqual([])
  })

  it('does not let an entry for one module cover the same id in another', () => {
    const allowlist = [
      { id: 'EXAMPLE-0001', module: 'other-lib', reason: 'test', expires: '2026-12-31' },
    ]
    expect(reconcile([ADVISORY], allowlist, TODAY).failures).toHaveLength(1)
  })

  it('rejects an entry with a malformed expiry', () => {
    const allowlist = [
      { id: 'EXAMPLE-0001', module: 'example-lib', reason: 'test', expires: 'soon' },
    ]
    const { failures } = reconcile([ADVISORY], allowlist, TODAY)
    expect(failures.some((f) => f.includes('malformed'))).toBe(true)
  })

  it('rejects an entry with an empty reason', () => {
    const allowlist = [
      { id: 'EXAMPLE-0001', module: 'example-lib', reason: '   ', expires: '2026-12-31' },
    ]
    const { failures } = reconcile([ADVISORY], allowlist, TODAY)
    expect(failures.some((f) => f.includes('reason'))).toBe(true)
  })
})

describe('parseAuditOutput', () => {
  it('reads a blocking advisory out of a recognised report', () => {
    const stdout = JSON.stringify({
      advisories: {
        1: {
          github_advisory_id: 'EXAMPLE-0001',
          module_name: 'example-lib',
          severity: 'high',
          title: 'Example advisory used only in tests',
        },
      },
    })
    const result = parseAuditOutput(stdout)
    expect(result.recognized).toBe(true)
    expect(result.advisories).toEqual([
      {
        id: 'EXAMPLE-0001',
        module: 'example-lib',
        severity: 'high',
        title: 'Example advisory used only in tests',
      },
    ])
  })

  it('drops advisories below the blocking severity', () => {
    const stdout = JSON.stringify({
      advisories: {
        1: { id: 'EXAMPLE-0002', module_name: 'example-lib', severity: 'moderate', title: 'x' },
      },
    })
    const result = parseAuditOutput(stdout)
    expect(result.recognized).toBe(true)
    expect(result.advisories).toEqual([])
  })

  it('recognises an empty container as a genuinely clean report', () => {
    const result = parseAuditOutput(JSON.stringify({ advisories: {} }))
    expect(result.recognized).toBe(true)
    expect(result.advisories).toEqual([])
  })

  it('refuses output that is not JSON', () => {
    const result = parseAuditOutput('ELIFECYCLE  Command failed.')
    expect(result.recognized).toBe(false)
    expect(result.advisories).toEqual([])
  })

  it('refuses JSON with no advisory container', () => {
    const result = parseAuditOutput(JSON.stringify({ metadata: { totalDependencies: 900 } }))
    expect(result.recognized).toBe(false)
    expect(result.reason).toContain('no known advisory container')
  })

  /* The case that motivates the whole verdict return: a counts summary sitting
     under a container name. A parser that only filtered on severity would read
     this as "zero blocking advisories" and pass a build it never checked. */
  it('refuses a container holding a counts summary rather than advisories', () => {
    const stdout = JSON.stringify({ vulnerabilities: { high: 2, critical: 1, moderate: 0 } })
    const result = parseAuditOutput(stdout)
    expect(result.recognized).toBe(false)
    expect(result.reason).toContain('severity')
  })

  /* Pinned to a real `pnpm audit --json` run on this repo (pnpm 10.34.5, Step
     3b), not to a format borrowed from another tool. The advisory below is a
     genuine, publicly disclosed one this repo's registry returned at the time
     of observation; its severity was "moderate" in that report, which is
     below this gate's blocking threshold, so it must recognise the report but
     report zero blocking advisories. Extra fields the real report carries
     (cves, cvss, findings, ...) must not confuse recognition. */
  it('recognises the shape actually emitted by pnpm audit --json on this repo (pnpm 10.34.5)', () => {
    const stdout = JSON.stringify({
      actions: [],
      advisories: {
        1119441: {
          github_advisory_id: 'GHSA-w5hq-g745-h8pq',
          module_name: 'uuid',
          severity: 'moderate',
          title: 'uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided',
          id: 1119441,
          cves: ['CVE-2026-41907'],
          cvss: { score: 7.5, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N' },
          findings: [{ version: '8.3.2', paths: ['...'] }],
        },
      },
      metadata: {
        dependencies: 1267,
        devDependencies: 0,
        optionalDependencies: 0,
        totalDependencies: 1267,
        vulnerabilities: { critical: 0, high: 0, info: 0, low: 0, moderate: 1 },
      },
      muted: [],
    })
    const result = parseAuditOutput(stdout)
    expect(result.recognized).toBe(true)
    expect(result.advisories).toEqual([])
  })
})
