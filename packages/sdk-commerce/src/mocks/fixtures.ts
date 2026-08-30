/**
 * Fixture data shaped exactly like Storefront API responses.
 *
 * Wire-shaped rather than domain-shaped on purpose: fixtures that skip the
 * `edges`/`node` plumbing would test the mapping layer against itself, and the
 * mapping layer is precisely the code most likely to be wrong.
 *
 * Generated from a short list of names rather than written out 24 times — the
 * count exists to make the storefront's virtualised grid meaningful, and 24
 * hand-written literals would be 24 opportunities for an inconsistent one.
 */

/** The shop these fixtures pretend to belong to. */
export const MOCK_SHOP_DOMAIN = 'demo-shop.myshopify.com'

/**
 * A placeholder token, obviously fake by construction.
 *
 * Never a real value, even a revoked one: a token-shaped string in a repository
 * teaches the wrong habit and invites someone to "just update it".
 */
export const MOCK_STOREFRONT_TOKEN = 'mock-public-storefront-token'

/** Currency for every fixture price. */
export const MOCK_CURRENCY = 'USD'

const NAMES = [
  'Stoneware Mug',
  'Speckled Bowl',
  'Linen Apron',
  'Cast Iron Pan',
  'Walnut Board',
  'Ceramic Jug',
  'Copper Whisk',
  'Rattan Tray',
] as const

/**
 * A hostile product description, served by fixture 1.
 *
 * Real merchant HTML is a trust boundary, so the fixtures exercise it. Every
 * payload here is one the sanitiser must neutralise: a script element, an
 * event handler, a `javascript:` URL, and a positioned overlay.
 */
const HOSTILE_DESCRIPTION =
  '<p>Thrown by <strong>hand</strong> in Bandung.</p>' +
  '<script>window.pwned = "script"</script>' +
  '<img src="x" onerror="window.pwned = \'onerror\'">' +
  '<a href="javascript:alert(1)">Care guide</a>' +
  '<p style="position:fixed;inset:0;z-index:9999">Click here to win</p>'

const SAFE_DESCRIPTION =
  '<p>Small-batch, <em>kiln-fired</em>, and made to be used daily.</p>' +
  '<ul><li>Dishwasher safe</li><li>Microwave safe</li></ul>'

/** One product as the Storefront API would return it. */
export interface WireProduct {
  readonly id: string
  readonly handle: string
  readonly title: string
  readonly availableForSale: boolean
  readonly descriptionHtml: string
  readonly featuredImage: {
    readonly url: string
    readonly altText: string | null
    readonly width: number
    readonly height: number
  } | null
  readonly priceRange: {
    readonly minVariantPrice: { readonly amount: string; readonly currencyCode: string }
  }
  readonly variants: {
    readonly edges: readonly {
      readonly node: {
        readonly id: string
        readonly title: string
        readonly availableForSale: boolean
        readonly price: { readonly amount: string; readonly currencyCode: string }
      }
    }[]
  }
}

/** Price in whole dollars for product `index`, as a Shopify decimal string. */
function priceFor(index: number): string {
  return `${19 + (index % 8) * 10}.00`
}

/** 24 products; `sentra-piece-1` carries the hostile description. */
export const FIXTURE_PRODUCTS: readonly WireProduct[] = Array.from({ length: 24 }, (_, offset) => {
  const index = offset + 1
  const name = NAMES[offset % NAMES.length] ?? 'Sentra Piece'
  const amount = priceFor(offset)
  /* Every fourth product is out of stock, so the listing has a real
       unavailable state to render rather than a uniformly happy catalogue. */
  const availableForSale = index % 4 !== 0
  return {
    id: `gid://shopify/Product/${index}`,
    handle: `sentra-piece-${index}`,
    title: `${name} No. ${index}`,
    availableForSale,
    descriptionHtml: index === 1 ? HOSTILE_DESCRIPTION : SAFE_DESCRIPTION,
    featuredImage: {
      url: `https://cdn.shopify.com/s/files/1/0001/sentra-piece-${index}.jpg`,
      altText: `${name} No. ${index}`,
      width: 1200,
      height: 1200,
    },
    priceRange: { minVariantPrice: { amount, currencyCode: MOCK_CURRENCY } },
    variants: {
      edges: [
        {
          node: {
            id: `gid://shopify/ProductVariant/${index}-0`,
            title: 'Default',
            availableForSale,
            price: { amount, currencyCode: MOCK_CURRENCY },
          },
        },
      ],
    },
  }
})

/** Variant id → its product, for cart line rendering. */
export const FIXTURE_VARIANT_INDEX: ReadonlyMap<string, WireProduct> = new Map(
  FIXTURE_PRODUCTS.flatMap((product) =>
    product.variants.edges.map((edge) => [edge.node.id, product] as const),
  ),
)

/** The one collection these fixtures expose. */
export const FIXTURE_COLLECTION = { handle: 'tableware', title: 'Tableware' } as const

/**
 * A deterministically-generated placeholder product photo, base64-encoded.
 *
 * The Storefront API mocks never exercised image requests: {@link
 * createStorefrontHandlers} only intercepted the GraphQL endpoint, so every
 * `<img>` built from a fixture's image URL (via `shopifyImageUrl` /
 * `shopifyImageSrcset`) fell through to a real, unmocked request against
 * `cdn.shopify.com` — a hostname these fixtures do not own and that 404s for
 * every fixture path. That produced 20 failed resource loads on the
 * storefront home page under Lighthouse, not "MSW forcing image bytes to
 * zero" as originally (and incorrectly) documented.
 *
 * This is a genuine, valid 150x150 8-bit RGB PNG (~11.1 KB), built by hand
 * with `zlib.deflateSync` plus a hand-rolled CRC32 — there is no image
 * library in this repo and no real photo asset to vendor. It exists purely
 * so the image-request mock handler below has real bytes to return; its
 * pixel content (a smooth gradient) carries no meaning.
 */
export const MOCK_PRODUCT_IMAGE_BASE64 =
  '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'
