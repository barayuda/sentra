import type { App } from 'vue'
import type { ErrorReporter } from './reporter.ts'

/**
 * Attaches every capture path and returns a teardown function.
 *
 * The `securitypolicyviolation` listener is the reason this package earns its
 * place. The shell delivers its CSP as a `<meta http-equiv>` tag, and
 * `scripts/csp.mjs` strips `report-uri` and `report-to` from that form because
 * browsers ignore them there — so a document-level listener is the only channel
 * by which this application can learn about a violation in a real user's
 * browser. `apps/shell/e2e/csp.spec.ts` already trusts this event as an oracle
 * at test time; this generalises it to runtime.
 *
 * @param app - The Vue application whose `errorHandler` is claimed.
 * @param reporter - Where captured errors go.
 * @returns A function removing every listener installed here.
 */
export function installErrorSources(app: App, reporter: ErrorReporter): () => void {
  app.config.errorHandler = (error) => {
    reporter.report(error, undefined, 'vue')
  }

  const onError = (event: Event) => {
    const { error, message } = event as ErrorEvent
    reporter.report(error ?? message ?? 'unknown window error', undefined, 'window')
  }

  const onRejection = (event: Event) => {
    const { reason } = event as PromiseRejectionEvent
    reporter.report(reason ?? 'unknown rejection', undefined, 'unhandledrejection')
  }

  const onViolation = (event: Event) => {
    const violation = event as SecurityPolicyViolationEvent
    reporter.report(`CSP violation: ${violation.violatedDirective}`, undefined, 'csp', {
      directive: violation.violatedDirective,
      blockedUri: violation.blockedURI,
    })
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  document.addEventListener('securitypolicyviolation', onViolation)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    document.removeEventListener('securitypolicyviolation', onViolation)
    app.config.errorHandler = undefined
  }
}
