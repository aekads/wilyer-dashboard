// src/services/socket.js
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
let socket = null

export const initSocket = (token) => {
  if (socket?.connected) return socket
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 15,
  })
  socket.on('connect', () => console.log('🔌 Socket connected'))
  socket.on('disconnect', (r) => console.log('🔌 Disconnected:', r))
  return socket
}

export const getSocket = () => socket
export const disconnectSocket = () => { socket?.disconnect(); socket = null }

export const subscribeToScreenUpdates = (cb) => {
  socket?.on('screen:status_change', cb)
  socket?.on('screen:heartbeat', cb)
  return () => {
    socket?.off('screen:status_change', cb)
    socket?.off('screen:heartbeat', cb)
  }
}

export const subscribeToNotifications = (cb) => {
  socket?.on('notification:new', cb)
  return () => socket?.off('notification:new', cb)
}

export const sendScreenCommand = (screenId, command, payload = {}) => {
  socket?.emit('screen:command', { screenId, command, payload })
}
