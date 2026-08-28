/// <reference types="vite/client" />

/** The typed environment contract; see `.env.example`. */
interface ImportMetaEnv {
  readonly VITE_SENTRA_MOCKS?: string
  readonly VITE_SENTRA_SHOPIFY_DOMAIN?: string
  readonly VITE_SENTRA_SHOPIFY_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
