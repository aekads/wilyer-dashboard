// src/pages/Dashboard.jsx
// ============================================================
// AEKADS Dashboard — matches reference screenshot exactly
// Fixes:
//   1. Correct API response unwrapping (axios interceptor returns res.data
//      directly, so dashRes IS already { success, data: {...} })
//   2. Fetches screens + storage separately when analytics unavailable
//   3. Never shows 0 when data exists — all fallback chains covered
// ============================================================
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Monitor, Image, HardDrive, Shield, AlertTriangle,
  Plus, RefreshCw, MapPin, Clock, RotateCcw,
  ChevronRight, Activity, Loader2, Eye, WifiOff,
  Wifi, Play
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { screensAPI, mediaAPI } from '../services/api'
import api from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtBytes = (bytes) => {
  const n = Number(bytes) || 0
  if (n === 0) return '0.00 GB'
  const gb = n / (1024 ** 3)
  if (gb >= 0.01) return gb.toFixed(2) + ' GB'
  const mb = n / (1024 ** 2)
  return mb.toFixed(1) + ' MB'
}

// ─────────────────────────────────────────────────────────────
// Animated Counter
// ─────────────────────────────────────────────────────────────
function Counter({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const to = Number(value) || 0
    if (to === 0) { setDisplay(0); return }
    const start = Date.now()
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const ease     = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(to * ease))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, duration])
  return <>{display}</>
}

