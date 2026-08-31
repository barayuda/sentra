import { expectTypeOf } from 'vitest'
import { createFlagClient } from './client.ts'
import { staticSource } from './sources.ts'

const client = createFlagClient({
  declarations: { 'checkout.express': { default: false } },
  source: staticSource({}),
})

expectTypeOf(client.isOn).parameter(0).toEqualTypeOf<'checkout.express'>()

// @ts-expect-error — an undeclared key must not compile
client.isOn('checkout.exress')
