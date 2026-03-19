// src/services/api.js
import axios from 'axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Request interceptor - add auth token and org slug
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  const orgSlug = localStorage.getItem('org-slug')
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  // Add organization slug header for multi-tenancy
  if (orgSlug) {
    config.headers['X-Org-Slug'] = orgSlug
  }
  
  // Add device token for screen devices
  const deviceToken = localStorage.getItem('deviceToken')
  if (deviceToken && config.url?.includes('/devices/')) {
    config.headers['X-Device-Token'] = deviceToken
  }
  
  config.metadata = { startTime: Date.now() }
  return config
})

// Token refresh queue
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token))
  failedQueue = []
}

// Debounced toast to prevent spam
const showErrorToast = (() => {
  let timeout;
  let lastError = '';
  
  return (message) => {
    if (message === lastError) return;
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      toast.error(message);
      lastError = message;
      setTimeout(() => { lastError = '' }, 5000);
    }, 300);
  };
})();

// Response interceptor
api.interceptors.response.use(
  (res) => {
    // Log slow responses in development
    if (import.meta.env.DEV) {
      const duration = Date.now() - res.config.metadata.startTime;
      if (duration > 1000) {
        console.warn(`Slow API call (${duration}ms):`, res.config.url);
      }
    }
    return res.data
  },
  async (error) => {
    const originalRequest = error.config
    
    // Handle token expiration
    const status = error.response?.status
    const code = error.response?.data?.error?.code
    
    if (status === 401 && code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const rt = localStorage.getItem('refreshToken')
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: rt })
        
        const { accessToken, refreshToken, organization } = res.data.data
        
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        if (organization?.slug) {
          localStorage.setItem('org-slug', organization.slug)
        }
        
        processQueue(null, accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (err) {
        processQueue(err)
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }
    
    // Handle other errors
    const msg = error.response?.data?.error?.message || 'An error occurred'
    if (status !== 401) {
      showErrorToast(msg)
    }
    
    return Promise.reject(error)
  }
)

// ─── Helper: unwrap { success, data, meta } ───────────────────────────────────
const unwrap = res => ({
  data: res.data?.data ?? res.data,
  meta: res.data?.meta,
  raw:  res.data,
})

// Auth API - FIXED field names to match backend
export const authAPI = {
  register: (data) => api.post('/auth/register', {
    email: data.email,
    password: data.password,
    firstName: data.firstName,
    lastName: data.lastName,
    orgName: data.orgName,           // Changed from organizationName to orgName
    orgSlug: data.orgSlug             // Changed from organizationSlug to orgSlug
  }),
  
  login: (data) => api.post('/auth/login', {
    email: data.email,
    password: data.password,
    orgSlug: data.orgSlug
  }).then(res => {
    // Store org slug in localStorage
    if (res.data?.data?.organization?.slug) {
      localStorage.setItem('org-slug', res.data.data.organization.slug)
    }
    return res
  }),
  
  logout: (refreshToken) => {
    localStorage.removeItem('org-slug')
    return api.post('/auth/logout', { refreshToken })
  },
  
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  getMe: () => api.get('/auth/me'),
  pairDevice: (pairingCode) => api.post('/auth/device/pair', { pairingCode }),
}

// Screens API
export const screensAPI = {
  getAll:         (params)         => api.get('/screens', { params }),
  getOne:         (id)             => api.get(`/screens/${id}`),
  update:         (id, data)       => api.patch(`/screens/${id}`, data),
  delete:         (id)             => api.delete(`/screens/${id}`),
  assignPlaylist: (screenId, data) => 
    api.post(`/screens/${screenId}/assign-playlist`, data).then(res => {
      return { data: res.data?.data || res.data }
    }),
  getHealth:      ()               => api.get('/screens/health'),
  pair: (data) => api.post('/screens/pair', {
    pairingCode: data.pairingCode,
    deviceName:  data.name,
    location:    data.location  || null,
    tags:        data.tags      || null,
    groupId:     data.groupId   || null,
  }),
  generatePairingCode: (data) => api.post('/screens/device/generate-code', data),
  checkPairingStatus: (code) => api.get('/screens/device/check-pair', { params: { code } }),
  heartbeat: (data) => api.post('/screens/device/heartbeat', data, {
    headers: { 'X-Device-Token': localStorage.getItem('deviceToken') },
  }),
  getContent: () => api.get('/screens/device/content', {
    headers: { 'X-Device-Token': localStorage.getItem('deviceToken') },
  }),
}

// Media API
export const mediaAPI = {
  getAll: (params) => api.get('/media', { params }),
  getOne: (id) => api.get(`/media/${id}`),
  upload: (formData, onProgress, signal) => api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      const percent = Math.round((e.loaded * 100) / e.total)
      onProgress?.(percent)
    },
    signal
  }),
  update: (id, data) => api.patch(`/media/${id}`, data),
  delete: (id) => api.delete(`/media/${id}`),
  getStorageStats: () => api.get('/media/storage-stats'),
  getFolders: (params) => api.get('/media/folders', { params }),
  getFolder: (id) => api.get(`/media/folders/${id}`),
  createFolder: (data) => api.post('/media/folders', data),
  updateFolder: (id, data) => api.patch(`/media/folders/${id}`, data),
  deleteFolder: (id, moveToParent) => api.delete(`/media/folders/${id}`, { params: { moveToParent } }),
  moveFiles: (data) => api.post('/media/move', data),
}

