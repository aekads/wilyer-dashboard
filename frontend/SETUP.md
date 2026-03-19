# Aekads Frontend — Setup Guide

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (proxies to backend at localhost:5000)
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create `.env` at the frontend root:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

For production:
```env
VITE_API_URL=https://api.aekads.com/api
VITE_SOCKET_URL=https://api.aekads.com
```

## Tech Stack
- **React 18** + Vite
- **React Router v6** — nested routes
- **Zustand** — auth state management
- **Axios** — API client with auto token refresh
- **Socket.io Client** — real-time screen updates
- **@dnd-kit** — drag-and-drop playlist builder
- **Chart.js + react-chartjs-2** — analytics charts
- **react-dropzone** — media upload
- **Tailwind CSS** — utility-first styling
- **Lucide React** — icon library
- **date-fns** — date formatting
- **react-hot-toast** — notifications

## Pages & Routes

| Route | Page | Auth |
|-------|------|------|
| /login | Login | Public |
| /register | Register | Public |
| /dashboard | Dashboard | Protected |
| /screens | Screen Management | Protected |
| /media | Media Library | Protected |
| /playlists | Playlist Builder (new) | Protected |
| /playlists/:id | Playlist Builder (edit) | Protected |
| /schedules | Schedule Manager | Protected |
| /analytics | Analytics & Reports | Protected |
| /users | User & Role Management | Protected |
| /settings | Organization Settings | Protected |

## Key Features
- ✅ JWT auth with automatic refresh token rotation
- ✅ Role-based menu visibility
- ✅ Real-time screen status via Socket.io
- ✅ Drag-and-drop playlist builder (@dnd-kit)
- ✅ Cloudinary media upload with progress
- ✅ Live analytics charts (Chart.js)
- ✅ CSV export for proof-of-play
- ✅ Dark theme with glass morphism design
- ✅ Responsive (mobile-first)
