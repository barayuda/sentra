import { inject, type InjectionKey, type Plugin } from 'vue'
import {
  createErrorReporter,
  type CreateErrorReporterOptions,
  type ErrorReporter,
} from './reporter.ts'
import { installErrorSources } from './sources.ts'

/** String-keyed so tests can provide a reporter without importing this instance. */
export const ERRORS_INJECTION_KEY = 'sentra:errors' as unknown as InjectionKey<ErrorReporter>

/**
 * The null object used as the `inject` default.
 *
 * `report` is a no-op and `count` stays 0. This is what lets `useErrors()` be
 * called from a component or story with no `errorsPlugin` installed, without
 * making error reporting mandatory everywhere.
 */
export const NULL_REPORTER: ErrorReporter = {
  report() {
    /* No sink is installed; there is nowhere for this to go. */
  },
  count: 0,
}

/**
 * Vue plugin: `app.use(errorsPlugin, options)` creates the reporter, provides it
 * app-wide, and attaches every capture source.
 *
 * `installErrorSources` is exported separately only so tests can drive the
 * sources without an application.
 */
export const errorsPlugin: Plugin<[CreateErrorReporterOptions]> = {
  install(app, options) {
    const reporter = createErrorReporter(options)
    app.provide(ERRORS_INJECTION_KEY, reporter)
    installErrorSources(app, reporter)
  },
}

/**
 * Returns the app's error reporter, or {@link NULL_REPORTER} when none is
 * installed.
 *
 * Deliberately does not throw: a component or unit test that renders without
 * `errorsPlugin` installed should not fail because of it. The dependency is
 * genuinely optional at the library's edge.
 */
export function useErrors(): ErrorReporter {
  return inject(ERRORS_INJECTION_KEY, NULL_REPORTER)
}
