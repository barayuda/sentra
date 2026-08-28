/**
 * `@sentra/sdk-commerce` — typed Shopify Storefront client.
 *
 * This entry is deliberately free of Vue imports: the transport, operations,
 * and error taxonomy are unit-testable without mounting a component. Vue
 * bindings live behind the `./vue` export, MSW handlers behind `./mocks`.
 */
export { STOREFRONT_API_VERSION, STOREFRONT_SCHEMA_SHA256 } from './version.ts'
