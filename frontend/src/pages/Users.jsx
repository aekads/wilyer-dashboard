// src/pages/Users.jsx
import { useState, useEffect } from 'react'
import { Users2, Plus, Mail, Shield, Trash2, Edit3, MoreVertical, Crown } from 'lucide-react'
import { usersAPI } from '../services/api'
import { Modal, ConfirmModal, Input, Select, EmptyState, PageLoader, Badge, Spinner, SearchInput } from '../components/ui'
import { formatDate, getRoleColor, timeAgo } from '../utils'
import toast from 'react-hot-toast'

const SYSTEM_ROLES = [
  { slug: 'admin',   label: 'Admin',   desc: 'Full organization access' },
  { slug: 'manager', label: 'Manager', desc: 'Manage screens, playlists, schedules' },
  { slug: 'editor',  label: 'Editor',  desc: 'Create and edit content' },
  { slug: 'viewer',  label: 'Viewer',  desc: 'Read-only access' },
]

export default function Users() {
  const [users, setUsers]         = useState([])
  const [roles, setRoles]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [inviteModal, setInviteModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', roleSlug: 'editor' })

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [uRes, rRes] = await Promise.all([
        usersAPI.getAll({ limit: 100 }),
        usersAPI.getRoles(),
      ])
      setUsers(uRes.data)
      setRoles(rRes.data ?? SYSTEM_ROLES)
    } finally { setLoading(false) }
  }

  const fetchUsers = async () => {
    const res = await usersAPI.getAll({ limit: 100, search })
    setUsers(res.data)
  }

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.firstName) { toast.error('Email and first name required'); return }
    setSaving(true)
    try {
      const res = await usersAPI.invite(inviteForm)
      setUsers(p => [res.data, ...p])
      setInviteModal(false)
      setInviteForm({ email: '', firstName: '', lastName: '', roleSlug: 'editor' })
      toast.success(`Invitation sent to ${inviteForm.email}`)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    await usersAPI.delete(deleteModal.id)
    setUsers(p => p.filter(u => u.id !== deleteModal.id))
    setDeleteModal(null)
    toast.success('User removed')
  }

  if (loading) return <PageLoader />

  const stats = [
    { label: 'Total Users', value: users.length, color: 'text-brand-400' },
    { label: 'Admins',      value: users.filter(u => u.roles?.some(r => r.slug === 'admin')).length, color: 'text-purple-400' },
    { label: 'Active',      value: users.filter(u => u.is_active).length, color: 'text-emerald-400' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Users & Roles</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage team members and their permissions</p>
        </div>
        <button onClick={() => setInviteModal(true)} className="btn-primary"><Plus size={16} />Invite User</button>
      </div>

      {/* Quick stats */}
      <div className="flex gap-4 flex-wrap">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl px-5 py-3 flex items-center gap-3">
            <span className={`font-display text-2xl font-bold ${color}`}>{value}</span>
            <span className="text-slate-500 text-sm">{label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <SearchInput value={search} onChange={setSearch} placeholder="Search users by name or email…" className="max-w-80" />

      {/* Role legend */}
      <div className="flex flex-wrap gap-2">
        {SYSTEM_ROLES.map(role => (
          <div key={role.slug} className="flex items-center gap-2 px-3 py-1.5 bg-surface-700/30 rounded-lg border border-white/[0.05]">
            <Badge variant={getRoleColor(role.slug).replace('badge-', '')}>{role.label}</Badge>
            <span className="text-xs text-slate-500">{role.desc}</span>
          </div>
        ))}
      </div>

      {/* Users table */}
      {users.length === 0 ? (
        <EmptyState icon={Users2} title="No users found" desc="Invite team members to collaborate on your signage network."
          action={<button className="btn-primary" onClick={() => setInviteModal(true)}><Plus size={16} />Invite User</button>} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-accent-purple flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm flex items-center gap-1.5">
                          {user.first_name} {user.last_name}
                          {user.roles?.some(r => r.slug === 'super_admin') && (
                            <Crown size={12} className="text-amber-400" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail size={10} />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map(role => (
                        <Badge key={role.slug} variant={getRoleColor(role.slug).replace('badge-','')}>{role.name}</Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge variant={user.is_active ? 'green' : 'gray'} dot>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td><span className="text-xs text-slate-500">{timeAgo(user.last_login_at)}</span></td>
                  <td><span className="text-xs text-slate-500">{formatDate(user.created_at)}</span></td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditModal(user)} className="btn-ghost p-1.5"><Edit3 size={14} /></button>
                      <button onClick={() => setDeleteModal(user)} className="btn-ghost p-1.5 text-red-400/60 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      <Modal isOpen={inviteModal} onClose={() => setInviteModal(false)} title="Invite Team Member"
        subtitle="They'll receive an email invitation to join your workspace"
        footer={<>
          <button className="btn-secondary" onClick={() => setInviteModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleInvite} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <><Mail size={14} />Send Invitation</>}
          </button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name *" placeholder="John" value={inviteForm.firstName}
              onChange={e => setInviteForm(p => ({ ...p, firstName: e.target.value }))} />
            <Input label="Last Name" placeholder="Doe" value={inviteForm.lastName}
              onChange={e => setInviteForm(p => ({ ...p, lastName: e.target.value }))} />
          </div>
          <Input label="Email Address *" type="email" placeholder="john@company.com" value={inviteForm.email}
            onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} />
          <Select label="Role" value={inviteForm.roleSlug}
            onChange={e => setInviteForm(p => ({ ...p, roleSlug: e.target.value }))}>
            {SYSTEM_ROLES.map(r => <option key={r.slug} value={r.slug}>{r.label} — {r.desc}</option>)}
          </Select>
          {/* Role capabilities preview */}
          <div className="bg-surface-700/50 rounded-xl p-4 border border-white/[0.05]">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-brand-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capabilities</span>
            </div>
            <div className="text-xs text-slate-400">
              {SYSTEM_ROLES.find(r => r.slug === inviteForm.roleSlug)?.desc}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} onConfirm={handleDelete}
        title="Remove User" confirmLabel="Remove"
        message={`Remove ${deleteModal?.first_name} ${deleteModal?.last_name} from your workspace? They will lose all access.`} />
    </div>
  )
}
