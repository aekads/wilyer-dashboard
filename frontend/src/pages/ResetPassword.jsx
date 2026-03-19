// src/pages/ResetPassword.jsx
// ============================================================
// AEKADS Reset Password Page
// Route: /reset-password?token=<token>
// ============================================================
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertTriangle, Loader2, MonitorPlay } from 'lucide-react'
import { authAPI } from '../services/api'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

function PasswordStrength({ password }) {
  const checks = [
    { label: 'At least 6 characters', ok: password.length >= 6 },
    { label: 'Contains a number',      ok: /\d/.test(password) },
    { label: 'Contains uppercase',     ok: /[A-Z]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const bar   = score === 0 ? 'bg-slate-200' : score === 1 ? 'bg-red-400' : score === 2 ? 'bg-amber-400' : 'bg-emerald-500'

  if (!password) return null
  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${bar}`} style={{ width: `${(score / 3) * 100}%` }} />
      </div>
      <div className="flex gap-3 flex-wrap">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] font-medium flex items-center gap-1 ${c.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ResetPassword() {
  const navigate         = useNavigate()
  const [params]         = useSearchParams()
  const token            = params.get('token')

  const [form, setForm]       = useState({ newPassword: '', confirm: '' })
  const [showPass, setShowPass] = useState({ new: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [errors, setErrors]   = useState({})

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  const validate = () => {
    const e = {}
    if (!form.newPassword)             e.newPassword = 'Password is required'
    else if (form.newPassword.length < 6) e.newPassword = 'At least 6 characters'
    if (!form.confirm)                 e.confirm = 'Please confirm your password'
    else if (form.confirm !== form.newPassword) e.confirm = 'Passwords do not match'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await authAPI.resetPassword(token, form.newPassword)
      setDone(true)
      toast.success('Password updated!')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Reset failed. Link may have expired.'
      toast.error(msg)
      if (err.response?.status === 400) {
        setErrors({ newPassword: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 mb-10"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
            <MonitorPlay size={18} className="text-white" />
          </div>
          <span className="text-slate-800 text-lg font-bold">Aekads</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/80 overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Password updated!</h2>
                <p className="text-slate-500 text-sm mb-6">Redirecting you to login…</p>
                <Link to="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors">
                  Go to Login <ArrowRight size={15} />
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-7">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h1>
                  <p className="text-slate-400 text-sm">Choose a strong password for your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">New Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type={showPass.new ? 'text' : 'password'}
                        value={form.newPassword}
                        onChange={e => { setForm(p => ({ ...p, newPassword: e.target.value })); setErrors(p => ({ ...p, newPassword: '' })) }}
                        placeholder="Min. 6 characters"
                        disabled={loading}
                        className={`w-full pl-11 pr-12 py-3.5 border-2 rounded-xl text-sm outline-none transition-all bg-white placeholder:text-slate-300 ${errors.newPassword ? 'border-red-300' : 'border-slate-200 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]'}`}
                      />
                      <button type="button" onClick={() => setShowPass(p => ({ ...p, new: !p.new }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPass.new ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                    <PasswordStrength password={form.newPassword} />
                    {errors.newPassword && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.newPassword}</p>}
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2">Confirm Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type={showPass.confirm ? 'text' : 'password'}
                        value={form.confirm}
                        onChange={e => { setForm(p => ({ ...p, confirm: e.target.value })); setErrors(p => ({ ...p, confirm: '' })) }}
                        placeholder="Repeat password"
                        disabled={loading}
                        className={`w-full pl-11 pr-12 py-3.5 border-2 rounded-xl text-sm outline-none transition-all bg-white placeholder:text-slate-300 ${errors.confirm ? 'border-red-300' : 'border-slate-200 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]'}`}
                      />
                      <button type="button" onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPass.confirm ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                    {errors.confirm && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.confirm}</p>}
                  </div>

                  <motion.button
                    type="submit" disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: loading ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #0891b2)',
                      boxShadow: loading ? 'none' : '0 4px 20px rgba(37,99,235,0.3)',
                    }}
                  >
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" /> Updating…</>
                      : <>Update Password <ArrowRight size={16} /></>
                    }
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center text-slate-400 text-sm mt-6">
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}