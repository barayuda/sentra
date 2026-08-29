export { createOpsClient, type OpsClient } from './client.ts'
export {
  authError,
  isRetryable,
  networkError,
  schemaError,
  validationError,
  type OpsError,
  type OpsResult,
} from './errors.ts'
export {
  createOpsTransport,
  retryDelayMs,
  type OpsTransport,
  type OpsTransportOptions,
} from './transport.ts'
export type { GetOrderInput, ListOrdersInput } from './operations/orders.ts'
export type { SetFlagInput } from './operations/flags.ts'
export type {
  FeatureFlag,
  MoneyAmount,
  OrderDetail,
  OrderLine,
  OrderPage,
  OrderSortKey,
  OrderStatus,
  OrderSummary,
  SortDirection,
} from './types.ts'
export { err, ok, type Result } from '@sentra/result'
