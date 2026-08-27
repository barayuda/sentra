import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import Button from './Button.vue'

describe('Button', () => {
  it('renders its default slot as the accessible name', () => {
    render(Button, { slots: { default: 'Save changes' } })
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
  })

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(Button, { slots: { default: 'Go' } })
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('honours an explicit submit type', () => {
    render(Button, { props: { type: 'submit' }, slots: { default: 'Go' } })
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  it('is disabled when the disabled prop is set', () => {
    render(Button, { props: { disabled: true }, slots: { default: 'Go' } })
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('is also disabled while loading, so a request cannot be double-submitted', () => {
    render(Button, { props: { loading: true }, slots: { default: 'Go' } })
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('exposes loading state to assistive technology via aria-busy', () => {
    render(Button, { props: { loading: true }, slots: { default: 'Go' } })
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true')
  })

  it('omits aria-busy when idle rather than emitting aria-busy="false"', () => {
    render(Button, { slots: { default: 'Go' } })
    expect(screen.getByRole('button').hasAttribute('aria-busy')).toBe(false)
  })

  it('applies the variant class from the shared helper', () => {
    render(Button, { props: { variant: 'danger' }, slots: { default: 'Delete' } })
    expect(screen.getByRole('button').className).toContain('bg-danger-700')
  })
})
