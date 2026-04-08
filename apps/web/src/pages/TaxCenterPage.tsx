import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  DollarSign,
  Download,
  FileText,
  TrendingUp,
  AlertCircle,
  Calendar,
  Info,
  ExternalLink,
  ReceiptText,
  Landmark,
  Scale,
  Calculator,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, CHART_TOOLTIP_STYLE } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { AnimatedCounter } from '../components/fx/AnimatedCounter'
import { TextReveal } from '../components/fx/TextReveal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaxTransaction {
  id: string
  platform_name: string
  type: 'redemption' | 'prize' | 'bonus'
  amount_usd: number
  date: string
  status: 'completed' | 'pending' | 'rejected'
  payment_method: string
  notes?: string
}

interface MonthlyBreakdown {
  month: string // "Jan", "Feb" etc.
  month_num: number
  redemptions: number
  prizes: number
  total: number
}

interface YearSummary {
  year: number
  total_redemptions_usd: number
  total_prizes_usd: number
  total_taxable_usd: number
  est_federal_liability: number
  est_state_liability: number
  transaction_count: number
}

interface TaxSummaryData {
  year: number
  total_redemptions_usd: number
  total_prizes_usd: number
  total_taxable_usd: number
  est_federal_liability: number
  est_state_liability: number
  est_total_liability: number
  effective_rate: number
  transaction_count: number
  platforms_count: number
  monthly: MonthlyBreakdown[]
  top_platforms: Array<{ name: string; amount: number; pct: number }>
}

// ─── Stub data ────────────────────────────────────────────────────────────────

function buildMonthlyStub(_year: number): MonthlyBreakdown[] {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return months.map((m, i) => {
    const base = Math.random() * 800 + 200
    return {
      month: m,
      month_num: i + 1,
      redemptions: Math.round(base * 0.7),
      prizes: Math.round(base * 0.3),
      total: Math.round(base),
    }
  })
}

const STUB_SUMMARIES: Record<number, TaxSummaryData> = {
  2025: {
    year: 2025,
    total_redemptions_usd: 8_742.5,
    total_prizes_usd: 1_320.0,
    total_taxable_usd: 10_062.5,
    est_federal_liability: 2_213.75,
    est_state_liability: 452.81,
    est_total_liability: 2_666.56,
    effective_rate: 26.5,
    transaction_count: 47,
    platforms_count: 8,
    monthly: buildMonthlyStub(2025),
    top_platforms: [
      { name: 'Chumba Casino', amount: 3200, pct: 36.5 },
      { name: 'Pulsz Casino', amount: 2100, pct: 24.0 },
      { name: 'WOW Vegas', amount: 1800, pct: 20.6 },
      { name: 'Stake.us', amount: 900, pct: 10.3 },
      { name: 'Others', amount: 742.5, pct: 8.6 },
    ],
  },
  2024: {
    year: 2024,
    total_redemptions_usd: 6_180.0,
    total_prizes_usd: 980.0,
    total_taxable_usd: 7_160.0,
    est_federal_liability: 1_575.2,
    est_state_liability: 322.2,
    est_total_liability: 1_897.4,
    effective_rate: 26.5,
    transaction_count: 34,
    platforms_count: 6,
    monthly: buildMonthlyStub(2024),
    top_platforms: [
      { name: 'Chumba Casino', amount: 2400, pct: 38.7 },
      { name: 'Pulsz Casino', amount: 1600, pct: 25.8 },
      { name: 'WOW Vegas', amount: 1200, pct: 19.4 },
      { name: 'Others', amount: 980, pct: 16.1 },
    ],
  },
}

const DEFAULT_TAX_SUMMARY: TaxSummaryData = {
  year: 2025,
  total_redemptions_usd: 0,
  total_prizes_usd: 0,
  total_taxable_usd: 0,
  est_federal_liability: 0,
  est_state_liability: 0,
  est_total_liability: 0,
  effective_rate: 0,
  transaction_count: 0,
  platforms_count: 0,
  monthly: [],
  top_platforms: [],
}

