// src/pages/Schedules.jsx
import { useState, useEffect } from 'react'
import { Calendar, Plus, Clock, Repeat, Trash2, Edit3, ToggleLeft, ToggleRight, Monitor } from 'lucide-react'
import { schedulesAPI, playlistsAPI, screensAPI } from '../services/api'
import { Modal, ConfirmModal, Input, Select, EmptyState, PageLoader, Badge, Spinner, SearchInput } from '../components/ui'
import { formatDate, getStatusColor } from '../utils'
import toast from 'react-hot-toast'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const RECURRENCE = ['none','daily','weekly','monthly']

export default function Schedules() {
  const [schedules, setSchedules]   = useState([])
  const [playlists, setPlaylists]   = useState([])
  const [screens, setScreens]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [formModal, setFormModal]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving]         = useState(false)

  const emptyForm = { name: '', playlistId: '', screenIds: [], startDate: '', endDate: '', startTime: '', endTime: '', recurrenceType: 'none', recurrenceDays: [], priority: 0 }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, pRes, scrRes] = await Promise.all([
        schedulesAPI.getAll({ limit: 100 }),
        playlistsAPI.getAll({ status: 'published', limit: 100 }),
        screensAPI.getAll({ limit: 100 }),
      ])
      setSchedules(sRes.data)
      setPlaylists(pRes.data)
      setScreens(scrRes.data)
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setFormModal(true) }
  const openEdit = (s) => {
    setEditTarget(s)
    setForm({
      name: s.name, playlistId: s.playlist_id,
      screenIds: s.screen_ids ?? [], startDate: s.start_date?.slice(0,10) ?? '',
      endDate: s.end_date?.slice(0,10) ?? '', startTime: s.start_time ?? '',
      endTime: s.end_time ?? '', recurrenceType: s.recurrence_type ?? 'none',
      recurrenceDays: s.recurrence_days ?? [], priority: s.priority ?? 0,
    })
    setFormModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.playlistId || !form.startDate) {
      toast.error('Name, playlist, and start date are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name, playlistId: form.playlistId,
        screenIds: form.screenIds, startDate: form.startDate,
        endDate: form.endDate || null, startTime: form.startTime || null,
        endTime: form.endTime || null, recurrenceType: form.recurrenceType,
        recurrenceDays: form.recurrenceDays, priority: parseInt(form.priority) || 0,
      }
      if (editTarget) {
        const res = await schedulesAPI.update(editTarget.id, payload)
        setSchedules(p => p.map(s => s.id === editTarget.id ? res.data : s))
        toast.success('Schedule updated')
      } else {
        const res = await schedulesAPI.create(payload)
        setSchedules(p => [res.data, ...p])
        toast.success('Schedule created')
      }
      setFormModal(false)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    await schedulesAPI.delete(deleteTarget.id)
    setSchedules(p => p.filter(s => s.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('Schedule deleted')
  }

  const toggleStatus = async (schedule) => {
    const newStatus = schedule.status === 'active' ? 'paused' : 'active'
    await schedulesAPI.update(schedule.id, { status: newStatus })
    setSchedules(p => p.map(s => s.id === schedule.id ? { ...s, status: newStatus } : s))
    toast.success(`Schedule ${newStatus}`)
  }

  const toggleDay = (day) => {
    setForm(p => ({
      ...p,
      recurrenceDays: p.recurrenceDays.includes(day)
        ? p.recurrenceDays.filter(d => d !== day)
        : [...p.recurrenceDays, day]
    }))
  }

  if (loading) return <PageLoader />

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Schedules</h1>
          <p className="text-slate-500 text-sm mt-0.5">Auto-assign playlists by date, time, and recurrence</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} />New Schedule</button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState icon={Calendar} title="No schedules yet"
          desc="Create schedules to automatically control which playlist plays on your screens at specific times."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} />Create Schedule</button>} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Playlist</th>
                <th>Date Range</th>
                <th>Time</th>
                <th>Recurrence</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="font-medium text-white text-sm">{s.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.screen_ids?.length ?? 0} screens</div>
                  </td>
                  <td>
                    <span className="badge-blue text-xs">{s.playlist_name ?? 'Unknown'}</span>
                  </td>
                  <td>
                    <div className="text-xs text-slate-300">{formatDate(s.start_date)}</div>
                    {s.end_date && <div className="text-xs text-slate-500">→ {formatDate(s.end_date)}</div>}
                  </td>
                  <td>
                    {s.start_time
                      ? <span className="text-xs text-slate-300 font-mono">{s.start_time} – {s.end_time ?? 'end'}</span>
                      : <span className="text-slate-600 text-xs">All day</span>}
                  </td>
                  <td>
                    {s.recurrence_type && s.recurrence_type !== 'none'
                      ? <div className="flex items-center gap-1.5"><Repeat size={11} className="text-purple-400" /><span className="text-xs text-purple-400 capitalize">{s.recurrence_type}</span></div>
                      : <span className="text-xs text-slate-600">One-time</span>}
                  </td>
                  <td><span className="font-mono text-xs text-slate-400">{s.priority ?? 0}</span></td>
                  <td>
                    <Badge variant={s.status === 'active' ? 'green' : s.status === 'paused' ? 'yellow' : 'gray'} dot>
                      {s.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => toggleStatus(s)} className="btn-ghost p-1.5" title={s.status === 'active' ? 'Pause' : 'Activate'}>
                        {s.status === 'active' ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} className="text-slate-500" />}
                      </button>
                      <button onClick={() => openEdit(s)} className="btn-ghost p-1.5"><Edit3 size={14} /></button>
                      <button onClick={() => setDeleteTarget(s)} className="btn-ghost p-1.5 text-red-400/60 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={formModal} onClose={() => setFormModal(false)} size="lg"
        title={editTarget ? 'Edit Schedule' : 'New Schedule'}
        footer={<>
          <button className="btn-secondary" onClick={() => setFormModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : editTarget ? 'Save Changes' : 'Create Schedule'}
          </button>
        </>}>
        <div className="space-y-5">
          <Input label="Schedule Name *" placeholder="Weekend Promo Loop" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />

          <Select label="Playlist *" value={form.playlistId}
            onChange={e => setForm(p => ({ ...p, playlistId: e.target.value }))}>
            <option value="">Select a published playlist</option>
            {playlists.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date *" type="date" value={form.startDate}
              onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            <Input label="End Date" type="date" value={form.endDate}
              onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Time" type="time" value={form.startTime}
              onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
            <Input label="End Time" type="time" value={form.endTime}
              onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Recurrence" value={form.recurrenceType}
              onChange={e => setForm(p => ({ ...p, recurrenceType: e.target.value }))}>
              {RECURRENCE.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </Select>
            <Input label="Priority (higher wins)" type="number" min={0} max={100} value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} />
          </div>

          {form.recurrenceType === 'weekly' && (
            <div>
              <label className="input-label">Days of Week</label>
              <div className="flex gap-2">
                {DAYS.map((day, i) => (
                  <button key={day} type="button" onClick={() => toggleDay(i)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      form.recurrenceDays.includes(i)
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-700 text-slate-400 hover:text-white border border-white/[0.06]'
                    }`}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="input-label">Target Screens ({form.screenIds.length} selected)</label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 bg-surface-700/30 rounded-xl p-3 border border-white/[0.05]">
              {screens.map(screen => (
                <label key={screen.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={form.screenIds.includes(screen.id)}
                    onChange={e => setForm(p => ({
                      ...p,
                      screenIds: e.target.checked
                        ? [...p.screenIds, screen.id]
                        : p.screenIds.filter(id => id !== screen.id)
                    }))}
                    className="rounded border-white/20 bg-surface-700 text-brand-500 focus:ring-brand-500/50" />
                  <Monitor size={12} className="text-slate-500" />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{screen.device_name}</span>
                  <span className="text-xs text-slate-600 ml-auto">{screen.location}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Schedule" confirmLabel="Delete"
        message={`Delete schedule "${deleteTarget?.name}"? Screens will revert to default assignment.`} />
    </div>
  )
}
