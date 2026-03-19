// src/store/authStore.js
// ============================================================
// AEKADS Auth Store — Zustand — Final Complete Version
//
// Response shapes this handles:
//
// POST /api/auth/login  →
//   { success, data: { user: { id, email, firstName, lastName, orgId, roles },
//                      accessToken, refreshToken } }
//
// GET /api/auth/me  →
//   { success, data: { id, email, first_name, last_name,
//                      org_id, org_name, org_slug, logo_url,
//                      roles: [{name,slug}],
//                      permissions: [{slug,module,action}],
//                      isSuperAdmin, isAdmin } }
//
// hasPermission(slug) — works for all roles:
//   • super_admin / admin  → always true (bypass)
//   • others               → checks user.permissions[] from /me
// ============================================================
import { create } from 'zustand'
import { authAPI } from '../services/api'
import { initSocket, disconnectSocket } from '../services/socket'

// ─────────────────────────────────────────────────────────────
// normalizeUser — both snake_case + camelCase available
// ─────────────────────────────────────────────────────────────
function normalizeUser(u) {
  if (!u) return u
  return {
    ...u,
    id:          u.id          || u.userId     || null,
    first_name:  u.first_name  || u.firstName  || '',
    last_name:   u.last_name   || u.lastName   || '',
    firstName:   u.firstName   || u.first_name || '',
    lastName:    u.lastName    || u.last_name  || '',
    org_id:      u.org_id      || u.orgId      || null,
    org_name:    u.org_name    || null,
    org_slug:    u.org_slug    || null,
    orgId:       u.orgId       || u.org_id     || null,
    roles:       Array.isArray(u.roles)       ? u.roles       : [],
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    isSuperAdmin: u.isSuperAdmin ?? false,
    isAdmin:      u.isAdmin      ?? false,
  }
}

export const useAuthStore = create((set, get) => ({
  user:            null,
  organization:    null,
  isAuthenticated: false,
  isLoading:       true,
  authError:       null,

  // ── initialize ─────────────────────────────────────────────
  initialize: async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) { set({ isLoading: false }); return }

    const timeoutId = setTimeout(() => {
      set({ isLoading: false, authError: 'timeout' })
    }, 10000)

    try {
      // /auth/me → { success, data: { id, email, first_name, …, roles, permissions, isSuperAdmin, isAdmin } }
      const body     = await authAPI.getMe()
      clearTimeout(timeoutId)
      const userData = body?.data ?? body

      const org = {
        id:      userData.org_id   || null,
        name:    userData.org_name || null,
        slug:    userData.org_slug || null,
        logoUrl: userData.logo_url || null,
      }
      if (org.slug) localStorage.setItem('org-slug', org.slug)

      set({
        user:            normalizeUser(userData),
        organization:    org,
        isAuthenticated: true,
        isLoading:       false,
        authError:       null,
      })

      try { initSocket(token) } catch {}
    } catch (err) {
      clearTimeout(timeoutId)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({ isLoading: false, authError: err?.response?.status || 'unknown' })
    }
  },

  // ── login ───────────────────────────────────────────────────
  login: async (credentials) => {
    set({ authError: null })
    try {
      // login → { success, data: { user, accessToken, refreshToken } }
      const body = await authAPI.login(credentials)
      const { user, accessToken, refreshToken } = body?.data ?? body

      if (!accessToken) throw new Error('No access token in login response')

      localStorage.setItem('accessToken',  accessToken)
      localStorage.setItem('refreshToken', refreshToken)

      const normalizedUser = normalizeUser(user)
      const org = {
        id:   normalizedUser.org_id   || null,
        name: normalizedUser.org_name || null,
        slug: normalizedUser.org_slug || null,
      }
      if (org.slug) localStorage.setItem('org-slug', org.slug)

      set({ user: normalizedUser, organization: org, isAuthenticated: true, authError: null })

      try { initSocket(accessToken) } catch {}

      // Immediately fetch /me to hydrate full permissions after login
      try {
        const meBody   = await authAPI.getMe()
        const meData   = meBody?.data ?? meBody
        const fullUser = normalizeUser(meData)
        const fullOrg  = {
          id:      fullUser.org_id   || org.id,
          name:    fullUser.org_name || org.name,
          slug:    fullUser.org_slug || org.slug,
          logoUrl: fullUser.logo_url || null,
        }
        if (fullOrg.slug) localStorage.setItem('org-slug', fullOrg.slug)
        set({ user: fullUser, organization: fullOrg })
      } catch {}

      return { user: normalizedUser, organization: org }
    } catch (err) {
      console.error('Login failed:', err)
      throw err
    }
  },

  // ── logout ──────────────────────────────────────────────────
  logout: async () => {
    try {
      const rt = localStorage.getItem('refreshToken')
      if (rt) await authAPI.logout(rt).catch(() => {})
    } catch {}
    finally {
      localStorage.clear()
      disconnectSocket()
      set({ user: null, organization: null, isAuthenticated: false, authError: null })
      window.location.href = '/login'
    }
  },

  // ── updateUser / updateOrganization ────────────────────────
  updateUser:         (updates) => set(s => ({ user:         { ...s.user,         ...updates } })),
  updateOrganization: (updates) => set(s => ({ organization: { ...s.organization, ...updates } })),

  // ── hasPermission ───────────────────────────────────────────
  // Call as: hasPermission('screens:read')
  //       or: hasPermission('screens', 'read')
  //
  // Bypass: super_admin, admin (both from role slug AND flags)
  // Others: check user.permissions[] returned by /auth/me
  hasPermission: (permOrModule, action) => {
    const { user } = get()
    if (!user) return false

    const roles = user.roles || []

    // ── Bypass: super_admin or admin role ─────────────────────
    const isSuperAdmin = user.isSuperAdmin || roles.some(r => r.slug === 'super_admin')
    const isAdmin      = user.isAdmin      || roles.some(r => r.slug === 'admin')
    if (isSuperAdmin || isAdmin) return true

    // ── Build slug ────────────────────────────────────────────
    const slug = action ? `${permOrModule}:${action}` : String(permOrModule)

    // ── Check permissions array from /me ─────────────────────
    const perms = user.permissions || []
    if (perms.length === 0) return false

    return perms.some(p =>
      (typeof p === 'object' && p?.slug === slug) ||
      p === slug
    )
  },

  // ── hasRole ─────────────────────────────────────────────────
  hasRole: (slug) => {
    const { user } = get()
    return (user?.roles || []).some(r => r.slug === slug)
  },

  // ── Helpers ─────────────────────────────────────────────────
  getCurrentOrg:   () => get().organization,
  isOrgMember:     (orgId) => get().organization?.id === orgId,
  retryInitialize: async () => {
    set({ isLoading: true, authError: null })
    await get().initialize()
  },
}))