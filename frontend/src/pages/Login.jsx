// src/pages/Login.jsx
// ============================================================
// AEKADS Login — Real logo + premium redesign
// Mobile: stacked layout, logo at top
// Desktop: dark left panel (logo + screens) + white right form
// ============================================================
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye, EyeOff, ArrowRight, Mail, Lock, X,
  CheckCircle2, Loader2, Zap, Globe2, BarChart3, Wifi,
  MonitorPlay
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

// ─────────────────────────────────────────────────────────────
// Aekads Logo — loads real image, falls back to text
// ─────────────────────────────────────────────────────────────
function AekadsLogo({ className = '', imgClass = 'h-10 w-auto', theme = 'dark' }) {
  const [err, setErr] = useState(false)
  if (!err) {
    return (
      <img
        src="https://cms.aekads.com/images/Logo.png"
        alt="Aekads"
        onError={() => setErr(true)}
        className={`${imgClass} object-contain ${className}`}
        // style={{ maxWidth: 200, filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'none' }}
      />
    )
  }
  // Fallback SVG text logo
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
        <MonitorPlay size={18} className="text-white" />
      </div>
      <span className={`font-black text-xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
        style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.04em' }}>
        Aek<span style={{ color: theme === 'dark' ? '#60a5fa' : '#2563eb' }}>ads</span>
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Screen mockup cards in the left panel
// ─────────────────────────────────────────────────────────────
const MOCK_SCREENS = [
  { x: 0,   y: 0,   w: 138, h: 82, delay: 0,    online: true,  label: 'Lobby Display',   type: 'promo'  },
  { x: 150, y: 0,   w: 106, h: 82, delay: 0.1,  online: true,  label: 'Floor 2 TV',      type: 'news'   },
  { x: 0,   y: 96,  w: 88,  h: 82, delay: 0.2,  online: false, label: 'Reception',       type: 'idle'   },
  { x: 102, y: 96,  w: 154, h: 82, delay: 0.3,  online: true,  label: 'Conference Rm',   type: 'chart'  },
  { x: 0,   y: 192, w: 120, h: 82, delay: 0.42, online: true,  label: 'Cafeteria',       type: 'menu'   },
  { x: 134, y: 192, w: 122, h: 82, delay: 0.52, online: false, label: 'Car Park',        type: 'dark'   },
]

function MockScreen({ s }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: s.delay + 0.6, duration: 0.4, ease: [0.2, 1, 0.35, 1] }}
      className="absolute rounded-lg overflow-hidden"
      style={{
        left: s.x, top: s.y, width: s.w, height: s.h,
        background: s.online ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid rgba(255,255,255,${s.online ? '0.15' : '0.06'})`,
      }}
    >
      {/* Content area */}
      <div className="flex-1 h-[calc(100%-22px)] p-2 flex flex-col justify-center gap-1"
        style={{ background: s.online ? 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(6,182,212,0.06))' : 'transparent' }}>
        {s.type === 'promo' && <>
          <div className="h-2 w-4/5 rounded-sm bg-blue-400/25" />
          <div className="h-1.5 w-3/5 rounded-sm bg-white/15" />
          <div className="mt-0.5 h-4 w-full rounded bg-blue-300/15" />
        </>}
        {s.type === 'news' && [70,55,80].map((w, i) => (
          <div key={i} className="h-1.5 rounded-sm bg-white/12" style={{ width: `${w}%` }} />
        ))}
        {s.type === 'chart' && <div className="flex items-end gap-0.5 h-8 w-full px-1">
          {[60,80,45,90,70,55,85].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-cyan-400/30" style={{ height: `${h}%` }} />
          ))}
        </div>}
        {s.type === 'menu' && [1,2,3].map(i => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-amber-400/30" />
            <div className="flex-1 h-1.5 rounded-sm bg-white/12" />
          </div>
        ))}
        {(s.type === 'idle' || s.type === 'dark') && (
          <div className="flex items-center justify-center h-full opacity-20">
            <div className="w-6 h-6 rounded border border-white/30" />
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="h-[22px] px-2 flex items-center justify-between"
        style={{ background: 'rgba(0,0,0,0.4)' }}>
        <span className="text-white/45 text-[7px] font-medium truncate">{s.label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {s.online && <Wifi size={6} className="text-emerald-400/70" />}
          <span className="rounded-full"
            style={{ width: 5, height: 5,
              background: s.online ? '#10b981' : '#475569',
              boxShadow: s.online ? '0 0 5px #10b981' : 'none' }} />
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Forgot Password bottom sheet / modal
// ─────────────────────────────────────────────────────────────
function ForgotModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim())                              { setErr('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('Enter a valid email'); return }
    setLoading(true)
    try { await authAPI.forgotPassword(email.trim().toLowerCase()) } catch {}
    setLoading(false)
    setSent(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-[420px] rounded-t-[28px] sm:rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Mobile handle */}
        <div className="sm:hidden pt-3 pb-0 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-[17px] font-bold text-slate-900">Reset password</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">We'll send a link to your email</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors mt-0.5">
            <X size={17} />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <h4 className="font-bold text-slate-800 mb-1">Email sent!</h4>
                <p className="text-slate-400 text-[13px] mb-5 leading-relaxed">
                  If <strong className="text-slate-600">{email}</strong> is registered, check your inbox for the reset link.
                </p>
                <button onClick={onClose}
                  className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black transition-colors">
                  Got it
                </button>
              </motion.div>
            ) : (
              <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-2">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input autoFocus type="email" value={email} onChange={e => { setEmail(e.target.value); setErr('') }}
                      placeholder="you@company.com"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition-all ${
                        err ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {err && <p className="text-red-500 text-[11px] font-semibold mt-1">{err}</p>}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose}
                    className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-semibold text-[13px] hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-[2] py-3 rounded-xl text-white font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#1d4ed8,#0891b2)', boxShadow: '0 4px 14px rgba(29,78,216,0.3)' }}>
                    {loading
                      ? <><Loader2 size={14} className="animate-spin" />Sending…</>
                      : <><Mail size={14} />Send Reset Link</>}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Login
// ─────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuthStore()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errs, setErrs]     = useState({})
  const [showForgot, setShowForgot] = useState(false)

  useEffect(() => { if (isAuthenticated) navigate('/dashboard') }, [isAuthenticated, navigate])

  const setF = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setErrs(p => ({ ...p, [k]: '' })) }

  const validate = () => {
    const e = {}
    if (!form.email?.trim())   e.email    = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password)        e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'At least 6 characters'
    setErrs(e); return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await login({ email: form.email.trim().toLowerCase(), password: form.password })
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Login failed'
      toast.error(msg)
      if (err.response?.status === 401)      setErrs({ password: 'Invalid email or password' })
      else if (err.response?.status === 429) setErrs({ email: 'Too many attempts. Try again later.' })
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col lg:flex-row"
        style={{ fontFamily: "'DM Sans','Plus Jakarta Sans',sans-serif" }}>

        {/* ══════════════════════════════════════════════════
            LEFT — Dark brand panel
        ══════════════════════════════════════════════════ */}
        <div
          className="relative flex flex-col overflow-hidden
            px-6 pt-8 pb-7
            lg:w-[500px] lg:flex-shrink-0 lg:min-h-screen lg:p-12 lg:justify-between"
          style={{ background: 'linear-gradient(148deg,#0a1628 0%,#0d2040 55%,#071625 100%)' }}
        >
          {/* Dot grid bg */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={{ backgroundImage:'radial-gradient(rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize:'28px 28px' }} />
          {/* Glow blobs */}
          <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full pointer-events-none"
            style={{ background:'radial-gradient(circle,rgba(59,130,246,.2),transparent 65%)' }} />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none"
            style={{ background:'radial-gradient(circle,rgba(6,182,212,.12),transparent 65%)' }} />

          {/* Logo */}
          <motion.div
            initial={{ opacity:0, y:-14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15, duration:0.5 }}
            className="relative z-10"
          >
            <AekadsLogo imgClass="h-10 w-auto" theme="dark" />
          </motion.div>

          {/* Screen grid — desktop only */}
          <motion.div
            initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
            transition={{ delay:0.4, duration:0.65, ease:[0.22,1,0.36,1] }}
            className="hidden lg:flex justify-center my-6 relative z-10"
          >
            <div className="relative" style={{ width:258, height:278 }}>
              {MOCK_SCREENS.map((s, i) => <MockScreen key={i} s={s} />)}
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.75, duration:0.5 }}
            className="relative z-10"
          >
            <h2 className="text-white font-black leading-[1.18] tracking-tight mb-3"
              style={{ fontSize: 'clamp(18px, 2.5vw, 26px)' }}>
              Digital Signage,<br />
              <span style={{ background:'linear-gradient(90deg,#60a5fa,#22d3ee)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Reimagined.
              </span>
            </h2>
            <p className="text-white/40 text-[13px] leading-relaxed mb-4">
              Manage all your screens from one powerful platform.
            </p>
            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Zap,       label: 'Real-time sync'  },
                { icon: Globe2,    label: 'Any device'      },
                { icon: BarChart3, label: 'Proof of play'   },
              ].map(({ icon: Icon, label }) => (
                <div key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/55"
                  style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)' }}>
                  <Icon size={11} className="text-blue-400" />{label}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ══════════════════════════════════════════════════
            RIGHT — Login form
        ══════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#f4f6fb] px-5 py-10 sm:px-8">

          {/* Mobile logo (only shown on small screens) */}
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
            className="lg:hidden mb-8 w-full max-w-[400px]"
          >
            <AekadsLogo imgClass="h-8 w-auto" theme="light" />
          </motion.div>

          <div className="w-full max-w-[400px]">

            {/* Heading */}
            <motion.div
              initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.22 }}
              className="mb-7"
            >
              <h1 className="text-[28px] font-black text-slate-900 tracking-tight">Welcome back</h1>
              <p className="text-slate-400 text-[13px] mt-1.5">Sign in to continue to your workspace</p>
            </motion.div>

            {/* Form card */}
            <motion.div
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
              className="bg-white rounded-[20px] border border-slate-200/70 overflow-hidden"
              style={{ boxShadow:'0 2px 24px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.025)' }}
            >
              <div className="p-7 space-y-5">

                {/* Email field */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email" autoFocus autoComplete="email"
                      value={form.email} onChange={setF('email')} disabled={loading}
                      placeholder="you@company.com"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-xl border-2 text-[14px] text-slate-800
                        placeholder:text-slate-300 outline-none transition-all duration-150
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${errs.email
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200 bg-[#fafbfc] focus:bg-white focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]'
                        }`}
                    />
                  </div>
                  <AnimatePresence>
                    {errs.email && (
                      <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                        className="text-red-500 text-[11px] font-bold mt-1.5">{errs.email}</motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Password field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                    <button type="button" onClick={() => setShowForgot(true)}
                      className="text-[12px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={form.password} onChange={setF('password')} disabled={loading}
                      placeholder="Enter your password"
                      className={`w-full pl-11 pr-12 py-3.5 rounded-xl border-2 text-[14px] text-slate-800
                        placeholder:text-slate-300 outline-none transition-all duration-150
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${errs.password
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200 bg-[#fafbfc] focus:bg-white focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]'
                        }`}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} disabled={loading}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPw ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  <AnimatePresence>
                    {errs.password && (
                      <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                        className="text-red-500 text-[11px] font-bold mt-1.5">{errs.password}</motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sign In button */}
                <motion.button
                  type="button" onClick={handleSubmit} disabled={loading}
                  whileHover={!loading ? { scale:1.012, y:-1 } : {}}
                  whileTap={!loading ? { scale:0.988 } : {}}
                  className="w-full py-3.5 rounded-xl text-white font-black text-[14px]
                    flex items-center justify-center gap-2 transition-all duration-200
                    disabled:opacity-55 disabled:cursor-not-allowed"
                  style={{
                    background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1e40af 0%,#0369a1 100%)',
                    boxShadow:  loading ? 'none' : '0 4px 20px rgba(30,64,175,0.4),0 1px 3px rgba(0,0,0,0.1)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {loading
                    ? <><Loader2 size={17} className="animate-spin" />Signing in…</>
                    : <>Sign In <ArrowRight size={17} /></>
                  }
                </motion.button>
              </div>

              {/* Card footer */}
              <div className="px-7 py-5 bg-slate-50/80 border-t border-slate-100 text-center">
                <p className="text-slate-400 text-[13px]">
                  New to Aekads?{' '}
                  <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold transition-colors">
                    Create a workspace
                  </Link>
                </p>
              </div>
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.6 }}
              className="text-center text-[11px] text-slate-400 mt-5 leading-relaxed"
            >
              By continuing, you agree to the{' '}
              <span className="text-slate-500 font-medium hover:underline cursor-pointer">Terms of Service</span>
              {' & '}
              <span className="text-slate-500 font-medium hover:underline cursor-pointer">Privacy Policy</span>
            </motion.p>
          </div>
        </div>
      </div>

      {/* Forgot password bottom sheet */}
      <AnimatePresence>
        {showForgot && <ForgotModal onClose={() => setShowForgot(false)} />}
      </AnimatePresence>
    </>
  )
}