<script setup lang="ts">
import { useAnalytics } from '@sentra/plugin-analytics'
import { useProduct } from '@sentra/sdk-commerce/vue'
import { Button, Money, Select, useToast, type SelectOption } from '@sentra/ui'
import { computed, ref, watch } from 'vue'
import RichText from '../components/RichText.vue'
import StateBlock from '../components/StateBlock.vue'
import { errorCopy } from '../lib/errorCopy.ts'
import { useCartStore } from '../stores/cart.ts'

/**
 * Product detail page.
 *
 * The description is rendered through `RichText`, which is the sanitisation
 * boundary — this view never touches `v-html` itself.
 */
const props = defineProps<{
  /** Product handle from the route. */
  handle: string
}>()

const analytics = useAnalytics()
const toast = useToast()
const cart = useCartStore()

const { data: product, loading, error } = useProduct(() => props.handle)

/** Selected variant id; defaults to the first variant when the product loads. */
const selectedVariantId = ref('')

const variantOptions = computed<SelectOption[]>(() =>
  (product.value?.variants ?? []).map((variant) => ({
    value: variant.id,
    label: variant.title,
    disabled: !variant.availableForSale,
  })),
)

const selectedVariant = computed(
  () =>
    product.value?.variants.find((variant) => variant.id === selectedVariantId.value) ??
    product.value?.variants[0] ??
    null,
)

const canAdd = computed(() => selectedVariant.value?.availableForSale === true)

const copy = computed(() => (error.value ? errorCopy(error.value) : null))
const notFound = computed(() => !loading.value && !error.value && product.value === null)

/** Selects the first variant and reports the view, once per loaded product. */
watch(product, (next) => {
  if (!next) return
  selectedVariantId.value = next.variants[0]?.id ?? ''
  analytics.track('product_view', { handle: next.handle, available: next.availableForSale })
})

watch(error, (next) => {
  if (next) analytics.track('storefront_error', { kind: next.kind, operation: 'getProduct' })
})

/** Adds the selected variant, then reports the outcome to the reader. */
async function addToCart(): Promise<void> {
  const variant = selectedVariant.value
  if (!variant) return
  const added = await cart.addLine(variant.id, 1)
  if (!added) {
    const failure = cart.error ? errorCopy(cart.error) : null
    toast.show({
      title: failure?.title ?? 'Could not add to cart',
      description: failure?.detail,
      variant: 'danger',
    })
    return
  }
  analytics.track('add_to_cart', {
    merchandiseId: variant.id,
    quantity: 1,
    currency: variant.price.currencyCode,
    /* A number, not the decimal string: the allowlist declares `value`, and an
       analytics backend cannot sum strings. */
    value: Number(variant.price.amount),
  })
  toast.show({ title: 'Added to cart', description: product.value?.title, variant: 'success' })
}
</script>

<template>
  <StateBlock
    v-if="loading && !product"
    variant="loading"
    title="Loading the product"
    detail="Fetching details from the store."
  />

  <StateBlock
    v-else-if="error && copy && !product"
    variant="error"
    :title="copy.title"
    :detail="copy.detail"
  />

  <StateBlock
    v-else-if="notFound"
    variant="empty"
    title="Product not found"
    detail="This product may have been removed."
  >
    <template #action>
      <RouterLink to="/" class="text-sm text-brand-700 underline"
        >Back to the collection</RouterLink
      >
    </template>
  </StateBlock>

  <article v-else-if="product" class="grid gap-8 md:grid-cols-2">
    <img
      v-if="product.image"
      :src="product.image.url"
      :alt="product.image.altText ?? product.title"
      class="w-full rounded-lg bg-neutral-100 object-cover"
      width="600"
      height="600"
    />
    <div v-else class="aspect-square w-full rounded-lg bg-neutral-100" aria-hidden="true" />

    <div class="flex flex-col gap-4">
      <h1 class="text-2xl font-semibold text-neutral-900">{{ product.title }}</h1>

      <p class="text-lg font-medium text-neutral-900">
        <Money
          :amount="selectedVariant?.price.amount ?? product.price.amount"
          :currency="selectedVariant?.price.currencyCode ?? product.price.currencyCode"
        />
      </p>

      <Select
        v-if="variantOptions.length > 1"
        v-model="selectedVariantId"
        label="Variant"
        :options="variantOptions"
      />

      <Button :disabled="!canAdd" :loading="cart.loading" @click="addToCart()">
        {{ canAdd ? 'Add to cart' : 'Sold out' }}
      </Button>

      <RichText :html="product.descriptionHtml" />
    </div>
  </article>
</template>
