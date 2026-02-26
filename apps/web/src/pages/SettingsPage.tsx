import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User,
  Lock,
  Bell,
  CreditCard,
  FileText,
  Shield,
  Zap,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'
import { cn, formatSC } from '../lib/utils'

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'profile' | 'security' | 'notifications' | 'subscription' | 'tax' | 'responsible' | 'danger'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'tax', label: 'Tax Center', icon: FileText },
  { id: 'responsible', label: 'Responsible Play', icon: Shield },
  { id: 'danger', label: 'Danger Zone', icon: Trash2 },
]

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
        saved
          ? 'bg-green-800 text-green-200'
          : 'bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50'
      )}
    >
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {saved && <CheckCircle2 className="w-3.5 h-3.5" />}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
    </button>
  )
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await supabase.auth.updateUser({ data: { display_name: displayName } })
      void qc.invalidateQueries({ queryKey: ['user'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Profile" description="Your public identity on SweepBot.">
      <InputField
        label="Email"
        value={user?.email ?? ''}
        disabled
      />
      <InputField
        label="Display Name"
        value={displayName}
        onChange={setDisplayName}
        placeholder="Your name or nickname"
      />
      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </Section>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleChangePassword() {
    setError(null)
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    if (newPw.length < 8) { setError('New password must be at least 8 characters.'); return }

    setSaving(true)
    try {
      // Re-authenticate then update
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('No user found.')

      // Sign in with old password to verify
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPw,
      })
      if (signInError) throw new Error('Current password is incorrect.')

      const { error: updateError } = await supabase.auth.updateUser({ password: newPw })
      if (updateError) throw updateError

      setOldPw(''); setNewPw(''); setConfirmPw('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Password & Security">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-lg bg-green-950/50 border border-green-800 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Password updated successfully.
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Current Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <InputField
        label="New Password (min 8 chars)"
        value={newPw}
        onChange={setNewPw}
        type={showPw ? 'text' : 'password'}
        placeholder="••••••••"
      />
      <InputField
        label="Confirm New Password"
        value={confirmPw}
        onChange={setConfirmPw}
        type={showPw ? 'text' : 'password'}
        placeholder="••••••••"
      />

      <button
        onClick={handleChangePassword}
        disabled={saving || !oldPw || !newPw || !confirmPw}
        className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Update Password
      </button>
    </Section>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

type NotifPrefs = {
  jackpot_surge: boolean
  jackpot_near_ceiling: boolean
  tos_change_major: boolean
  tos_change_any: boolean
  redemption_status: boolean
  weekly_digest: boolean
  platform_trust_drop: boolean
  bonus_calendar: boolean
}

function NotificationsTab() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['user', 'notifications'],
    queryFn: () => api.user.notificationPrefs(),
    staleTime: 300_000,
  })

  const prefs = (data as { data?: NotifPrefs })?.data

  const mutation = useMutation({
    mutationFn: (updates: Partial<NotifPrefs>) => api.user.updateNotificationPrefs(updates),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['user', 'notifications'] }),
  })

  const toggles: { key: keyof NotifPrefs; label: string; description: string }[] = [
    { key: 'jackpot_surge', label: 'Jackpot Surge Alerts', description: 'When a jackpot is growing unusually fast' },
    { key: 'jackpot_near_ceiling', label: 'Must-Hit-By Alerts', description: 'When a jackpot approaches its ceiling' },
    { key: 'tos_change_major', label: 'Major TOS Changes', description: 'When a platform makes a significant policy change' },
    { key: 'tos_change_any', label: 'All TOS Changes', description: 'Any detected change to platform terms' },
    { key: 'redemption_status', label: 'Redemption Updates', description: 'Status changes on your active redemptions' },
    { key: 'weekly_digest', label: 'Weekly Digest', description: 'A summary of your stats and notable events' },
    { key: 'platform_trust_drop', label: 'Trust Score Drops', description: 'When a platform\'s Trust Index falls significantly' },
    { key: 'bonus_calendar', label: 'Bonus Calendar', description: 'Upcoming promotions and bonus opportunities' },
  ]

  return (
    <Section title="Notification Preferences" description="Control what SweepBot alerts you about.">
      {toggles.map(({ key, label, description }) => {
        const enabled = prefs?.[key] ?? false
        return (
          <div key={key} className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-white">{label}</p>
              <p className="text-xs text-zinc-500">{description}</p>
            </div>
            <button
              onClick={() => mutation.mutate({ [key]: !enabled })}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors focus:outline-none',
                enabled ? 'bg-brand-600' : 'bg-zinc-700'
              )}
            >
              <span className={cn(
                'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                enabled ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>
        )
      })}
    </Section>
  )
}

// ─── Subscription Tab ─────────────────────────────────────────────────────────

