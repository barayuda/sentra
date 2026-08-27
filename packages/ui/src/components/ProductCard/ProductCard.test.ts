import { render, screen, fireEvent } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import ProductCard from './ProductCard.vue'

const baseProps = {
  title: 'Aeropress Go',
  price: { amount: '49.00', currency: 'USD' },
}

describe('ProductCard', () => {
  it('renders title and formatted price', () => {
    render(ProductCard, { props: baseProps })
    expect(screen.getByRole('heading', { name: 'Aeropress Go' })).toBeTruthy()
    expect(screen.getByTestId('money').textContent).toContain('49.00')
  })

  it('renders the image with its alt text', () => {
    render(ProductCard, {
      props: { ...baseProps, imageSrc: '/aeropress.jpg', imageAlt: 'Aeropress Go brewer' },
    })
    expect(screen.getByRole('img', { name: 'Aeropress Go brewer' })).toBeTruthy()
  })

  it('renders the badge when provided', () => {
    render(ProductCard, { props: { ...baseProps, badge: 'New' } })
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('renders description and footer slots', () => {
    render(ProductCard, {
      props: baseProps,
      slots: { default: 'Portable espresso-style brewer', footer: '<button>Add to cart</button>' },
    })
    expect(screen.getByText('Portable espresso-style brewer')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeTruthy()
  })

  it('emits select when the card body is clicked', async () => {
    const { emitted } = render(ProductCard, { props: baseProps })
    await fireEvent.click(screen.getByRole('heading', { name: 'Aeropress Go' }))
    expect(emitted('select')).toHaveLength(1)
  })

  it('shows a skeleton and hides content while loading', () => {
    render(ProductCard, { props: { ...baseProps, loading: true } })
    expect(screen.getByTestId('product-card').getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
