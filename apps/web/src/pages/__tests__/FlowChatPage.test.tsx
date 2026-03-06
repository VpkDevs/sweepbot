import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import { FlowChatPage } from '../FlowChatPage'
import { api } from '../../lib/api'

// Simple mock for navigation
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => {},
}))

describe('<FlowChatPage />', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('starts a conversation and shows assistant reply', async () => {
    const fakeState = {
      sessionId: 'conv-1',
      turns: [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi, what do you want to automate?', timestamp: new Date().toISOString() },
      ],
    }

    const startSpy = vi.spyOn(api.flows, 'startConversation').mockResolvedValue(fakeState as any)

    render(<FlowChatPage />)

    const input = screen.getByPlaceholderText(/describe your automation/i)
    await userEvent.type(input, 'Test flow')
    const button = screen.getByRole('button', { name: /send/i })
    await userEvent.click(button)

    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('Test flow'))

    expect(screen.getByText('Hi, what do you want to automate?')).toBeInTheDocument()
  })

  it('continues existing conversation when conversationId set', async () => {
    const fakeStart = {
      sessionId: 'conv-2',
      turns: [{ role: 'user', content: 'Begin', timestamp: new Date().toISOString() }],
    }
    const fakeContinue = {
      sessionId: 'conv-2',
      turns: [
        { role: 'user', content: 'Begin', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'OK', timestamp: new Date().toISOString() },
      ],
    }

    const startSpy = vi.spyOn(api.flows, 'startConversation').mockResolvedValue(fakeStart as any)
    const convSpy = vi.spyOn(api.flows, 'converse').mockResolvedValue(fakeContinue as any)

    render(<FlowChatPage />)
    const input = screen.getByPlaceholderText(/describe your automation/i)
    await userEvent.type(input, 'Start')
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(startSpy).toHaveBeenCalled())

    // now type again
    await userEvent.type(input, 'then something')
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(convSpy).toHaveBeenCalled())

    expect(screen.getByText('OK')).toBeInTheDocument()
  })
})