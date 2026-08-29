/**
 * Shopify CDN image transforms.
 *
 * Shopify resizes on its own CDN from query parameters, which is why this is a
 * URL-building function and not an image pipeline: asking for the size actually
 * needed is both the cheapest and the most effective image optimisation
 * available here — no build step, no extra service, and the CDN caches every
 * variant globally.
 */

/** A requested rendition. */
export interface ShopifyImageTransform {
  /** Target width in CSS pixels. */
  readonly width: number
  /** Target height; omit to preserve the aspect ratio. */
  readonly height?: number
  /** Which part to keep when both dimensions are constrained. */
  readonly crop?: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Builds a transformed CDN URL.
 *
 * Existing query parameters are preserved — Shopify appends a `v=` cache-buster
 * that must survive, or every catalogue update serves stale images.
 *
 * @param url - The original image URL.
 * @param transform - The rendition to request.
 * @returns The transformed URL, or the input unchanged if it is not a URL.
 */
export function shopifyImageUrl(url: string, transform: ShopifyImageTransform): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    /* Not a URL — a fixture placeholder or a malformed CDN value. Returning it
       unchanged degrades to an unoptimised image instead of a broken one. */
    return url
  }
  parsed.searchParams.set('width', String(transform.width))
  if (transform.height !== undefined) parsed.searchParams.set('height', String(transform.height))
  if (transform.crop !== undefined) parsed.searchParams.set('crop', transform.crop)
  return parsed.toString()
}

/**
 * Builds a `srcset` so the browser picks the rendition matching the device.
 *
 * @param url - The original image URL.
 * @param widths - Candidate widths, in CSS pixels.
 * @returns A `srcset` value, or an empty string when no widths are given.
 */
export function shopifyImageSrcset(url: string, widths: readonly number[]): string {
  return widths.map((width) => `${shopifyImageUrl(url, { width })} ${width}w`).join(', ')
}
