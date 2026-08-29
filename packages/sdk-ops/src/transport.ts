import { err, ok } from '@sentra/result'
import {
  authError,
  isRetryable,
  networkError,
  schemaError,
  validationError,
  type OpsError,
  type OpsResult,
} from './errors.ts'

/** Configuration for {@link createOpsTransport}. */
export interface OpsTransportOptions {
  /** Base URL with no trailing slash, e.g. `https://ops.sentra.test/api/v1`. */
  readonly baseUrl: string
  /** Bearer token. In this project always a mock placeholder. */
  readonly token: string
  /**
   * Per-attempt timeout.
   *
   * @defaultValue `8000`
   */
  readonly timeoutMs?: number
  /**
   * Total attempts, including the first. `1` disables retrying.
   *
   * @defaultValue `3`
   */
  readonly maxAttempts?: number
  /**
   * `fetch` implementation. Injected so tests never touch the network.
   *
   * @defaultValue `globalThis.fetch`
   */
  readonly fetchImpl?: typeof fetch
  /**
   * Delay between retries. Injected so tests assert the retry count without
   * waiting for real backoff.
   *
   * @defaultValue a real `setTimeout` wrapper
   */
  readonly sleep?: (ms: number) => Promise<void>
}

/** Executes JSON requests against one Ops API base URL. */
export interface OpsTransport {
  /**
   * Sends one request.
   *
   * @typeParam T - Expected response shape. The transport does not verify it;
   *   that is the operations layer's job, which is where `schema` errors for
   *   *content* are raised. The transport raises `schema` only when the body
   *   is not JSON at all.
   * @param method - HTTP method.
   * @param path - Path appended to `baseUrl`, starting with `/`.
   * @param body - Optional JSON body.
   */
  request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<OpsResult<T>>
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 300
const BACKOFF_CEILING_MS = 2_400

/** Shape the Ops API uses for every non-2xx body. */
interface ErrorBody {
  readonly message?: string
  readonly field?: string
}

/**
 * Exponential backoff for attempt `n`.
 *
 * @param attempt - 1-based number of the attempt that just failed.
 */
export function retryDelayMs(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CEILING_MS)
}

/** Real sleep, used when the caller does not inject one. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates a transport bound to one base URL and token.
 *
 * Everything network-shaped lives here — timeout, retry, status mapping — so
 * an operation is only ever a path plus a mapping function. Same split as
 * `@sentra/sdk-commerce`, reached independently for a different protocol,
 * which is the evidence D11 wanted.
 *
 * @param options - See {@link OpsTransportOptions}.
 */
export function createOpsTransport(options: OpsTransportOptions): OpsTransport {
  const {
    baseUrl,
    token,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    fetchImpl = globalThis.fetch,
    sleep = defaultSleep,
  } = options

  /**
   * Strips the token from any text about to become an error message.
   *
   * An upstream service that echoes the credential back — some do, in
   * "invalid token: <value>" form — would otherwise put it into a toast, a
   * console line, and an analytics payload. Named risk area: secrets
   * management.
   */
  function redact(text: string): string {
    return token === '' ? text : text.split(token).join('[redacted]')
  }

  async function request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<OpsResult<T>> {
    let lastError: OpsError = networkError('request was never attempted', null)

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let response: Response
      let rawBody: string
      try {
        response = await fetchImpl(`${baseUrl}${path}`, {
          method,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        })
        /* The timer stays armed through the body read, not only until headers
           arrive: a server that sends headers then stalls mid-body would
           otherwise defeat `timeoutMs` entirely. */
        rawBody = await response.text()
      } catch (cause) {
        const aborted = cause instanceof Error && cause.name === 'AbortError'
        const message = aborted
          ? `request timed out after ${timeoutMs}ms`
          : cause instanceof Error
            ? cause.message
            : 'unknown transport failure'
        lastError = networkError(redact(message), null)
        if (attempt < maxAttempts) {
          await sleep(retryDelayMs(attempt))
          continue
        }
        return err(lastError)
      } finally {
        clearTimeout(timer)
      }

      let parsed: unknown = null
      let parseFailed = false
      try {
        parsed = rawBody === '' ? null : JSON.parse(rawBody)
      } catch {
        parseFailed = true
      }

      if (response.status === 401 || response.status === 403) {
        const message =
          (parsed as ErrorBody | null)?.message ?? `request refused (${response.status})`
        return err(authError(redact(message)))
      }

      if (response.status === 422) {
        const errorBody = parsed as ErrorBody | null
        return err(
          validationError(
            redact(errorBody?.message ?? 'the request was rejected'),
            errorBody?.field ?? '',
          ),
        )
      }

      if (response.status >= 500) {
        lastError = networkError(`upstream responded ${response.status}`, response.status)
        if (isRetryable(lastError) && attempt < maxAttempts) {
          await sleep(retryDelayMs(attempt))
          continue
        }
        return err(lastError)
      }

      if (!response.ok) {
        /* Understood and refused — retrying cannot change the answer. */
        return err(networkError(`upstream responded ${response.status}`, response.status))
      }

      if (parseFailed) return err(schemaError('response body was not valid JSON', '$'))
      if (parsed === null) return err(schemaError('response contained no body', '$'))
      return ok(parsed as T)
    }

    return err(lastError)
  }

  return { request }
}
