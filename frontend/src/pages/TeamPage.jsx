// src/pages/TeamPage.jsx
// ============================================================
// AEKADS Team Management Page — Fully Responsive
// Matches wilyersignage.com/team reference design exactly:
//   Tabs: Members | New Member | Logs
//   Left panel:  Member form (name, email, role, password)
//   Right panel: Permission matrix (module × create/view/update/delete)
//                + Access Control Settings
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  Users2, Plus, Trash2, Edit3, Eye, EyeOff, Shield,
  CheckCircle2, XCircle, Search, RefreshCw, Clock,
  ChevronDown, LogIn, Crown, MoreVertical, UserCheck,
  FileCheck, Lock, AlertCircle, Info
} from 'lucide-react'
import { teamAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import {
  Modal, ConfirmModal, Spinner, PageLoader, SearchInput,
  Badge, EmptyState, Pagination
} from '../components/ui'
import { formatDate, timeAgo, getRoleColor } from '../utils'
import toast from 'react-hot-toast'

// ── Permission modules shown in matrix (matches reference) ────
const MODULES = [
  { key: 'screens',   label: 'Screen'    },
  { key: 'playlists', label: 'Playlist'  },
  { key: 'media',     label: 'Library'   },
  { key: 'analytics', label: 'Reports'   },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'groups',    label: 'Groups'    },
  { key: 'clusters',  label: 'Clusters'  },
  { key: 'team',      label: 'Team'      },
]
const ACTIONS = ['create', 'read', 'update', 'delete']
const ACTION_LABELS = { create: 'CREATE', read: 'VIEW', update: 'UPDATE', delete: 'DELETE' }

const ROLES = [
  { slug: 'manager', label: 'Manager' },
  { slug: 'editor',  label: 'Editor'  },
  { slug: 'viewer',  label: 'Viewer'  },
  { slug: 'others',  label: 'Others'  },
]

// ── Role preset permissions (mirrors backend defaults) ────────
const ROLE_PRESETS = {
  admin: {
    screens:   { create:true, read:true, update:true, delete:true },
    playlists: { create:true, read:true, update:true, delete:true },
    media:     { create:true, read:true, update:true, delete:true },
    analytics: { create:true, read:true, update:true, delete:true },
    dashboard: { create:true, read:true, update:true, delete:true },
    groups:    { create:true, read:true, update:true, delete:true },
    clusters:  { create:true, read:true, update:true, delete:true },
    team:      { create:true, read:true, update:true, delete:true },
  },
  manager: {
    screens:   { create:true,  read:true,  update:true,  delete:true  },
    playlists: { create:true,  read:true,  update:true,  delete:true  },
    media:     { create:true,  read:true,  update:true,  delete:true  },
    analytics: { create:true,  read:true,  update:true,  delete:true  },
    dashboard: { create:false, read:true,  update:false, delete:false },
    groups:    { create:true,  read:true,  update:true,  delete:true  },
    clusters:  { create:true,  read:true,  update:true,  delete:true  },
    team:      { create:true,  read:true,  update:true,  delete:true  },
  },
  editor: {
    screens:   { create:true,  read:true,  update:true,  delete:false },
    playlists: { create:true,  read:true,  update:true,  delete:false },
    media:     { create:true,  read:true,  update:true,  delete:false },
    analytics: { create:false, read:true,  update:false, delete:false },
    dashboard: { create:false, read:true,  update:false, delete:false },
    groups:    { create:true,  read:true,  update:true,  delete:false },
    clusters:  { create:false, read:true,  update:false, delete:false },
    team:      { create:false, read:true,  update:false, delete:false },
  },
  viewer: {
    screens:   { create:false, read:true,  update:false, delete:false },
    playlists: { create:false, read:true,  update:false, delete:false },
    media:     { create:false, read:true,  update:false, delete:false },
    analytics: { create:false, read:true,  update:false, delete:false },
    dashboard: { create:false, read:true,  update:false, delete:false },
    groups:    { create:false, read:true,  update:false, delete:false },
    clusters:  { create:false, read:true,  update:false, delete:false },
    team:      { create:false, read:true,  update:false, delete:false },
  },
  others: {
    screens:   { create:false, read:false, update:false, delete:false },
    playlists: { create:false, read:false, update:false, delete:false },
    media:     { create:false, read:false, update:false, delete:false },
    analytics: { create:false, read:false, update:false, delete:false },
    dashboard: { create:false, read:false, update:false, delete:false },
    groups:    { create:false, read:false, update:false, delete:false },
    clusters:  { create:false, read:false, update:false, delete:false },
    team:      { create:false, read:false, update:false, delete:false },
  },
}

