import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Plus, ListVideo, Edit2, Trash2, Copy, Eye, 
  MoreVertical, Calendar, Monitor, Search, ChevronDown 
} from 'lucide-react'
import { playlistsAPI } from '../services/api'
import { EmptyState, PageLoader, Modal, Input, Badge, ConfirmModal } from '../components/ui'
import { formatDate } from '../utils'
import toast from 'react-hot-toast'

export default function Playlists() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('')
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null })
  const [menuOpen, setMenuOpen] = useState(null)

  useEffect(() => {
    fetchPlaylists()
  }, [])

  const fetchPlaylists = async () => {
    setLoading(true)
    try {
      const res = await playlistsAPI.getAll({ limit: 50 })
      setPlaylists(res.data || [])
    } catch (error) {
      console.error('Failed to fetch playlists:', error)
      toast.error('Could not load playlists')
    } finally {
      setLoading(false)
    }
  }

  const createPlaylist = async () => {
    // 1. Validation
    if (!newPlaylistName.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }

    try {
      // 2. API Call
      const res = await playlistsAPI.create({ 
        name: newPlaylistName,
        description: newPlaylistDesc 
      });

      // 3. Success Feedback
      toast.success('Playlist created successfully!');
      
      // 4. Cleanup Modal State
      setShowCreateModal(false);
      setNewPlaylistName('');
      setNewPlaylistDesc('');

      // 5. THE PERFECT REDIRECT
      // Assuming your route is defined as /playlists/:id/builder
      if (res.data && res.data.id) {
        navigate(`/playlists/${res.data.id}/builder`);
      } else {
        // Fallback if ID is missing from response
        fetchPlaylists(); 
      }
      
    } catch (error) {
      console.error('Creation error:', error);
      toast.error('Failed to create playlist. Please try again.');
    }
  };

  const deletePlaylist = async () => {
    try {
      await playlistsAPI.delete(deleteModal.id)
      toast.success('Playlist deleted')
      setDeleteModal({ open: false, id: null })
      fetchPlaylists()
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-[#F0F5FA] p-8">
      {/* Header matching image top bar */}
      <div className="flex items-center justify-end gap-3 mb-8">
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 shadow-sm">
          Read Docs <span className="bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">i</span>
        </button>
        
        <div className="flex border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
           <button className="px-3 py-2 bg-gray-500 text-white border-r border-gray-300">
             <ListVideo size={18} />
           </button>
           <button className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-gray-700">
             Sort by Created <ChevronDown size={14} />
           </button>
        </div>

        <div className="relative">
          <input 
            type="text" 
            placeholder="Search.." 
            className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg w-64 focus:outline-none shadow-sm"
          />
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
        </div>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-[#0066FF] text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm"
        >
          <Plus size={18} strokeWidth={3} />
          New Playlist
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {playlists.map(playlist => (
          <div key={playlist.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative p-4">
            
            {/* Card Preview Area */}
            <div className="bg-[#E2E8F0] rounded-xl aspect-video flex flex-col items-center justify-center relative mb-4">
              <span className="text-gray-600 font-bold text-sm">No Layout Found!</span>
              
              {/* Three dots menu */}
              <button className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm">
                <MoreVertical size={16} className="text-gray-600" />
              </button>
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-2 mb-4">
              <button className="bg-[#0066FF] text-white text-xs font-bold px-4 py-1.5 rounded-lg">
                Publish
              </button>
              <div className="ml-auto flex gap-2">
                <button 
                  onClick={() => navigate(`/playlists/${playlist.id}/builder`)}
                  className="bg-[#FFCC00] text-black text-xs font-bold px-4 py-1.5 rounded-lg"
                >
                  Edit
                </button>
                <button 
                  onClick={() => setDeleteModal({ open: true, id: playlist.id })}
                  className="bg-[#EF4444] text-white p-1.5 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Info Section */}
            <div>
              <h3 className="font-bold text-gray-800 text-lg">{playlist.name}</h3>
              <p className="text-gray-400 text-xs mt-0.5">{playlist.description || playlist.name}</p>
              
              <div className="flex justify-between items-center mt-4 text-[#3B82F6] font-medium text-xs">
                <div className="flex items-center gap-1.5">
                   <div className="w-4 h-4 border border-blue-500 rounded flex items-center justify-center text-[10px]">||</div>
                   0 Layouts
                </div>
                <div className="flex items-center gap-1.5">
                  <Monitor size={14} />
                  {playlist.screens_count || 0} Screen
                </div>
                <div className="text-gray-400">
                  {formatDate(playlist.updated_at || new Date())}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reusable Modals */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Playlist">
        <div className="p-4 space-y-4">
          <Input label="Name" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} />
          <button onClick={createPlaylist} className="w-full bg-[#0066FF] text-white py-2 rounded-lg font-bold">Create</button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={deletePlaylist}
        danger
      />
    </div>
  )
}


  