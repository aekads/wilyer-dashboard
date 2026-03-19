// src/pages/PlaylistPublish.jsx
// ============================================================
// AEKADS Playlist Publish
// Key fixes:
//   • On open: pre-loads screens already assigned to this playlist → pre-checked
//   • Selected screens ALWAYS appear first in the left table
//   • Right panel always shows all selected screens (not just current page)
//   • Edit mode: checkbox is pre-ticked + "Currently Live" badge
//   • All other logic unchanged
// ============================================================
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  BookOpen, Info, ArrowLeft, Calendar, Upload,
  Search, ChevronDown, ChevronRight, Trash2, Monitor,
  Check, X, Loader2, Tag, Users, Clock3, Radio, Wifi, WifiOff
} from 'lucide-react'
import { playlistsAPI, screensAPI } from '../services/api'
import api from '../services/api'
import toast from 'react-hot-toast'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getStatus = (s) => s.real_status || s.status || 'offline'

function StatusBadge({ status }) {
  const map = {
    online:  { dot: 'bg-emerald-500', label: 'Online',  text: 'text-emerald-700', bg: 'bg-emerald-50'  },
    idle:    { dot: 'bg-amber-400',   label: 'Idle',    text: 'text-amber-700',   bg: 'bg-amber-50'    },
    offline: { dot: 'bg-slate-300',   label: 'Offline', text: 'text-slate-500',   bg: 'bg-slate-100'   },
  }
  const s = map[status] || map.offline
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function CB({ checked, indeterminate, onChange }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input
      ref={ref} type="checkbox" checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer"
      onClick={e => e.stopPropagation()}
    />
  )
}

