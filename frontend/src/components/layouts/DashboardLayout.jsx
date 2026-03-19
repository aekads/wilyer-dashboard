// src/components/layouts/DashboardLayout.jsx
// ============================================================
// AEKADS Dashboard Layout — Final Complete Version
//
// Nav filtering:
//   • super_admin / admin  → see ALL nav items (bypass)
//   • others               → filtered by hasPermission(slug)
//     where slug matches exactly what the backend requirePermission() uses
//
// Logo: loads https://cms.aekads.com/images/Logo.png
//   collapsed → small square icon fallback
//   expanded  → full logo
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Image, ListVideo, Calendar,
  BarChart3, Users, Settings, LogOut, Bell,
  ChevronLeft, ChevronRight, Shield, MonitorPlay, X, Radio
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { subscribeToNotifications, subscribeToScreenUpdates } from '../../services/socket'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────
// Nav config — perm must match backend requirePermission() slugs
// ─────────────────────────────────────────────────────────────
const NAV = [
  {
    group: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      // Dashboard visible to everyone logged in
    ],
  },
  {
    group: 'Content',
    items: [
      { to: '/screens',   icon: Monitor,   label: 'Screens',       perm: 'screens:read'   },
      { to: '/media',     icon: Image,     label: 'Media Library',  perm: 'media:read'     },
      { to: '/playlists', icon: ListVideo, label: 'Playlists',      perm: 'playlists:read' },
      // { to: '/schedules', icon: Calendar,  label: 'Schedules',      perm: 'schedules:read' },
    ],
  },
  {
    group: 'Insights',
    items: [
      // { to: '/analytics', icon: BarChart3, label: 'Analytics', perm: 'analytics:read' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { to: '/teams',    icon: Users,    label: 'Team',     perm: 'team:read'     },
      // { to: '/settings', icon: Settings, label: 'Settings', perm: 'settings:read' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Logo — real image with fallback
// ─────────────────────────────────────────────────────────────
function Logo({ collapsed }) {
  const [err, setErr] = useState(false)

  if (!err) {
    return (
      <img
        src="https://cms.aekads.com/images/Logo.png"
        alt="Aekads"
        onError={() => setErr(true)}
        className={`object-contain transition-all ${collapsed ? 'h-7 w-7' : 'h-8 w-auto max-w-[140px]'}`}
      />
    )
  }

  // Text fallback
  if (collapsed) {
    return (
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
        <MonitorPlay size={16} className="text-white" />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)' }}>
        <MonitorPlay size={16} className="text-white" />
      </div>
      <span className="font-black text-[18px] text-slate-900 tracking-tight leading-none"
        style={{ letterSpacing: '-0.04em' }}>
        Aek<span className="text-blue-600">ads</span>
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Notification dropdown
// ─────────────────────────────────────────────────────────────
function NotifDropdown({ notifs, onClose, onClear }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-bold text-slate-800">Notifications</span>
        <div className="flex items-center gap-3">
          {notifs.length > 0 && (
            <button onClick={onClear}
              className="text-xs text-slate-400 hover:text-red-500 font-semibold transition-colors">
              Clear all
            </button>
          )}
          <button onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {notifs.length === 0 ? (
          <div className="py-10 text-center">
            <Bell size={22} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">All caught up!</p>
          </div>
        ) : notifs.map((n, i) => (
          <div key={i}
            className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
              ${!n.read ? 'bg-blue-50/50' : ''}`}>
            <div className="flex items-start gap-2.5">
              {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
              <div className={!n.read ? '' : 'ml-4'}>
                <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                {n.message && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Avatar gradient by initials
// ─────────────────────────────────────────────────────────────
const GRADIENTS = [
  'from-blue-500 to-cyan-500',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
]
function avatarGrad(initials) {
  return GRADIENTS[(initials?.charCodeAt(0) || 0) % GRADIENTS.length]
}

// ─────────────────────────────────────────────────────────────
// Main Layout
// ─────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const { user, organization, logout, hasPermission, hasRole } = useAuthStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed,  setCollapsed]  = useState(false)
  const [notifs,     setNotifs]     = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [online,     setOnline]     = useState(0)
  const notifRef = useRef(null)

  // ── Real-time ───────────────────────────────────────────────
  useEffect(() => {
    const u1 = subscribeToNotifications((n) => {
      setNotifs(p => [{ ...n, read: false }, ...p.slice(0, 19)])
      toast(n.title, { icon: '🔔' })
    })
    const u2 = subscribeToScreenUpdates((d) => {
      if (d.status === 'online')  setOnline(p => p + 1)
      if (d.status === 'offline') setOnline(p => Math.max(0, p - 1))
    })
    return () => { u1?.(); u2?.() }
  }, [])

  // ── Close notif on outside click ────────────────────────────
  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Derived user info ────────────────────────────────────────
  const firstName = user?.first_name || user?.firstName || ''
  const lastName  = user?.last_name  || user?.lastName  || ''
  const email     = user?.email      || ''
  const orgName   = organization?.name || user?.org_name || ''
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || email
  const initials  = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || email[0]?.toUpperCase() || 'U'
  const grad      = avatarGrad(initials)

  // ── Role checks ─────────────────────────────────────────────
  const isSuperAdmin = user?.isSuperAdmin || hasRole('super_admin')
  const isAdmin      = user?.isAdmin      || hasRole('admin')
  const elevated     = isSuperAdmin || isAdmin

  // ── Nav item visibility ──────────────────────────────────────
  // elevated users see everything; others filtered by hasPermission
  const canSee = (item) => {
    if (!item.perm) return true       // no perm required
    if (elevated)   return true       // admin bypass
    return hasPermission(item.perm)   // check permission slug
  }

  // ── Active page label ────────────────────────────────────────
  const activeLabel = (() => {
    for (const { items } of NAV) {
      for (const item of items) {
        if (location.pathname.startsWith(item.to)) return item.label
      }
    }
    return 'Dashboard'
  })()

  const unread = notifs.filter(n => !n.read).length

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden"
      style={{ background: '#edf4fb', fontFamily: "'DM Sans','Plus Jakarta Sans',sans-serif" }}>

      {/* ════════════════════════════════════════════════════
          SIDEBAR
      ════════════════════════════════════════════════════ */}
      <aside
        className={`flex flex-col flex-shrink-0 bg-white border-r border-slate-200/80
          transition-all duration-300 ease-in-out relative
          ${collapsed ? 'w-[68px]' : 'w-[218px]'}`}
        style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.04)' }}
      >
        {/* Logo row */}
        <div className={`flex items-center h-[60px] border-b border-slate-100 flex-shrink-0
          ${collapsed ? 'justify-center px-3' : 'px-4 gap-2'}`}>
          <Logo collapsed={collapsed} />
          {!collapsed && (
            <button onClick={() => setCollapsed(true)}
              className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700
                hover:bg-slate-100 transition-all flex-shrink-0">
              <ChevronLeft size={15} />
            </button>
          )}
        </div>

        {/* Expand toggle */}
        {collapsed && (
          <button onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-[72px] w-6 h-6 bg-white border border-slate-200
              rounded-full flex items-center justify-center z-10 shadow-sm
              hover:bg-slate-50 transition-colors">
            <ChevronRight size={11} className="text-slate-500" />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV.map(({ group, items }) => {
            const visible = items.filter(canSee)
            if (!visible.length) return null
            return (
              <div key={group} className="mb-3">
                {!collapsed && (
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.13em]
                    px-3 py-1.5 mb-0.5">
                    {group}
                  </p>
                )}
                {collapsed && (
                  <div className="my-1.5 mx-3 border-t border-slate-100 first:hidden" />
                )}
                {visible.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold
                      transition-all duration-150 cursor-pointer select-none mb-0.5
                      ${collapsed ? 'justify-center' : ''}
                      ${isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                    `}
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate leading-none">{label}</span>}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        {/* User profile */}
        <div className="flex-shrink-0 border-t border-slate-100 p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad}
                flex items-center justify-center text-xs font-black text-white`}>
                {initials}
              </div>
              <button onClick={handleLogout}
                title="Logout"
                className="w-full flex items-center justify-center p-1.5 rounded-lg
                  text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad}
                flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-sm`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-800 truncate leading-tight">{fullName}</p>
                <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{orgName || email}</p>
              </div>
              <button onClick={handleLogout}
                title="Logout"
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50
                  transition-all opacity-0 group-hover:opacity-100">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          MAIN
      ════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex-shrink-0 h-[60px] bg-white/80 backdrop-blur-sm
          border-b border-slate-200/60 flex items-center px-5 gap-4"
          style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>

          {/* Page title + live indicator */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-[15px] font-bold text-slate-800 truncate">{activeLabel}</span>
            {online > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1
                bg-emerald-50 border border-emerald-200 text-emerald-700
                text-[11px] font-bold rounded-full flex-shrink-0">
                <Radio size={9} className="animate-pulse" />
                {online} online
              </span>
            )}
          </div>

          {/* Right: role badge, bell, avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Role badge */}
            {elevated && (
              <span className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1
                rounded-full text-[10px] font-black uppercase tracking-wide
                ${isSuperAdmin
                  ? 'bg-violet-100 text-violet-700 border border-violet-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
                }`}>
                <Shield size={9} />
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </span>
            )}

            {/* Notification bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setShowNotifs(v => !v)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800
                  hover:bg-slate-100 transition-all">
                <Bell size={17} />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white
                    text-[8px] font-black rounded-full flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {showNotifs && (
                <NotifDropdown
                  notifs={notifs}
                  onClose={() => setShowNotifs(false)}
                  onClear={() => { setNotifs([]); setShowNotifs(false) }}
                />
              )}
            </div>

            {/* Avatar */}
            <div
              title={fullName}
              className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad}
                flex items-center justify-center text-xs font-black text-white
                shadow-sm cursor-default select-none`}>
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#edf4fb' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}