import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import DashboardLayout from './components/layouts/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { Button } from './components/ui/Button'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Screens from './pages/Screens'
import MediaLibrary from './pages/MediaLibrary'
import Playlists from './pages/Playlists'
import PlaylistBuilder from './pages/PlaylistBuilder'
import PlaylistPublish from './pages/PlaylistPublish'
import Schedules from './pages/Schedules'
import Analytics from './pages/Analytics'
import Teams from './pages/TeamPage'
import Users from './pages/Users'
import Settings from './pages/Settings'
import ResetPassword from './pages/ResetPassword'

import axios from 'axios';
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '/api';
axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default function App() {
  const { initialize, isLoading, authError, retryInitialize } = useAuthStore()
  const [initAttempted, setInitAttempted] = useState(false)

  useEffect(() => {
    const init = async () => {
      await initialize()
      setInitAttempted(true)
    }
    init()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md px-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center shadow-glow-brand animate-pulse">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="2" fill="white" opacity="0.9"/>
                <rect x="13" y="3" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                <rect x="3" y="13" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                <rect x="13" y="13" width="8" height="8" rx="2" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="font-display text-xl font-semibold text-slate-800">Loading Aekads</h2>
            <div className="flex justify-center gap-1">
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" />
            </div>
            <p className="text-slate-500 text-sm">Preparing your digital signage workspace...</p>
          </div>
        </div>
      </div>
    )
  }

  if (authError && !isLoading && initAttempted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-600">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="1.5" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-slate-800 mb-2">Connection Issue</h2>
          <p className="text-slate-500 text-sm mb-6">
            {authError === 401
              ? 'Your session has expired. Please login again.'
              : authError === 429
              ? 'Too many requests. Please wait a moment and try again.'
              : 'Unable to connect to the server. Please check your internet connection.'}
          </p>
          <div className="space-y-3">
            <Button onClick={() => window.location.href = '/login'} className="w-full bg-brand-600 hover:bg-brand-700 text-white">
              Go to Login
            </Button>
            <Button onClick={() => retryInitialize()} variant="outline" className="w-full">
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: {
          background: '#ffffff',
          color: '#1e293b',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          fontSize: '13px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }} />

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/screens" element={<Screens />} />
            <Route path="/media" element={<MediaLibrary />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/teams" element={<Teams />} />
          </Route>
        </Route>

        {/* Playlist nested routes (outside DashboardLayout) */}
        <Route path="/playlists/:id/builder" element={<PlaylistBuilder />} />
        <Route path="/playlists/:id/publish" element={<PlaylistPublish />} />
        <Route path="/playlists/:id" element={<Navigate to="./builder" replace />} />

        {/* Root → /login (unauthenticated users land on login) */}
        {/* ProtectedRoute handles redirect to /dashboard after login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch all → /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}