const TIER_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  analyst: 'Analyst',
  elite: 'Elite',
  lifetime: 'Lifetime Pro',
}

function SubscriptionTab() {
  const { data } = useQuery({
    queryKey: ['user', 'subscription'],
    queryFn: () => api.user.subscription(),
    staleTime: 300_000,
  })

  const sub = (data as { data?: Record<string, unknown> })?.data

  return (
    <div className="space-y-4">
      <Section title="Current Plan">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-white">
              {TIER_NAMES[sub?.['tier'] as string] ?? 'Free'}
            </p>
            {sub?.['current_period_end'] && (
              <p className="text-xs text-zinc-500 mt-0.5">
                {sub['cancel_at_period_end']
                  ? `Cancels on ${new Date(sub['current_period_end'] as string).toLocaleDateString()}`
                  : `Renews on ${new Date(sub['current_period_end'] as string).toLocaleDateString()}`
                }
              </p>
            )}
          </div>
          {sub?.['tier'] !== 'free' && sub?.['tier'] !== 'lifetime' && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Zap className="w-3.5 h-3.5 text-brand-400" />
              {sub?.['stripe_subscription_id'] ? 'Stripe Billing' : 'Active'}
            </div>
          )}
        </div>

        <a
          href="/pricing"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {sub?.['tier'] === 'free' ? 'Upgrade Plan' : 'Change Plan'}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </Section>

      {sub?.['tier'] !== 'free' && sub?.['stripe_subscription_id'] && (
        <Section title="Billing Portal" description="Manage payment methods, view invoices, and cancel.">
          <a
            href="/api/user/billing-portal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Open Stripe Billing Portal
            <ExternalLink className="w-3 h-3" />
          </a>
        </Section>
      )}
    </div>
  )
}

// ─── Tax Center Tab ───────────────────────────────────────────────────────────

function TaxTab() {
  const currentYear = new Date().getFullYear()
  const [taxYear, setTaxYear] = useState(currentYear)

  const { data, isLoading } = useQuery({
    queryKey: ['user', 'tax', taxYear],
    queryFn: () => api.user.taxSummary(taxYear),
    staleTime: 3_600_000,
  })

  const taxData = (data as { data?: Record<string, unknown> })?.data

  return (
    <div className="space-y-4">
      <Section title="Tax Summary" description="Total redemptions by platform for tax reporting.">
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400">Tax Year</label>
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="bg-zinc-950 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : taxData ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Redeemed', value: `${formatSC(taxData['total_redeemed_sc'] as number)} SC` },
                { label: 'Est. USD Value', value: `$${((taxData['total_redeemed_sc'] as number) ?? 0).toFixed(2)}` },
                { label: 'Platforms Used', value: String(taxData['platform_count'] ?? 0) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* By platform */}
            {((taxData['by_platform'] as Record<string, unknown>[]) ?? []).map((p) => (
              <div key={p['platform_id'] as string} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                <p className="text-sm text-zinc-300">{p['platform_name'] as string}</p>
                <p className="text-sm font-medium text-white tabular-nums">
                  {formatSC(p['total_sc'] as number)} SC
                </p>
              </div>
            ))}

            <div className="flex items-center gap-3">
              <p className="text-xs text-zinc-500 flex-1">
                <AlertTriangle className="w-3 h-3 inline mr-1 text-yellow-400" />
                SweepBot is not a tax advisor. Consult a qualified professional.
              </p>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors">
                <Download className="w-3 h-3" />
                Export PDF
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No redemption data for {taxYear}.</p>
        )}
      </Section>
    </div>
  )
}

// ─── Responsible Play Tab ─────────────────────────────────────────────────────

type ResponsiblePrefs = {
  session_time_limit_minutes: number | null
  daily_loss_limit_sc: number | null
  reality_check_interval_minutes: number | null
  self_exclusion_until: string | null
  chase_detection_enabled: boolean
}

