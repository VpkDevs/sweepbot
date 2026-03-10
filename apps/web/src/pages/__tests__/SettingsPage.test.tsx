import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { SettingsPage } from '../SettingsPage'
import { api } from '../../lib/api'

// mock out auth store — fixes module path and prevents Supabase/Zustand init side-effects
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'user-1' } }) }))

const renderWithClient = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('<SettingsPage />', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Make window.confirm return true so the self-exclusion guard passes in jsdom
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('calls selfExclude when danger zone button clicked', async () => {
    const excludeSpy = vi.spyOn(api.user, 'selfExclude').mockResolvedValue({ success: true })

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SettingsPage /></QueryClientProvider>)

    // click the Danger Zone tab first so the self-exclusion button is rendered
    const dangerTab = screen.getByRole('button', { name: /danger zone/i })
    await userEvent.click(dangerTab)

    const button = screen.getByRole('button', { name: /activate 30-day self-exclusion/i })
    await userEvent.click(button)

    // jsdom doesn't show confirm() dialog; we rely on direct API call check
    await waitFor(() => expect(excludeSpy).toHaveBeenCalledWith(30))
  })
})