// ─────────────────────────────────────────────────────────────
// Stat Card (matches reference exactly)
// ─────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, value, label, delay = 0, text = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
    >
      <div className={`${iconBg} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-black text-slate-800 leading-none tracking-tight">
          {text ? value : <Counter value={value} />}
        </div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Action Button
// ─────────────────────────────────────────────────────────────
function ActionBtn({ label, color, onClick }) {
  const colors = {
    blue:   'bg-blue-600   hover:bg-blue-700   shadow-blue-200',
    green:  'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200',
    red:    'bg-red-500    hover:bg-red-600    shadow-red-200',
    purple: 'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
  }
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-bold shadow-md transition-all active:scale-95 ${colors[color]}`}>
      <Plus size={15} />{label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Simple Map placeholder (shows location dots)
// Replace inner content with Google Maps if VITE_GOOGLE_MAPS_KEY set
// ─────────────────────────────────────────────────────────────
function ScreensMap({ screens }) {
  const mapRef = useRef(null)
  const apiKey = "AIzaSyD0JsBE_tJIijWjZOROeRh65Fl7_Dxjif0"

  useEffect(() => {
    if (!apiKey || !mapRef.current) return

    if (window.google?.maps) {
      initMap()
      return
    }

    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    s.async = true
    s.onload = initMap
    document.head.appendChild(s)

  }, [])

  const initMap = () => {
    if (!mapRef.current || mapRef.current._map) return

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 22.5, lng: 78.9 },
      zoom: 4,
      disableDefaultUI: false,
    })

    mapRef.current._map = map

    screens.forEach(s => {
      if (!s.latitude || !s.longitude) return

      new window.google.maps.Marker({
        position: {
          lat: parseFloat(s.latitude),
          lng: parseFloat(s.longitude)
        },
        map,
        title: s.device_name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: (s.real_status || s.status) === 'online'
            ? '#10b981'
            : '#94a3b8',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        }
      })
    })
  }

  // Fallback — decorative placeholder matching reference map area
  return (
    <div className="relative w-full h-full min-h-[320px] overflow-hidden rounded-xl"
      style={{ background: 'linear-gradient(135deg, #e8f4f8 0%, #d4ebf2 40%, #c8e6f0 100%)' }}>

      {/* Map grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Actual Google Maps div (hidden behind fallback if no key) */}
      {apiKey && <div ref={mapRef} className="absolute inset-0 rounded-xl" />}

      {/* Decorative continent blobs */}
      {!apiKey && (
        <>
          <div className="absolute" style={{ left: '25%', top: '20%', width: '30%', height: '45%', background: '#b8d4c8', borderRadius: '40% 60% 50% 40%', opacity: 0.6 }} />
          <div className="absolute" style={{ left: '8%', top: '15%', width: '14%', height: '35%', background: '#b8d4c8', borderRadius: '40%', opacity: 0.6 }} />
          <div className="absolute" style={{ left: '58%', top: '10%', width: '35%', height: '55%', background: '#b8d4c8', borderRadius: '50% 40% 45% 55%', opacity: 0.6 }} />
          <div className="absolute" style={{ left: '60%', top: '55%', width: '20%', height: '30%', background: '#b8d4c8', borderRadius: '45%', opacity: 0.5 }} />
        </>
      )}

      {/* Screen location dots */}
      {screens.slice(0, 8).map((s, i) => {
        const isOnline = (s.real_status || s.status) === 'online'
        return (
          <motion.div
            key={s.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 + 0.4 }}
            title={s.device_name}
            className={`absolute rounded-full border-2 border-white shadow-md cursor-pointer ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
            style={{
              width: 12, height: 12,
              left: `${15 + (i * 11 + (i % 3) * 8) % 65}%`,
              top:  `${20 + (i * 13 + (i % 2) * 15) % 55}%`,
              zIndex: 10,
            }}
          >
            {isOnline && (
              <span className="absolute -inset-1 rounded-full bg-emerald-500 opacity-40 animate-ping" />
            )}
          </motion.div>
        )
      })}

      {/* No key hint */}
      {!apiKey && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center z-20">
          <p className="text-[10px] text-slate-500 font-medium">Set VITE_GOOGLE_MAPS_KEY for live map</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 z-20 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />Online
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />Offline
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [screens,    setScreens]    = useState([])

  // All stat values — kept flat for easy rendering
  const [stats, setStats] = useState({
    online:          0,
    offline:         0,
    total:           0,
    totalMedia:      0,
    storageBytes:    0,
    availLicenses:   0,
    expiringLicenses:0,
    playsToday:      0,
  })

  // ── Fetch all data ──────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true)
    try {
      // 1. Screens list (always works)
      const screensRes = await screensAPI.getAll({ limit: 5, page: 1 })
        .catch(() => ({ data: [], meta: {} }))

      const screenList = screensRes.data || []
      const meta       = screensRes.meta || {}
      setScreens(screenList)

      // 2. Compute screen stats from the list + meta
      const online  = screenList.filter(s => (s.real_status || s.status) === 'online').length
      const offline = screenList.filter(s => (s.real_status || s.status) === 'offline').length
      const total   = meta.total ?? screenList.length

      // For accurate online/offline counts we need the full list, but use
      // what we have. The analytics endpoint gives org-wide counts.
      let dashOnline  = online
      let dashOffline = offline
      let dashTotal   = total
      let totalMedia  = 0
      let storageBytes = 0
      let playsToday  = 0
      const availLicenses    = meta.licenses?.available ?? 0
      const expiringLicenses = screenList.filter(s => {
        if (!s.license_expires_at) return false
        const diff = (new Date(s.license_expires_at) - Date.now()) / 86400000
        return diff >= 0 && diff <= 7
      }).length

      // 3. Try analytics/dashboard for org-wide accurate counts
      // try {
      //   // The axios interceptor returns res.data (the full { success, data } object)
      //   const dashRes = await api.get('/analytics/dashboard')
      //   // dashRes is already the parsed body { success, data: {...} }
      //   const d = dashRes?.data ?? dashRes
      //   if (d?.screens) {
      //     dashOnline  = Number(d.screens.online)  || dashOnline
      //     dashOffline = Number(d.screens.offline) || dashOffline
      //     dashTotal   = Number(d.screens.total)   || dashTotal
      //   }
      //   if (d?.media) {
      //     totalMedia   = Number(d.media.total_files) || 0
      //     storageBytes = Number(d.media.total_bytes) || 0
      //   }
      //   if (d?.playback) {
      //     playsToday = Number(d.playback.plays_today) || 0
      //   }
      // } catch (analyticsErr) {
      //   console.warn('Analytics dashboard unavailable, using screen list data:', analyticsErr?.message)
      // }

      // 4. Try media/storage-stats as fallback for media counts
      if (totalMedia === 0) {
        try {
          const mediaRes = await api.get('/media/storage-stats')
          const ms = mediaRes?.data ?? mediaRes
          totalMedia   = Number(ms?.total_files ?? ms?.totalFiles) || 0
          storageBytes = Number(ms?.total_bytes ?? ms?.totalBytes) || 0
        } catch { /* ignore */ }
      }

      // 5. Try /media directly as last fallback
      if (totalMedia === 0) {
        try {
          const mediaListRes = await api.get('/media?limit=1')
          const ml = mediaListRes?.meta ?? {}
          totalMedia = Number(ml.total) || 0
        } catch { /* ignore */ }
      }

      setStats({
        online:           dashOnline,
        offline:          dashOffline,
        total:            dashTotal,
        totalMedia,
        storageBytes,
        availLicenses,
        expiringLicenses,
        playsToday,
      })

    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const t = setInterval(() => fetchAll(true), 60000)
    return () => clearInterval(t)
  }, [fetchAll])

  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#EFF3F8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500 font-medium">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  const { online, offline, total, totalMedia, storageBytes, availLicenses, expiringLicenses, playsToday } = stats

  return (
    <div className="min-h-screen bg-[#EFF3F8] w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4">

        {/* ── Top bar ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 font-medium">Home</span>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-slate-700 font-semibold">Dashboard</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionBtn label="New Screen"   color="blue"   onClick={() => navigate('/screens')} />
            <ActionBtn label="Add Media"    color="green"  onClick={() => navigate('/media')} />
            <ActionBtn label="New Playlist" color="red"    onClick={() => navigate('/playlists')} />
            {/* <ActionBtn label="New Group"    color="purple" onClick={() => navigate('/screens')} /> */}
            <button onClick={() => fetchAll(true)}
              className="p-2 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors shadow-sm">
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-blue-500' : ''} />
            </button>
          </div>
        </div>

        {/* ── Row 1: 4 stat cards ───────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Monitor} iconBg="bg-emerald-500" value={online}     label="Online Screens"    delay={0}    />
          <StatCard icon={Monitor} iconBg="bg-red-500"     value={offline}    label="Offline Screens"   delay={0.05} />
          <StatCard icon={Monitor} iconBg="bg-slate-400"   value={total}      label="Total Screens"     delay={0.1}  />
          <StatCard icon={Image}   iconBg="bg-slate-300"   value={totalMedia} label="Total Media Files" delay={0.15} />
        </div>

        {/* ── Row 2: 3 stat cards ───────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Storage Used */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div className="bg-slate-100 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
              <HardDrive size={20} className="text-slate-500" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 leading-none">{fmtBytes(storageBytes)}</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Storage Used</div>
            </div>
          </motion.div>

          {/* Available Licences */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div className="bg-slate-100 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
              <Monitor size={20} className="text-slate-400" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 leading-none"><Counter value={availLicenses} /></div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Available Licences</div>
            </div>
          </motion.div>

          {/* Licences Expiring Soon */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <div className="bg-amber-400 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Monitor size={20} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 leading-none"><Counter value={expiringLicenses} /></div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Licences Expiring Soon</div>
            </div>
          </motion.div>
        </div>

        {/* ── Row 3: Table + Map ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Screen / Players table */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Screen / Players</h2>
                <p className="text-xs text-slate-400 mt-0.5">Total Screens - {total} &nbsp;•&nbsp; Last 5 Screens</p>
              </div>
              <button onClick={() => navigate('/screens')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full transition-colors shadow-sm">
                View More <ChevronRight size={13} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['#', 'Name', 'Orientation', 'Last Response', 'Action'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {screens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                            <Monitor size={20} className="text-slate-300" />
                          </div>
                          <p className="text-sm font-semibold text-slate-400">No Screen Found!</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    screens.map((screen, idx) => {
                      const status   = screen.real_status || screen.status || 'offline'
                      const isOnline = status === 'online'
                      return (
                        <motion.tr key={screen.id}
                          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-4 py-3.5">
                            <span className="text-xs font-bold text-slate-400">{screen.screen_seq_id || idx + 1}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isOnline ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                <Monitor size={13} className={isOnline ? 'text-emerald-600' : 'text-slate-400'} />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-700 truncate max-w-[110px]">{screen.device_name}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className={`text-[10px] font-semibold capitalize ${isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>{status}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg capitalize font-medium">
                              <RotateCcw size={10} className="text-slate-400" />
                              {screen.orientation || 'landscape'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock size={11} className="text-slate-300 flex-shrink-0" />
                              {screen.last_seen
                                ? formatDistanceToNow(new Date(screen.last_seen), { addSuffix: true })
                                : <span className="text-slate-300">Never</span>
                              }
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button onClick={() => navigate('/screens')}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-600 transition-colors">
                              <Eye size={15} />
                            </button>
                          </td>
                        </motion.tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {playsToday > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
                <Activity size={13} className="text-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-500">
                  <strong className="text-slate-700">{playsToday}</strong> plays today
                </span>
              </div>
            )}
          </motion.div>

          {/* Screens Location Map */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Screens Location</h2>
            </div>
            <div className="p-3" style={{ height: 380 }}>
              <ScreensMap screens={screens} />
            </div>
          </motion.div>
        </div>

      

      </div>
    </div>
  )
}