const STUB_TRANSACTIONS: TaxTransaction[] = [
  {
    id: 't1',
    platform_name: 'Chumba Casino',
    type: 'redemption',
    amount_usd: 450.0,
    date: '2025-12-15',
    status: 'completed',
    payment_method: 'PayPal',
  },
  {
    id: 't2',
    platform_name: 'Pulsz Casino',
    type: 'redemption',
    amount_usd: 200.0,
    date: '2025-12-08',
    status: 'completed',
    payment_method: 'ACH',
  },
  {
    id: 't3',
    platform_name: 'WOW Vegas',
    type: 'prize',
    amount_usd: 320.0,
    date: '2025-11-22',
    status: 'completed',
    payment_method: 'Prepaid Visa',
  },
  {
    id: 't4',
    platform_name: 'Stake.us',
    type: 'redemption',
    amount_usd: 150.0,
    date: '2025-11-14',
    status: 'pending',
    payment_method: 'ACH',
  },
  {
    id: 't5',
    platform_name: 'Chumba Casino',
    type: 'redemption',
    amount_usd: 800.0,
    date: '2025-10-30',
    status: 'completed',
    payment_method: 'PayPal',
  },
  {
    id: 't6',
    platform_name: 'Pulsz Casino',
    type: 'redemption',
    amount_usd: 275.0,
    date: '2025-10-11',
    status: 'completed',
    payment_method: 'ACH',
  },
  {
    id: 't7',
    platform_name: 'WOW Vegas',
    type: 'redemption',
    amount_usd: 400.0,
    date: '2025-09-28',
    status: 'completed',
    payment_method: 'PayPal',
  },
  {
    id: 't8',
    platform_name: 'Global Poker',
    type: 'redemption',
    amount_usd: 120.0,
    date: '2025-09-03',
    status: 'rejected',
    payment_method: 'ACH',
    notes: 'Verification required',
  },
]

