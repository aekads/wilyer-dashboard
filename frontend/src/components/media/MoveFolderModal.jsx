// src/components/media/MoveFolderModal.jsx
import { useState, useEffect } from 'react';
import { Modal } from '../ui';
import { Folder, X, ChevronRight, ChevronDown } from 'lucide-react';
import { mediaAPI } from '../../services/api';

export function MoveFolderModal({ isOpen, onClose, onConfirm, currentFolder }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = async () => {
    try {
      const res = await mediaAPI.getFolders();
      setFolders(buildTree(res.data));
    } catch (error) {
      console.error('Failed to load folders');
    }
  };

  const buildTree = (flatFolders) => {
    const map = {};
    const roots = [];
    
    flatFolders.forEach(folder => {
      map[folder.id] = { ...folder, children: [] };
    });
    
    flatFolders.forEach(folder => {
      if (folder.parent_id) {
        if (map[folder.parent_id]) {
          map[folder.parent_id].children.push(map[folder.id]);
        }
      } else {
        roots.push(map[folder.id]);
      }
    });
    
    return roots.sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleExpand = (folderId, e) => {
    e.stopPropagation();
    const newExpanded = new Set(expanded);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpanded(newExpanded);
  };

  const renderFolder = (folder, level = 0) => {
    const isExpanded = expanded.has(folder.id);
    const hasChildren = folder.children?.length > 0;
    const isSelected = selectedFolder === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center px-2 py-2 rounded-lg cursor-pointer ${
            isSelected ? 'bg-[#00A3FF]/10 border border-[#00A3FF]' : 'hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => setSelectedFolder(folder.id)}
        >
          <button
            onClick={(e) => toggleExpand(folder.id, e)}
            className="w-5 h-5 flex items-center justify-center text-gray-400"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span className="w-4" />
            )}
          </button>
          
          <Folder size={16} className={`mr-2 ${isSelected ? 'text-[#00A3FF]' : 'text-gray-400'}`} />
          
          <span className={`text-sm flex-1 ${isSelected ? 'text-[#00A3FF] font-medium' : 'text-gray-700'}`}>
            {folder.name}
          </span>
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Folder size={20} className="text-[#00A3FF]" />
            Move to Folder
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="mb-4 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-2">
          <div
            onClick={() => setSelectedFolder(null)}
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${
              selectedFolder === null ? 'bg-[#00A3FF]/10 border border-[#00A3FF]' : 'hover:bg-gray-100'
            }`}
          >
            <Folder size={16} className={selectedFolder === null ? 'text-[#00A3FF]' : 'text-gray-400'} />
            <span className={`text-sm ${selectedFolder === null ? 'text-[#00A3FF] font-medium' : 'text-gray-700'}`}>
              Root (No Folder)
            </span>
          </div>
          
          {folders.map(folder => renderFolder(folder))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(selectedFolder)} 
            className="px-4 py-2 bg-[#00A3FF] text-white rounded-lg hover:bg-[#0093e6] text-sm font-medium"
          >
            Move
          </button>
        </div>
      </div>
    </Modal>
  );
}