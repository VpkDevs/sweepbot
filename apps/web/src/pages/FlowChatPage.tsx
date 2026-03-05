import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Send, Bot, User, Loader2, AlertTriangle, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
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
    trigger: any
    guardrails: any[]
  }
  humanReadableSummary: string
  warnings: any[]
}

/**
 * Render a conversational Flow Builder page that converts natural-language descriptions into flow drafts and lets the user confirm or modify them.
 *
 * Renders a chat-like UI where users submit plain-English automation descriptions, receives an interpreted summary and structured flow suggestion from the server, displays a confirmation card with any warnings, and provides actions to create the flow or request modifications.
 *
 * @returns The React element for the Flow Builder page.
 */
export function FlowChatPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [confirmation, setConfirmation] = useState<FlowConfirmation | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const interpretMutation = useMutation({
    mutationFn: (text: string) => api.flows.interpret(text),
  })

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    try {
      const result = await interpretMutation.mutateAsync(input)
      const botMessage: Message = {
        role: 'assistant',
        content: (result as any).humanReadableSummary ?? 'Flow interpreted successfully.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botMessage])
      setConfirmation(result as any)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't interpret that. Could you try rephrasing?", timestamp: new Date() },
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
      navigate({ to: `/flows/${(result as any).id}` })
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

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-b-2xl mx-4 mt-0 animate-reveal-up">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600/20 via-brand-500/10 to-brand-800/20" />
        <div className="absolute inset-0 aurora-bg opacity-30" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500/15">
              <Bot className="w-5 h-5 text-brand-400" />
              <div className="absolute inset-0 rounded-xl bg-brand-400/10 animate-glow-pulse" />
            </div>
            <div>
              <TextReveal as="h1" className="text-lg font-bold text-white tracking-tight text-shimmer" stagger={40}>Flow Builder</TextReveal>
              <p className="text-sm text-zinc-500">Describe your automation in plain English</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 animate-reveal-up">
            <div className="empty-icon-wrapper w-20 h-20 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-5">
              <Sparkles className="w-9 h-9 text-brand-400" />
            </div>
            <p className="text-zinc-400 text-center max-w-md mb-3 font-medium">
              Tell me what you want to automate
            </p>
            <p className="text-zinc-600 text-sm italic text-center max-w-lg text-pretty leading-relaxed">
              "Every day at 3:30 PM, open Chumba, grab my daily bonus, play Sweet Bonanza at minimum bet.
              If I win more than 5x the bonus, keep going. Otherwise stop."
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn('flex gap-3 animate-slide-up-fade', msg.role === 'user' ? 'flex-row-reverse' : '')}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg',
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand-500/20'
                    : 'bg-zinc-800 shadow-black/20'
                )}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-3 rounded-2xl text-sm',
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-brand-600/25 to-brand-700/15 text-white rounded-br-md ring-1 ring-brand-500/10'
                      : 'glass-card text-zinc-200 rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {interpretMutation.isPending && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center shadow-lg shadow-black/20">
                  <Bot className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
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
        <div className="mx-4 mb-4 glass-card-elevated rounded-2xl p-5 space-y-4 animate-spring-in">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-brand-400" />
            <h3 className="font-bold text-white text-sm tracking-tight">Flow Summary</h3>
          </div>
          <div className="text-sm text-zinc-300 space-y-1 bg-brand-500/5 rounded-xl p-4 border border-brand-500/10">
            {(confirmation.humanReadableSummary ?? '').split('\n').map((line, idx) => (
              <div key={idx} className="leading-relaxed">{line}</div>
            ))}
          </div>

          {confirmation.warnings?.length > 0 && (
            <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                <h4 className="font-semibold text-yellow-300 text-xs">Warnings</h4>
              </div>
              {confirmation.warnings.map((warning: any, idx: number) => (
                <div key={idx} className="text-xs text-yellow-300/80 mb-1">{warning.message}</div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="group flex-1 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-xl shadow-brand-500/20 press-scale flex items-center justify-center gap-2"
            >
              Activate This Flow
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={handleModify}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-300 text-sm font-medium hover:bg-white/[0.06] transition-colors press-scale"
            >
              Modify
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {!confirmation && (
        <form onSubmit={handleSendMessage} className="px-4 pb-4 pt-2 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="flex gap-3 glass-card-elevated rounded-2xl p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your automation..."
              className="flex-1 px-4 py-2.5 bg-transparent text-white placeholder-zinc-600 text-sm focus:outline-none"
              disabled={interpretMutation.isPending}
            />
            <button
              type="submit"
              disabled={interpretMutation.isPending || !input.trim()}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 text-white transition-all disabled:opacity-30 press-scale shadow-lg shadow-brand-500/20"
            >
              {interpretMutation.isPending ? (
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
