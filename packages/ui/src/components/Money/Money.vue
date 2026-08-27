<script setup lang="ts">
import { computed } from 'vue'

/**
 * Formats a monetary amount with `Intl.NumberFormat`. The platform API is
 * the deliberate build-vs-buy choice here (see the package README): it
 * already knows every currency's minor-unit rules and every locale's symbol
 * placement, so a currency library would only add bundle weight.
 *
 * Accepts decimal strings because Shopify's Storefront API returns amounts
 * as strings (`"129.00"`); this component is the single parsing point.
 */
const props = withDefaults(
  defineProps<{
    /** Decimal amount in major units — number, or a Shopify-style decimal string. */
    amount: number | string
    /** ISO 4217 currency code, e.g. `'USD'`, `'IDR'`. */
    currency: string
    /** BCP 47 locale; defaults to the runtime's locale when omitted. */
    locale?: string
  }>(),
  { locale: undefined },
)

/** Parsed major-unit value, or null when the input is not a number. */
const numericAmount = computed<number | null>(() => {
  const value = typeof props.amount === 'string' ? Number(props.amount) : props.amount
  return Number.isFinite(value) ? value : null
})

const formatted = computed(() => {
  if (numericAmount.value === null) return '—'
  return new Intl.NumberFormat(props.locale, {
    style: 'currency',
    currency: props.currency,
  }).format(numericAmount.value)
})
</script>

<template>
  <span data-testid="money" :data-amount="numericAmount ?? undefined">{{ formatted }}</span>
</template>
