import {
  isRetryable,
  networkError,
  schemaError,
  throttledError,
  type RequestCost,
  type StorefrontError,
  type StorefrontResult,
  type ThrottleStatus,
} from './errors.ts'
import { err, ok } from './result.ts'

/** Configuration for {@link createStorefrontTransport}. */
export interface StorefrontTransportOptions {
  /** Full GraphQL endpoint URL. */
  readonly endpoint: string
  /** Public Storefront API access token. */
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
   * `fetch` implementation. Injected so tests never touch the network and so a
   * host application can supply an instrumented fetch.
   *
   * @defaultValue `globalThis.fetch`
   */
  readonly fetchImpl?: typeof fetch
  /**
   * Delay function used between retries. Injected so tests assert the computed
   * delays without waiting for them — the alternative is fake timers fighting
   * an async retry loop.
   *
   * @defaultValue a real `setTimeout` wrapper
   */
  readonly sleep?: (ms: number) => Promise<void>
  /** Called once per response that reported `extensions.cost`. */
  readonly onCost?: (cost: RequestCost) => void
}

/** Executes GraphQL documents against one Storefront endpoint. */
export interface StorefrontTransport {
  /**
   * Sends one document.
   *
   * @typeParam TData - Expected shape of `data`; supplied by the caller from
   *   the generated types. The transport does not verify it — that is the
   *   operations layer's job, and where `SchemaError` is raised from.
   */
  request<TData>(
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<StorefrontResult<TData>>
}

/** Shape of a GraphQL-over-HTTP response body. */
interface GraphQLBody<TData> {
  readonly data?: TData | null
  readonly errors?: readonly { message?: string; extensions?: { code?: string } }[]
  readonly extensions?: { cost?: Partial<RequestCost> }
}

/** HTTP status Shopify uses for cost-based throttling, alongside 429. */
const THROTTLED_STATUSES = new Set([429, 430])

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 500
const BACKOFF_CEILING_MS = 4_000

/**
 * How long to wait before the next attempt.
 *
 * Two strategies, whichever is longer. Exponential backoff handles ordinary
 * transient failures. When Shopify has told us the cost budget is short, the
 * arithmetic answer is better than a guess: the deficit divided by the restore
 * rate is exactly how long until the request can afford to run. Waiting less
 * guarantees another throttle; waiting a blind fixed interval is either
 * needlessly slow or uselessly fast.
 *
 * @param attempt - 1-based number of the attempt that just failed.
 * @param throttleStatus - Budget state, when reported.
 * @param requestedQueryCost - Cost of the query being retried.
 * @returns Delay in milliseconds.
 */
export function retryDelayMs(
  attempt: number,
  throttleStatus: ThrottleStatus | null,
  requestedQueryCost: number,
): number {
  const backoff = Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_CEILING_MS)
  if (!throttleStatus || throttleStatus.restoreRate <= 0) return backoff
  const deficit = requestedQueryCost - throttleStatus.currentlyAvailable
  if (deficit <= 0) return backoff
  return Math.max(backoff, Math.ceil(deficit / throttleStatus.restoreRate) * 1000)
}

/** Reads `extensions.cost`, returning null when Shopify omitted it. */
function readCost(body: GraphQLBody<unknown>): RequestCost | null {
  const cost = body.extensions?.cost
  if (!cost || typeof cost.requestedQueryCost !== 'number') return null
  return {
    requestedQueryCost: cost.requestedQueryCost,
    actualQueryCost: typeof cost.actualQueryCost === 'number' ? cost.actualQueryCost : null,
    throttleStatus: cost.throttleStatus ?? null,
  }
}

/** Whether a top-level GraphQL error array indicates cost throttling. */
function isThrottledBody(body: GraphQLBody<unknown>): boolean {
  return (body.errors ?? []).some((error) => error.extensions?.code === 'THROTTLED')
}

/** Real sleep, used when the caller does not inject one. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates a transport bound to one endpoint and token.
 *
 * Everything network-shaped lives here — timeout, retry, throttle arithmetic,
 * cost accounting — so that an operation is only ever a document plus a
 * mapping function. That split is what lets the whole error taxonomy be tested
 * without a socket.
 *
 * @param options - See {@link StorefrontTransportOptions}.
 */
export function createStorefrontTransport(
  options: StorefrontTransportOptions,
): StorefrontTransport {
  const {
    endpoint,
    token,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    fetchImpl = globalThis.fetch,
    sleep = defaultSleep,
    onCost,
  } = options

  async function request<TData>(
    document: string,
    variables: Record<string, unknown> = {},
  ): Promise<StorefrontResult<TData>> {
    let lastError: StorefrontError = networkError('request was never attempted', 0, null)
    let lastRequestedCost = 0
    let lastThrottleStatus: ThrottleStatus | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let response: Response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Shopify-Storefront-Access-Token': token,
          },
          body: JSON.stringify({ query: document, variables }),
          signal: controller.signal,
        })
      } catch (cause) {
        const aborted = cause instanceof Error && cause.name === 'AbortError'
        const message = aborted
          ? `request timed out after ${timeoutMs}ms`
          : cause instanceof Error
            ? cause.message
            : 'unknown transport failure'
        lastError = networkError(message, attempt, null)
        if (attempt < maxAttempts) {
          await sleep(retryDelayMs(attempt, lastThrottleStatus, lastRequestedCost))
          continue
        }
        return err(lastError)
      } finally {
        clearTimeout(timer)
      }

      /* Throttling can arrive as a status code with no usable body, so read the
         body defensively before deciding. */
      const rawBody = await response.text()
      let body: GraphQLBody<TData> | null = null
      try {
        body = rawBody === '' ? null : (JSON.parse(rawBody) as GraphQLBody<TData>)
      } catch {
        body = null
      }

      if (body) {
        const cost = readCost(body)
        if (cost) {
          lastRequestedCost = cost.requestedQueryCost
          lastThrottleStatus = cost.throttleStatus
          onCost?.(cost)
        }
      }

      if (THROTTLED_STATUSES.has(response.status) || (body ? isThrottledBody(body) : false)) {
        lastError = throttledError(attempt, lastThrottleStatus)
      } else if (response.status >= 500) {
        lastError = networkError(`upstream responded ${response.status}`, attempt, response.status)
      } else if (!response.ok) {
        /* Understood and refused — retrying cannot change the answer. */
        return err(networkError(`upstream responded ${response.status}`, attempt, response.status))
      } else if (!body) {
        return err(schemaError('response body was not valid JSON', '$'))
      } else if (body.errors && body.errors.length > 0) {
        /* Our documents are generated against a pinned schema, so a top-level
           GraphQL error means the live schema no longer matches it. That is
           schema drift, not a user mistake. */
        const messages = body.errors.map((error) => error.message ?? 'unknown error').join('; ')
        return err(schemaError(messages, '$.errors'))
      } else if (body.data === null || body.data === undefined) {
        return err(schemaError('response contained no data', '$.data'))
      } else {
        return ok(body.data)
      }

      if (!isRetryable(lastError) || attempt >= maxAttempts) return err(lastError)
      await sleep(retryDelayMs(attempt, lastThrottleStatus, lastRequestedCost))
    }

    return err(lastError)
  }

  return { request }
}
