import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Send,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
  Zap,
  AlertCircle,
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

const PROMPT_SUGGESTIONS = [
  'Claim daily bonuses on all platforms every morning at 8 AM',
  'Alert me when Chumba jackpot exceeds $50,000',
  'Play Sweet Bonanza on Pulsz at min bet, stop after 30 spins or 10x win',
  'Watch my SC balance, notify me when I hit 100 SC to redeem',
  'Every Friday, play an hour on WOW Vegas with $20 SC budget',
  'Pause all flows if I lose more than $30 in a day',
]

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

  const startConvMutation = useMutation({
    mutationFn: (text: string) => api.flows.startConversation(text),
  })

  const converseMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.flows.converse(id, text),
  })

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
    } catch {
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

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      {/* Header with Aurora Background */}
      <div className="animate-reveal-up relative mx-4 mt-0 overflow-hidden rounded-b-3xl shadow-2xl">
        {/* Aurora gradient layers */}
        <div className="from-brand-600/30 via-brand-500/15 to-brand-800/30 absolute inset-0 bg-gradient-to-r" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)',
            filter: 'blur(40px)',
          }}
        />

        <div className="relative px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500/20 relative flex h-12 w-12 items-center justify-center rounded-2xl">
              <Bot className="text-brand-300 h-6 w-6" />
              <div className="bg-brand-400/10 animate-glow-pulse absolute inset-0 rounded-2xl" />
            </div>
            <div>
              <TextReveal
                as="h1"
                className="text-shimmer text-2xl font-bold tracking-tight text-white"
                stagger={30}
              >
                Flow Builder
              </TextReveal>
              <p className="mt-0.5 text-sm text-zinc-400">
                Describe your automation in plain English
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 space-y-4 overflow-y-auto px-6 py-6"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 ? (
          <div className="animate-reveal-up flex flex-col items-center justify-center py-12">
            {/* Empty State with Prompt Suggestions */}
            <div className="empty-icon-wrapper bg-brand-500/10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
              <Sparkles className="text-brand-400 h-9 w-9" />
            </div>
            <p className="mb-2 max-w-md text-center text-lg font-semibold text-white">
              Tell me what you want to automate
            </p>
            <p className="mb-8 max-w-lg text-center text-sm text-zinc-500">
              Or try one of these example prompts
            </p>

            {/* Prompt Suggestion Chips */}
            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
              {PROMPT_SUGGESTIONS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="glass-card-elevated hover:border-brand-500/30 hover:bg-brand-500/[0.03] press-scale group relative rounded-xl border border-white/5 p-4 text-left transition-all duration-200"
                >
                  <div className="bg-brand-500/20 absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
                    <ArrowRight className="text-brand-400 h-3 w-3" />
                  </div>
                  <p className="pr-6 text-sm leading-relaxed text-zinc-300 transition-colors group-hover:text-white">
                    {prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'animate-slide-up-fade group flex gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : ''
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
                    'relative max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                    msg.role === 'user'
                      ? 'from-brand-600/25 to-brand-700/15 ring-brand-500/10 rounded-br-md bg-gradient-to-br text-white ring-1'
                      : 'glass-card rounded-bl-md text-zinc-200'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <span className="absolute bottom-1 right-3 text-xs text-zinc-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator with three bouncing dots */}
            {(startConvMutation.isPending || converseMutation.isPending) && (
              <div className="animate-fade-in flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 shadow-lg shadow-black/20">
                  <Bot className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="bg-brand-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="bg-brand-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="bg-brand-400 h-2 w-2 animate-bounce rounded-full"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Rich Flow Confirmation Card */}
      {confirmation && (
        <div className="glass-card-elevated animate-spring-in border-brand-500/20 mx-4 mb-4 space-y-4 rounded-2xl border p-6">
          {/* Header with confidence badge */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-brand-500/20 flex h-10 w-10 items-center justify-center rounded-xl">
                <CheckCircle2 className="text-brand-300 h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{confirmation.flow.name}</h3>
                <p className="mt-1 text-xs text-zinc-400">{confirmation.flow.description}</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              Ready to Deploy
            </span>
          </div>

          {/* Visual step-by-step breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Automation Steps
            </p>
            <div className="space-y-2">
              {(confirmation.humanReadableSummary || '')
                .split('\n')
                .filter((line) => line.trim())
                .map((line, idx, arr) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="bg-brand-500/20 text-brand-300 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed text-zinc-300">{line}</p>
                      {idx < arr.length - 1 && (
                        <div className="bg-brand-500/20 ml-2.5 mt-2 h-2 w-0.5" />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Trigger info */}
          {confirmation.flow.trigger && (
            <div className="bg-brand-500/5 border-brand-500/10 flex items-center gap-2 rounded-lg border px-3 py-2">
              <Clock className="text-brand-400 h-4 w-4" />
              <span className="text-xs text-zinc-300">
                <span className="text-brand-300 font-semibold">Trigger:</span> When conditions are
                met
              </span>
            </div>
          )}

          {/* Guardrails as green pills */}
          {confirmation.flow.guardrails && confirmation.flow.guardrails.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Guardrails
              </p>
              <div className="flex flex-wrap gap-2">
                {confirmation.flow.guardrails.map((guard, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400"
                  >
                    <Shield className="h-3 w-3" />
                    {(guard['type'] as string) || `Guard ${idx + 1}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings as yellow pills */}
          {confirmation.warnings && confirmation.warnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Warnings
              </p>
              <div className="space-y-1.5">
                {confirmation.warnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-3 py-2"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                    <span className="text-xs text-yellow-300">
                      {(warning['message'] as string) || `Warning ${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleConfirm}
              className="btn-primary shadow-brand-500/20 press-scale group flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-xl"
            >
              <Zap className="h-4 w-4" />
              Activate Flow
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={handleModify}
              className="press-scale rounded-xl border border-white/[0.06] bg-white/[0.04] px-5 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06]"
            >
              Modify
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      {!confirmation && (
        <form onSubmit={handleSendMessage} className="animate-fade-in px-4 pb-4 pt-2">
          <div className="glass-card-elevated flex gap-3 rounded-2xl border border-white/5 p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your automation..."
              className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
              disabled={startConvMutation.isPending || converseMutation.isPending}
            />
            <button
              type="submit"
              disabled={startConvMutation.isPending || converseMutation.isPending || !input.trim()}
              title="Send message"
              aria-label="Send message"
              className="from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 press-scale shadow-brand-500/20 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-all disabled:opacity-30"
            >
              {startConvMutation.isPending || converseMutation.isPending ? (
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