// Widgets API
export const widgetsAPI = {
  getAll: (params) => api.get('/widgets', { params }),
  getById: (id) => api.get(`/widgets/${id}`),
  create: (data) => api.post('/widgets', data),
  update: (id, data) => api.patch(`/widgets/${id}`, data),
  delete: (id) => api.delete(`/widgets/${id}`),
  duplicate: (id) => api.post(`/widgets/${id}/duplicate`),
  approve: (id, approve = true) => api.post(`/widgets/${id}/approve`, { approve }),
  getTypes: () => api.get('/widgets/types'),
  getDefaults: (type) => api.get(`/widgets/defaults/${type}`),
  getStats: () => api.get('/widgets/stats'),
  render: (id) => api.get(`/widgets/${id}/render`),
  preview: (type, config) => api.post('/widgets/preview', { type, config })
}

// Playlists API
export const playlistsAPI = {
  getAll:       (params)      => api.get('/playlists', { params }).then(unwrap),
  create:       (body)        => api.post('/playlists', body).then(unwrap),
  getOne:       (id)          => api.get(`/playlists/${id}`).then(unwrap),
  update:       (id, body)    => api.patch(`/playlists/${id}`, body).then(unwrap),
  updateItems:  (id, body)    => api.put(`/playlists/${id}/items`, body).then(unwrap),
  publish:      (id, body)    => api.post(`/playlists/${id}/publish`, body).then(unwrap),
  preview:      (id)          => api.get(`/playlists/${id}/preview`).then(unwrap),
  getVersions:  (id)          => api.get(`/playlists/${id}/versions`).then(unwrap),
  delete:       (id)          => api.delete(`/playlists/${id}`).then(unwrap),
}

// Schedules API
export const schedulesAPI = {
  getAll: (params) => api.get('/schedules', { params }),
  getOne: (id) => api.get(`/schedules/${id}`),
  create: (data) => api.post('/schedules', data),
  update: (id, d) => api.patch(`/schedules/${id}`, d),
  delete: (id) => api.delete(`/schedules/${id}`),
  getConflicts: (id) => api.get(`/schedules/${id}/conflicts`),
}

// Analytics API
export const analyticsAPI = {
  // getDashboard: () => api.get('/analytics/dashboard'),
  getScreenUptime: (id, period) => api.get(`/analytics/screens/${id}/uptime`, { params: { period } }),
  getProofOfPlay: (params) => api.get('/analytics/proof-of-play', { params }),
  getTopMedia: (period) => api.get('/analytics/media', { params: { period } }),
  exportCSV: (params) => api.get('/analytics/export', { 
    params, 
    responseType: 'blob',
    timeout: 60000
  }),
  getRealtime: (screenId) => api.get(`/analytics/realtime/${screenId}`),
}

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  invite: (data) => api.post('/users/invite', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  assignRole: (id, roleId) => api.post(`/users/${id}/roles`, { roleId }),
  removeRole: (id, roleId) => api.delete(`/users/${id}/roles/${roleId}`),
  getRoles: () => api.get('/roles'),
  getPermissions: () => api.get('/users/permissions'),
}

// Settings API
export const settingsAPI = {
  // ── Organization ─────────────────────────────
  getOrg:            ()        => api.get('/settings/org'),
  updateOrg:         (data)    => api.patch('/settings/org', data),

  // ── Plans ───────────────────────────────────
  // optional: ?screenCount=N
  getPlans:          (params)  => api.get('/settings/plans', { params }),

  // ── Subscription ────────────────────────────
  getSubscription:   ()        => api.get('/settings/subscription'),
  subscribe:         (data)    => api.post('/settings/subscribe', data),
  cancelSubscription:()        => api.post('/settings/subscription/cancel'),
  renewSubscription: ()        => api.post('/settings/subscription/renew'),

  // ── Billing ─────────────────────────────────
  // params: { page, limit }
  getBillingHistory: (params)  => api.get('/settings/billing-history', { params }),  

  // ── Screen Licenses ─────────────────────────
  getScreenLicenses: ()        => api.get('/settings/screen-licenses'),
  renewScreenLicense:(id)      => api.post(`/settings/screen-licenses/${id}/renew`),

  // ── Security ────────────────────────────────
  changePassword:    (data)    => api.post('/settings/password', data),
}

// Device API
export const deviceAPI = {
  heartbeat: (data) => api.post('/devices/heartbeat', data, {
    headers: { 'X-Device-Token': localStorage.getItem('deviceToken') }
  }),
  getPlaylist: (screenId) => api.get(`/devices/${screenId}/playlist`),
  reportStatus: (data) => api.post('/devices/status', data),
  getCommands: (screenId) => api.get(`/devices/${screenId}/commands`),
  acknowledgeCommand: (commandId) => api.post(`/devices/commands/${commandId}/acknowledge`),
  uploadLogs: (screenId, logs) => api.post(`/devices/${screenId}/logs`, logs),
  getConfig: (screenId) => api.get(`/devices/${screenId}/config`),
}

// ─────────────────────────────────────────────────────────────
// ADD THIS TO: src/services/api.js
// ─────────────────────────────────────────────────────────────
// Paste this block at the bottom of your existing api.js file

export const teamAPI = {
  // Members
  getMembers:              (params)   => api.get('/team/members', { params }),
  getMember:               (id)       => api.get(`/team/members/${id}`),
  addMember:               (data)     => api.post('/team/members', data),
  updateMember:            (id, data) => api.patch(`/team/members/${id}`, data),
  updateMemberPermissions: (id, data) => api.patch(`/team/members/${id}/permissions`, data),
  removeMember:            (id)       => api.delete(`/team/members/${id}`),

  // Roles & Permissions
  getRoles:           ()           => api.get('/team/roles'),
  getRolePermissions: (roleSlug)   => api.get('/team/permissions', { params: { roleSlug } }),

  // Logs & Stats
  getActivityLogs:    (params)     => api.get('/team/logs', { params }),
  getStats:           ()           => api.get('/team/stats'),
}
              


// 👇 IMPORTANT: Export both default and named exports
export { api }
export default api