// src/pages/Screens.jsx
// ============================================================
// AEKADS Screens — Enhanced with FULL RESPONSIVENESS:
//   • Mobile-first design with breakpoints
//   • Responsive tables with card view on mobile
//   • Adaptive layouts for all screen sizes
//   • Preserved all existing features and logic
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  Monitor, Plus, Search, X, Trash2, RefreshCw, Loader2,
  Copy, Check, Shield, AlertTriangle, Info, Pencil,
  MoreVertical, PlayCircle, RotateCcw, CalendarClock,
  Tag, Clock, Wifi, WifiOff, Cloud, Youtube, Globe, Layout,
  Image, Video, Film, FileText, ChevronLeft, ChevronRight,
  Undo2, AlertCircle, CheckCircle2, Save, MapPin, Hash,
  ScreenShare, Activity, BanIcon, Layers, TrendingUp
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../services/api'
import { screensAPI } from '../services/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow, format, isPast } from 'date-fns'

// ─────────────────────────────────────────────────────────────
// Status config (unchanged)
// ─────────────────────────────────────────────────────────────
const getStatus = (s) => s.real_status || s.status || 'offline'

const STATUS = {
  online:  { label: 'Online',  dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Wifi    },
  idle:    { label: 'Idle',    dot: 'bg-amber-400',   badge: 'bg-amber-50  text-amber-700  border-amber-200',    icon: Clock   },
  offline: { label: 'Offline', dot: 'bg-slate-300',   badge: 'bg-slate-100 text-slate-500  border-slate-200',   icon: WifiOff },
}

const WIDGET_ICONS = {
  clock:   Clock,
  weather: Cloud,
  youtube: Youtube,
  webview: Globe,
  rss:     FileText,
}

