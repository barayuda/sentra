/** Where an order is in its lifecycle. */
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refunded' | 'cancelled'

/**
 * A monetary amount.
 *
 * `amount` is a decimal **string**, not a number, for the same reason
 * `@sentra/sdk-commerce` does it: binary floating point cannot represent
 * `0.1`, and money that is off by a cent after two additions is a defect that
 * reaches an invoice.
 */
export interface MoneyAmount {
  /** Decimal string, e.g. `"149.00"`. */
  readonly amount: string
  /** ISO 4217 code, e.g. `"IDR"`. */
  readonly currencyCode: string
}

/** An order as it appears in a list. */
export interface OrderSummary {
  /** Opaque identifier. */
  readonly id: string
  /** Human-facing reference, e.g. `"SEN-1042"`. */
  readonly reference: string
  /** ISO 8601 timestamp. */
  readonly placedAt: string
  readonly status: OrderStatus
  readonly total: MoneyAmount
  /** How many lines the order has, so a list need not fetch them. */
  readonly lineCount: number
}

/** One page of orders. */
export interface OrderPage {
  readonly orders: readonly OrderSummary[]
  /** Cursor for the next page, or null when exhausted. */
  readonly nextCursor: string | null
  /** Total matching orders, for a page count. */
  readonly totalCount: number
}

/** One line of an order. */
export interface OrderLine {
  readonly id: string
  readonly title: string
  readonly quantity: number
  readonly total: MoneyAmount
}

/** An order with its lines. */
export interface OrderDetail extends OrderSummary {
  /**
   * Opaque reference to the customer record.
   *
   * Deliberately not a name, an email, or a phone number. An ops console is
   * exactly the kind of internal tool where personal data accumulates without
   * anyone deciding it should, so the contract refuses to carry it. Named
   * risk area: data minimisation.
   */
  readonly customerRef: string
  readonly lines: readonly OrderLine[]
}

/** A runtime feature flag. */
export interface FeatureFlag {
  /** Stable key used in code, e.g. `"new-checkout"`. */
  readonly key: string
  /** Human-readable label for the console. */
  readonly label: string
  readonly enabled: boolean
  /** ISO 8601 timestamp of the last change. */
  readonly updatedAt: string
}

/** Sort fields the orders list supports. */
export type OrderSortKey = 'placedAt' | 'reference' | 'status' | 'total'

/** Sort direction. */
export type SortDirection = 'asc' | 'desc'
