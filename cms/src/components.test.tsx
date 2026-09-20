import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './components'

describe('ConfirmDialog', () => {
  it('requires a reason before enabling a destructive action', () => {
    const confirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Suspend user"
        description="Confirm action"
        danger
        onClose={() => undefined}
        onConfirm={confirm}
      />,
    )

    const button = screen.getByRole('button', { name: 'Confirm' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Policy violation' } })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(confirm).toHaveBeenCalledWith('Policy violation', '')
  })

  it('requires exact confirmation text for maintenance', () => {
    render(
      <ConfirmDialog
        open
        title="Execute"
        description="Dangerous"
        requireText="EXECUTE"
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: 'Approved maintenance' } })
    fireEvent.change(inputs[1], { target: { value: 'execute' } })
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    fireEvent.change(inputs[1], { target: { value: 'EXECUTE' } })
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled()
  })
})