function StatusDot({ status }) {
  const c = STATUS[status] || STATUS.offline
  return (
    <span className="relative flex items-center justify-center w-2.5 h-2.5 flex-shrink-0">
      {status === 'online' && (
        <span className={`absolute w-2.5 h-2.5 rounded-full ${c.dot} opacity-50 animate-ping`} />
      )}
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Add Screen Modal (responsive)
// ─────────────────────────────────────────────────────────────
function AddScreenModal({ onClose, onSuccess, licenses }) {
  const [form, setForm] = useState({
    pairingCode: '',
    deviceName: '',
    location: '',
    tags: '',
    orientation: 'landscape',
  })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleCode = (e) => {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setForm(f => ({ ...f, pairingCode: v }))
  }

  const canAdd = !licenses || licenses.available > 0

  const submit = async (e) => {
    e.preventDefault()
    if (form.pairingCode.length < 6) return toast.error('Enter the full 6-character code shown on your device')
    if (!form.deviceName.trim())     return toast.error('Screen name is required')
    setLoading(true)
    try {
      const res = await screensAPI.pair({
        pairingCode: form.pairingCode,
        name:        form.deviceName.trim(),
        location:    form.location.trim()    || null,
        tags:        form.tags.trim()        || null,
        orientation: form.orientation,
      })
      toast.success(`"${form.deviceName}" paired successfully!`)
      onSuccess(res.data?.screen)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Invalid or expired pairing code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 350 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Monitor size={16} className="text-white sm:hidden" />
              <Monitor size={17} className="text-white hidden sm:block" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">Add New Screen</h2>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Enter the code displayed on your AEKADS device</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {!canAdd && (
          <div className="mx-4 sm:mx-6 mt-4 sm:mt-5 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 sm:px-4 py-3">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-amber-700">
              All <strong>{licenses?.total}</strong> screen licenses are used.{' '}
              <button className="underline font-semibold">Upgrade your plan</button> to add more.
            </p>
          </div>
        )}

        <div className="mx-4 sm:mx-6 mt-4 sm:mt-5 flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3 sm:px-4 py-3">
          <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] sm:text-xs text-blue-700 leading-relaxed">
            Open the <strong>AEKADS app</strong> on your Android device — it shows a <strong>6-character pairing code</strong>. Enter it below to link the device.
          </p>
        </div>

        <form onSubmit={submit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">
              Device Pairing Code <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={form.pairingCode}
              onChange={handleCode}
              placeholder="A3B7KZ"
              maxLength={6}
              className="w-full font-mono text-xl sm:text-3xl font-black tracking-[0.3em] sm:tracking-[0.5em] text-center uppercase
                border-2 rounded-xl py-3 sm:py-4 px-3 sm:px-4 outline-none transition-all
                border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-100/50
                placeholder:text-slate-200 placeholder:text-lg sm:placeholder:text-xl placeholder:tracking-[0.2em] sm:placeholder:tracking-[0.3em] placeholder:font-light"
            />
            <div className="flex justify-between mt-1.5 text-[10px] sm:text-xs text-slate-400 px-0.5">
              <span>{form.pairingCode.length}/6 characters</span>
              <span>Expires after 15 minutes</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">
              Screen Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.deviceName}
              onChange={set('deviceName')}
              placeholder="e.g. Lobby Display, Floor 2 TV"
              className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-medium placeholder:font-normal placeholder:text-slate-300 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">Orientation</label>
            <div className="flex gap-2">
              {['landscape', 'portrait'].map(o => (
                <button
                  key={o} type="button"
                  onClick={() => setForm(f => ({ ...f, orientation: o }))}
                  className={`flex-1 py-2 sm:py-2.5 rounded-xl border-2 text-xs sm:text-sm font-semibold capitalize transition-all ${
                    form.orientation === o ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {o === 'landscape' ? '⬛ Landscape' : '📱 Portrait'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">Location</label>
            <input
              value={form.location} onChange={set('location')}
              placeholder="e.g. Main Lobby, Reception Area"
              className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-medium placeholder:font-normal placeholder:text-slate-300 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">
              Tags <span className="text-slate-400 font-normal normal-case">(comma separated)</span>
            </label>
            <input
              value={form.tags} onChange={set('tags')}
              placeholder="e.g. lobby, digital, promo"
              className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-800 font-medium placeholder:font-normal placeholder:text-slate-300 text-xs sm:text-sm"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs sm:text-sm">
              Cancel
            </button>
            <button type="submit"
              disabled={loading || !canAdd || form.pairingCode.length < 6 || !form.deviceName.trim()}
              className="flex-[2] py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200/60 text-xs sm:text-sm"
            >
              {loading ? <><Loader2 size={14} sm:size={16} className="animate-spin" /> Pairing…</> : <><Monitor size={14} sm:size={16} /> Pair Screen</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Edit Screen Modal — Responsive
// ─────────────────────────────────────────────────────────────
function EditScreenModal({ screen, onClose, onSuccess }) {
  const [form, setForm] = useState({
    deviceName:  screen.device_name  || '',
    location:    screen.location     || '',
    orientation: screen.orientation  || 'landscape',
    tags:        (screen.tags || []).join(', '),
  })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.deviceName.trim()) return toast.error('Screen name is required')
    setLoading(true)
    try {
      const tagsArr = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      await screensAPI.update(screen.id, {
        deviceName:  form.deviceName.trim(),
        location:    form.location.trim() || null,
        orientation: form.orientation,
        tags:        tagsArr,
      })
      toast.success('Screen updated successfully!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update screen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 350 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <Pencil size={14} className="text-white sm:hidden" />
              <Pencil size={16} className="text-white hidden sm:block" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">Edit Screen</h2>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 font-mono">
                #{screen.screen_seq_id || screen.id?.slice(0, 8)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
          {/* Screen Name */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">
              Screen Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Monitor size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none sm:hidden" />
              <Monitor size={15} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none hidden sm:block" />
              <input
                autoFocus
                value={form.deviceName}
                onChange={set('deviceName')}
                placeholder="e.g. Lobby Display"
                className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 font-medium placeholder:font-normal placeholder:text-slate-300 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">Location</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none sm:hidden" />
              <MapPin size={15} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none hidden sm:block" />
              <input
                value={form.location}
                onChange={set('location')}
                placeholder="e.g. Main Lobby, Reception"
                className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 font-medium placeholder:font-normal placeholder:text-slate-300 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Orientation */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">Orientation</label>
            <div className="flex gap-2">
              {['landscape', 'portrait'].map(o => (
                <button
                  key={o} type="button"
                  onClick={() => setForm(f => ({ ...f, orientation: o }))}
                  className={`flex-1 py-2 sm:py-2.5 rounded-xl border-2 text-xs sm:text-sm font-semibold capitalize transition-all ${
                    form.orientation === o
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {o === 'landscape' ? '⬛ Landscape' : '📱 Portrait'}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">
              Tags <span className="text-slate-400 font-normal normal-case">(comma separated)</span>
            </label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none sm:hidden" />
              <Hash size={15} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none hidden sm:block" />
              <input
                value={form.tags}
                onChange={set('tags')}
                placeholder="e.g. lobby, digital, promo"
                className="w-full border-2 border-slate-200 bg-slate-50 rounded-xl pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 font-medium placeholder:font-normal placeholder:text-slate-300 text-xs sm:text-sm"
              />
            </div>

            {/* Tag preview */}
            {form.tags && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="text-[9px] sm:text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-1.5 py-0.5 font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Current Info (read-only) */}
          {screen.playlist_name && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2.5">
              <PlayCircle size={14} className="text-blue-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">Assigned Playlist</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-0.5 truncate">{screen.playlist_name}</p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs sm:text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-[2] py-2.5 sm:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/60 text-xs sm:text-sm">
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : <><Save size={14} /> Save Changes</>
              }
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Soft Delete Confirm Modal (responsive)
// ─────────────────────────────────────────────────────────────
function SoftDeleteModal({ screen, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const go = async () => { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
        className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-sm mx-3 sm:mx-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
          <Trash2 size={18} className="text-amber-500 sm:hidden" />
          <Trash2 size={20} className="text-amber-500 hidden sm:block" />
        </div>
        <h3 className="font-bold text-slate-800 text-base sm:text-lg mb-1">Delete Screen?</h3>
        <p className="text-slate-500 text-xs sm:text-sm mb-1">
          <strong className="text-slate-700">{screen.device_name}</strong> will be moved to the <strong>Deleted</strong> tab and disconnected.
        </p>
        <p className="text-[10px] sm:text-xs text-slate-400 mb-1">You can restore it later or permanently delete it from the Deleted tab.</p>
        <p className="text-[9px] sm:text-xs text-slate-400 mb-4 sm:mb-5 font-mono">Screen ID: #{screen.screen_seq_id || screen.id}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 sm:py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-xs sm:text-sm">Cancel</button>
          <button onClick={go} disabled={loading} className="flex-1 py-2 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 size={12} className="animate-spin" />} Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Permanent Delete Confirm Modal (responsive)
// ─────────────────────────────────────────────────────────────
function PermanentDeleteModal({ screen, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [typed, setTyped] = useState('')
  const confirmWord = screen.device_name?.split(' ')[0] || 'DELETE'
  const go = async () => { setLoading(true); await onConfirm(); setLoading(false) }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
        className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-sm mx-3 sm:mx-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-red-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
          <BanIcon size={18} className="text-red-500 sm:hidden" />
          <BanIcon size={20} className="text-red-500 hidden sm:block" />
        </div>
        <h3 className="font-bold text-slate-800 text-base sm:text-lg mb-1">Permanently Delete?</h3>
        <p className="text-slate-500 text-xs sm:text-sm mb-3">
          <strong className="text-slate-700">{screen.device_name}</strong> will be <span className="text-red-600 font-semibold">permanently erased</span>. This cannot be undone.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
          <p className="text-[10px] sm:text-xs text-red-600 mb-2">
            Type <strong className="font-mono">{confirmWord}</strong> to confirm
          </p>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono outline-none focus:border-red-400 bg-white"
            placeholder={confirmWord}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 sm:py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-xs sm:text-sm">Cancel</button>
          <button
            onClick={go}
            disabled={loading || typed !== confirmWord}
            className="flex-1 py-2 sm:py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 size={12} className="animate-spin" />}
            Delete Forever
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// License Bar (responsive)
// ─────────────────────────────────────────────────────────────
function LicenseBar({ licenses }) {
  if (!licenses) return null
  const { used = 0, total = 5, available = 5 } = licenses
  const pct = Math.min(100, Math.round((used / total) * 100))
  const bar = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-white border border-slate-200 rounded-xl px-4 sm:px-5 py-3 sm:py-3.5 shadow-sm">
      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Shield size={16} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0 w-full sm:w-auto">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">Available Licenses</span>
          <span className="text-[10px] sm:text-xs font-bold">
            <span className={pct >= 100 ? 'text-red-600' : 'text-blue-600'}>{available}</span>
            <span className="text-slate-400 font-normal"> of {total} available</span>
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
            className={`h-full rounded-full ${bar}`}
          />
        </div>
      </div>
      {pct >= 100 && (
        <button className="text-[10px] sm:text-xs font-bold text-blue-600 border border-blue-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap">
          Upgrade Plan →
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Mobile Screen Card Component
// ─────────────────────────────────────────────────────────────
function MobileScreenCard({ screen, onEdit, onDelete, onPreview }) {
  const status = getStatus(screen)
  const cfg = STATUS[status] || STATUS.offline
  const [copiedId, setCopiedId] = useState(false)

  const copyId = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(String(screen.screen_seq_id || screen.id))
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1800)
    toast.success('Screen ID copied')
  }

  const expiry = screen.license_expires_at ? new Date(screen.license_expires_at) : null
  const expired = expiry && isPast(expiry)
  const expiringSoon = expiry && !expired && (expiry - Date.now()) < 7 * 86400000

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm"
    >
      {/* Header with ID and Actions */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={copyId} className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors">
          <span className="bg-slate-100 px-2 py-1 rounded-md">#{screen.screen_seq_id || screen.id?.slice(0, 6).toUpperCase()}</span>
          {copiedId ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="opacity-50" />}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => onPreview(screen)} className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors">
            <PlayCircle size={16} />
          </button>
          <button onClick={() => onEdit(screen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
            <Pencil size={16} />
          </button>
          <button onClick={() => onDelete(screen)} className="p-2 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Screen Name & Location */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            status === 'online' ? 'bg-emerald-100' : status === 'idle' ? 'bg-amber-100' : 'bg-slate-100'
          }`}>
            <Monitor size={14} className={
              status === 'online' ? 'text-emerald-600' : status === 'idle' ? 'text-amber-600' : 'text-slate-400'
            } />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 text-sm truncate">{screen.device_name}</div>
            {screen.location && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin size={9} className="text-slate-300" />
                <span className="text-xs text-slate-400 truncate">{screen.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status & Playlist */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
          <StatusDot status={status} />{cfg.label}
        </span>
        {screen.playlist_name && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
            <PlayCircle size={11} className="text-blue-400" />
            <span className="truncate max-w-[120px]">{screen.playlist_name}</span>
          </span>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <RotateCcw size={11} className="text-slate-400" />
          <span className="capitalize">{screen.orientation || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <CalendarClock size={11} className="text-slate-400" />
          {expiry ? (
            <span className={expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : ''}>
              {expired ? 'Expired' : format(expiry, 'dd MMM')}
            </span>
          ) : 'No expiry'}
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
          <Clock size={11} className="text-slate-400" />
          <span className="truncate">
            {screen.last_seen ? formatDistanceToNow(new Date(screen.last_seen), { addSuffix: true }) : 'Never'}
          </span>
        </div>
      </div>

      {/* Tags */}
      {(screen.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
          {screen.tags.map(t => (
            <span key={t} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5 font-medium">
              #{t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Mobile Deleted Screen Card
// ─────────────────────────────────────────────────────────────
function MobileDeletedScreenCard({ screen, onRestore, onPermanentDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm opacity-75"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
          #{screen.screen_seq_id || screen.id?.slice(0, 6).toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => onRestore(screen)} className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors">
            <Undo2 size={16} />
          </button>
          <button onClick={() => onPermanentDelete(screen)} className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors">
            <BanIcon size={16} />
          </button>
        </div>
      </div>

      {/* Screen Name & Location */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Monitor size={14} className="text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-500 text-sm line-through truncate">{screen.device_name}</div>
            {screen.location && (
              <div className="text-xs text-slate-300 truncate">{screen.location}</div>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-400 border-red-200">
          <Trash2 size={10} /> Deleted
        </span>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <RotateCcw size={11} />
          <span>{screen.orientation || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Trash2 size={11} />
          {screen.deleted_at ? format(new Date(screen.deleted_at), 'dd MMM') : '—'}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 col-span-2">
          <Clock size={11} />
          <span className="truncate">
            {screen.last_seen ? formatDistanceToNow(new Date(screen.last_seen), { addSuffix: true }) : 'Never'}
          </span>
        </div>
      </div>

      {/* Tags */}
      {(screen.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
          {screen.tags.map(t => (
            <span key={t} className="text-[10px] bg-slate-100 text-slate-400 rounded px-1.5 py-0.5 font-medium">
              #{t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Action Menu — ACTIVE screens (unchanged)
// ─────────────────────────────────────────────────────────────
function ActionMenu({ screen, onEdit, onDelete, onPreview }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
        <MoreVertical size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-44 overflow-hidden"
            >
              <button onClick={() => { setOpen(false); onPreview(screen) }}
                className="w-full px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2.5 transition-colors">
                <PlayCircle size={14} /> Preview Content
              </button>
              <button onClick={() => { setOpen(false); onEdit(screen) }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors">
                <Pencil size={14} className="text-slate-400" /> Edit Screen
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={() => { setOpen(false); onDelete(screen) }}
                className="w-full px-3 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2.5 transition-colors">
                <Trash2 size={14} /> Delete Screen
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Action Menu — DELETED screens (unchanged)
// ─────────────────────────────────────────────────────────────
function DeletedActionMenu({ screen, onRestore, onPermanentDelete }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
        <MoreVertical size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-44 overflow-hidden"
            >
              <button onClick={() => { setOpen(false); onRestore(screen) }}
                className="w-full px-3 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 transition-colors">
                <Undo2 size={14} /> Restore Screen
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={() => { setOpen(false); onPermanentDelete(screen) }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors font-semibold">
                <BanIcon size={14} /> Delete Forever
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Preview Modal helpers (unchanged from original)
// ─────────────────────────────────────────────────────────────
function getZonesForOrientation(ori) {
  if (ori === 'horizontal') return [
    { id: 'zone-left', name: 'Left Zone' },
    { id: 'zone-right', name: 'Right Zone' },
  ]
  if (ori === 'custom') return [
    { id: 'zone-top', name: 'Top Zone' },
    { id: 'zone-bottom-left', name: 'Bottom Left' },
    { id: 'zone-bottom-right', name: 'Bottom Right' },
  ]
  return [{ id: 'zone-main', name: 'Main Zone' }]
}

function getGridStyle(orientation) {
  if (orientation === 'horizontal') return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
  if (orientation === 'custom')     return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
  return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
}

function buildLayoutSlides(playlistData) {
  const { layouts = [], items_by_layout = {}, layout_type = 'vertical' } = playlistData
  return layouts.map((layout, index) => {
    const orientation = layout.orientation || layout_type
    const zones       = getZonesForOrientation(orientation)
    const layoutZones = items_by_layout[layout.id] || {}
    const zoneMap = {}
    zones.forEach(zone => {
      const rawItems = layoutZones[zone.id] || []
      zoneMap[zone.id] = {
        name: zone.name,
        items: rawItems.map(item => {
          const cfg = item.widget_config || {}
          return {
            id: item.id, position: item.position, duration: item.duration || 10,
            widget_type: item.widget_type || null, widget_config: cfg,
            item_type: item.item_type || (item.widget_type ? 'widget' : 'media'),
            media_id: item.media_id || null, media_name: item.media_name || cfg.mediaName || null,
            secure_url: item.secure_url || cfg.secureUrl || null,
            thumbnail_url: item.thumbnail_url || cfg.thumbnailUrl || null,
            resource_type: item.resource_type || cfg.resourceType || 'image',
            bounds: item.bounds || cfg.bounds || { x: 0, y: 0, w: 100, h: 100 },
          }
        }).sort((a, b) => a.position - b.position),
      }
    })
    const zoneDurations = Object.values(zoneMap).map(z => z.items.reduce((s, i) => s + (i.duration || 10), 0))
    const slideDuration = zoneDurations.length > 0 ? Math.max(10, ...zoneDurations.filter(d => d > 0)) : 10
    return { layoutId: layout.id, layoutName: layout.name || `Layout ${index + 1}`, orientation, zones: zoneMap, duration: slideDuration }
  })
}

function CanvasItemPreview({ item, small }) {
  const bounds = item.bounds || { x: 0, y: 0, w: 100, h: 100 }
  const isWidget = !!item.widget_type
  const Icon = isWidget ? (WIDGET_ICONS[item.widget_type] || Monitor) : null
  return (
    <div style={{ position: 'absolute', left: `${bounds.x}%`, top: `${bounds.y}%`, width: `${bounds.w}%`, height: `${bounds.h}%`, zIndex: 5 }}
      className="overflow-hidden rounded-sm">
      {isWidget && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 gap-1">
          <Icon size={small ? 10 : 20} className="text-white/70" />
          {!small && <p className="text-white/60 text-[8px] font-medium capitalize leading-none">{item.widget_type}</p>}
        </div>
      )}
      {!isWidget && item.resource_type === 'video' && item.secure_url && (
        <video key={item.secure_url} src={item.secure_url} className="w-full h-full object-cover" style={{ display: 'block', pointerEvents: 'none' }} autoPlay muted loop playsInline />
      )}
      {!isWidget && item.resource_type !== 'video' && (item.thumbnail_url || item.secure_url) && (
        <img src={item.thumbnail_url || item.secure_url} alt={item.media_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
      )}
      {!isWidget && !item.secure_url && !item.thumbnail_url && item.media_id && (
        <div className="w-full h-full flex items-center justify-center bg-gray-800/60">
          <Film size={small ? 10 : 16} className="text-white/30" />
        </div>
      )}
    </div>
  )
}

function ZonePreview({ zoneData, small }) {
  const items = zoneData?.items || []
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: items.length === 0 ? '#111827' : '#000', backgroundImage: items.length === 0 ? `linear-gradient(rgba(150,150,150,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(150,150,150,.05) 1px,transparent 1px)` : 'none', backgroundSize: '20px 20px' }}>
      {items.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <Monitor size={small ? 10 : 18} className="text-white/10" />
          {!small && <p className="text-white/20 text-[9px] mt-1 font-medium">{zoneData?.name || 'Empty'}</p>}
        </div>
      )}
      {items.map(item => <CanvasItemPreview key={item.id} item={item} small={small} />)}
      {!small && items.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10">
          <span className="text-white text-[7px] font-medium">{zoneData?.name}</span>
        </div>
      )}
    </div>
  )
}

function LayoutPreviewFrame({ slide, small }) {
  const { orientation, zones } = slide
  const zoneList = getZonesForOrientation(orientation)
  return (
    <div className="w-full h-full" style={{ display: 'grid', gap: small ? '1px' : '2px', background: '#d1d5db', ...getGridStyle(orientation) }}>
      {zoneList.map((zone, idx) => {
        const zoneData  = zones[zone.id] || { name: zone.name, items: [] }
        const spanStyle = (orientation === 'custom' && idx === 0) ? { gridColumn: '1 / -1' } : {}
        return (
          <div key={zone.id} style={{ ...spanStyle, position: 'relative', overflow: 'hidden' }}>
            <ZonePreview zoneData={zoneData} small={small} />
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Screen Preview Modal (responsive)
// ─────────────────────────────────────────────────────────────
function ScreenPreviewModal({ screen, onClose }) {
  const [playlistData, setPlaylistData] = useState(null)
  const [slides, setSlides]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [slideIdx, setSlideIdx]         = useState(0)
  const [paused, setPaused]             = useState(false)

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true); setError(null)
      try {
        const screenRes  = await screensAPI.getOne(screen.id)
        const screenData = screenRes.data
        if (!screenData.assigned_playlist_id) { setError('No playlist assigned to this screen'); setLoading(false); return }
        const plRes = await api.get(`/playlists/${screenData.assigned_playlist_id}`)
        const pl    = plRes.data
        setPlaylistData(pl)
        setSlides(buildLayoutSlides(pl))
        setSlideIdx(0)
      } catch (err) {
        setError('Failed to load: ' + (err.response?.data?.message || err.message))
      } finally { setLoading(false) }
    }
    if (screen?.id) doFetch()
  }, [screen.id])

  useEffect(() => {
    if (paused || slides.length < 2) return
    const slide = slides[slideIdx]
    const t = setTimeout(() => setSlideIdx(prev => (prev + 1) % slides.length), (slide?.duration || 10) * 1000)
    return () => clearTimeout(t)
  }, [slideIdx, slides, paused])

  const currentSlide  = slides[slideIdx] || null
  const isOnline      = (screen.real_status || screen.status) === 'online'
  const totalDuration = slides.reduce((s, sl) => s + (sl.duration || 10), 0)
  const totalItems    = slides.reduce((s, sl) => s + Object.values(sl.zones).reduce((sz, z) => sz + z.items.length, 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ type: 'spring', damping: 26, stiffness: 350 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Monitor size={16} className="text-white sm:hidden" />
              <Monitor size={18} className="text-white hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                <span className="truncate max-w-[150px] sm:max-w-[300px]">{screen.device_name}</span>
                <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-xs font-medium border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 flex items-center gap-1 sm:gap-2 flex-wrap">
                <span className="font-mono bg-slate-100 px-1 sm:px-1.5 py-0.5 rounded">#{screen.screen_seq_id || screen.id?.slice(0, 8)}</span>
                {screen.location && <span className="hidden sm:inline">•</span>}
                {screen.location && <span className="truncate max-w-[100px] sm:max-w-[200px]">{screen.location}</span>}
                {playlistData?.name && <span className="flex items-center gap-1 text-indigo-600 font-medium truncate max-w-[100px] sm:max-w-[200px]">• <PlayCircle size={10} /> {playlistData.name}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} className="sm:hidden" />
            <X size={18} className="hidden sm:block" />
          </button>
        </div>

        <div className="p-3 sm:p-6 bg-slate-50 space-y-3 sm:space-y-4">
          <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 sm:border-[6px] border-slate-800 aspect-video w-full bg-black">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                <Loader2 size={24} className="animate-spin text-indigo-400 mb-2 sm:mb-3 sm:hidden" />
                <Loader2 size={40} className="animate-spin text-indigo-400 mb-3 hidden sm:block" />
                <p className="text-white/70 text-[10px] sm:text-sm">Loading playlist…</p>
              </div>
            )}
            {!loading && error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 px-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-red-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4">
                  <AlertTriangle size={18} className="text-red-400 sm:hidden" />
                  <AlertTriangle size={26} className="text-red-400 hidden sm:block" />
                </div>
                <p className="text-white/90 font-semibold text-xs sm:text-base mb-1">Preview Unavailable</p>
                <p className="text-white/50 text-[10px] sm:text-sm text-center max-w-xs">{error}</p>
              </div>
            )}
            {!loading && !error && slides.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-700 rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-4">
                  <PlayCircle size={18} className="text-slate-400 sm:hidden" />
                  <PlayCircle size={26} className="text-slate-400 hidden sm:block" />
                </div>
                <p className="text-white/90 font-semibold text-xs sm:text-base mb-1">No Content</p>
                <p className="text-white/40 text-[10px] sm:text-sm">Add items in the Playlist Builder</p>
              </div>
            )}
            {!loading && !error && currentSlide && (
              <AnimatePresence mode="wait">
                <motion.div key={currentSlide.layoutId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
                  <LayoutPreviewFrame slide={currentSlide} small={false} />
                </motion.div>
              </AnimatePresence>
            )}
            {!loading && !error && currentSlide && (
              <>
                <div className="absolute top-1 left-1 sm:top-2 sm:left-2 z-20 bg-black/60 backdrop-blur-sm text-white/90 text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg flex items-center gap-1 pointer-events-none">
                  <Layout size={8} className="sm:hidden" />
                  <Layout size={10} className="hidden sm:block" />
                  <span className="font-semibold hidden sm:inline">{currentSlide.layoutName}</span>
                  <span className="font-semibold sm:hidden truncate max-w-[60px]">{currentSlide.layoutName}</span>
                </div>
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-20 bg-black/60 backdrop-blur-sm text-white/90 text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg flex items-center gap-1 pointer-events-none max-w-[100px] sm:max-w-[200px]">
                  <PlayCircle size={8} className="sm:hidden" />
                  <PlayCircle size={10} className="hidden sm:block" />
                  <span className="truncate">{playlistData?.name}</span>
                </div>
                <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 z-20 bg-black/60 backdrop-blur-sm text-white/90 text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg pointer-events-none">
                  {slideIdx + 1}/{slides.length}
                </div>
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 z-20 bg-black/60 backdrop-blur-sm text-white/90 text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg flex items-center gap-1 pointer-events-none">
                  <Clock size={8} className="sm:hidden" />
                  <Clock size={10} className="hidden sm:block" />
                  {currentSlide.duration}s
                </div>
              </>
            )}
          </div>

          {!loading && !error && slides.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 flex gap-1 sm:gap-2 overflow-x-auto pb-1 min-w-0 w-full sm:w-auto">
                {slides.map((slide, idx) => {
                  const hasItems = Object.values(slide.zones).some(z => z.items.length > 0)
                  return (
                    <button key={slide.layoutId} onClick={() => { setSlideIdx(idx); setPaused(true) }} title={slide.layoutName}
                      className={`flex-shrink-0 rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all ${slideIdx === idx ? 'border-indigo-500 shadow-md shadow-indigo-200/60 scale-105' : 'border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-300'}`}
                      style={{ width: 70, height: 45 }}>
                      <div className="w-full h-full relative">
                        {hasItems ? <LayoutPreviewFrame slide={slide} small={true} /> : <div className="w-full h-full flex items-center justify-center bg-slate-800"><Monitor size={10} className="text-white/20" /></div>}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white/90 text-[6px] font-semibold text-center py-0.5 truncate px-1 z-10">{slide.layoutName}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto justify-end">
                <button onClick={() => { setSlideIdx(i => (i - 1 + slides.length) % slides.length); setPaused(true) }} disabled={slides.length < 2} className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={12} className="sm:hidden" />
                  <ChevronLeft size={14} className="hidden sm:block" />
                </button>
                <button onClick={() => setPaused(p => !p)} className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-bold transition-colors ${paused ? 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}>
                  {paused ? '▶ Play' : '⏸ Pause'}
                </button>
                <button onClick={() => { setSlideIdx(i => (i + 1) % slides.length); setPaused(true) }} disabled={slides.length < 2} className="p-1.5 sm:p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors">
                  <ChevronRight size={12} className="sm:hidden" />
                  <ChevronRight size={14} className="hidden sm:block" />
                </button>
              </div>
            </div>
          )}

          {!isOnline && !loading && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 sm:px-4 py-2 sm:py-3">
              <WifiOff size={13} className="text-amber-500 flex-shrink-0 sm:hidden" />
              <WifiOff size={15} className="text-amber-500 flex-shrink-0 hidden sm:block" />
              <p className="text-xs sm:text-sm text-amber-700">Screen is <strong>offline</strong>. Showing last assigned playlist content.</p>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {playlistData && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[9px] sm:text-xs text-slate-500">
              <span className="flex items-center gap-1"><Layout size={10} className="text-slate-400 sm:hidden" /><Layout size={12} className="text-slate-400 hidden sm:block" />{slides.length} layout{slides.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><Film size={10} className="text-slate-400 sm:hidden" /><Film size={12} className="text-slate-400 hidden sm:block" />{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><Clock size={10} className="text-slate-400 sm:hidden" /><Clock size={12} className="text-slate-400 hidden sm:block" />{totalDuration}s total</span>
              <span className="flex items-center gap-1 capitalize"><Monitor size={10} className="text-slate-400 sm:hidden" /><Monitor size={12} className="text-slate-400 hidden sm:block" />{playlistData.layout_type}</span>
            </div>
          )}
          <button onClick={onClose} className="sm:ml-auto px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors w-full sm:w-auto">
            Close Preview
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Active Screen Table Row (desktop)
// ─────────────────────────────────────────────────────────────
function ScreenRow({ screen, idx, onEdit, onDelete, onPreview }) {
  const status = getStatus(screen)
  const cfg    = STATUS[status] || STATUS.offline
  const [copiedId, setCopiedId] = useState(false)

  const copyId = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(String(screen.screen_seq_id || screen.id))
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1800)
    toast.success('Screen ID copied')
  }

  const expiry       = screen.license_expires_at ? new Date(screen.license_expires_at) : null
  const expired      = expiry && isPast(expiry)
  const expiringSoon = expiry && !expired && (expiry - Date.now()) < 7 * 86400000

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025, duration: 0.2 }}
      className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
    >
      <td className="px-4 py-3.5 whitespace-nowrap">
        <button onClick={copyId} className="group/id flex items-center gap-1.5 font-mono text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors" title="Click to copy">
          <span className="bg-slate-100 group-hover/id:bg-blue-50 px-2 py-1 rounded-md transition-colors">
            #{screen.screen_seq_id || screen.id?.slice(0, 6).toUpperCase()}
          </span>
          {copiedId ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="opacity-0 group-hover/id:opacity-100 transition-opacity" />}
        </button>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${status === 'online' ? 'bg-emerald-100' : status === 'idle' ? 'bg-amber-100' : 'bg-slate-100'}`}>
            <Monitor size={13} className={status === 'online' ? 'text-emerald-600' : status === 'idle' ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <div>
            <span className="font-semibold text-slate-800 text-sm whitespace-nowrap">{screen.device_name}</span>
            {screen.location && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin size={10} className="text-slate-300" />
                <span className="text-xs text-slate-400 truncate max-w-[120px]">{screen.location}</span>
              </div>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
          <StatusDot status={status} />{cfg.label}
        </span>
      </td>

      <td className="px-4 py-3.5">
        {screen.playlist_name
          ? <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 whitespace-nowrap"><PlayCircle size={13} className="text-blue-400 flex-shrink-0" />{screen.playlist_name}</span>
          : <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">No playlist</span>
        }
      </td>

      <td className="px-4 py-3.5 whitespace-nowrap">
        {screen.orientation
          ? <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg capitalize font-medium"><RotateCcw size={11} className="text-slate-400" />{screen.orientation}</span>
          : <span className="text-slate-300 text-xs">—</span>
        }
      </td>

      <td className="px-4 py-3.5 whitespace-nowrap">
        {expiry
          ? <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${expired ? 'bg-red-50 text-red-600 border-red-200' : expiringSoon ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              <CalendarClock size={11} />{expired ? 'Expired' : format(expiry, 'dd MMM yyyy')}
            </span>
          : <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">No expiry</span>
        }
      </td>

      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={12} className="flex-shrink-0 text-slate-400" />
          {screen.last_seen ? formatDistanceToNow(new Date(screen.last_seen), { addSuffix: true }) : <span className="text-slate-300">Never</span>}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1 max-w-[160px]">
          {(screen.tags || []).length > 0
            ? (screen.tags || []).slice(0, 2).map(t => (
                <span key={t} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5 font-medium whitespace-nowrap">{t}</span>
              ))
            : <span className="text-slate-300 text-xs">—</span>
          }
          {(screen.tags || []).length > 2 && <span className="text-xs text-slate-400 font-medium">+{screen.tags.length - 2}</span>}
        </div>
      </td>

      <td className="px-4 py-3.5 text-right">
        <ActionMenu screen={screen} onEdit={onEdit} onDelete={onDelete} onPreview={onPreview} />
      </td>
    </motion.tr>
  )
}

// ─────────────────────────────────────────────────────────────
// Deleted Screen Row (desktop)
// ─────────────────────────────────────────────────────────────
function DeletedScreenRow({ screen, idx, onRestore, onPermanentDelete }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025, duration: 0.2 }}
      className="group border-b border-slate-100 last:border-0 hover:bg-red-50/30 transition-colors opacity-75"
    >
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
          #{screen.screen_seq_id || screen.id?.slice(0, 6).toUpperCase()}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Monitor size={13} className="text-slate-300" />
          </div>
          <div>
            <span className="font-semibold text-slate-500 text-sm line-through whitespace-nowrap">{screen.device_name}</span>
            {screen.location && <div className="text-xs text-slate-300 truncate max-w-[120px]">{screen.location}</div>}
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-400 border-red-200">
          <Trash2 size={10} /> Deleted
        </span>
      </td>

      <td className="px-4 py-3.5">
        {screen.playlist_name
          ? <span className="text-xs text-slate-400">{screen.playlist_name}</span>
          : <span className="text-slate-300 text-xs">—</span>
        }
      </td>

      <td className="px-4 py-3.5">
        {screen.orientation
          ? <span className="text-xs text-slate-400 capitalize">{screen.orientation}</span>
          : <span className="text-slate-300 text-xs">—</span>
        }
      </td>

      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="text-xs text-red-400 flex items-center gap-1.5">
          <Trash2 size={11} />
          {screen.deleted_at ? format(new Date(screen.deleted_at), 'dd MMM yyyy') : '—'}
        </span>
      </td>

      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="text-xs text-slate-400">
          {screen.last_seen ? formatDistanceToNow(new Date(screen.last_seen), { addSuffix: true }) : <span className="text-slate-300">Never</span>}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1 max-w-[160px]">
          {(screen.tags || []).length > 0
            ? (screen.tags || []).slice(0, 2).map(t => <span key={t} className="text-xs bg-slate-100 text-slate-400 rounded px-1.5 py-0.5 font-medium whitespace-nowrap">{t}</span>)
            : <span className="text-slate-300 text-xs">—</span>
          }
        </div>
      </td>

      <td className="px-4 py-3.5 text-right">
        <DeletedActionMenu screen={screen} onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
      </td>
    </motion.tr>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function Screens() {
  // ── Active screens state ──────────────────────────────────
  const [screens,        setScreens]        = useState([])
  const [deletedScreens, setDeletedScreens] = useState([])
  const [expiredScreens, setExpiredScreens] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [meta,           setMeta]           = useState(null)

  // ── UI state ──────────────────────────────────────────────
  const [search,         setSearch]         = useState('')
  const [mainTab,        setMainTab]        = useState('all')   // all | online | offline | expiring
  const [pageTab,        setPageTab]        = useState('active') // active | deleted | expired
  const [showAdd,        setShowAdd]        = useState(false)
  const [editTarget,     setEditTarget]     = useState(null)
  const [softDelTarget,  setSoftDelTarget]  = useState(null)
  const [permDelTarget,  setPermDelTarget]  = useState(null)
  const [previewTarget,  setPreviewTarget]  = useState(null)
  const [refreshing,     setRefreshing]     = useState(false)

  // ── Load ALL screens (active + deleted) ───────────────────
  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    try {
      // Active screens (no deleted_at)
      const res = await screensAPI.getAll({ search: search || undefined })
      setScreens(res.data || [])
      setMeta(res.meta)

      // Deleted screens — pass include_deleted param
      try {
        const delRes = await screensAPI.getAll({ include_deleted: true, only_deleted: true, search: search || undefined })
        setDeletedScreens(delRes.data || [])
      } catch {
        setDeletedScreens([])
      }
    } catch {
      toast.error('Failed to load screens')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(() => load(true), 30000)
    return () => clearInterval(t)
  }, [load])

  // Expired = active screens with expired license
  useEffect(() => {
    setExpiredScreens(screens.filter(s => s.license_expires_at && isPast(new Date(s.license_expires_at))))
  }, [screens])

  // ── Soft Delete ───────────────────────────────────────────
  const handleSoftDelete = async () => {
    try {
      await screensAPI.delete(softDelTarget.id)
      toast.success(`"${softDelTarget.device_name}" moved to Deleted`)
      setSoftDelTarget(null)
      load(true)
    } catch {
      toast.error('Failed to delete screen')
    }
  }

  // ── Permanent Delete ──────────────────────────────────────
  const handlePermanentDelete = async () => {
    try {
      // Use permanent=true flag for hard delete
      await api.delete(`/screens/${permDelTarget.id}?permanent=true`)
      toast.success(`"${permDelTarget.device_name}" permanently deleted`)
      setPermDelTarget(null)
      load(true)
    } catch {
      toast.error('Failed to permanently delete screen')
    }
  }

  // ── Restore ───────────────────────────────────────────────
  const handleRestore = async (screen) => {
    try {
      await api.patch(`/screens/${screen.id}/restore`)
      toast.success(`"${screen.device_name}" restored successfully`)
      load(true)
    } catch {
      toast.error('Failed to restore screen')
    }
  }

  // ── Stats ─────────────────────────────────────────────────
  const live     = screens.filter(s => getStatus(s) === 'online').length
  const offline  = screens.filter(s => getStatus(s) === 'offline').length
  const expiring = screens.filter(s => {
    if (!s.license_expires_at) return false
    return (new Date(s.license_expires_at) - Date.now()) / 86400000 <= 7
  }).length

  // ── Filter active by sub-tab ──────────────────────────────
  const filtered = screens.filter(s => {
    if (mainTab === 'online')   return getStatus(s) === 'online'
    if (mainTab === 'offline')  return getStatus(s) === 'offline'
    if (mainTab === 'expiring') return (() => {
      if (!s.license_expires_at) return false
      return (new Date(s.license_expires_at) - Date.now()) / 86400000 <= 7
    })()
    return true
  })

  // ── Tab config ────────────────────────────────────────────
  const pageTabs = [
    { key: 'active',  label: 'All Screens',     count: screens.length,        icon: Monitor,   color: 'text-slate-700' },
    { key: 'deleted', label: 'Deleted',  count: deletedScreens.length, icon: Trash2,    color: 'text-red-600' },
    { key: 'expired', label: 'Expired',  count: expiredScreens.length, icon: AlertCircle, color: 'text-amber-600' },
  ]

  const TABLE_HEADERS_ACTIVE  = ['ID','Name','Status','Playlist','Orientation','Expiry','Last Seen','Tags','']
  const TABLE_HEADERS_DELETED = ['ID','Name','Status','Playlist','Orientation','Deleted On','Last Seen','Tags','']

  return (
    <div className="min-h-screen bg-[#F1F5F9] w-full">
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6">
        <div className="w-full space-y-3 sm:space-y-4">

          {/* ── Page Header ─────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">Screens</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage and monitor your digital signage displays</p>
            </div>
            {pageTab === 'active' && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-200/60 transition-all w-full sm:w-auto"
              >
                <Plus size={16} className="sm:hidden" />
                <Plus size={17} className="hidden sm:block" /> New Screen
              </button>
            )}
          </div>

          {/* ── Stats Cards (only on Active tab) ────────────── */}
          {pageTab === 'active' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: 'LIVE',       val: live,                             color: 'bg-emerald-500', icon: Activity  },
                { label: 'OFFLINE',    val: offline,                          color: 'bg-slate-400',  icon: WifiOff   },
                { label: 'EXPIRING',   val: expiring,                         color: 'bg-amber-500',  icon: CalendarClock },
                { label: 'AVAILABLE',  val: meta?.licenses?.available ?? '—', color: 'bg-blue-500',   icon: Shield    },
              ].map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-4 flex items-center gap-2 sm:gap-3"
                >
                  <div className={`${c.color} w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <c.icon size={14} className="text-white sm:hidden" />
                    <c.icon size={18} className="text-white hidden sm:block" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-2xl font-black text-slate-800 leading-none">{c.val}</div>
                    <div className="text-[8px] sm:text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">{c.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Deleted/Expired info banners */}
          {pageTab === 'deleted' && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-xl px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center gap-2 sm:gap-3">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 sm:hidden" />
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 hidden sm:block" />
              <p className="text-xs sm:text-sm text-amber-700">
                Deleted screens are <strong>disconnected</strong> but preserved. You can restore or permanently delete them.
              </p>
            </motion.div>
          )}

          {pageTab === 'expired' && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center gap-2 sm:gap-3">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 sm:hidden" />
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 hidden sm:block" />
              <p className="text-xs sm:text-sm text-red-700">
                These screens have <strong>expired licenses</strong>. Renew your plan to restore access.
              </p>
            </motion.div>
          )}

          {pageTab === 'active' && <LicenseBar licenses={meta?.licenses} />}

          {/* ── Main Table Card ──────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">

            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-100">

              {/* Page-level tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 w-fit flex-wrap">
                {pageTabs.map(t => {
                  const Icon = t.icon
                  return (
                    <button key={t.key} onClick={() => setPageTab(t.key)}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                        pageTab === t.key
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Icon size={11} className={pageTab === t.key ? t.color : ''} />
                      <span className="hidden sm:inline">{t.label}</span>
                      <span className="sm:hidden">{t.key === 'active' ? 'All' : t.key}</span>
                      <span className={`ml-0.5 px-1 sm:px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-bold ${
                        pageTab === t.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200/50 text-slate-400'
                      }`}>{t.count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Right: sub-filter + search + refresh */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
                {pageTab === 'active' && (
                  <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5 w-full sm:w-auto overflow-x-auto">
                    {[
                      { key: 'all',      label: `All (${screens.length})` },
                      { key: 'online',   label: `Live (${live})` },
                      { key: 'offline',  label: `Offline (${offline})` },
                      { key: 'expiring', label: `Expiring (${expiring})` },
                    ].map(t => (
                      <button key={t.key} onClick={() => setMainTab(t.key)}
                        className={`flex-1 sm:flex-none px-2 sm:px-2.5 py-1 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all ${
                          mainTab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <input
                      value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search screens…"
                      className="w-full sm:w-36 md:w-44 bg-slate-50 border border-slate-200 rounded-xl pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    />
                    <Search size={12} className="absolute left-2.5 sm:left-3 top-2 sm:top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                  <button onClick={() => load(true)} title="Refresh"
                    className="p-1.5 sm:p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                    <RefreshCw size={12} className={refreshing ? 'animate-spin text-blue-500' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── MOBILE VIEW (Cards) ────────────────────────── */}
            <div className="block lg:hidden p-3 sm:p-4">
              {pageTab === 'active' && (
                loading ? (
                  <div className="py-10 flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-blue-400" />
                    <span className="text-xs sm:text-sm text-slate-400">Loading screens…</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <Monitor size={20} className="text-slate-300 sm:hidden" />
                      <Monitor size={28} className="text-slate-300 hidden sm:block" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-sm sm:text-base">No screens found</p>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        {mainTab !== 'all' ? 'No screens match this filter.' : 'Click "New Screen" to pair your first display'}
                      </p>
                    </div>
                    {mainTab === 'all' && (
                      <button onClick={() => setShowAdd(true)}
                        className="px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-2 transition-colors">
                        <Plus size={14} /> Add Screen
                      </button>
                    )}
                  </div>
                ) : (
                  filtered.map((s, i) => (
                    <MobileScreenCard
                      key={s.id}
                      screen={s}
                      onEdit={setEditTarget}
                      onDelete={setSoftDelTarget}
                      onPreview={setPreviewTarget}
                    />
                  ))
                )
              )}

              {pageTab === 'deleted' && (
                loading ? (
                  <div className="py-10 flex flex-col items-center gap-3">
                    <Loader2 size={24} className="animate-spin text-blue-400" />
                    <span className="text-xs sm:text-sm text-slate-400">Loading deleted screens…</span>
                  </div>
                ) : deletedScreens.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-50 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 size={20} className="text-green-400 sm:hidden" />
                      <CheckCircle2 size={28} className="text-green-400 hidden sm:block" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-sm sm:text-base">No deleted screens</p>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">Screens you delete will appear here</p>
                    </div>
                  </div>
                ) : (
                  deletedScreens.map((s, i) => (
                    <MobileDeletedScreenCard
                      key={s.id}
                      screen={s}
                      onRestore={handleRestore}
                      onPermanentDelete={setPermDelTarget}
                    />
                  ))
                )
              )}

              {pageTab === 'expired' && (
                expiredScreens.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 size={20} className="text-emerald-400 sm:hidden" />
                      <CheckCircle2 size={28} className="text-emerald-400 hidden sm:block" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 text-sm sm:text-base">No expired screens</p>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1">All screen licenses are active</p>
                    </div>
                  </div>
                ) : (
                  expiredScreens.map((s, i) => (
                    <MobileScreenCard
                      key={s.id}
                      screen={s}
                      onEdit={setEditTarget}
                      onDelete={setSoftDelTarget}
                      onPreview={setPreviewTarget}
                    />
                  ))
                )
              )}
            </div>

            {/* ── DESKTOP TABLES (hidden on mobile) ──────────── */}
            <div className="hidden lg:block">
              {/* ACTIVE SCREENS TABLE */}
              {pageTab === 'active' && (
                loading ? (
                  <div className="py-20 flex flex-col items-center gap-3">
                    <Loader2 size={26} className="animate-spin text-blue-400" />
                    <span className="text-sm text-slate-400">Loading screens…</span>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                      <Monitor size={28} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">No screens found</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {mainTab !== 'all' ? 'No screens match this filter.' : 'Click "New Screen" to pair your first display'}
                      </p>
                    </div>
                    {mainTab === 'all' && (
                      <button onClick={() => setShowAdd(true)}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl inline-flex items-center gap-2 transition-colors">
                        <Plus size={16} /> Add Screen
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm table-auto">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          {TABLE_HEADERS_ACTIVE.map((h, i) => (
                            <th key={h} className={`px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${i === 8 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((s, i) => (
                          <ScreenRow
                            key={s.id} screen={s} idx={i}
                            onEdit={setEditTarget}
                            onDelete={setSoftDelTarget}
                            onPreview={setPreviewTarget}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* DELETED SCREENS TABLE */}
              {pageTab === 'deleted' && (
                loading ? (
                  <div className="py-20 flex flex-col items-center gap-3">
                    <Loader2 size={26} className="animate-spin text-blue-400" />
                    <span className="text-sm text-slate-400">Loading deleted screens…</span>
                  </div>
                ) : deletedScreens.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 size={28} className="text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">No deleted screens</p>
                      <p className="text-sm text-slate-400 mt-1">Screens you delete will appear here</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm table-auto">
                      <thead>
                        <tr className="border-b border-slate-100 bg-red-50/50">
                          {TABLE_HEADERS_DELETED.map((h, i) => (
                            <th key={h} className={`px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${i === 8 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deletedScreens.map((s, i) => (
                          <DeletedScreenRow
                            key={s.id} screen={s} idx={i}
                            onRestore={handleRestore}
                            onPermanentDelete={setPermDelTarget}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* EXPIRED SCREENS TABLE */}
              {pageTab === 'expired' && (
                expiredScreens.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 size={28} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">No expired screens</p>
                      <p className="text-sm text-slate-400 mt-1">All screen licenses are active</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm table-auto">
                      <thead>
                        <tr className="border-b border-slate-100 bg-amber-50/50">
                          {TABLE_HEADERS_ACTIVE.map((h, i) => (
                            <th key={h} className={`px-4 py-3 text-[11px] font-bold text-amber-500/70 uppercase tracking-wider whitespace-nowrap ${i === 8 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expiredScreens.map((s, i) => (
                          <ScreenRow
                            key={s.id} screen={s} idx={i}
                            onEdit={setEditTarget}
                            onDelete={setSoftDelTarget}
                            onPreview={setPreviewTarget}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            {/* Pagination (active tab) */}
            {pageTab === 'active' && meta && meta.total > meta.limit && (
              <div className="px-3 sm:px-5 py-3 sm:py-3.5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-[10px] sm:text-xs text-slate-500">Showing {filtered.length} of {meta.total} screens</span>
                <div className="flex gap-2">
                  <button disabled={meta.page === 1}         className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">← Previous</button>
                  <button disabled={meta.page >= meta.pages} className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Next →</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <AddScreenModal key="add" licenses={meta?.licenses} onClose={() => setShowAdd(false)} onSuccess={() => load(true)} />
        )}
        {editTarget && (
          <EditScreenModal key="edit" screen={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => load(true)} />
        )}
        {softDelTarget && (
          <SoftDeleteModal key="soft-del" screen={softDelTarget} onClose={() => setSoftDelTarget(null)} onConfirm={handleSoftDelete} />
        )}
        {permDelTarget && (
          <PermanentDeleteModal key="perm-del" screen={permDelTarget} onClose={() => setPermDelTarget(null)} onConfirm={handlePermanentDelete} />
        )}
        {previewTarget && (
          <ScreenPreviewModal key="preview" screen={previewTarget} onClose={() => setPreviewTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}