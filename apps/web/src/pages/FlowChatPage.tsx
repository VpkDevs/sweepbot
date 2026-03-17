import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Send,
  Bot,
  User,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { api } from '../lib/api'
import { usePerformanceMonitor } from '../hooks/usePerformance'
import { TextReveal } from '../components/fx/TextReveal'
import { cn } from '../lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface FlowConfirmation {
  flow: {
    id: string
    name: string
    description: string
    status: string
    trigger: Record<string, unknown>
    guardrails: Record<string, unknown>[]
  }
  humanReadableSummary: string
  warnings: Record<string, unknown>[]
}

interface ConversationState {
  sessionId?: string
  turns: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
  currentFlow?: {
    id: string
    name: string
    description?: string
    trigger?: Record<string, unknown>
    guardrails?: Record<string, unknown>[]
  }
  warnings?: Record<string, unknown>[]
}

export function FlowChatPage() {
  usePerformanceMonitor('FlowChatPage')

  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<FlowConfirmation | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const interpretMutation = useMutation({
    mutationFn: (text: string) => api.flows.interpret(text),
  })

  const startConvMutation = useMutation({
    mutationFn: (text: string) => api.flows.startConversation(text),
  })

  const converseMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.flows.converse(id, text),
  })

  // helper to sync messages from server conversation state
  function syncMessagesFromState(stateRecord: Record<string, unknown>) {
    const state = stateRecord as unknown as ConversationState
    if (!state?.turns) return
    const newMsgs: Message[] = state.turns.map((t) => ({
      role: t.role,
      content: t.content,
      timestamp: new Date(t.timestamp),
    }))
    setMessages(newMsgs)
    if (state.sessionId) setConversationId(state.sessionId)
    // extract confirmation if present
    if (state.currentFlow && state.currentFlow.id && state.currentFlow.name) {
      setConfirmation({
        flow: {
          id: state.currentFlow.id,
          name: state.currentFlow.name,
          description: state.currentFlow.description || '',
          status: 'active',
          trigger: state.currentFlow.trigger || {},
          guardrails: state.currentFlow.guardrails || [],
        },
        humanReadableSummary: state.currentFlow.description || '',
        warnings: state.warnings || [],
      })
    } else {
      setConfirmation(null)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // user message is sent to server, server will echo when state syncs
    setMessages((prev) => [...prev, { role: 'user', content: input, timestamp: new Date() }])
    const text = input
    setInput('')

    try {
      if (!conversationId) {
        const result = await startConvMutation.mutateAsync(text)
        syncMessagesFromState(result)
      } else {
        const result = await converseMutation.mutateAsync({ id: conversationId, text })
        syncMessagesFromState(result)
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ])
    }
  }

  const handleConfirm = async () => {
    if (!confirmation) return
    try {
      const result = await api.flows.create({
        name: confirmation.flow.name,
        description: confirmation.flow.description,
        definition: confirmation.flow,
        trigger: confirmation.flow.trigger,
        guardrails: confirmation.flow.guardrails,
      })
      const flowId = result['id'] as string
      navigate({ to: `/flows/${flowId}` })
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Failed to create flow. Please try again.',
          timestamp: new Date(),
        },
      ])
    }
  }

  const handleModify = () => {
    setConfirmation(null)
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'What would you like to change?', timestamp: new Date() },
    ])
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      {/* Header */}
      <div className="animate-reveal-up relative mx-4 mt-0 overflow-hidden rounded-b-2xl">
        <div className="from-brand-600/20 via-brand-500/10 to-brand-800/20 absolute inset-0 bg-gradient-to-r" />
        <div className="aurora-bg absolute inset-0 opacity-30" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500/15 relative flex h-10 w-10 items-center justify-center rounded-xl">
              <Bot className="text-brand-400 h-5 w-5" />
              <div className="bg-brand-400/10 animate-glow-pulse absolute inset-0 rounded-xl" />
            </div>
            <div>
              <TextReveal
                as="h1"
                className="text-shimmer text-lg font-bold tracking-tight text-white"
                stagger={40}
              >
                Flow Builder
              </TextReveal>
              <p className="text-sm text-zinc-500">Describe your automation in plain English</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 space-y-4 overflow-y-auto px-6 py-6"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 ? (
          <div className="animate-reveal-up flex flex-col items-center justify-center py-16">
            <div className="empty-icon-wrapper bg-brand-500/10 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl">
              <Sparkles className="text-brand-400 h-9 w-9" />
            </div>
            <p className="mb-3 max-w-md text-center font-medium text-zinc-400">
              Tell me what you want to automate
            </p>
            <p className="max-w-lg text-pretty text-center text-sm italic leading-relaxed text-zinc-600">
              "Every day at 3:30 PM, open Chumba, grab my daily bonus, play Sweet Bonanza at minimum
              bet. If I win more than 5x the bonus, keep going. Otherwise stop."
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'animate-slide-up-fade flex gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : '',
                  `message-delay-${idx % 5}`
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl shadow-lg',
                    msg.role === 'user'
                      ? 'from-brand-500 to-brand-700 shadow-brand-500/20 bg-gradient-to-br'
                      : 'bg-zinc-800 shadow-black/20'
                  )}
                >
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4 text-white" aria-label="User message" />
                  ) : (
                    <Bot className="h-4 w-4 text-zinc-400" aria-label="Assistant message" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                    msg.role === 'user'
                      ? 'from-brand-600/25 to-brand-700/15 ring-brand-500/10 rounded-br-md bg-gradient-to-br text-white ring-1'
                      : 'glass-card rounded-bl-md text-zinc-200'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {interpretMutation.isPending && (
              <div className="animate-fade-in flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 shadow-lg shadow-black/20">
                  <Bot className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="typing-dot typing-dot-0 h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
                    <span className="typing-dot typing-dot-1 h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
                    <span className="typing-dot typing-dot-2 h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Confirmation Card */}
      {confirmation && (
        <div className="glass-card-elevated animate-spring-in mx-4 mb-4 space-y-4 rounded-2xl p-5">
          <div className="mb-1 flex items-center gap-2">
            <CheckCircle2 className="text-brand-400 h-4 w-4" />
            <h3 className="text-sm font-bold tracking-tight text-white">Flow Summary</h3>
          </div>
          <div className="bg-brand-500/5 border-brand-500/10 space-y-1 rounded-xl border p-4 text-sm text-zinc-300">
            {(confirmation.humanReadableSummary ?? '').split('\n').map((line, idx) => (
              <div key={idx} className="leading-relaxed">
                {line}
              </div>
            ))}
          </div>

          {confirmation.warnings?.length > 0 && (
            <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                <h4 className="text-xs font-semibold text-yellow-300">Warnings</h4>
              </div>
              {confirmation.warnings.map((warning, idx: number) => (
                <div key={idx} className="mb-1 text-xs text-yellow-300/80">
                  {warning.message as string}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="btn-primary shadow-brand-500/20 press-scale group flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-xl"
            >
              Activate This Flow
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={handleModify}
              className="press-scale rounded-xl border border-white/[0.06] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06]"
            >
              Modify
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {!confirmation && (
        <form
          onSubmit={handleSendMessage}
          className="animate-fade-in fade-delay-200 px-4 pb-4 pt-2"
        >
          <div className="glass-card-elevated flex gap-3 rounded-2xl p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your automation..."
              className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
              disabled={interpretMutation.isPending}
            />
            <button
              type="submit"
              disabled={interpretMutation.isPending || !input.trim()}
              title="Send message"
              aria-label="Send message"
              className="from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 press-scale shadow-brand-500/20 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-all disabled:opacity-30"
            >
              {interpretMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
