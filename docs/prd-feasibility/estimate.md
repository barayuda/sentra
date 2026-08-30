# Estimate: cross-device wishlist

**Classification: PUBLIC**

Prices [feasibility-review.md](./feasibility-review.md)'s recommended option
2 (shell-session-scoped, not truly cross-device). Option 1 and option 3 are
not estimated here — see "Excluded from this estimate" below for why.

**Scale:** modified Fibonacci story points (1, 2, 3, 5, 8, 13). A point is a
relative sizing unit, not a time unit; the basis for each number is a
comparable piece of work already in this repository, cited by path, not a
guessed hour count.

## Breakdown

| # | Piece of work | Points | Basis |
|---|---|---|---|
| 1 | Client-side wishlist store (Pinia, `localStorage`-backed, keyed by session id) | 5 | `apps/storefront/src/stores/cart.ts` (263 lines) is the closest comparable persistence-surface store in the repo — same `try`/`catch` `localStorage` discipline as its `readStoredCartId`/`writeStoredCartId` (lines 24–40). Sized below cart's full 263 lines because a wishlist needs no checkout/subtotal computation and no network-mutation generation-guarding (`apps/storefront/src/stores/cart.ts` lines 92, 113–128), only the persisted-list shape plus session keying. |
| 2 | Cross-remote bus event so other remotes can react to wishlist changes | 2 | `packages/shell-contract/src/bus.ts`'s existing `ShellEventMap` already holds the same shape of entry (`cart:updated`), and `apps/storefront/src/stores/cart.ts`'s `publishCount` (lines 80–83) is the emit-call-site pattern a wishlist store would copy. Adding one closed-map entry plus one call site, per ADR 0006's discipline. |
| 3 | Read the existing session id to key the store | 1 | `useSession()` is already exported from `packages/shell-contract/src/index.ts` (line 14) and used elsewhere (`apps/shell/src/components/RoleSwitcher.vue`). This is a read of an existing, already-public API, not new plumbing. |
| 4 | Save/unsave affordance on the product page | 3 | `apps/storefront/src/views/ProductView.vue` (153 lines) is the file where the existing add-to-cart action lives; this is one more action on an existing view, not a new one — comparable in scope to the add-to-cart wiring already there. |
| 5 | A surface where `shopper-1` can see everything saved | 5 | `apps/storefront/src/components/CartDrawer.vue` (156 lines) is the closest existing "drawer listing saved things" component and the direct structural comparable for a wishlist list. |
| | **Total** | **16** | |

Test effort is folded into each line above rather than broken out separately:
across the repository, operation and store modules carry test files of
roughly comparable size to the implementation
(`packages/sdk-commerce/src/operations/collections.ts` 61 lines /
`packages/sdk-commerce/src/operations/collections.test.ts` 102 lines;
`packages/sdk-commerce/src/operations/products.ts` 47 lines /
`packages/sdk-commerce/src/operations/products.test.ts` 132 lines;
`apps/storefront/src/stores/cart.ts` 263 lines /
`apps/storefront/src/stores/cart.test.ts` 299 lines), so each point above
assumes a same-scale test file, not an untested stub.

## Excluded from this estimate

- **A real sign-in/identity system and any server-side data store**
  (feasibility-review.md's option 3). Nothing in this repository is a
  comparable for either piece — `packages/shell-contract/src/session.ts`'s
  `Session` is explicitly documented as not authentication
  (`apps/shell/src/session.ts`, the comment above `initialSession`), so there
  is no existing identity code to size from, and no server-side store exists
  anywhere in the repo to size a new one against. Estimating this would be a
  guess wearing a number; it needs its own estimate once a backend and
  identity decision is made.
- **True cross-device persistence itself.** The 16 points above buy option 2,
  which — as feasibility-review.md states plainly — does not satisfy the
  PRD's core acceptance criterion. If the product owner requires the literal
  PRD as written, this estimate is not the right one to approve.
- **Variant tracking, discontinued-item handling, sharing, and price-drop
  notification**, per `docs/prd-feasibility/sample-prd.md`'s "Out of scope"
  and "Open questions" sections.

## Unknowns that would move the number most

1. **Whether a real login lands before this ships.** If `Session.id` stops
   being the hardcoded `'demo-user'` value from `apps/shell/src/session.ts`
   and becomes a real per-user id, item 3 is unaffected but the whole premise
   of the estimate changes: option 3 becomes buildable, and it is unestimated
   here because there is no comparable for it yet.
2. **Whether a wishlist entry needs to remember the variant (size, color),
   not just the product** — an open question in
   `docs/prd-feasibility/sample-prd.md`. This would push item 1 toward
   `apps/storefront/src/stores/cart.ts`'s full line-item complexity
   (merchandise id plus quantity per entry, as that file's `addLine` function
   and `packages/sdk-commerce/src/mocks/store.ts`'s `addMockLines` function
   both handle), likely moving it from 5 to 8.
3. **Whether the badge/list must be visible outside the storefront remote**
   (e.g. from the shell header, the way the cart badge is). If not, item 2
   disappears entirely (-2). If it must also be visible from another remote
   beyond the shell (for example a future admin view), ADR 0005's
   shared-singleton question reopens for wishlist state the way it already
   did for the cart, and that is not sized here.
