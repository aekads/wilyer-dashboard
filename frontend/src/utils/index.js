// src/utils/index.js
import { formatDistanceToNow, format, parseISO } from 'date-fns'

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export const formatDuration = (seconds) => {
  if (!seconds) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export const formatDate = (d, fmt = 'dd MMM yyyy') => {
  if (!d) return '—'
  try { return format(typeof d === 'string' ? parseISO(d) : d, fmt) }
  catch { return '—' }
}

export const timeAgo = (d) => {
  if (!d) return 'Never'
  try { return formatDistanceToNow(typeof d === 'string' ? parseISO(d) : d, { addSuffix: true }) }
  catch { return '—' }
}

export const getStatusColor = (status) => ({
  online:      'badge-green',
  offline:     'badge-red',
  inactive:    'badge-gray',
  maintenance: 'badge-yellow',
  published:   'badge-green',
  draft:       'badge-gray',
  archived:    'badge-yellow',
  active:      'badge-green',
  expired:     'badge-red',
  trial:       'badge-blue',
  suspended:   'badge-red',
}[status] ?? 'badge-gray')

export const getStatusDot = (status) => ({
  online:  'status-online',
  offline: 'status-offline',
  idle:    'status-idle',
}[status] ?? 'status-offline')

export const cx = (...classes) => classes.filter(Boolean).join(' ')

export const truncate = (str, n = 30) =>
  str && str.length > n ? str.slice(0, n) + '…' : str

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export const getRoleColor = (slug) => ({
  super_admin: 'badge-purple',
  admin:       'badge-blue',
  manager:     'badge-green',
  editor:      'badge-yellow',
  viewer:      'badge-gray',
  device:      'badge-gray',
}[slug] ?? 'badge-gray')
