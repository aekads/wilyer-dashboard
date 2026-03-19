// src/components/media/NewFolderModal.jsx
import { useState } from 'react';
import { Modal } from '../ui';
import { Folder, X } from 'lucide-react';
import { mediaAPI } from '../../services/api';
import toast from 'react-hot-toast';

export function NewFolderModal({ isOpen, onClose, onSuccess, currentFolder }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Folder name is required');
      return;
    }

    setLoading(true);
    try {
      await mediaAPI.createFolder({
        name: name.trim(),
        parentId: currentFolder
      });
      toast.success('Folder created');
      onSuccess?.();
      onClose();
      setName('');
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Folder size={20} className="text-[#00A3FF]" />
            Create New Folder
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1.5">Folder Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00A3FF]"
              placeholder="e.g., Marketing Videos"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-4 py-2 bg-[#00A3FF] text-white rounded-lg hover:bg-[#0093e6] text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}