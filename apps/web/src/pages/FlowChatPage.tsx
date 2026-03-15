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
  Shield,
  Clock,
  Zap,
  Target,
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
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() },
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
      navigate({ to: `/app/flows/${flowId}` })
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to create flow. Please try again.', timestamp: new Date() },
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
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      {/* Header with Aurora Background */}
      <div className="relative overflow-hidden rounded-b-3xl mx-4 mt-0 animate-reveal-up shadow-2xl">
        {/* Aurora gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600/30 via-brand-500/15 to-brand-800/30" />
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
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/20">
              <Bot className="w-6 h-6 text-brand-300" />
              <div className="absolute inset-0 rounded-2xl bg-brand-400/10 animate-glow-pulse" />
            </div>
            <div>
              <TextReveal
                as="h1"
                className="text-2xl font-bold text-white tracking-tight text-shimmer"
                stagger={30}
              >
                Flow Builder
              </TextReveal>
              <p className="text-sm text-zinc-400 mt-0.5">Describe your automation in plain English</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 animate-reveal-up">
            {/* Empty State with Prompt Suggestions */}
            <div className="empty-icon-wrapper w-20 h-20 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-6">
              <Sparkles className="w-9 h-9 text-brand-400" />
            </div>
            <p className="text-white text-center max-w-md mb-2 font-semibold text-lg">
              Tell me what you want to automate
            </p>
            <p className="text-zinc-500 text-sm text-center max-w-lg mb-8">
              Or try one of these example prompts
            </p>

            {/* Prompt Suggestion Chips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
              {PROMPT_SUGGESTIONS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="group relative text-left p-4 rounded-xl glass-card-elevated border border-white/5 hover:border-brand-500/30 hover:bg-brand-500/[0.03] transition-all duration-200 press-scale"
                >
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-3 h-3 text-brand-400" />
                  </div>
                  <p className="text-sm text-zinc-300 pr-6 leading-relaxed group-hover:text-white transition-colors">
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
                className={cn('flex gap-3 animate-slide-up-fade group', msg.role === 'user' ? 'flex-row-reverse' : '')}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg',
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand-500/20'
                      : 'bg-zinc-800 shadow-black/20'
                  )}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" aria-label="User message" />
                  ) : (
                    <Bot className="w-4 h-4 text-zinc-400" aria-label="Assistant message" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-3 rounded-2xl text-sm relative',
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-brand-600/25 to-brand-700/15 text-white rounded-br-md ring-1 ring-brand-500/10'
                      : 'glass-card text-zinc-200 rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <span className="absolute bottom-1 right-3 text-xs text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator with three bouncing dots */}
            {(startConvMutation.isPending || converseMutation.isPending) && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center shadow-lg shadow-black/20">
                  <Bot className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <span
                      className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
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
        <div className="mx-4 mb-4 glass-card-elevated rounded-2xl p-6 space-y-4 animate-spring-in border border-brand-500/20">
          {/* Header with confidence badge */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-brand-300" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{confirmation.flow.name}</h3>
                <p className="text-xs text-zinc-400 mt-1">{confirmation.flow.description}</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
              Ready to Deploy
            </span>
          </div>

          {/* Visual step-by-step breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Automation Steps</p>
            <div className="space-y-2">
              {(confirmation.humanReadableSummary || '')
                .split('\n')
                .filter((line) => line.trim())
                .map((line, idx, arr) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-300">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-300 leading-relaxed">{line}</p>
                      {idx < arr.length - 1 && <div className="w-0.5 h-2 bg-brand-500/20 ml-2.5 mt-2" />}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Trigger info */}
          {confirmation.flow.trigger && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/5 border border-brand-500/10">
              <Clock className="w-4 h-4 text-brand-400" />
              <span className="text-xs text-zinc-300">
                <span className="font-semibold text-brand-300">Trigger:</span> When conditions are met
              </span>
            </div>
          )}

          {/* Guardrails as green pills */}
          {confirmation.flow.guardrails && confirmation.flow.guardrails.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Guardrails</p>
              <div className="flex flex-wrap gap-2">
                {confirmation.flow.guardrails.map((guard, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                    <Shield className="w-3 h-3" />
                    {(guard['type'] as string) || `Guard ${idx + 1}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings as yellow pills */}
          {confirmation.warnings && confirmation.warnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Warnings</p>
              <div className="space-y-1.5">
                {confirmation.warnings.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-yellow-300">{(warning['message'] as string) || `Warning ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleConfirm}
              className="group flex-1 py-3 btn-primary text-white text-sm font-bold rounded-xl shadow-xl shadow-brand-500/20 press-scale flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Activate Flow
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={handleModify}
              className="px-5 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-300 text-sm font-medium hover:bg-white/[0.06] transition-colors press-scale"
            >
              Modify
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      {!confirmation && (
        <form onSubmit={handleSendMessage} className="px-4 pb-4 pt-2 animate-fade-in">
          <div className="flex gap-3 glass-card-elevated rounded-2xl p-2 border border-white/5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your automation..."
              className="flex-1 px-4 py-2.5 bg-transparent text-white placeholder-zinc-600 text-sm focus:outline-none"
              disabled={startConvMutation.isPending || converseMutation.isPending}
            />
            <button
              type="submit"
              disabled={startConvMutation.isPending || converseMutation.isPending || !input.trim()}
              title="Send message"
              aria-label="Send message"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 text-white transition-all disabled:opacity-30 press-scale shadow-lg shadow-brand-500/20"
            >
              {startConvMutation.isPending || converseMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
