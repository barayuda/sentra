# Cross-device wishlist

**Classification: PUBLIC**

## Problem

Shoppers browsing on a phone during a commute frequently find products they
are not ready to buy. Today the only way to keep a product in mind is to add
it to the cart (which reads as purchase intent it isn't) or leave the tab
open. When they pick the site back up on a laptop, whatever they were
considering is gone. Support hears this as "where did the thing I saved go?"
roughly as often as cart-abandonment complaints.

## User story

As `shopper-1`, I want to save a product to a wishlist from any device and see
the same wishlist when I come back on a different device, so that I don't
lose track of things I'm considering between sessions.

## Acceptance criteria

- From a product page, `shopper-1` can add or remove the product from their
  wishlist with one action, with no page reload.
- A wishlisted product shows as saved everywhere its state is visible (the
  product page, any listing) within the same session.
- After `shopper-1` signs in on a second device or browser, their wishlist
  from the first device is visible there too.
- Removing an item on one device removes it everywhere it is next viewed.
- An anonymous visitor (no sign-in) can still use the wishlist for their
  current browser; it does not need to follow them anywhere until they sign
  in.

## Out of scope

- Sharing a wishlist with another person.
- Notifying `shopper-1` when a wishlisted item's price changes or it goes
  out of stock.
- Any wishlist-specific promotion or merchandising surface.

## Open questions

- Is there a real sign-in flow this can attach to, or does "signs in"
  above still mean the demo role switch? This changes what "cross-device"
  can actually mean at launch.
- Does a wishlisted item need to remember the variant (size, color) or only
  the product?
- What happens to a wishlist item whose product is discontinued?
