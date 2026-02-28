/**
 * Flow Chat Page - Conversational Flow builder
 * Users describe what they want in plain English, get confirmation, then activate
 */

import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'

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

export function FlowChatPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [confirmation, setConfirmation] = useState<FlowConfirmation | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mutation for initial interpretation
  const interpretMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.post('/flows/interpret', {
        rawInput: text,
      })
      return response.data.data
    },
  })

  // Handle initial message submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Interpret the message
    try {
      const result = await interpretMutation.mutateAsync(input)

      // Add bot response with summary
      const botMessage: Message = {
        role: 'assistant',
        content: result.humanReadableSummary,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botMessage])

      // Show confirmation card
      setConfirmation(result)
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, I couldn't interpret that. Could you try rephrasing?",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleConfirm = async () => {
    if (!confirmation) return

    try {
      // Create the flow
      const response = await api.post('/flows', {
        name: confirmation.flow.name,
        description: confirmation.flow.description,
        definition: confirmation.flow,
        trigger: confirmation.flow.trigger,
        guardrails: confirmation.flow.guardrails,
      })

      // Navigate to flow detail
      navigate({ to: `/flows/${response.data.data.id}` })
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Failed to create flow. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleModify = () => {
    setConfirmation(null)
    const modifyMessage: Message = {
      role: 'assistant',
      content: 'What would you like to change?',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, modifyMessage])
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-lg">
        <h1 className="text-2xl font-bold">Flow Builder</h1>
        <p className="text-blue-100">Describe your automation in plain English</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">
              Tell me what you want to automate. For example:
            </p>
            <p className="text-gray-500 italic">
              "Every day at 3:30 PM, open Chumba, grab my daily bonus, play Sweet Bonanza at minimum bet.
              If I win more than 5x the bonus, keep going. Otherwise stop."
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xl px-4 py-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Confirmation Card */}
      {confirmation && (
        <div className="border-t bg-white p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Flow Summary</h3>
            <div className="text-sm text-blue-800 space-y-1">
              {confirmation.humanReadableSummary.split('\n').map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {confirmation.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Warnings</h4>
              {confirmation.warnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-yellow-800 mb-1">
                  • {warning.message}
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Activate This Flow
            </button>
            <button
              onClick={handleModify}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Modify
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      {!confirmation && (
        <form onSubmit={handleSendMessage} className="border-t bg-white p-6 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your automation..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={interpretMutation.isPending}
          />
          <button
            type="submit"
            disabled={interpretMutation.isPending || !input.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 font-medium"
          >
            <Send size={20} />
          </button>
        </form>
      )}
    </div>
  )
}
