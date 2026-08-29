/**
 * Whether this build runs against mocks.
 *
 * Reads the env flag rather than `import.meta.env.DEV`, because the federated
 * E2E suite runs against **preview** builds where `DEV` is false — gating on
 * `DEV` would silently disable the mock worker for the one suite that most
 * needs it. Same flag name as the storefront's, so a single
 * `VITE_SENTRA_MOCKS=true` covers the whole platform.
 *
 * The storefront's own `mocksEnabled()` is not reusable here: it lives in
 * `apps/storefront/src/storefront.ts` next to Shopify client construction, and
 * the shell importing an app's internals would be a worse coupling than four
 * duplicated lines.
 *
 * `registry/break.ts`'s `?break=` control is gated on this same flag at its
 * call site in `registry/boot.ts` — see Task 11 correction 8.
 */
export function mocksEnabled(): boolean {
  return import.meta.env.VITE_SENTRA_MOCKS === 'true'
}
