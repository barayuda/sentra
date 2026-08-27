import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import Input from './Input.vue'

describe('Input', () => {
  it('associates the label with the control', () => {
    render(Input, { props: { label: 'Email address' } })
    expect(screen.getByLabelText('Email address')).toBeTruthy()
  })

  it('reflects modelValue into the control', () => {
    render(Input, { props: { label: 'Email', modelValue: 'a@b.test' } })
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('a@b.test')
  })

  it('emits update:modelValue so v-model works', async () => {
    const { emitted } = render(Input, { props: { label: 'Email' } })
    await fireEvent.update(screen.getByLabelText('Email'), 'typed')
    expect(emitted()['update:modelValue']).toEqual([['typed']])
  })

  it('renders a hint and links it via aria-describedby', () => {
    render(Input, { props: { label: 'Email', hint: 'We never share this' } })
    const hint = screen.getByText('We never share this')
    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toContain(hint.id)
  })

  it('marks the control invalid and announces the error when one is present', () => {
    render(Input, { props: { label: 'Email', error: 'Required' } })
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toContain('Required')
  })

  it('omits aria-describedby entirely when there is no hint or error', () => {
    render(Input, { props: { label: 'Email' } })
    expect(screen.getByLabelText('Email').hasAttribute('aria-describedby')).toBe(false)
  })

  it('omits aria-invalid when valid rather than emitting aria-invalid="false"', () => {
    render(Input, { props: { label: 'Email' } })
    expect(screen.getByLabelText('Email').hasAttribute('aria-invalid')).toBe(false)
  })

  it('passes the type through for correct mobile keyboards', () => {
    render(Input, { props: { label: 'Phone', type: 'tel' } })
    expect(screen.getByLabelText('Phone').getAttribute('type')).toBe('tel')
  })

  it('disables the control when requested', () => {
    render(Input, { props: { label: 'Email', disabled: true } })
    expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(true)
  })

  it('gives distinct ids to two instances so labels never cross-wire', () => {
    render(Input, { props: { label: 'First' } })
    render(Input, { props: { label: 'Second' } })
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id)
  })
})
