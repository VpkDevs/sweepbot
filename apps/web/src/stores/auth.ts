import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Session } from '@supabase/supabase-js'
import { supabaseClient, supabaseStub } from '../lib/supabase'

// Use supabaseClient which handles the null case
const getSupabase = () => supabaseClient ?? supabaseStub

export interface AuthState {
  user: User | null
  session: Session | null
  tier: string
  isLoading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setTier: (tier: string) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      user: null,
      session: null,
      tier: 'free',
      isLoading: true,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setTier: (tier) => set({ tier }),

      signIn: async (email, password) => {
        const supabase = getSupabase()
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        set({ user: data.user, session: data.session })
      },

      signUp: async (email, password) => {
        const supabase = getSupabase()
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        set({ user: data.user, session: data.session })
      },

      signInWithGoogle: async () => {
        const supabase = getSupabase()
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
      },

      signOut: async () => {
        const supabase = getSupabase()
        await supabase.auth.signOut()
        set({ user: null, session: null, tier: 'free' })
      },

      refreshSession: async () => {
        const supabase = getSupabase()
        try {
          const { data, error } = await supabase.auth.getSession()
          if (error || !data.session) {
            set({ user: null, session: null, isLoading: false })
            return
          }
          set({ user: data.session.user, session: data.session, isLoading: false })
        } catch {
          set({ user: null, session: null, isLoading: false })
        }
      },
    }),
    {
      name: 'sweepbot-auth',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        tier: state.tier,
      }),
    }
  )
)

// Initialize auth listener on module load - only if Supabase is available
const supabase = getSupabase()
supabase.auth.onAuthStateChange((event, session) => {
  const store = useAuthStore.getState()
  store.setUser(session?.user ?? null)
  store.setSession(session)

  if (event === 'SIGNED_OUT') {
    store.setTier('free')
  }
})