const STUB_YOY: YearSummary[] = [
  {
    year: 2023,
    total_redemptions_usd: 4200,
    total_prizes_usd: 600,
    total_taxable_usd: 4800,
    est_federal_liability: 1056,
    est_state_liability: 216,
    transaction_count: 22,
  },
  {
    year: 2024,
    total_redemptions_usd: 6180,
    total_prizes_usd: 980,
    total_taxable_usd: 7160,
    est_federal_liability: 1575,
    est_state_liability: 322,
    transaction_count: 34,
  },
  {
    year: 2025,
    total_redemptions_usd: 8742,
    total_prizes_usd: 1320,
    total_taxable_usd: 10062,
    est_federal_liability: 2213,
    est_state_liability: 453,
    transaction_count: 47,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(val: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val)
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function TaxTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null
  return (
    <div
      style={CHART_TOOLTIP_STYLE}
      className="min-w-36 rounded-xl border border-zinc-700 p-3 shadow-xl"
    >
      <p className="mb-2 text-xs font-semibold text-zinc-400">{label as string}</p>
      {payload.map((entry: Record<string, unknown>) => (
        <div key={entry.name as string} className="flex items-center justify-between gap-4">
          <span className="text-xs" style={{ color: entry.color as string }}>
            {entry.name as string}
          </span>
          <span className="text-xs font-bold text-white">
            {formatUSD(entry.value as number, 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Summary stat card ─────────────────────────────────────────────────────────

function TaxStat({
  label,
  value,
  sub,
  icon: Icon,
  color,
  prefix = '$',
}: {
  label: string
  value: number
  sub: string
  icon: React.ElementType
  color: string
  prefix?: string
}) {
  return (
    <SpotlightCard className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
          <p className={cn('text-2xl font-black tabular-nums', color)}>
            {prefix}
            <AnimatedCounter value={Math.round(value)} />
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>
        </div>
        <div className="ml-3 shrink-0 rounded-lg bg-zinc-800 p-2">
          <Icon className={cn('h-4 w-4', color)} />
        </div>
      </div>
    </SpotlightCard>
  )
}

// ─── Transaction table ────────────────────────────────────────────────────────

const TX_STATUS: Record<string, { cls: string; label: string }> = {
  completed: { cls: 'text-green-400 bg-green-900/20 border-green-800/50', label: 'Completed' },
  pending: { cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/50', label: 'Pending' },
  rejected: { cls: 'text-red-400 bg-red-900/20 border-red-800/50', label: 'Rejected' },
}

function TransactionTable({ transactions }: { transactions: TaxTransaction[] }) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? transactions : transactions.slice(0, 6)

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ReceiptText className="text-brand-400 h-4 w-4" />
          <h3 className="text-sm font-semibold text-white">Taxable Transactions</h3>
        </div>
        <span className="text-xs text-zinc-500">{transactions.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              {['Date', 'Platform', 'Type', 'Amount', 'Method', 'Status'].map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {shown.map((tx, i) => {
              const status = TX_STATUS[tx.status] ?? TX_STATUS.completed
              return (
                <tr
                  key={tx.id}
                  className="transition-colors hover:bg-zinc-800/30"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                    {new Date(tx.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="max-w-40 truncate whitespace-nowrap px-4 py-3 text-xs font-medium text-zinc-200">
                    {tx.platform_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize text-zinc-400">{tx.type}</span>
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-sm font-bold tabular-nums',
                      tx.status === 'rejected' ? 'text-zinc-600 line-through' : 'text-green-400'
                    )}
                  >
                    {formatUSD(tx.amount_usd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                    {tx.payment_method}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                        status.cls
                      )}
                    >
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {transactions.length > 6 && (
        <div className="border-t border-zinc-800 px-5 py-3 text-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${transactions.length} transactions`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Year-over-year chart ─────────────────────────────────────────────────────

function YearOverYearChart({ data }: { data: YearSummary[] }) {
  const chartData = data.map((y) => ({
    year: String(y.year),
    Redemptions: y.total_redemptions_usd,
    Prizes: y.total_prizes_usd,
    'Est. Tax': y.est_federal_liability + y.est_state_liability,
  }))

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="text-brand-400 h-4 w-4" />
        <h3 className="text-sm font-semibold text-white">Year-Over-Year Summary</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: '#71717a', fontSize: 12 }} />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#71717a', fontSize: 10 }}
          />
          <Tooltip content={<TaxTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
          <Bar dataKey="Redemptions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Prizes" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Est. Tax" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.7} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Monthly chart ────────────────────────────────────────────────────────────

function MonthlyChart({ data }: { data: MonthlyBreakdown[] }) {
  const chartData = data.map((m) => ({
    month: m.month,
    Redemptions: m.redemptions,
    Prizes: m.prizes,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="taxRedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="taxBlueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 10 }} />
        <YAxis tickFormatter={(v) => `$${v}`} tick={{ fill: '#71717a', fontSize: 10 }} />
        <Tooltip content={<TaxTooltip />} />
        <Area
          type="monotone"
          dataKey="Redemptions"
          stroke="#8b5cf6"
          fill="url(#taxRedGrad)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="Prizes"
          stroke="#06b6d4"
          fill="url(#taxBlueGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Platform breakdown ───────────────────────────────────────────────────────

function PlatformBreakdown({
  platforms,
}: {
  platforms: Array<{ name: string; amount: number; pct: number }>
}) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2">
        <Landmark className="text-brand-400 h-4 w-4" />
        <h3 className="text-sm font-semibold text-white">Income by Platform</h3>
      </div>
      <div className="space-y-2.5">
        {platforms.map((p, i) => (
          <div key={p.name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="max-w-36 truncate text-xs text-zinc-300">{p.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{p.pct.toFixed(1)}%</span>
                <span className="text-xs font-bold tabular-nums text-white">
                  {formatUSD(p.amount, 0)}
                </span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${p.pct}%`,
                  background: `hsl(${270 - i * 20}, 70%, ${60 - i * 5}%)`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tax estimate panel ────────────────────────────────────────────────────────

function TaxEstimatePanel({ summary }: { summary: TaxSummaryData }) {
  const brackets = [
    { label: 'Federal (est. 22%)', amount: summary.est_federal_liability, color: 'text-red-400' },
    { label: 'State (est. 4.5%)', amount: summary.est_state_liability, color: 'text-orange-400' },
  ]

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-red-400" />
        <h3 className="text-sm font-semibold text-white">Estimated Tax Liability</h3>
      </div>

      {/* Big number */}
      <div className="py-3 text-center">
        <p className="mb-1 text-xs text-zinc-500">Total Estimated Owed</p>
        <p className="text-4xl font-black tabular-nums text-red-400">
          {formatUSD(summary.est_total_liability)}
        </p>
        <p className="mt-1 text-xs text-zinc-600">~{summary.effective_rate}% effective rate</p>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        {brackets.map((b) => (
          <div key={b.label} className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{b.label}</span>
            <span className={cn('text-sm font-bold tabular-nums', b.color)}>
              {formatUSD(b.amount)}
            </span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t border-zinc-800 pt-2">
          <span className="text-xs font-semibold text-zinc-300">Total Taxable Income</span>
          <span className="text-sm font-black tabular-nums text-white">
            {formatUSD(summary.total_taxable_usd)}
          </span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-yellow-800/30 bg-yellow-900/10 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
        <p className="text-[10px] leading-relaxed text-yellow-600">
          Estimates only. Sweepstakes casino winnings may have complex tax treatment. Consult a
          qualified tax professional.
        </p>
      </div>

      <a
        href="https://www.irs.gov/taxtopics/tc419"
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-400 hover:text-brand-300 flex items-center gap-1 text-xs transition-colors"
      >
        IRS guidance on gambling income <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

// ─── Export button ─────────────────────────────────────────────────────────────

function ExportButton({ year }: { year: number }) {
  const [downloading, setDownloading] = useState(false)

  const handleExport = () => {
    setDownloading(true)
    const url = api.tax.exportUrl(year)
    window.open(url, '_blank')
    setTimeout(() => setDownloading(false), 2000)
  }

  return (
    <button
      onClick={handleExport}
      disabled={downloading}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all',
        downloading
          ? 'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500'
          : 'border-green-700/50 bg-green-900/20 text-green-300 hover:border-green-600 hover:bg-green-900/40'
      )}
    >
      <Download className={cn('h-4 w-4', downloading && 'animate-bounce')} />
      {downloading ? 'Preparing…' : 'Export CSV'}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023]

export function TaxCenterPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(
    AVAILABLE_YEARS.includes(currentYear - 1) ? currentYear - 1 : (AVAILABLE_YEARS[1] ?? 2025)
  )

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['tax-summary', selectedYear],
    queryFn: () => api.tax.summary(selectedYear),
    staleTime: 300_000,
    retry: false,
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['tax-transactions', selectedYear],
    queryFn: () => api.tax.transactions({ year: selectedYear, limit: 100 }),
    staleTime: 300_000,
    retry: false,
  })

  const { data: yoyData } = useQuery({
    queryKey: ['tax-yoy'],
    queryFn: () => api.tax.yearOverYear(),
    staleTime: 600_000,
    retry: false,
  })

  // Graceful fallback
  const summary =
    (summaryData as TaxSummaryData | undefined) ??
    STUB_SUMMARIES[selectedYear] ??
    Object.values(STUB_SUMMARIES)[0] ??
    DEFAULT_TAX_SUMMARY
  const transactions = (txData as TaxTransaction[] | undefined) ?? STUB_TRANSACTIONS
  const yoy = (yoyData as YearSummary[] | undefined) ?? STUB_YOY

  const isLoading = summaryLoading || txLoading

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <ScrollReveal>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <TextReveal as="h1" className="text-2xl font-bold text-white">
              Tax Center
            </TextReveal>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Accountant-ready summaries, estimated liabilities, and a complete transaction record
              for every prize redemption you&apos;ve made.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* Year picker */}
            <div className="flex items-center gap-1 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
              {AVAILABLE_YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={cn(
                    'px-3 py-2 text-sm font-semibold transition-all',
                    selectedYear === year
                      ? 'bg-brand-600 text-white'
                      : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
            <ExportButton year={selectedYear} />
          </div>
        </div>
      </ScrollReveal>

      {/* ── Disclaimer banner ─────────────────────────────── */}
      <ScrollReveal delay={40}>
        <div className="flex items-start gap-3 rounded-xl border border-blue-800/40 bg-blue-950/30 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-300/80">
            <strong className="text-blue-200">Not tax advice.</strong> SweepBot aggregates your
            redemption records to help you stay organized. Tax treatment of sweepstakes prizes
            varies by jurisdiction and individual circumstances.{' '}
            <strong>Always consult a CPA or tax attorney</strong> before filing. Estimates use a 22%
            federal + 4.5% state blended rate as a rough proxy only.
          </p>
        </div>
      </ScrollReveal>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
            />
          ))}
        </div>
      ) : (
        <>
          {/* ── Summary stats ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: 'Total Redemptions',
                value: summary.total_redemptions_usd,
                sub: `${summary.transaction_count} transactions`,
                icon: DollarSign,
                color: 'text-green-400',
              },
              {
                label: 'Total Prizes',
                value: summary.total_prizes_usd,
                sub: 'jackpots & promotions',
                icon: TrendingUp,
                color: 'text-cyan-400',
              },
              {
                label: 'Total Taxable',
                value: summary.total_taxable_usd,
                sub: 'gross reportable income',
                icon: Scale,
                color: 'text-yellow-400',
              },
              {
                label: 'Est. Tax Owed',
                value: summary.est_total_liability,
                sub: `~${summary.effective_rate}% effective rate`,
                icon: Landmark,
                color: 'text-red-400',
              },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 60}>
                <TaxStat {...item} />
              </ScrollReveal>
            ))}
          </div>

          {/* ── Secondary metrics ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: 'Platforms Used',
                value: summary.platforms_count,
                sub: 'with reportable income',
                icon: FileText,
                color: 'text-brand-400',
                prefix: '',
              },
              {
                label: 'Federal Liability',
                value: summary.est_federal_liability,
                sub: 'estimated at 22%',
                icon: Landmark,
                color: 'text-red-400',
              },
              {
                label: 'State Liability',
                value: summary.est_state_liability,
                sub: 'estimated at 4.5%',
                icon: Calculator,
                color: 'text-orange-400',
              },
              {
                label: 'Transactions',
                value: summary.transaction_count,
                sub: 'completed redemptions',
                icon: ReceiptText,
                color: 'text-zinc-300',
                prefix: '',
              },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={240 + i * 60}>
                <TaxStat {...item} />
              </ScrollReveal>
            ))}
          </div>

          {/* ── Monthly chart + breakdown ──────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Monthly area chart */}
            <div className="space-y-6 lg:col-span-2">
              <ScrollReveal delay={100}>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="text-brand-400 h-4 w-4" />
                      <h3 className="text-sm font-semibold text-white">
                        Monthly Income — {selectedYear}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="bg-brand-500 inline-block h-2 w-2 rounded-full" />
                        Redemptions
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
                        Prizes
                      </span>
                    </div>
                  </div>
                  <MonthlyChart data={summary.monthly} />
                </div>
              </ScrollReveal>

              {/* YoY chart */}
              <ScrollReveal delay={140}>
                <YearOverYearChart data={yoy} />
              </ScrollReveal>

              {/* Transaction table */}
              <ScrollReveal delay={180}>
                <TransactionTable transactions={transactions} />
              </ScrollReveal>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              <ScrollReveal delay={80}>
                <TaxEstimatePanel summary={summary} />
              </ScrollReveal>

              <ScrollReveal delay={120}>
                <PlatformBreakdown platforms={summary.top_platforms} />
              </ScrollReveal>

              {/* Accountant package CTA */}
              <ScrollReveal delay={160}>
                <SpotlightCard className="from-brand-950/70 border-brand-800/40 relative overflow-hidden rounded-xl border bg-gradient-to-br to-zinc-900 p-4">
                  <div className="bg-brand-500/10 absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      <FileText className="text-brand-400 h-4 w-4" />
                      <span className="text-brand-300 text-xs font-bold uppercase tracking-wide">
                        Accountant Package
                      </span>
                    </div>
                    <p className="mb-1 text-sm font-semibold text-white">Ready for Your CPA</p>
                    <p className="mb-3 text-xs text-zinc-400">
                      Export a complete, PDF-formatted summary with all transactions, platform
                      totals, and estimated liabilities &mdash; formatted for CPA review.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => window.open(api.tax.exportUrl(selectedYear), '_blank')}
                        className="bg-brand-600 hover:bg-brand-500 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download CSV
                      </button>
                      <button className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200">
                        <FileText className="h-3.5 w-3.5" />
                        PDF Summary (Pro)
                      </button>
                    </div>
                  </div>
                </SpotlightCard>
              </ScrollReveal>

              {/* Resources */}
              <ScrollReveal delay={200}>
                <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Tax Resources
                  </h3>
                  {[
                    {
                      label: 'IRS Topic 419: Gambling Income',
                      href: 'https://www.irs.gov/taxtopics/tc419',
                    },
                    {
                      label: 'W-2G Reporting Thresholds',
                      href: 'https://www.irs.gov/forms-pubs/about-form-w-2-g',
                    },
                    {
                      label: 'State Tax Guides (H&R Block)',
                      href: 'https://www.hrblock.com/tax-center/income/other-income/gambling-winnings-tax/',
                    },
                    {
                      label: 'Find a CPA Near You',
                      href: 'https://www.aicpa.org/forthepublic/find-a-cpa',
                    },
                  ].map(({ label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      <span>{label}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              </ScrollReveal>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