function TagChip({ tag, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-full">
      {tag}
      {onRemove && <button onClick={onRemove} className="hover:text-blue-900 transition-colors"><X size={9} /></button>}
    </span>
  )
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({ playlistName, onClose, onConfirm, publishing }) {
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [endTime,   setEndTime]   = useState('')
  const valid = startDate && startTime

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Calendar size={17} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Schedule Publish</h2>
              <p className="text-xs text-gray-400 mt-0.5">Set when this playlist goes live</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-semibold truncate">
            📋 {playlistName}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">Start Time *</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 mb-1.5 block">Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1.5 block">Time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-colors" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5">
              End Time <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 mb-1.5 block">Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  min={startDate || new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 mb-1.5 block">Time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ startDate, startTime, endDate: endDate || null, endTime: endTime || null })}
            disabled={!valid || publishing}
            className="flex-[2] py-2.5 text-sm font-bold text-gray-900 bg-amber-400 rounded-xl hover:bg-amber-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
            Schedule Publish
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PlaylistPublish() {
  const { id: playlistId } = useParams()
  const navigate = useNavigate()

  // Playlist meta
  const [playlist, setPlaylist]               = useState(null)
  const [loadingPlaylist, setLoadingPlaylist]  = useState(true)

  // Pre-assigned screen IDs (already live with this playlist)
  const [preAssignedIds, setPreAssignedIds]    = useState(new Set())
  const [loadingPreAssigned, setLoadingPreAssigned] = useState(true)

  // Screens list
  const [screens, setScreens]                 = useState([])
  const [loadingScreens, setLoadingScreens]   = useState(true)
  const [totalScreens, setTotalScreens]       = useState(0)
  const [totalPages, setTotalPages]           = useState(1)
  const [page, setPage]                       = useState(1)
  const PAGE_SIZE = 20

  // Filters
  const [activeTab, setActiveTab]             = useState('screens')
  const [searchQuery, setSearchQuery]         = useState('')
  const [statusFilter, setStatusFilter]       = useState('all')
  const [selectedTags, setSelectedTags]       = useState([])
  const [mustAllTags, setMustAllTags]         = useState(false)
  const [availableTags, setAvailableTags]     = useState([])
  const [tagDropOpen, setTagDropOpen]         = useState(false)

  // Selection — Set of screen IDs
  const [selected, setSelected]               = useState(new Set())
  // Full screen objects cache (across pages)
  const [selectedCache, setSelectedCache]     = useState({})

  // Groups
  const [groups, setGroups]                   = useState([])
  const [selectedGroups, setSelectedGroups]   = useState(new Set())

  // Publish
  const [publishing, setPublishing]           = useState(false)
  const [showSchedule, setShowSchedule]       = useState(false)

  // ── 1. Load playlist meta ─────────────────────────────────────────────────
  useEffect(() => {
    if (!playlistId) return
    playlistsAPI.getOne(playlistId)
      .then(r => setPlaylist(r.data))
      .catch(() => toast.error('Playlist not found'))
      .finally(() => setLoadingPlaylist(false))
  }, [playlistId])

  // ── 2. Pre-load already-assigned screens ──────────────────────────────────
  // These get pre-checked when the page opens (edit mode)
  useEffect(() => {
    if (!playlistId) return
    const load = async () => {
      setLoadingPreAssigned(true)
      try {
        // Fetch ALL screens that have this playlist assigned
        const res = await screensAPI.getAll({
          assigned_playlist_id: playlistId,
          limit: 200
        })
        const data = res.data || []
        const ids  = new Set(data.map(s => s.id))
        setPreAssignedIds(ids)
        // Pre-select them
        setSelected(new Set(ids))
        // Cache them so right panel shows them immediately
        setSelectedCache(prev => {
          const next = { ...prev }
          data.forEach(s => { next[s.id] = s })
          return next
        })
      } catch {
        // If the filter param isn't supported, ignore — selection starts empty
        setPreAssignedIds(new Set())
      } finally {
        setLoadingPreAssigned(false)
      }
    }
    load()
  }, [playlistId])

  // ── 3. Load paginated screens ─────────────────────────────────────────────
  const fetchScreens = useCallback(async () => {
    setLoadingScreens(true)
    try {
      const params = { page, limit: PAGE_SIZE }
      if (searchQuery)             params.search  = searchQuery
      if (statusFilter !== 'all')  params.status  = statusFilter
      if (selectedTags.length > 0) params.tags    = selectedTags.join(',')
      if (mustAllTags)             params.mustIncludeAllTags = true

      const res = await screensAPI.getAll(params)
      const data = res.data || []
      setScreens(data)
      setTotalScreens(res.meta?.total || 0)
      setTotalPages(res.meta?.pages  || 1)

      // Collect available tags
      const tagSet = new Set(availableTags)
      data.forEach(s => (s.tags || []).forEach(t => tagSet.add(t)))
      setAvailableTags(Array.from(tagSet))

      // Cache all loaded screen objects
      setSelectedCache(prev => {
        const next = { ...prev }
        data.forEach(s => { next[s.id] = s })
        return next
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingScreens(false)
    }
  }, [page, searchQuery, statusFilter, selectedTags, mustAllTags])

  useEffect(() => {
    const t = setTimeout(fetchScreens, searchQuery ? 350 : 0)
    return () => clearTimeout(t)
  }, [fetchScreens, searchQuery])

  // ── Groups ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'groups') return
    screensAPI.getGroups?.()
      .then(r => setGroups(r.data || []))
      .catch(() => {})
  }, [activeTab])

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggle = (screenId) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(screenId) ? next.delete(screenId) : next.add(screenId)
      return next
    })
  }

  const toggleAll = () => {
    const visible  = screens.map(s => s.id)
    const allChecked = visible.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      allChecked ? visible.forEach(id => next.delete(id)) : visible.forEach(id => next.add(id))
      return next
    })
  }

  const removeSelected = (id) => setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  const clearAll = () => setSelected(new Set())

  const allVisible  = screens.length > 0 && screens.every(s => selected.has(s.id))
  const someVisible = screens.some(s => selected.has(s.id))

  // Selected objects for right panel (from cache)
  const selectedObjects = useMemo(
    () => Array.from(selected).map(id => selectedCache[id]).filter(Boolean),
    [selected, selectedCache]
  )

  // ── Sort: selected-first rows for LEFT table ───────────────────────────────
  // Rules (matches screenshots exactly):
  //   1. Pre-assigned screens ALWAYS appear in the table — even when unselected
  //      (so user can re-tick them). Pulled from selectedCache (loaded on mount).
  //   2. Pre-assigned + still selected → top, green highlight row
  //   3. Pre-assigned + unselected     → still visible, normal row (no green)
  //   4. Other selected (not pre-assigned) → below pre-assigned group
  //   5. Unselected / not-pre-assigned   → bottom
  //   6. Deduplication by id prevents duplicate rows
  const sortedScreens = useMemo(() => {
    const seen = new Set()

    // Pre-assigned objects from cache — always include regardless of selection
    const preAssignedObjs = Array.from(preAssignedIds)
      .map(id => selectedCache[id])
      .filter(Boolean)

    const group1 = [] // pre-assigned (selected or not)
    const group2 = [] // other selected (not pre-assigned)
    const group3 = [] // unselected, not pre-assigned

    preAssignedObjs.forEach(s => {
      if (!seen.has(s.id)) { seen.add(s.id); group1.push(s) }
    })
    screens.forEach(s => {
      if (seen.has(s.id)) return
      seen.add(s.id)
      if (selected.has(s.id)) group2.push(s)
      else                    group3.push(s)
    })

    return [...group1, ...group2, ...group3]
  }, [screens, selected, preAssignedIds, selectedCache])

  // ── Publish ───────────────────────────────────────────────────────────────
  // Handles both directions:
  //   • Screens that are NOW selected     → assign playlist
  //   • Screens that WERE live but are NOW unselected → unassign playlist (clear assignment)
  const doPublish = async (scheduleInfo = null) => {
    if (selected.size === 0) { toast.error('Select at least one screen'); return }
    setPublishing(true)
    try {
      // Step 1: Mark playlist as published
      await playlistsAPI.publish(playlistId, { action: 'publish', ...(scheduleInfo || {}) })

      // Step 2: Assign to all currently selected screens
      const toAssign = Array.from(selected)
      const assignResults = await Promise.allSettled(
        toAssign.map(screenId => screensAPI.assignPlaylist(screenId, { playlistId }))
      )
      const ok   = assignResults.filter(r => r.status === 'fulfilled').length
      const fail = assignResults.filter(r => r.status === 'rejected').length

      // Step 3: Unassign from screens that WERE live but are NOW deselected
      // These screens had this playlist but the user explicitly unchecked them
      const toUnassign = Array.from(preAssignedIds).filter(id => !selected.has(id))
      if (toUnassign.length > 0) {
        await Promise.allSettled(
          toUnassign.map(screenId =>
            // Clear assigned_playlist_id by assigning null / calling unassign endpoint
            // Uses PATCH screens/:id to clear the assignment
            screensAPI.update(screenId, { assignedPlaylistId: null })
              .catch(() =>
                // Fallback: use raw API patch if update doesn't support it
                api.patch(`/screens/${screenId}`, { assigned_playlist_id: null })
              )
          )
        )
      }

      if (ok > 0 && fail === 0) {
        const unMsg = toUnassign.length > 0 ? `, removed from ${toUnassign.length}` : ''
        toast.success(`🎉 Live on ${ok} screen${ok > 1 ? 's' : ''}${unMsg}!`)
      } else if (ok > 0) {
        toast.success(`Assigned to ${ok} screens. ${fail} failed.`)
      } else {
        toast.error('Failed to assign screens. Playlist is published.')
      }

      navigate('/playlists')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Publish failed')
    } finally {
      setPublishing(false)
      setShowSchedule(false)
    }
  }

  // ── Tag filter helpers ────────────────────────────────────────────────────
  const addTag    = (tag) => { if (!selectedTags.includes(tag)) { setSelectedTags(p => [...p, tag]); setPage(1) }; setTagDropOpen(false) }
  const removeTag = (tag) => { setSelectedTags(p => p.filter(t => t !== tag)); setPage(1) }
  const unselectedAvailableTags = availableTags.filter(t => !selectedTags.includes(t))

  const playlistName = playlist?.name || (loadingPlaylist ? '…' : 'Playlist')
  const isEditMode   = preAssignedIds.size > 0

  return (
    <div className="min-h-screen pb-28" style={{ background: '#edf4fb', fontFamily: "'DM Sans','Plus Jakarta Sans',sans-serif" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3 gap-4">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Link to="/playlists" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">Playlists</Link>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
            <span className="text-gray-800 font-semibold truncate">{playlistName}</span>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
            <span className="text-blue-600 font-bold shrink-0">
              {isEditMode ? 'Update Live Screens' : 'Publish'}
            </span>
            {isEditMode && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full shrink-0">
                <Radio size={9} className="animate-pulse" />
                {preAssignedIds.size} currently live
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-full hover:bg-blue-50 transition-colors">
              <BookOpen size={14} />Read Docs<Info size={11} className="text-blue-400" />
            </button>
            <button onClick={() => navigate(`/playlists/${playlistId}/builder`)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowLeft size={14} />Go Back
            </button>
            <button onClick={() => setShowSchedule(true)} disabled={publishing || selected.size === 0}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-gray-900 bg-amber-400 rounded-full hover:bg-amber-500 disabled:opacity-40 transition-colors shadow-sm">
              <Calendar size={14} />Schedule
            </button>
            <button onClick={() => doPublish()} disabled={publishing || selected.size === 0}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm">
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {isEditMode ? 'Update Live' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-2.5">
        <p className="text-sm text-gray-500">
          {isEditMode
            ? `Editing live screens — ${preAssignedIds.size} screen${preAssignedIds.size > 1 ? 's' : ''} currently showing this playlist. Adjust selection below.`
            : 'Select screens, groups and playlists to publish.'
          }
        </p>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="px-6 flex gap-4 items-start">

        {/* ── LEFT: Screen Selector ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-5">
            {['Screens', 'Groups', 'Schedules'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
                className={`py-4 mr-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.toLowerCase()
                    ? 'text-blue-600 border-blue-500'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >{tab}</button>
            ))}
          </div>

          {/* ── SCREENS TAB ─── */}
          {activeTab === 'screens' && (
            <>
              {/* Filter bar */}
              <div className="px-5 py-3.5 border-b border-gray-100 space-y-2.5 bg-gray-50/50">

                {/* Row 1: search + count + status */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
                      placeholder="Search screens…"
                      className="w-full pl-8 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-full focus:outline-none focus:border-blue-400 focus:bg-white transition-colors shadow-sm"
                    />
                  </div>
                  <div className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 font-semibold whitespace-nowrap shadow-sm">
                    {totalScreens} Screens
                  </div>
                  <div className="relative">
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                      className="appearance-none bg-white border border-gray-200 rounded-full pl-4 pr-8 py-2 text-sm font-semibold text-gray-600 focus:outline-none focus:border-blue-400 cursor-pointer shadow-sm">
                      <option value="all">All Status</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Row 2: Tags + must-all */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {selectedTags.map(t => <TagChip key={t} tag={t} onRemove={() => removeTag(t)} />)}

                  <div className="relative">
                    <button onClick={() => setTagDropOpen(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-500 hover:border-gray-300 shadow-sm transition-colors">
                      <Tag size={12} />{selectedTags.length === 0 ? 'Filter by Tag' : 'Add Tag'}
                      <ChevronDown size={11} className={`transition-transform ${tagDropOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {tagDropOpen && (
                      <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-xl border border-gray-200 shadow-xl z-20 py-1 max-h-44 overflow-y-auto">
                        {unselectedAvailableTags.length === 0
                          ? <p className="text-xs text-gray-400 px-3 py-2">No more tags</p>
                          : unselectedAvailableTags.map(tag => (
                              <button key={tag} onClick={() => addTag(tag)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                #{tag}
                              </button>
                            ))
                        }
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={mustAllTags} onChange={e => { setMustAllTags(e.target.checked); setPage(1) }}
                      className="w-4 h-4 rounded accent-blue-500 cursor-pointer" />
                    <span className="text-sm text-gray-500 font-medium">Must include all tags</span>
                  </label>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="w-10 px-4 py-3 text-center">
                        <CB checked={allVisible} indeterminate={!allVisible && someVisible} onChange={toggleAll} />
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Screen Name</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Orientation</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tags</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingScreens || loadingPreAssigned ? (
                      <tr><td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 size={24} className="animate-spin text-blue-400" />
                          <span className="text-sm text-gray-400">Loading screens…</span>
                        </div>
                      </td></tr>
                    ) : sortedScreens.length === 0 ? (
                      <tr><td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Monitor size={36} className="text-gray-200" />
                          <p className="text-sm font-semibold text-gray-400">No screens found</p>
                          <p className="text-xs text-gray-300">
                            {searchQuery ? 'Try a different search term' : 'Pair a screen to get started'}
                          </p>
                        </div>
                      </td></tr>
                    ) : sortedScreens.map((screen) => {
                      const isChecked     = selected.has(screen.id)
                      const isPreAssigned = preAssignedIds.has(screen.id)
                      const status        = getStatus(screen)
                      const tags          = Array.isArray(screen.tags) ? screen.tags : []

                      return (
                        <tr
                          key={screen.id}
                          onClick={() => toggle(screen.id)}
                          className={`border-b border-slate-50 cursor-pointer transition-all ${
                            isPreAssigned
                              ? 'bg-emerald-50/60 hover:bg-emerald-50'
                              : isChecked
                              ? 'bg-blue-50/70 hover:bg-blue-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <CB checked={isChecked} onChange={() => toggle(screen.id)} />
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                status === 'online' ? 'bg-emerald-100' : 'bg-slate-100'
                              }`}>
                                <Monitor size={14} className={status === 'online' ? 'text-emerald-600' : 'text-slate-400'} />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-800 text-sm leading-tight">{screen.device_name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <StatusBadge status={status} />
                                  {isPreAssigned && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] font-bold rounded-full">
                                      <Radio size={7} className="animate-pulse" />Currently Live
                                    </span>
                                  )}
                                  {screen.screen_seq_id && (
                                    <span className="text-[10px] text-gray-400">#{screen.screen_seq_id}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 capitalize text-gray-600 text-sm">{screen.orientation || 'landscape'}</td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{screen.location || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 2).map(t => <TagChip key={t} tag={t} />)}
                              {tags.length > 2 && <span className="text-[10px] text-gray-400">+{tags.length - 2}</span>}
                              {tags.length === 0 && <span className="text-gray-300 text-xs">—</span>}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              onClick={e => { e.stopPropagation(); toggle(screen.id) }}
                              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                                isChecked
                                  ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                              }`}
                            >
                              {isChecked ? 'Remove' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-1 py-4 border-t border-gray-100">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-1.5 text-sm font-bold text-blue-600 rounded-full hover:bg-blue-50 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors">
                  ← Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full transition-colors ${
                      page === p ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}>{p}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-4 py-1.5 text-sm font-bold text-blue-600 rounded-full hover:bg-blue-50 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors">
                  Next →
                </button>
              </div>
            </>
          )}

          {/* ── GROUPS TAB ─── */}
          {activeTab === 'groups' && (
            <div className="p-5">
              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Users size={36} className="text-gray-200 mb-3" />
                  <p className="text-sm font-semibold text-gray-400">No groups found</p>
                  <p className="text-xs text-gray-300 mt-1">Create screen groups to bulk publish</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map(g => (
                    <div key={g.id}
                      onClick={() => setSelectedGroups(prev => { const n = new Set(prev); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedGroups.has(g.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CB checked={selectedGroups.has(g.id)} onChange={() => {}} />
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">{g.name}</div>
                          <div className="text-xs text-gray-400">{g.screen_count || 0} screens</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SCHEDULES TAB ─── */}
          {activeTab === 'schedules' && (
            <div className="flex flex-col items-center justify-center py-20">
              <Clock3 size={40} className="text-gray-200 mb-4" />
              <p className="text-sm font-semibold text-gray-400">No schedules configured</p>
              <p className="text-xs text-gray-300 mt-1">Use the Schedule button to set a future publish time</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Selected Screens ────────────────────────────────────────── */}
        <div className="w-[480px] shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-[65px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Monitor size={15} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  Selected Screens
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    {selected.size}
                  </span>
                </h3>
                {isEditMode && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                    {preAssignedIds.size} currently live • {selected.size - preAssignedIds.size > 0 ? `+${selected.size - preAssignedIds.size} new` : ''}
                  </p>
                )}
              </div>
            </div>
            {selected.size > 0 && (
              <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors">
                Clear all
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-8">#</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Screen Name</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Group</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Playing</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Location</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Del</th>
                </tr>
              </thead>
              <tbody>
                {selectedObjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Monitor size={28} className="text-gray-200" />
                        <p className="text-xs font-semibold text-gray-400">No screens selected</p>
                        <p className="text-[11px] text-gray-300">Check screens on the left to add them</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Show pre-assigned (live) first, then rest
                  [...selectedObjects]
                    .sort((a, b) => {
                      const aLive = preAssignedIds.has(a.id) ? 0 : 1
                      const bLive = preAssignedIds.has(b.id) ? 0 : 1
                      return aLive - bLive
                    })
                    .map((screen, idx) => {
                      const status    = getStatus(screen)
                      const isLive    = preAssignedIds.has(screen.id)
                      return (
                        <tr key={screen.id}
                          className={`border-b border-slate-50 transition-colors ${
                            isLive ? 'bg-emerald-50/50' : 'hover:bg-gray-50'
                          }`}>
                          <td className="px-3 py-3 text-xs text-gray-400 font-bold">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <div>
                              <div className="font-semibold text-gray-800 text-sm leading-tight truncate max-w-[110px]">
                                {screen.device_name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <StatusBadge status={status} />
                                {isLive && (
                                  <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                                    <Radio size={7} className="animate-pulse" />Live
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{screen.group_name || '—'}</td>
                          <td className="px-3 py-3">
                            {screen.playlist_name
                              ? <span className="text-gray-600 text-xs font-medium truncate block max-w-[80px]">{screen.playlist_name}</span>
                              : <span className="text-gray-300 italic text-xs">None</span>
                            }
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs truncate max-w-[70px]">{screen.location || '—'}</td>
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => removeSelected(screen.id)}
                              className="p-1 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Right panel footer CTA */}
          {selected.size > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60">
              <button onClick={() => doPublish()} disabled={publishing}
                className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg,#2563eb,#0891b2)', boxShadow: '0 4px 16px rgba(37,99,235,.3)' }}>
                {publishing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isEditMode ? `Update ${selected.size} Screen${selected.size > 1 ? 's' : ''}` : `Publish to ${selected.size} Screen${selected.size > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky bottom bar ─────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-2xl z-30">
          <div className="flex items-center justify-between px-6 py-3.5 max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <Monitor size={16} className="text-blue-600" />
              </div>
              <div className="text-sm">
                <span className="font-bold text-gray-800">{selected.size} screen{selected.size > 1 ? 's' : ''} selected</span>
                <span className="text-gray-400 ml-2">→</span>
                <span className="font-bold text-blue-600 ml-2">{playlistName}</span>
                {isEditMode && preAssignedIds.size > 0 && (
                  <span className="text-gray-400 ml-2 text-xs">
                    ({preAssignedIds.size} already live)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearAll} className="px-4 py-2 text-sm font-semibold text-gray-500 rounded-full hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button onClick={() => setShowSchedule(true)} disabled={publishing}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-gray-900 bg-amber-400 rounded-full hover:bg-amber-500 transition-colors shadow-sm">
                <Calendar size={14} />Schedule
              </button>
              <button onClick={() => doPublish()} disabled={publishing}
                className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm">
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {isEditMode ? 'Update Live Screens' : 'Publish Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <ScheduleModal
          playlistName={playlistName}
          publishing={publishing}
          onClose={() => setShowSchedule(false)}
          onConfirm={info => doPublish(info)}
        />
      )}
    </div>
  )
}