// src/components/media/FolderTree.jsx
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, MoreVertical } from 'lucide-react';
import { mediaAPI } from '../../services/api';
import toast from 'react-hot-toast';

export function FolderTree({ currentFolder, onSelect, onNewFolder, onDeleteFolder }) {
  const [folders, setFolders] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (currentFolder) {
      expandPathToFolder(currentFolder);
    }
  }, [currentFolder, folders]);

  const loadFolders = async () => {
    try {
      const res = await mediaAPI.getFolders();
      setFolders(buildTree(res.data));
    } catch (error) {
      toast.error('Failed to load folders');
    } finally {
      setLoading(false);
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

  const expandPathToFolder = (folderId) => {
    const findPath = (folders, targetId, path = []) => {
      for (const folder of folders) {
        if (folder.id === targetId) {
          return [...path, folder.id];
        }
        if (folder.children) {
          const found = findPath(folder.children, targetId, [...path, folder.id]);
          if (found) return found;
        }
      }
      return null;
    };

    const path = findPath(folders, folderId);
    if (path) {
      setExpanded(new Set([...expanded, ...path]));
    }
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

  const handleContextMenu = (e, folder) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folder
    });
  };

  const handleRename = async () => {
    const newName = prompt('Enter new folder name:', contextMenu.folder.name);
    if (newName && newName.trim()) {
      try {
        await mediaAPI.updateFolder(contextMenu.folder.id, { name: newName.trim() });
        toast.success('Folder renamed');
        loadFolders();
      } catch (error) {
        toast.error('Failed to rename folder');
      }
    }
    setContextMenu(null);
  };

  const renderFolder = (folder, level = 0) => {
    const isExpanded = expanded.has(folder.id);
    const hasChildren = folder.children?.length > 0;
    const isSelected = currentFolder === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`group relative flex items-center px-2 py-1.5 rounded-lg cursor-pointer ${
            isSelected ? 'bg-[#00A3FF] text-white' : 'hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => onSelect(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder)}
        >
          <button
            onClick={(e) => toggleExpand(folder.id, e)}
            className="w-5 h-5 flex items-center justify-center"
          >
            {hasChildren ? (
              isExpanded ? 
                <ChevronDown size={14} className={isSelected ? 'text-white' : 'text-gray-400'} /> : 
                <ChevronRight size={14} className={isSelected ? 'text-white' : 'text-gray-400'} />
            ) : (
              <span className="w-4" />
            )}
          </button>
          
          {isExpanded ? (
            <FolderOpen size={16} className={`mr-2 ${isSelected ? 'text-white' : 'text-[#00A3FF]'}`} />
          ) : (
            <Folder size={16} className={`mr-2 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
          )}
          
          <span className="text-sm flex-1 truncate">{folder.name}</span>
          
          <span className={`text-xs mr-1 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
            {folder.file_count || 0}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, folder);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded"
          >
            <MoreVertical size={12} className={isSelected ? 'text-white' : 'text-gray-400'} />
          </button>
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
    <div className="space-y-2">
      {/* All Media */}
      <div
        className={`flex items-center px-2 py-1.5 rounded-lg cursor-pointer ${
          !currentFolder ? 'bg-[#00A3FF] text-white' : 'hover:bg-gray-100'
        }`}
        onClick={() => onSelect(null)}
      >
        <Folder size={16} className={`mr-2 ${!currentFolder ? 'text-white' : 'text-gray-400'}`} />
        <span className="text-sm flex-1">All Media</span>
      </div>

      {/* New Folder Button */}
      <button
        onClick={onNewFolder}
        className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 w-full rounded-lg hover:bg-gray-100"
      >
        <Plus size={16} className="text-[#00A3FF]" />
        New Folder
      </button>

      {/* Folder List */}
      <div className="mt-2">
        {loading ? (
          <div className="text-sm text-gray-400 px-2">Loading...</div>
        ) : folders.length === 0 ? (
          <div className="text-sm text-gray-400 px-2">No folders</div>
        ) : (
          folders.map(folder => renderFolder(folder))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-32"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={handleRename}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Rename
            </button>
            <button
              onClick={() => {
                onDeleteFolder(contextMenu.folder.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-gray-100"
            >
              Delete
            </button>
          </div>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
        </>
      )}
    </div>
  );
}