/**
 * @sentra/plugin-errors — closed-shape, allowlist-only error reporting for
 * Vue applications. Install with `app.use(errorsPlugin, { sink })`.
 */
export {
  sanitizeUrl,
  redact,
  fingerprintOf,
  type ErrorKind,
  type ErrorReport,
  type ErrorSink,
} from './report.ts'
export {
  createErrorReporter,
  type CreateErrorReporterOptions,
  type ErrorReporter,
} from './reporter.ts'
export { installErrorSources } from './sources.ts'
export { consoleSink, beaconSink } from './sinks.ts'
export { errorsPlugin, useErrors, ERRORS_INJECTION_KEY, NULL_REPORTER } from './vue.ts'