function ResponsiblePlayTab() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['user', 'responsible'],
    queryFn: () => api.user.responsiblePlayPrefs(),
    staleTime: 300_000,
  })

  const prefs = (data as { data?: ResponsiblePrefs })?.data

  const [sessionLimit, setSessionLimit] = useState<string>('')
  const [lossLimit, setLossLimit] = useState<string>('')
  const [realityCheck, setRealityCheck] = useState<string>('')
  const [chaseDetection, setChaseDetection] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (prefs) {
      setSessionLimit(String(prefs.session_time_limit_minutes ?? ''))
      setLossLimit(String(prefs.daily_loss_limit_sc ?? ''))
      setRealityCheck(String(prefs.reality_check_interval_minutes ?? ''))
      setChaseDetection(prefs.chase_detection_enabled)
    }
  }, [prefs])

  async function handleSave() {
    setSaving(true)
    try {
      await api.user.updateResponsiblePlayPrefs({
        session_time_limit_minutes: sessionLimit ? Number(sessionLimit) : null,
        daily_loss_limit_sc: lossLimit ? Number(lossLimit) : null,
        reality_check_interval_minutes: realityCheck ? Number(realityCheck) : null,
        chase_detection_enabled: chaseDetection,
      })
      void qc.invalidateQueries({ queryKey: ['user', 'responsible'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title="Responsible Play"
      description="Set limits to help you stay in control. These limits are enforced by SweepBot."
    >
      <div className="px-3 py-2 rounded-lg bg-blue-950/30 border border-blue-800/50 text-blue-300 text-xs flex items-start gap-2">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          SweepBot is a tracking and automation tool, not a gambling platform. These tools exist to
          support your wellbeing — we encourage setting limits that reflect your personal goals.
        </span>
      </div>

      <InputField
        label="Session Time Limit (minutes, blank to disable)"
        value={sessionLimit}
        onChange={setSessionLimit}
        type="number"
        placeholder="e.g. 60"
      />
      <InputField
        label="Daily Loss Limit (SC, blank to disable)"
        value={lossLimit}
        onChange={setLossLimit}
        type="number"
        placeholder="e.g. 100"
      />
      <InputField
        label="Reality Check Interval (minutes, blank to disable)"
        value={realityCheck}
        onChange={setRealityCheck}
        type="number"
        placeholder="e.g. 30"
      />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white">Chase Detection</p>
          <p className="text-xs text-zinc-500">Alert me if my session pattern suggests chasing losses</p>
        </div>
        <button
          onClick={() => setChaseDetection((v) => !v)}
          className={cn(
            'relative w-10 h-6 rounded-full transition-colors',
            chaseDetection ? 'bg-brand-600' : 'bg-zinc-700'
          )}
        >
          <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform', chaseDetection ? 'translate-x-5' : 'translate-x-1')} />
        </button>
      </div>

      <SaveButton saving={saving} saved={saved} onClick={handleSave} />

      {prefs?.self_exclusion_until ? (
        <div className="px-3 py-2 rounded-lg bg-red-950/30 border border-red-800/50 text-red-300 text-xs">
          Self-exclusion active until {new Date(prefs.self_exclusion_until).toLocaleDateString()}.
        </div>
      ) : (
        <button
          onClick={() => {
            if (confirm('Are you sure you want to activate a 30-day self-exclusion? You will be locked out until then.')) {
              // TODO: call api.user.selfExclude()
            }
          }}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Activate self-exclusion (30 days) →
        </button>
      )}

      {/* Resource footer */}
      <p className="text-xs text-zinc-600">
        If you or someone you know needs support with problem gambling, visit{' '}
        <a
          href="https://www.ncpgambling.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-zinc-300 underline"
        >
          ncpgambling.org
        </a>
        {' '}or call the NCPG helpline: 1-800-522-4700.
      </p>
    </Section>
  )
}

// ─── Danger Zone Tab ──────────────────────────────────────────────────────────

function DangerZoneTab() {
  const { signOut } = useAuthStore()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteAccount() {
    if (confirmText !== 'delete my account') return
    setDeleting(true)
    try {
      await api.user.deleteAccount()
      await signOut()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <Section title="Danger Zone" description="Irreversible actions. Proceed with extreme caution.">
      <div className="space-y-4 border border-red-800/50 rounded-xl p-4 bg-red-950/10">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-300">Delete Account</p>
            <p className="text-xs text-zinc-400 mt-1">
              This permanently deletes your account, all tracked data, redemption history, and
              analytics. This cannot be undone.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Type <span className="text-red-400 font-mono">delete my account</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete my account"
            className="w-full px-3 py-2 bg-zinc-950 border border-red-800/50 text-white placeholder-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <button
          onClick={handleDeleteAccount}
          disabled={confirmText !== 'delete my account' || deleting}
          className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <Trash2 className="w-3.5 h-3.5" />
          Permanently Delete Account
        </button>
      </div>
    </Section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // Allow direct tab linking via URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    if (hash && TABS.find((t) => t.id === hash)) {
      setActiveTab(hash)
    }
  }, [])

  const TAB_CONTENT: Record<Tab, React.ReactNode> = {
    profile: <ProfileTab />,
    security: <SecurityTab />,
    notifications: <NotificationsTab />,
    subscription: <SubscriptionTab />,
    tax: <TaxTab />,
    responsible: <ResponsiblePlayTab />,
    danger: <DangerZoneTab />,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage your account, preferences, and subscription.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <nav className="w-44 shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id)
                window.history.replaceState(null, '', `#${id}`)
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                activeTab === id
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
                id === 'danger' && activeTab !== 'danger' && 'text-red-500 hover:text-red-400'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-4">{TAB_CONTENT[activeTab]}</div>
      </div>
    </div>
  )
}