// Build initial permissions matrix
const buildMatrix = (roleSlug = 'manager') => {
  const preset = ROLE_PRESETS[roleSlug] ?? ROLE_PRESETS.viewer
  return MODULES.reduce((acc, mod) => {
    acc[mod.key] = { ...(preset[mod.key] ?? { create:false, read:false, update:false, delete:false }) }
    return acc
  }, {})
}

// Convert matrix → flat slug array
const matrixToSlugs = (matrix) => {
  const slugs = []
  for (const [mod, actions] of Object.entries(matrix)) {
    for (const [action, enabled] of Object.entries(actions)) {
      if (enabled) slugs.push(`${mod}:${action}`)
    }
  }
  return slugs
}

// Convert slug array → matrix
const slugsToMatrix = (slugs) => {
  const matrix = buildMatrix('others')
  for (const slug of slugs) {
    const [mod, action] = slug.split(':')
    if (matrix[mod]) matrix[mod][action] = true
  }
  return matrix
}

// ─────────────────────────────────────────────────────────────
// Blue Checkbox Component (matches reference design)
// ─────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange, disabled = false }) {
  return (
    <label className={`inline-flex items-center ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
      <div
        onClick={disabled ? undefined : onChange}
        className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all duration-150 ${
          checked
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white border-gray-300 hover:border-blue-400'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {checked && (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
            <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────
// Permission Matrix Component — Mobile Responsive
// ─────────────────────────────────────────────────────────────
function PermissionMatrix({ matrix, onChange, readOnly = false }) {
  const toggleCell = (modKey, action) => {
    if (readOnly) return
    onChange(prev => ({
      ...prev,
      [modKey]: { ...prev[modKey], [action]: !prev[modKey][action] }
    }))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Shield size={16} className="text-blue-600" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-800">Member Permission</h3>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36 sm:w-48">
                Permissions
              </th>
              {ACTIONS.map(action => (
                <th key={action} className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {ACTION_LABELS[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod, idx) => {
              const row = matrix[mod.key] ?? {}
              return (
                <tr key={mod.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 sm:px-6 py-3 sm:py-3.5">
                    <span className="text-sm font-medium text-gray-700">{mod.label}</span>
                  </td>
                  {ACTIONS.map(action => (
                    <td key={action} className="px-3 sm:px-6 py-3 sm:py-3.5">
                      <Checkbox
                        checked={!!row[action]}
                        onChange={() => toggleCell(mod.key, action)}
                        disabled={readOnly}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="sm:hidden divide-y divide-gray-100">
        {MODULES.map((mod) => {
          const row = matrix[mod.key] ?? {}
          return (
            <div key={mod.key} className="px-4 py-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">{mod.label}</div>
              <div className="grid grid-cols-4 gap-2">
                {ACTIONS.map(action => (
                  <div key={action} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">
                      {action === 'read' ? 'View' : action.slice(0,3).toUpperCase()}
                    </span>
                    <Checkbox
                      checked={!!row[action]}
                      onChange={() => toggleCell(mod.key, action)}
                      disabled={readOnly}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Access Control Settings Component — Responsive
// ─────────────────────────────────────────────────────────────
function AccessControlSettings({ value, onChange, readOnly = false }) {
  const controls = [
    {
      key:   'fileApprovalRequired',
      label: 'File Approval Required',
      desc:  "This user's uploads need approval",
    },
    {
      key:   'fileApprovalPermission',
      label: 'File Approval Permission',
      desc:  'This user can approve files',
    },
    {
      key:   'restrictedAccess',
      label: 'Restricted Access',
      desc:  'Limit user to specific content',
    },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 mt-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4 sm:mb-5">
        <Lock size={16} className="text-blue-600" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-800">Access Control Settings</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {controls.map(ctrl => (
          <label key={ctrl.key} className={`flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-blue-50/40 transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
            <div className="mt-0.5 flex-shrink-0">
              <Checkbox
                checked={!!value[ctrl.key]}
                onChange={() => !readOnly && onChange(p => ({ ...p, [ctrl.key]: !p[ctrl.key] }))}
                disabled={readOnly}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-700">{ctrl.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{ctrl.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Role Dropdown
// ─────────────────────────────────────────────────────────────
function RoleDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const current = ROLES.find(r => r.slug === value) ?? ROLES[0]

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30">
        <span>{current.label}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden animate-slide-in-up">
          {ROLES.map(role => (
            <button key={role.slug} type="button"
              onClick={() => { onChange(role.slug); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === role.slug
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}>
              {role.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Members Tab — Fully Responsive
// ─────────────────────────────────────────────────────────────
function MembersTab({ onEditMember }) {
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const LIMIT = 20

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await teamAPI.getMembers({ search, page, limit: LIMIT })
      setMembers(res.data)
      setTotal(res.meta?.total ?? res.data.length)
    } finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { fetch() }, [fetch])

  const handleDelete = async () => {
    await teamAPI.removeMember(deleteTarget.id)
    setMembers(p => p.filter(m => m.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('Member removed')
  }

  return (
    <div>
      {/* Search */}
      <div className="flex items-center gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search members…" className="flex-1 max-w-72" />
        <button onClick={fetch} className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors flex-shrink-0">
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-20 text-center shadow-sm">
          <Users2 size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No members found</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map(member => (
                    <tr key={member.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800 text-sm">
                              {member.first_name} {member.last_name}
                            </div>
                            <div className="text-xs text-gray-400">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {member.roles?.map(role => (
                            <span key={role.slug} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                              role.slug === 'admin'   ? 'bg-purple-100 text-purple-700' :
                              role.slug === 'manager' ? 'bg-blue-100 text-blue-700' :
                              role.slug === 'editor'  ? 'bg-amber-100 text-amber-700' :
                              role.slug === 'viewer'  ? 'bg-gray-100 text-gray-600' :
                              'bg-teal-100 text-teal-700'
                            }`}>
                              {role.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${member.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-gray-400">{timeAgo(member.last_login_at)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-gray-400">{formatDate(member.created_at)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onEditMember(member)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(member)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > LIMIT && (
              <div className="px-5 py-3 border-t border-gray-100">
                <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
              </div>
            )}
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {members.map(member => (
              <div key={member.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 text-sm truncate">
                        {member.first_name} {member.last_name}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onEditMember(member)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => setDeleteTarget(member)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {member.roles?.map(role => (
                    <span key={role.slug} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                      role.slug === 'admin'   ? 'bg-purple-100 text-purple-700' :
                      role.slug === 'manager' ? 'bg-blue-100 text-blue-700' :
                      role.slug === 'editor'  ? 'bg-amber-100 text-amber-700' :
                      role.slug === 'viewer'  ? 'bg-gray-100 text-gray-600' :
                      'bg-teal-100 text-teal-700'
                    }`}>
                      {role.name}
                    </span>
                  ))}
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${member.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {timeAgo(member.last_login_at)}
                  </span>
                  <span>·</span>
                  <span>Joined {formatDate(member.created_at)}</span>
                </div>
              </div>
            ))}

            {total > LIMIT && (
              <div className="pt-2">
                <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Member"
        confirmLabel="Remove"
        message={`Remove ${deleteTarget?.first_name} ${deleteTarget?.last_name} from your workspace? They will lose all access immediately.`}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// New Member Form Tab (also used for Edit) — Responsive
// ─────────────────────────────────────────────────────────────
function NewMemberTab({ editTarget = null, onSuccess }) {
  const isEdit = !!editTarget

  const [form, setForm] = useState({
    firstName: editTarget?.first_name ?? '',
    lastName:  editTarget?.last_name  ?? '',
    email:     editTarget?.email      ?? '',
    password:  '',
    roleSlug:  editTarget?.roles?.[0]?.slug ?? 'manager',
  })
  const [showPass, setShowPass]     = useState(false)
  const [saving,   setSaving]       = useState(false)
  const [errors,   setErrors]       = useState({})

  // Permission matrix
  const [matrix, setMatrix] = useState(() => {
    if (editTarget?.permissionMatrix) {
      return editTarget.permissionMatrix.reduce((acc, row) => {
        acc[row.module] = { ...row.permissions }
        return acc
      }, {})
    }
    return buildMatrix(form.roleSlug)
  })

  // Access control flags
  const [accessControl, setAccessControl] = useState(
    editTarget?.accessControl ?? {
      fileApprovalRequired:  false,
      fileApprovalPermission: false,
      restrictedAccess:       false,
    }
  )

  const handleRoleChange = (roleSlug) => {
    setForm(p => ({ ...p, roleSlug }))
    setMatrix(buildMatrix(roleSlug))
  }

  const validate = () => {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'Member name is required'
    if (!form.email.trim())     e.email     = 'Email is required'
    if (!isEdit && !form.password) e.password = 'Password is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        permissions: matrixToSlugs(matrix),
        accessControl,
      }
      if (isEdit) {
        if (!payload.password) delete payload.password
        await teamAPI.updateMember(editTarget.id, payload)
        await teamAPI.updateMemberPermissions(editTarget.id, { permissions: payload.permissions })
        toast.success('Member updated!')
      } else {
        await teamAPI.addMember(payload)
        toast.success('Member added successfully!')
        setForm({ firstName: '', lastName: '', email: '', password: '', roleSlug: 'manager' })
        setMatrix(buildMatrix('manager'))
        setAccessControl({ fileApprovalRequired: false, fileApprovalPermission: false, restrictedAccess: false })
      }
      onSuccess?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Responsive: stack on mobile/tablet, side-by-side on large screens */}
      <div className="flex flex-col lg:grid lg:grid-cols-[380px_1fr] gap-5 lg:gap-6 items-start">

        {/* ── Left: Member Form ─────────────────────────────── */}
        <div className="w-full bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-sm">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
            <UserCheck size={16} className="text-blue-600" />
            <h3 className="text-base font-semibold text-gray-800">
              {isEdit ? 'Edit Member' : 'Member Details'}
            </h3>
          </div>

          {/* Name row — side by side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${errors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-blue-500'}`}
                placeholder="First name"
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Member Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              disabled={isEdit}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-blue-500'} ${isEdit ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
              placeholder="email@company.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Role</label>
            <RoleDropdown value={form.roleSlug} onChange={handleRoleChange} />
            <p className="text-xs text-gray-400 mt-1.5">Selecting a role loads the default permission preset</p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Login Password {!isEdit && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className={`w-full px-4 py-2.5 pr-11 border rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-blue-500'}`}
                placeholder={isEdit ? 'Leave blank to keep current' : 'Min 6 characters'}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPass ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Submit Button */}
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
            {saving
              ? <><Spinner size="sm" />{isEdit ? 'Saving…' : 'Adding…'}</>
              : isEdit ? 'Save Changes' : 'Add Member'
            }
          </button>
        </div>

        {/* ── Right: Permission Matrix + Access Control ─────── */}
        <div className="w-full">
          <PermissionMatrix matrix={matrix} onChange={setMatrix} />
          <AccessControlSettings value={accessControl} onChange={setAccessControl} />
        </div>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// Logs Tab — Responsive
// ─────────────────────────────────────────────────────────────
const LOG_ACTION_LABELS = {
  'member.added':        { label: 'Member added',        color: 'text-emerald-600 bg-emerald-50',  icon: UserCheck },
  'member.removed':      { label: 'Member removed',      color: 'text-red-600 bg-red-50',           icon: Trash2 },
  'member.updated':      { label: 'Member updated',      color: 'text-blue-600 bg-blue-50',         icon: Edit3 },
  'role.changed':        { label: 'Role changed',        color: 'text-purple-600 bg-purple-50',     icon: Shield },
  'permissions.updated': { label: 'Permissions updated', color: 'text-amber-600 bg-amber-50',       icon: Lock },
}

function LogsTab() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const LIMIT = 30

  useEffect(() => { fetchLogs() }, [page])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await teamAPI.getActivityLogs({ page, limit: LIMIT })
      setLogs(res.data)
      setTotal(res.meta?.total ?? res.data.length)
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center">
            <Clock size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No activity logged yet</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Performed By</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Affected Member</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => {
                    const meta = LOG_ACTION_LABELS[log.action] ?? { label: log.action, color: 'text-gray-600 bg-gray-100', icon: Clock }
                    const Icon = meta.icon
                    return (
                      <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.color}`}>
                            <Icon size={12} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {log.actor_first ? (
                            <div>
                              <div className="text-sm font-medium text-gray-700">{log.actor_first} {log.actor_last}</div>
                              <div className="text-xs text-gray-400">{log.actor_email}</div>
                            </div>
                          ) : <span className="text-gray-400 text-xs">System</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {log.target_first ? (
                            <div>
                              <div className="text-sm text-gray-700">{log.target_first} {log.target_last}</div>
                              <div className="text-xs text-gray-400">{log.target_email}</div>
                            </div>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <div className="text-xs text-gray-400 font-mono max-w-48 truncate">
                              {log.details.roleSlug && `Role: ${log.details.roleSlug}`}
                              {log.details.newRole  && `→ ${log.details.newRole}`}
                              {log.details.permissionsGranted != null && `${log.details.permissionsGranted} permissions`}
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-gray-400">{timeAgo(log.created_at)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout for Logs */}
            <div className="md:hidden divide-y divide-gray-100">
              {logs.map(log => {
                const meta = LOG_ACTION_LABELS[log.action] ?? { label: log.action, color: 'text-gray-600 bg-gray-100', icon: Clock }
                const Icon = meta.icon
                return (
                  <div key={log.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.color}`}>
                        <Icon size={12} />
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-400">{timeAgo(log.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">By</span>
                        {log.actor_first ? (
                          <div className="font-medium text-gray-700 mt-0.5">{log.actor_first} {log.actor_last}</div>
                        ) : <div className="text-gray-400 mt-0.5">System</div>}
                      </div>
                      {log.target_first && (
                        <div>
                          <span className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Affected</span>
                          <div className="font-medium text-gray-700 mt-0.5">{log.target_first} {log.target_last}</div>
                        </div>
                      )}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-xs text-gray-400 font-mono truncate">
                        {log.details.roleSlug && `Role: ${log.details.roleSlug}`}
                        {log.details.newRole  && ` → ${log.details.newRole}`}
                        {log.details.permissionsGranted != null && `${log.details.permissionsGranted} permissions`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {total > LIMIT && (
              <div className="px-4 sm:px-5 py-3 border-t border-gray-100">
                <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE — Fully Responsive
// ─────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [activeTab, setActiveTab]   = useState('members')
  const [editTarget, setEditTarget] = useState(null)
  const [loadingMember, setLoadingMember] = useState(false)

  const handleEditMember = async (member) => {
    setLoadingMember(true)
    try {
      const res = await teamAPI.getMember(member.id)
      setEditTarget(res.data)
      setActiveTab('new')
    } finally { setLoadingMember(false) }
  }

  const handleNewMemberSuccess = () => {
    if (editTarget) {
      setEditTarget(null)
      setActiveTab('members')
    }
  }

  const tabs = [
    { id: 'members', label: 'Members' },
    { id: 'new',     label: editTarget ? 'Edit Member' : 'New Member' },
    { id: 'logs',    label: 'Logs' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">

          {/* Tabs — scrollable on mobile */}
          <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 gap-0.5 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button key={tab.id}
                onClick={() => {
                  if (tab.id !== 'new') setEditTarget(null)
                  setActiveTab(tab.id)
                }}
                className={`px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Read Docs */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-gray-300 transition-colors self-start sm:self-auto flex-shrink-0">
            <Info size={15} />
            <span>Read Docs</span>
          </button>
        </div>

        {/* Tab Content */}
        {loadingMember ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <>
            {activeTab === 'members' && (
              <MembersTab onEditMember={handleEditMember} />
            )}
            {activeTab === 'new' && (
              <NewMemberTab
                key={editTarget?.id ?? 'new'}
                editTarget={editTarget}
                onSuccess={handleNewMemberSuccess}
              />
            )}
            {activeTab === 'logs' && (
              <LogsTab />
            )}
          </>
        )}
      </div>
    </div>
  )
}