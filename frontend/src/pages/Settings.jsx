// src/pages/Settings.jsx
// ============================================================
// AEKADS Settings — Complete with Plan Management
// Tabs: Organization | Subscription | Billing | Security
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  Building2, CreditCard, Key, Check, Save, Loader2,
  Monitor, Users, HardDrive, ListVideo, Zap, Shield,
  Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, Crown,
  RefreshCw, X, ArrowRight, Calendar, Clock, Receipt,
  Star, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  RotateCcw, DollarSign, Package
} from 'lucide-react'
import { settingsAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow, isPast, isValid } from 'date-fns'

// ─── Helpers ─────────────────────────────────────────────────
const fmt  = (n)  => `$${(+(n||0)).toFixed(2)}`
const fmtD = (d)  => { try { return d ? format(new Date(d), 'dd MMM yyyy') : '—' } catch { return '—' } }
const isExpired = (d) => d && isValid(new Date(d)) && isPast(new Date(d))
const daysLeft  = (d) => {
  if (!d || !isValid(new Date(d))) return null
  return Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000))
}

// ─── UsageMeter ──────────────────────────────────────────────
function UsageMeter({ icon: Icon, label, used, max, unit='', color='blue' }) {
  const pct = max > 0 ? Math.min(100, Math.round((used/max)*100)) : 0
  const bar = pct>=90 ? 'bg-red-500' : pct>=70 ? 'bg-amber-500' : `bg-${color}-500`
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg bg-${color}-100 flex items-center justify-center`}>
            <Icon size={13} className={`text-${color}-600`} />
          </div>
          <span className="text-[13px] font-bold text-slate-700">{label}</span>
        </div>
        <span className="text-sm font-black text-slate-800">{used}{unit} <span className="text-slate-400 font-normal text-xs">/ {max}{unit}</span></span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:0.6 }}
          className={`h-full rounded-full ${bar}`} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">{pct}% used</span>
        {pct>=90 && <span className="text-[10px] text-red-500 font-bold">Near limit</span>}
      </div>
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────
function PlanCard({ plan, billingCycle, selectedPlanSlug, onSelect, screenCount }) {
  const isSelected = selectedPlanSlug === plan.slug
  const isCurrent  = plan.isCurrent
  const pricing    = billingCycle === 'yearly' ? plan.yearly : plan.monthly

  const FEATURES = [
    { key: 'proof_of_play', label: 'Proof of Play' },
    { key: 'analytics',     label: 'Advanced Analytics' },
    { key: 'widgets',       label: 'Live Widgets' },
    { key: 'schedules',     label: 'Scheduling' },
    { key: 'api',           label: 'API Access' },
    { key: 'white_label',   label: 'White Label' },
    { key: 'priority_support', label: 'Priority Support' },
  ]

  return (
    <div
      onClick={() => onSelect(plan.slug)}
      className={`relative rounded-2xl border-2 cursor-pointer transition-all overflow-hidden ${
        isCurrent   ? 'border-emerald-500 bg-emerald-50/30' :
        isSelected  ? 'border-blue-500 bg-blue-50/20 shadow-lg shadow-blue-100' :
        'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {plan.isPopular && !isCurrent && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-4 py-0.5 rounded-b-lg">
          Most Popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider px-4 py-0.5 rounded-b-lg flex items-center gap-1">
          <CheckCircle2 size={8} /> Current Plan
        </div>
      )}

      <div className="p-5 pt-6">
        {/* Plan name + description */}
        <div className="mb-4">
          <h3 className="font-black text-slate-800 text-lg">{plan.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{plan.description}</p>
        </div>

        {/* Pricing */}
        <div className="mb-4">
          {plan.billingModel === 'per_screen' ? (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">{fmt(pricing.base)}</span>
                <span className="text-slate-400 text-xs">/base</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-black text-blue-600">{fmt(pricing.per)}</span>
                <span className="text-slate-400 text-xs">per screen/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
              </div>
              {screenCount > 0 && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-blue-700 font-bold">{screenCount} screens → {fmt(pricing.total)}/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">{fmt(pricing.total)}</span>
              <span className="text-slate-400 text-xs">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
            </div>
          )}
          {billingCycle === 'yearly' && plan.yearlyDiscount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1.5">
              Save {plan.yearlyDiscount}% yearly
            </span>
          )}
        </div>

        {/* Limits */}
        <div className="space-y-1.5 mb-4 pb-4 border-b border-slate-100">
          {[
            { icon: Monitor,   val: `${plan.maxScreens} Screens` },
            { icon: Users,     val: `${plan.maxUsers} Users` },
            { icon: HardDrive, val: `${plan.maxStorageGb}GB Storage` },
            { icon: ListVideo, val: `${plan.maxPlaylists} Playlists` },
          ].map(({ icon: Icon, val }) => (
            <div key={val} className="flex items-center gap-2 text-xs text-slate-600">
              <Icon size={11} className="text-slate-400" />{val}
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="space-y-1.5">
          {FEATURES.map(({ key, label }) => {
            const enabled = plan.features?.[key] || key === 'proof_of_play'
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <Check size={9} className="text-white" />
                </div>
                <span className={enabled ? 'text-slate-700' : 'text-slate-400 line-through'}>{label}</span>
              </div>
            )
          })}
        </div>

        {/* Select button */}
        <button
          className={`mt-5 w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            isCurrent  ? 'bg-emerald-100 text-emerald-700 cursor-default' :
            isSelected ? 'bg-blue-600 text-white shadow-sm' :
            'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {isCurrent ? '✓ Active' : isSelected ? 'Selected' : 'Select Plan'}
        </button>
      </div>
    </div>
  )
}

// ─── Purchase Modal ───────────────────────────────────────────
function PurchaseModal({ plan, billingCycle, screenCount, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const pricing = billingCycle === 'yearly' ? plan.yearly : plan.monthly

  const doSubscribe = async () => {
    setLoading(true)
    try {
      await settingsAPI.subscribe({ planSlug: plan.slug, billingCycle, screenCount })
      toast.success(`Subscribed to ${plan.name}!`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Subscription failed')
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale:0.95, y:12 }} animate={{ scale:1, y:0 }} exit={{ scale:0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Crown size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Confirm Subscription</h2>
              <p className="text-xs text-slate-400">Review your order below</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Order summary */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200">
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-slate-600">Plan</span>
              <span className="font-bold text-slate-800">{plan.name}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span className="text-slate-600">Billing</span>
              <span className="font-bold text-slate-800 capitalize">{billingCycle}</span>
            </div>
            {plan.billingModel === 'per_screen' && (
              <>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-slate-600">Base price</span>
                  <span className="font-bold text-slate-800">{fmt(pricing.base)}</span>
                </div>
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-slate-600">{screenCount} screens × {fmt(pricing.per)}</span>
                  <span className="font-bold text-slate-800">{fmt(pricing.per * screenCount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between px-4 py-3 text-sm bg-blue-50">
              <span className="font-bold text-slate-800">Total</span>
              <span className="font-black text-blue-700 text-base">{fmt(pricing.total)}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              This is a <strong>demo environment</strong>. No real payment will be charged.
              Click confirm to activate the plan immediately.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={doSubscribe} disabled={loading}
              className="flex-[2] py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}>
              {loading ? <><Loader2 size={15} className="animate-spin" />Processing…</> : <><Check size={15} />Confirm & Activate</>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Settings ────────────────────────────────────────────
export default function Settings() {
  const { user, updateUser, organization } = useAuthStore()
  const [activeTab, setActiveTab] = useState('org')
  const [loading, setLoading]     = useState(true)
  const [saving,  setSaving]      = useState(false)
  const [saved,   setSaved]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Org
  const [orgForm, setOrgForm] = useState({ name:'', contactEmail:'', contactPhone:'', address:'', timezone:'UTC', primaryColor:'#0F172A' })

  // Subscription
  const [sub,    setSub]    = useState(null)
  const [plans,  setPlans]  = useState([])
  const [billing, setBilling] = useState([])
  const [licenses, setLicenses] = useState([])

  // Plan selection
  const [billingCycle,    setBillingCycle]    = useState('monthly')
  const [screenCount,     setScreenCount]     = useState(5)
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(null)
  const [showPurchase,    setShowPurchase]    = useState(false)

  // Password
  const [pwForm, setPwForm]   = useState({ currentPassword:'', newPassword:'', confirmPassword:'' })
  const [showPw, setShowPw]   = useState({ current:false, new:false, confirm:false })
  const [pwSaving, setPwSaving] = useState(false)

  // ── Load ──────────────────────────────────────────────────
  const loadAll = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    try {
      const [orgRes, subRes, plansRes] = await Promise.all([
        settingsAPI.getOrg().catch(() => null),
        settingsAPI.getSubscription().catch(() => null),
        settingsAPI.getPlans({ screenCount }).catch(() => ({ data: [] })),
      ])
      const od = orgRes?.data || {}
      setOrgForm({
        name:         od.name          || organization?.name || '',
        contactEmail: od.contact_email || '',
        contactPhone: od.contact_phone || '',
        address:      od.address       || '',
        timezone:     od.timezone      || 'UTC',
        primaryColor: od.primary_color || '#0F172A',
      })
      setSub(subRes?.data || null)
      const ps = plansRes?.data || []
      setPlans(ps)
      if (!selectedPlanSlug) {
        const cur = ps.find(p => p.isCurrent) || ps[1] || ps[0]
        if (cur) setSelectedPlanSlug(cur.slug)
      }
    } catch (err) {
      console.error('Settings load:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [screenCount])

  useEffect(() => { loadAll() }, [])

  // Load billing + licenses when tab changes
  useEffect(() => {
    if (activeTab === 'billing') {
      settingsAPI.getBillingHistory().then(r => setBilling(r?.data || [])).catch(() => {})
      settingsAPI.getScreenLicenses().then(r => setLicenses(r?.data || [])).catch(() => {})
    }
  }, [activeTab])

  // Recalc plan prices when screenCount changes
  useEffect(() => {
    if (plans.length === 0) return
    const t = setTimeout(() => {
      settingsAPI.getPlans({ screenCount }).then(r => {
        if (r?.data) setPlans(r.data)
      }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [screenCount])

  // ── Save Org ────────────────────────────────────────────────
  const saveOrg = async () => {
    if (!orgForm.name.trim()) return toast.error('Organization name is required')
    setSaving(true)
    try {
      await settingsAPI.updateOrg(orgForm)
      updateUser({ org_name: orgForm.name })
      toast.success('Organization updated')
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to update') }
    finally { setSaving(false) }
  }

  // ── Change Password ─────────────────────────────────────────
  const changePassword = async () => {
    if (!pwForm.currentPassword)                          return toast.error('Enter current password')
    if (pwForm.newPassword.length < 8)                    return toast.error('New password min 8 chars')
    if (pwForm.newPassword !== pwForm.confirmPassword)    return toast.error('Passwords do not match')
    setPwSaving(true)
    try {
      await settingsAPI.updatePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      toast.success('Password updated!')
      setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' })
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed') }
    finally { setPwSaving(false) }
  }

  // ── Cancel subscription ──────────────────────────────────────
  const handleCancel = async () => {
    if (!window.confirm('Cancel subscription? Access continues until period ends.')) return
    try {
      await settingsAPI.cancelSubscription()
      toast.success('Subscription cancelled')
      loadAll(true)
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed') }
  }

  // ── Renew subscription ───────────────────────────────────────
  const handleRenew = async () => {
    try {
      const r = await settingsAPI.renewSubscription()
      toast.success(r?.message || 'Renewed!')
      loadAll(true)
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to renew') }
  }

  const TIMEZONES = ['UTC','Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','America/New_York','America/Los_Angeles','Europe/London','Europe/Berlin','Australia/Sydney']

  const statusColor = {
    active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
    trial:     'bg-amber-100  text-amber-700  border-amber-200',
    cancelled: 'bg-red-100    text-red-700    border-red-200',
    expired:   'bg-slate-100  text-slate-600  border-slate-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    failed:    'bg-red-100    text-red-700    border-red-200',
  }

  const TABS = [
    { id: 'org',     label: 'Organization', icon: Building2 },
    { id: 'plan',    label: 'Plans & Billing', icon: CreditCard },
    { id: 'billing', label: 'History',       icon: Receipt },
    { id: 'security',label: 'Security',      icon: Key },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background:'#edf4fb' }}>
      <Loader2 size={28} className="animate-spin text-blue-400" />
    </div>
  )

  const plan    = sub?.plan     || {}
  const usage   = sub?.usage    || {}
  const usagePct= sub?.usagePct || {}

  return (
    <div className="min-h-screen" style={{ background:'#edf4fb', fontFamily:"'DM Sans','Plus Jakarta Sans',sans-serif" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
            <p className="text-slate-400 text-sm mt-1">Manage workspace, plan and account</p>
          </div>
          <button onClick={() => loadAll(true)} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 transition-colors shadow-sm">
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 gap-1 mb-6 shadow-sm overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all ${
                activeTab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}>
              <Icon size={14} /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ════ ORGANIZATION ════ */}
          {activeTab === 'org' && (
            <motion.div key="org" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Building2 size={16} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Organization Profile</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Update your workspace info</p>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Organization Name *</label>
                  <input value={orgForm.name} onChange={e => setOrgForm(p=>({...p,name:e.target.value}))}
                    className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="Your Company" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Email</label>
                    <input type="email" value={orgForm.contactEmail} onChange={e => setOrgForm(p=>({...p,contactEmail:e.target.value}))}
                      className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="admin@company.com" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Phone</label>
                    <input value={orgForm.contactPhone} onChange={e => setOrgForm(p=>({...p,contactPhone:e.target.value}))}
                      className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
                      placeholder="+1 555 0100" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                  <textarea value={orgForm.address} onChange={e => setOrgForm(p=>({...p,address:e.target.value}))} rows={2}
                    className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                    placeholder="123 Business St, City, Country" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Timezone</label>
                  <select value={orgForm.timezone} onChange={e => setOrgForm(p=>({...p,timezone:e.target.value}))}
                    className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer">
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button onClick={saveOrg} disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition-all"
                    style={{ background: saving?'#94a3b8':'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: saving?'none':'0 4px 16px rgba(37,99,235,0.3)' }}>
                    {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> :
                     saved  ? <><CheckCircle2 size={14} />Saved!</> :
                              <><Save size={14} />Save Changes</>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════ PLANS & BILLING ════ */}
          {activeTab === 'plan' && (
            <motion.div key="plan" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="space-y-5">

              {/* Current subscription banner */}
              {sub?.subscriptionId && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    style={{ background:'linear-gradient(135deg,#1e3a5f,#0d2040)' }}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Crown size={20} className="text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-black text-xl">{plan.name || 'Starter'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusColor[sub.status] || statusColor.trial}`}>
                            {sub.status}
                          </span>
                          <span className="text-white/60 text-xs capitalize">{sub.billingCycle}</span>
                        </div>
                        <div className="text-white/50 text-xs mt-1 flex flex-wrap gap-3">
                          {sub.nextBillDate && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {sub.status === 'cancelled' ? 'Ends' : 'Renews'}: {fmtD(sub.nextBillDate)}
                              {sub.daysUntilBill !== null && <span className="text-amber-400 font-bold">({sub.daysUntilBill}d)</span>}
                            </span>
                          )}
                          {sub.amountPaid > 0 && <span className="flex items-center gap-1"><DollarSign size={10} />Paid: {fmt(sub.amountPaid)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {sub.status !== 'cancelled' && (
                        <button onClick={handleCancel}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold rounded-xl transition-colors border border-white/20">
                          Cancel
                        </button>
                      )}
                      {['expired','cancelled'].includes(sub.status) && (
                        <button onClick={handleRenew}
                          className="flex items-center gap-2 px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-xs rounded-xl transition-colors">
                          <RotateCcw size={12} />Renew Now
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Usage meters */}
                  <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white">
                    <UsageMeter icon={Monitor}   label="Screens"   used={usage.screensUsed||0}    max={plan.maxScreens||5}   color="blue" />
                    <UsageMeter icon={Users}     label="Users"     used={usage.usersCount||0}     max={plan.maxUsers||3}     color="violet" />
                    <UsageMeter icon={HardDrive} label="Storage"   used={usage.storageUsedGb||0}  max={plan.maxStorageGb||10} unit=" GB" color="emerald" />
                    <UsageMeter icon={ListVideo} label="Playlists" used={usage.playlistsCount||0} max={plan.maxPlaylists||50} color="amber" />
                  </div>
                </div>
              )}

              {/* Expiry warnings */}
              {(usage.expiredScreens > 0 || (sub?.daysUntilBill !== null && sub.daysUntilBill <= 7 && sub?.status === 'active')) && (
                <div className="space-y-2">
                  {usage.expiredScreens > 0 && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700"><strong>{usage.expiredScreens}</strong> screen{usage.expiredScreens>1?'s':''} with expired license. <button onClick={handleRenew} className="underline font-bold">Renew now →</button></p>
                    </div>
                  )}
                  {sub?.daysUntilBill <= 7 && sub?.status === 'active' && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <Clock size={15} className="text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700">Subscription renews in <strong>{sub.daysUntilBill} day{sub.daysUntilBill!==1?'s':''}</strong> on {fmtD(sub.nextBillDate)}.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Plan selector */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <h2 className="font-bold text-slate-800 text-[15px]">Choose a Plan</h2>

                  {/* Controls row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Screen count (for per-screen plans) */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
                      <Monitor size={13} className="text-slate-500" />
                      <span className="text-xs font-bold text-slate-600">Screens:</span>
                      <input type="number" min={1} max={500} value={screenCount}
                        onChange={e => setScreenCount(Math.max(1, +e.target.value || 1))}
                        className="w-14 bg-transparent text-sm font-black text-slate-800 outline-none text-center" />
                    </div>

                    {/* Billing cycle toggle */}
                    <div className="flex bg-slate-100 rounded-xl p-1">
                      {['monthly','yearly'].map(c => (
                        <button key={c} onClick={() => setBillingCycle(c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                            billingCycle === c ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                          }`}>
                          {c}
                          {c === 'yearly' && <span className="ml-1 text-emerald-500 text-[9px] font-black">-20%</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Plan cards */}
                {plans.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No plans available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {plans.map(p => (
                      <PlanCard key={p.id} plan={p} billingCycle={billingCycle}
                        selectedPlanSlug={selectedPlanSlug} onSelect={setSelectedPlanSlug}
                        screenCount={screenCount} />
                    ))}
                  </div>
                )}

                {/* Subscribe CTA */}
                {selectedPlanSlug && !plans.find(p=>p.slug===selectedPlanSlug)?.isCurrent && (
                  <div className="mt-5 flex justify-end">
                    <button onClick={() => setShowPurchase(true)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm shadow-lg transition-all"
                      style={{ background:'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow:'0 4px 20px rgba(37,99,235,0.35)' }}>
                      <Zap size={15} />Subscribe to {plans.find(p=>p.slug===selectedPlanSlug)?.name}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════ BILLING HISTORY ════ */}
          {activeTab === 'billing' && (
            <motion.div key="billing" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="space-y-4">

              {/* Payments */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                  <Receipt size={16} className="text-blue-600" />
                  <h2 className="font-bold text-slate-800">Payment History</h2>
                </div>
                {billing.length === 0 ? (
                  <div className="py-16 text-center">
                    <Receipt size={32} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No payments yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['Date','Plan','Cycle','Screens','Amount','Status',''].map((h,i) => (
                            <th key={h} className={`px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${i===6?'text-right':'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {billing.map(p => (
                          <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-xs text-slate-600">{fmtD(p.created_at)}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{p.plan_name||'—'}</td>
                            <td className="px-4 py-3 capitalize text-slate-600">{p.billing_cycle||'—'}</td>
                            <td className="px-4 py-3 text-slate-600">{p.screen_count||0}</td>
                            <td className="px-4 py-3 font-bold text-slate-800">{fmt(p.amount)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[p.status]||'bg-slate-100 text-slate-600'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {p.period_start && p.period_end && (
                                <span className="text-[10px] text-slate-400">{fmtD(p.period_start)} – {fmtD(p.period_end)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Screen licenses */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                  <Monitor size={16} className="text-blue-600" />
                  <h2 className="font-bold text-slate-800">Screen Licenses</h2>
                </div>
                {licenses.length === 0 ? (
                  <div className="py-16 text-center">
                    <Monitor size={32} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No screen licenses found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['License Key','Screen','Expires','Cycle','Status','Action'].map((h,i) => (
                            <th key={h} className={`px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${i===5?'text-right':'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {licenses.map(lic => {
                          const exp     = isExpired(lic.expires_at)
                          const days    = daysLeft(lic.expires_at)
                          const warnSoon = !exp && days !== null && days <= 14
                          return (
                            <tr key={lic.id} className={`border-b border-slate-50 transition-colors ${exp ? 'bg-red-50/30' : warnSoon ? 'bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                              <td className="px-4 py-3 font-mono text-xs text-slate-600">{lic.license_key}</td>
                              <td className="px-4 py-3">
                                {lic.device_name
                                  ? <div><div className="font-semibold text-slate-800 text-xs">{lic.device_name}</div><div className="text-slate-400 text-[10px]">{lic.location||''}</div></div>
                                  : <span className="text-slate-300 text-xs italic">Unassigned</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold ${exp ? 'text-red-600' : warnSoon ? 'text-amber-600' : 'text-slate-600'}`}>
                                  {lic.expires_at ? fmtD(lic.expires_at) : 'No expiry'}
                                  {days !== null && !exp && <span className="text-slate-400 font-normal"> ({days}d)</span>}
                                  {exp && <span className="ml-1 text-red-500">Expired</span>}
                                </span>
                              </td>
                              <td className="px-4 py-3 capitalize text-slate-600 text-xs">{lic.billing_cycle||'—'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[lic.status]||'bg-slate-100 text-slate-600'}`}>
                                  {lic.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {(exp || warnSoon) && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await settingsAPI.renewScreenLicense(lic.id, { billingCycle: lic.billing_cycle||'monthly' })
                                        toast.success('License renewed!')
                                        settingsAPI.getScreenLicenses().then(r => setLicenses(r?.data||[]))
                                      } catch (e) { toast.error('Renewal failed') }
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-colors ml-auto">
                                    <RotateCcw size={10} />Renew
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════ SECURITY ════ */}
          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="space-y-4">

              {/* Account info */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Shield size={16} className="text-blue-600" />
                  </div>
                  <h2 className="font-bold text-slate-800">Account</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{user?.email}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5 capitalize">{(user?.roles||[])[0]?.name||'Member'}</p>
                  </div>
                </div>
              </div>

              {/* Change password */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Key size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">Change Password</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Min 8 chars, mixed case + numbers</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { fk:'currentPassword', label:'Current Password', pk:'current', ph:'Your current password' },
                    { fk:'newPassword',     label:'New Password',     pk:'new',     ph:'Min. 8 characters' },
                    { fk:'confirmPassword', label:'Confirm Password', pk:'confirm', ph:'Repeat new password' },
                  ].map(({ fk, label, pk, ph }) => (
                    <div key={fk}>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type={showPw[pk] ? 'text' : 'password'}
                          value={pwForm[fk]} onChange={e => setPwForm(p=>({...p,[fk]:e.target.value}))}
                          placeholder={ph}
                          className="w-full pl-11 pr-12 py-3 border-2 border-slate-200 bg-slate-50 rounded-xl text-sm outline-none focus:border-amber-400 focus:bg-white transition-all placeholder:text-slate-300" />
                        <button type="button" onClick={() => setShowPw(p=>({...p,[pk]:!p[pk]}))}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showPw[pk] ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Strength checks */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-2 gap-1.5">
                    {[
                      { ok: pwForm.newPassword.length >= 8,          text: 'At least 8 characters' },
                      { ok: /[A-Z]/.test(pwForm.newPassword),         text: 'Uppercase letter' },
                      { ok: /[0-9]/.test(pwForm.newPassword),         text: 'One number' },
                      { ok: pwForm.newPassword === pwForm.confirmPassword && !!pwForm.confirmPassword, text: 'Passwords match' },
                    ].map(({ ok, text }) => (
                      <div key={text} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          <Check size={9} className="text-white" />
                        </div>
                        <span className={`text-[11px] ${ok ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>{text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button onClick={changePassword} disabled={pwSaving || !pwForm.currentPassword || pwForm.newPassword.length < 8}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ background:'linear-gradient(135deg,#d97706,#b45309)', boxShadow:'0 4px 16px rgba(217,119,6,0.3)' }}>
                      {pwSaving ? <><Loader2 size={14} className="animate-spin" />Updating…</> : <><Key size={14} />Update Password</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {showPurchase && selectedPlanSlug && (
          <PurchaseModal
            plan={plans.find(p=>p.slug===selectedPlanSlug)}
            billingCycle={billingCycle}
            screenCount={screenCount}
            onClose={() => setShowPurchase(false)}
            onSuccess={() => loadAll(true)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}