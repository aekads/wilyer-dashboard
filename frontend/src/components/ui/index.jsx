// src/components/ui/index.jsx
import { X, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { cx } from '../../utils'

/* ── Spinner ─────────────────────────────────────────────────── */
export const Spinner = ({ size = 'md', className = '' }) => {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return (
    <div className={cx('border-2 border-brand-500 border-t-transparent rounded-full animate-spin', s, className)} />
  )
}

/* ── Page Loader ─────────────────────────────────────────────── */
export const PageLoader = () => (
  <div className="flex items-center justify-center h-64 flex-col gap-4">
    <Spinner size="lg" />
    <p className="text-slate-500 text-sm">Loading…</p>
  </div>
)

/* ── Empty State ─────────────────────────────────────────────── */
export const EmptyState = ({ icon: Icon, title, desc, action }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-surface-700 flex items-center justify-center mb-4">
      <Icon size={28} className="text-slate-500" />
    </div>
    <h3 className="font-display font-semibold text-white text-lg mb-2">{title}</h3>
    <p className="text-slate-500 text-sm max-w-xs">{desc}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
)

/* ── Badge ───────────────────────────────────────────────────── */
export const Badge = ({ children, variant = 'gray', dot = false }) => (
  <span className={`badge-${variant}`}>
    {dot && <span className={cx('w-1.5 h-1.5 rounded-full', {
      green: 'bg-emerald-400', red: 'bg-red-400', yellow: 'bg-amber-400',
      blue: 'bg-brand-400', purple: 'bg-purple-400', gray: 'bg-slate-400',
    }[variant])} />}
    {children}
  </span>
)

/* ── Modal ───────────────────────────────────────────────────── */
export const Modal = ({ isOpen, onClose, title, subtitle, children, size = 'md', footer }) => {
  if (!isOpen) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={cx('modal-box w-full', sizes[size])} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-white/[0.06]">
          <div>
            <h3 className="font-display font-semibold text-white text-lg">{title}</h3>
            {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 ml-4 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="p-6 pt-0 flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  )
}

/* ── Confirm Modal ───────────────────────────────────────────── */
export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
    footer={<>
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose() }}>
        {confirmLabel}
      </button>
    </>}>
    <div className="flex gap-3">
      <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
    </div>
  </Modal>
)

/* ── Input ───────────────────────────────────────────────────── */
export const Input = ({ label, error, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="input-label">{label}</label>}
    <input {...props} className={cx('input', error && 'border-red-500/60 focus:ring-red-500/40', props.className)} />
    {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
  </div>
)

/* ── Textarea ────────────────────────────────────────────────── */
export const Textarea = ({ label, error, rows = 3, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="input-label">{label}</label>}
    <textarea rows={rows} {...props}
      className={cx('input resize-none', error && 'border-red-500/60')} />
    {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
  </div>
)

/* ── Select ──────────────────────────────────────────────────── */
export const Select = ({ label, error, className = '', children, ...props }) => (
  <div className={className}>
    {label && <label className="input-label">{label}</label>}
    <select {...props} className={cx('input cursor-pointer', error && 'border-red-500/60')}>
      {children}
    </select>
    {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
  </div>
)

/* ── Search Input ────────────────────────────────────────────── */
export const SearchInput = ({ value, onChange, placeholder = 'Search…', className = '' }) => (
  <div className={cx('relative', className)}>
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="input pl-9" />
  </div>
)

/* ── Stat Card ───────────────────────────────────────────────── */
export const StatCard = ({ title, value, sub, icon: Icon, iconBg = 'bg-brand-600/20', iconColor = 'text-brand-400', trend, className = '' }) => (
  <div className={cx('glass glass-hover rounded-2xl p-5 animate-slide-in-up', className)}>
    <div className="flex items-start justify-between mb-4">
      <div className={cx('w-11 h-11 rounded-xl flex items-center justify-center', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      {trend != null && (
        <span className={cx('text-xs font-semibold px-2 py-1 rounded-lg',
          trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="font-display text-3xl font-bold text-white mb-1">{value}</div>
    <div className="text-sm font-medium text-slate-400">{title}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </div>
)

/* ── Pagination ──────────────────────────────────────────────── */
export const Pagination = ({ page, total, limit, onChange }) => {
  const pages = Math.ceil(total / limit)
  if (pages <= 1) return null
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-xs text-slate-500">{(page-1)*limit+1}–{Math.min(page*limit,total)} of {total}</span>
      <button onClick={() => onChange(page-1)} disabled={page===1} className="btn-ghost px-2 py-1 disabled:opacity-30">
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: Math.min(5, pages) }, (_, i) => {
        const p = Math.max(1, Math.min(page - 2, pages - 4)) + i
        return (
          <button key={p} onClick={() => onChange(p)}
            className={cx('w-8 h-8 rounded-lg text-sm font-medium transition-colors',
              p === page ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-surface-600')}>
            {p}
          </button>
        )
      })}
      <button onClick={() => onChange(page+1)} disabled={page===pages} className="btn-ghost px-2 py-1 disabled:opacity-30">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

/* ── Skeleton ─────────────────────────────────────────────────── */
export const Skeleton = ({ className = '' }) => <div className={cx('skeleton', className)} />

/* ── Progress Bar ────────────────────────────────────────────── */
export const ProgressBar = ({ value, max = 100, color = 'bg-brand-500', className = '' }) => {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className={cx('w-full bg-surface-600 rounded-full h-1.5 overflow-hidden', className)}>
      <div className={cx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ── Toggle Switch ────────────────────────────────────────────── */
export const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className={cx('w-10 h-6 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-surface-600')} />
      <div className={cx('absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform', checked && 'translate-x-4')} />
    </div>
    {label && <span className="text-sm text-slate-300">{label}</span>}
  </label>
)

/* ── Tabs ────────────────────────────────────────────────────── */
export const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex gap-1 p-1 bg-surface-700/50 rounded-xl w-fit">
    {tabs.map(tab => (
      <button key={tab.id} onClick={() => onChange(tab.id)}
        className={cx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
          active === tab.id ? 'bg-brand-600 text-white shadow-glow-sm' : 'text-slate-400 hover:text-white')}>
        {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
        {tab.label}
      </button>
    ))}
  </div>
)

/* ── Tooltip ─────────────────────────────────────────────────── */
export const Tooltip = ({ children, text }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-surface-600 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/[0.08] z-50">
      {text}
    </div>
  </div>
)
