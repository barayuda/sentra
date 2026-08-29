import type { OpsResult } from './errors.ts'
import {
  getOrder,
  listOrders,
  type GetOrderInput,
  type ListOrdersInput,
} from './operations/orders.ts'
import { listFlags, setFlag, type SetFlagInput } from './operations/flags.ts'
import { createOpsTransport, type OpsTransportOptions } from './transport.ts'
import type { FeatureFlag, OrderDetail, OrderPage } from './types.ts'

/** Every Ops operation, bound to one transport. */
export interface OpsClient {
  /** See {@link listOrders}. */
  listOrders(input: ListOrdersInput): Promise<OpsResult<OrderPage>>
  /** See {@link getOrder}. */
  getOrder(input: GetOrderInput): Promise<OpsResult<OrderDetail | null>>
  /** See {@link listFlags}. */
  listFlags(): Promise<OpsResult<readonly FeatureFlag[]>>
  /** See {@link setFlag}. */
  setFlag(input: SetFlagInput): Promise<OpsResult<FeatureFlag>>
}

/**
 * Creates a client.
 *
 * The operations are free functions taking a transport, and this is a thin
 * binding over them. That split keeps every operation testable with a
 * three-line fake transport instead of a constructed client.
 *
 * @param options - See {@link OpsTransportOptions}.
 */
export function createOpsClient(options: OpsTransportOptions): OpsClient {
  const transport = createOpsTransport(options)
  return {
    listOrders: (input) => listOrders(transport, input),
    getOrder: (input) => getOrder(transport, input),
    listFlags: () => listFlags(transport),
    setFlag: (input) => setFlag(transport, input),
  }
}
