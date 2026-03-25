// src/pages/PlaylistBuilder.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragOverlay, useDroppable, useDraggable, rectIntersection
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Trash2, Clock, Eye, Save, Globe, CloudSun, Rss, Youtube,
  ListVideo, Image, Film, ArrowUp, ArrowDown, Pencil,
  ChevronDown, Info, Layers, Search,
  Monitor, X, Settings, Calendar, Upload,
  Maximize, BookOpenCheck, Wand2
} from 'lucide-react'
import { playlistsAPI, mediaAPI, widgetsAPI } from '../services/api'
import toast from 'react-hot-toast'

// ─── Constants ───────────────────────────────────────────────────────────────

const WIDGET_META = {
  clock:   { icon: Clock,    label: 'Clock',       desc: 'Digital or analog clock',  color: '#6366f1' },
  weather: { icon: CloudSun, label: 'Weather',      desc: 'Current weather',          color: '#0ea5e9' },
  rss:     { icon: Rss,      label: 'RSS Ticker',   desc: 'Scrolling news ticker',    color: '#f59e0b' },
  youtube: { icon: Youtube,  label: 'YouTube Live', desc: 'Embed YouTube stream',     color: '#ef4444' },
  webview: { icon: Globe,    label: 'Web Page',     desc: 'Embed any website URL',    color: '#10b981' },
}

function uid() {
  return 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
}

// ─── Zone Presets — canonical bounds per orientation ─────────────────────────

const ZONE_PRESETS = {
  'vertical': [
    { id: 'zone-main',         name: 'Main Zone',         bounds: { x: 0,  y: 0,  w: 100, h: 100 } },
  ],
  'horizontal': [
    { id: 'zone-left',         name: 'Left Zone',         bounds: { x: 0,  y: 0,  w: 50,  h: 100 } },
    { id: 'zone-right',        name: 'Right Zone',        bounds: { x: 50, y: 0,  w: 50,  h: 100 } },
  ],
  'top-bottom': [
    { id: 'zone-top',          name: 'Top Zone',          bounds: { x: 0,  y: 0,  w: 100, h: 50  } },
    { id: 'zone-bottom',       name: 'Bottom Zone',       bounds: { x: 0,  y: 50, w: 100, h: 50  } },
  ],
  'custom': [
    { id: 'zone-top',          name: 'Top Zone',          bounds: { x: 0,  y: 0,  w: 100, h: 50  } },
    { id: 'zone-bottom-left',  name: 'Bottom Left Zone',  bounds: { x: 0,  y: 50, w: 50,  h: 50  } },
    { id: 'zone-bottom-right', name: 'Bottom Right Zone', bounds: { x: 50, y: 50, w: 50,  h: 50  } },
  ],
  'pip': [
    { id: 'zone-main',         name: 'Main Zone',         bounds: { x: 0,  y: 0,  w: 100, h: 100 } },
    { id: 'zone-pip',          name: 'PIP Zone',          bounds: { x: 65, y: 60, w: 30,  h: 35  } },
  ],
}

function getZonesForLayout(layoutOrientation) {
  return ZONE_PRESETS[layoutOrientation || 'vertical'] || ZONE_PRESETS['vertical']
}

function getZonesForOrientation(ori) {
  return getZonesForLayout(ori)
}

function makeEmptyLayout(ori) {
  const zones = getZonesForLayout(ori)
  const items = {}
  const zoneBounds = {}
  zones.forEach(z => {
    items[z.id] = []
    zoneBounds[z.id] = z.bounds
  })
  return {
    id:          uid(),
    name:        'New Layout',
    orientation: ori,
    width:       1920,
    height:      1080,
    position:    0,
    zoneBounds,
    items,
  }
}

// ─── Shared renderItemContent (top-level so all components can use it) ────────

function renderItemContent(item) {
  if (!item) return null
  if (item.widget_type) {
    const meta = WIDGET_META[item.widget_type]
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
        <div className="text-center text-white">
          {meta?.icon && <meta.icon size={24} className="mx-auto mb-1 opacity-70" />}
          <p className="text-[10px] font-medium">{meta?.label || item.widget_type}</p>
        </div>
      </div>
    )
  }
  if (item.thumbnail_url) {
    return (
      <img
        src={item.thumbnail_url}
        alt={item.media_name || ''}
        className="w-full h-full object-cover"
      />
    )
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-200">
      <Image size={20} className="text-gray-400" />
    </div>
  )
}

// ─── ResizableCanvasItem ──────────────────────────────────────────────────────

function ResizableCanvasItem({ item, zoneId, layoutId, isSelected, onSelect, onRemove, onUpdateBounds, containerW, containerH }) {
  const bounds = item.bounds || { x: 0, y: 0, w: 100, h: 100 }
  const dragging = useRef(null)
  const resizing = useRef(null)

  const pct = (v, dim) => (v / dim) * 100

  const startInteraction = (e, mode) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(item.id)
    const startX = e.clientX
    const startY = e.clientY
    const sb = { ...bounds }
    if (mode === 'drag') dragging.current = { startX, startY, sb }
    else resizing.current = { type: mode, startX, startY, sb }

    const onMove = (e) => {
      const dx = pct(e.clientX - startX, containerW)
      const dy = pct(e.clientY - startY, containerH)
      if (dragging.current) {
        onUpdateBounds(item.id, zoneId, layoutId, {
          ...sb,
          x: Math.max(0, Math.min(100 - sb.w, sb.x + dx)),
          y: Math.max(0, Math.min(100 - sb.h, sb.y + dy)),
        })
        return
      }
      if (!resizing.current) return
      const nb = { ...sb }
      const MIN = 8
      switch (resizing.current.type) {
        case 'e':  nb.w = Math.max(MIN, sb.w + dx); break
        case 'w':  nb.x = sb.x + dx; nb.w = Math.max(MIN, sb.w - dx); break
        case 's':  nb.h = Math.max(MIN, sb.h + dy); break
        case 'n':  nb.y = sb.y + dy; nb.h = Math.max(MIN, sb.h - dy); break
        case 'se': nb.w = Math.max(MIN, sb.w + dx); nb.h = Math.max(MIN, sb.h + dy); break
        case 'sw': nb.x = sb.x + dx; nb.w = Math.max(MIN, sb.w - dx); nb.h = Math.max(MIN, sb.h + dy); break
        case 'ne': nb.w = Math.max(MIN, sb.w + dx); nb.y = sb.y + dy; nb.h = Math.max(MIN, sb.h - dy); break
        case 'nw': nb.x = sb.x + dx; nb.w = Math.max(MIN, sb.w - dx); nb.y = sb.y + dy; nb.h = Math.max(MIN, sb.h - dy); break
        default: break
      }
      nb.x = Math.max(0, Math.min(100 - nb.w, nb.x))
      nb.y = Math.max(0, Math.min(100 - nb.h, nb.y))
      nb.w = Math.min(100 - nb.x, nb.w)
      nb.h = Math.min(100 - nb.y, nb.h)
      onUpdateBounds(item.id, zoneId, layoutId, nb)
    }

    const onUp = () => {
      dragging.current = null
      resizing.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const isWidget = !!item.widget_type
  const meta = isWidget ? WIDGET_META[item.widget_type] : null
  const Icon = meta?.icon || (isWidget ? Globe : Image)

  const HANDLE_SIZE = 8
  const handles = [
    { id: 'n',  s: { top: -HANDLE_SIZE/2, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize', width: 30, height: HANDLE_SIZE } },
    { id: 's',  s: { bottom: -HANDLE_SIZE/2, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize', width: 30, height: HANDLE_SIZE } },
    { id: 'e',  s: { right: -HANDLE_SIZE/2, top: '50%', transform: 'translateY(-50%)', cursor: 'e-resize', width: HANDLE_SIZE, height: 30 } },
    { id: 'w',  s: { left: -HANDLE_SIZE/2, top: '50%', transform: 'translateY(-50%)', cursor: 'w-resize', width: HANDLE_SIZE, height: 30 } },
    { id: 'nw', s: { top: -4, left: -4, cursor: 'nw-resize', width: 10, height: 10, borderRadius: '50%' } },
    { id: 'ne', s: { top: -4, right: -4, cursor: 'ne-resize', width: 10, height: 10, borderRadius: '50%' } },
    { id: 'sw', s: { bottom: -4, left: -4, cursor: 'sw-resize', width: 10, height: 10, borderRadius: '50%' } },
    { id: 'se', s: { bottom: -4, right: -4, cursor: 'se-resize', width: 10, height: 10, borderRadius: '50%' } },
  ]

  return (
    <div
      style={{
        position: 'absolute',
        left: `${bounds.x}%`, top: `${bounds.y}%`,
        width: `${bounds.w}%`, height: `${bounds.h}%`,
        zIndex: isSelected ? 10 : 5
      }}
      onClick={e => { e.stopPropagation(); onSelect(item.id) }}
    >
      <div
        onMouseDown={e => startInteraction(e, 'drag')}
        style={{ width: '100%', height: '100%', cursor: 'move', userSelect: 'none', position: 'relative' }}
        className={`overflow-hidden rounded-sm ${
          isSelected
            ? 'outline outline-2 outline-yellow-400'
            : 'outline outline-1 outline-white/20 hover:outline-white/50'
        }`}
      >
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800/40">
            <Icon size={14} style={meta ? { color: meta.color } : {}} className={!meta ? 'text-gray-400' : ''} />
          </div>
        )}
        {isSelected && (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemove(item.id, zoneId, layoutId) }}
            style={{ position: 'absolute', top: 2, right: 2, zIndex: 20 }}
            className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
          ><X size={9} /></button>
        )}
      </div>
      {isSelected && handles.map(h => (
        <div
          key={h.id}
          onMouseDown={e => startInteraction(e, h.id)}
          style={{ position: 'absolute', ...h.s, background: 'rgba(250,204,21,0.9)', zIndex: 20 }}
        />
      ))}
    </div>
  )
}

// ─── CanvasZoneDropArea ───────────────────────────────────────────────────────

function CanvasZoneDropArea({ zone, layoutItem, isActive, onSelect, selectedItemId, onRemove, onUpdateBounds, containerW, containerH }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cvzone-${layoutItem?.id || 'none'}-${zone.id}`,
    data: { layoutId: layoutItem?.id, zoneId: zone.id }
  })

  const zoneItems = layoutItem?.items?.[zone.id] || []

  return (
    <div
      ref={setNodeRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
      className={`transition-all ${isActive ? 'ring-2 ring-blue-400 ring-inset' : ''} ${isOver ? 'ring-2 ring-blue-300 ring-inset' : ''}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: zoneItems.length === 0 ? '#f8fafc' : '#fff',
          backgroundImage: `linear-gradient(rgba(150,150,150,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(150,150,150,.06) 1px,transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />
      {zoneItems.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {isOver ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-full bg-blue-400/20 flex items-center justify-center" />
              <span className="text-[8px] text-blue-500 font-bold">Drop here</span>
            </div>
          ) : (
            <>
              <Layers size={14} className="text-gray-300" />
              <div className="text-[8px] text-gray-400 font-medium mt-1">{zone.name}</div>
            </>
          )}
        </div>
      )}
      {zoneItems.map(item => (
        <ResizableCanvasItem
          key={item.id}
          item={item}
          zoneId={zone.id}
          layoutId={layoutItem?.id}
          isSelected={selectedItemId === item.id}
          onSelect={onSelect}
          onRemove={onRemove}
          onUpdateBounds={onUpdateBounds}
          containerW={containerW}
          containerH={containerH}
        />
      ))}
      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/40 to-transparent pointer-events-none">
        <span className="text-white text-[7px] font-medium">{zone.name}</span>
      </div>
    </div>
  )
}

// ─── DraggableMediaCard ───────────────────────────────────────────────────────

function DraggableMediaCard({ media, onAdd }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `panel-media-${media.id}`,
    data: { source: 'panel', type: 'media', item: media }
  })
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 1000 : 'auto' }}
      onClick={() => !isDragging && onAdd(media)}
      className="group relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md select-none"
    >
      {media.thumbnail_url
        ? <img src={media.thumbnail_url} alt={media.name} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center bg-gray-50">
            {media.resource_type === 'video' ? <Film size={20} className="text-gray-300" /> : <Image size={20} className="text-gray-300" />}
          </div>
      }
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow"><Plus size={14} className="text-gray-800" /></div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-white text-[10px] truncate font-medium">{media.name}</p>
      </div>
    </div>
  )
}

// ─── DraggableWidgetCard ──────────────────────────────────────────────────────

function DraggableWidgetCard({ widget, onAdd }) {
  const meta = WIDGET_META[widget.widget_type] || {}
  const Icon = meta.icon || Globe
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `panel-widget-${widget.id || widget.widget_type}`,
    data: { source: 'panel', type: 'widget', item: widget }
  })
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      onClick={() => !isDragging && onAdd(widget)}
      className="group flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color || '#6366f1'}18` }}>
        <Icon size={16} style={{ color: meta.color || '#6366f1' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-800 truncate">{widget.name || meta.label || widget.widget_type}</div>
        <div className="text-[10px] text-gray-400 truncate">{meta.desc || 'Widget'}</div>
      </div>
      <Plus size={13} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
    </div>
  )
}

// ─── ZoneSettings Panel ───────────────────────────────────────────────────────

function ZoneSettings({ layout, zones, selectedItemId, onRemoveItem, onDurationChange, activeZone }) {
  const [tab, setTab] = useState('slides')

  if (!layout) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
        <Monitor size={32} className="text-gray-200" />
        <p className="text-sm font-semibold text-gray-400">No layout selected</p>
        <p className="text-xs text-gray-300">Click a layout card to begin</p>
      </div>
    )
  }

  const activeZoneItems = layout.items?.[activeZone] || []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          onClick={() => setTab('slides')}
          className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
            tab === 'slides' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >Slides</button>
        <button
          onClick={() => setTab('settings')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            tab === 'settings' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        ><Settings size={14} /></button>
        <button
          onClick={() => setTab('schedule')}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            tab === 'schedule' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        ><Calendar size={14} /></button>
        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors ml-auto">
          <Trash2 size={13} />
        </button>
      </div>

      {tab === 'slides' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeZoneItems.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-semibold text-gray-400">+ Drop Widgets &amp; Files</p>
            </div>
          ) : activeZoneItems.map((item, idx) => {
            const isWidget = !!item.widget_type
            const meta = isWidget ? WIDGET_META[item.widget_type] : null
            const MetaIcon = meta?.icon || Image
            const isSelected = selectedItemId === item.id

            return (
              <div
                key={item.id}
                className={`flex items-start gap-2 p-2.5 rounded-xl border transition-all ${
                  isSelected ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="w-14 h-12 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0 border border-gray-200">
                  {item.thumbnail_url
                    ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <MetaIcon size={16} style={meta ? { color: meta.color } : {}} className={!meta ? 'text-gray-400' : ''} />
                      </div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate leading-tight">
                    {item.media_name || meta?.label || 'Media'}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">
                    {isWidget ? 'Widget' : (item.resource_type || 'IMAGE')}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-1.5 py-0.5">
                      <Clock size={9} className="text-gray-400" />
                      <input
                        type="number" min={1} max={3600}
                        value={item.duration || 10}
                        onChange={e => onDurationChange(item.id, parseInt(e.target.value) || 10, activeZone, layout.id)}
                        className="w-7 bg-transparent border-0 text-[10px] text-gray-700 focus:outline-none text-center"
                      />
                      <span className="text-[9px] text-gray-400">sec</span>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id, activeZone, layout.id)}
                      className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-md hover:bg-red-600 transition-colors"
                    >Remove</button>
                  </div>
                </div>
                <div className="text-xs font-bold text-gray-300 flex-shrink-0 mt-0.5">{idx + 1}</div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Zone Name</label>
            <input
              defaultValue={zones.find(z => z.id === activeZone)?.name || ''}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs text-gray-400 text-center py-8">Schedule settings coming soon</p>
        </div>
      )}
    </div>
  )
}

// ─── Layout Thumbnail Card ────────────────────────────────────────────────────

function LayoutThumbCard({ layoutItem, isSelected, onSelect, onDelete }) {
  // Use the layout's OWN zones — not global orientation
  const layoutZones = getZonesForLayout(layoutItem.orientation || 'vertical')
  const allItems = Object.values(layoutItem.items || {}).flat()
  const totalDur = allItems.reduce((s, i) => s + (i.duration || 10), 0)
  const itemCount = allItems.length

  const getThumbGridStyle = () => {
    const ori = layoutItem.orientation || 'vertical'
    if (ori === 'horizontal') return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
    if (ori === 'top-bottom') return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }
    if (ori === 'custom')     return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
    if (ori === 'pip')        return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
    return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
  }

  return (
    <div
      onClick={onSelect}
      className={`relative flex-shrink-0 rounded-2xl border-2 overflow-hidden cursor-pointer transition-all bg-white ${
        isSelected ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
      style={{ width: 140 }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-blue-500 text-white text-[9px] font-bold px-3 py-0.5 rounded-b-lg whitespace-nowrap">{layoutItem.name}</div>
      </div>

      <div className="mt-6 mx-2 rounded-lg overflow-hidden border border-gray-100" style={{ height: 80 }}>
        <div
          className="w-full h-full"
          style={{
            display: 'grid',
            gap: '1px',
            background: '#e5e7eb',
            ...getThumbGridStyle()
          }}
        >
          {layoutZones.map((z, idx) => {
            const ori = layoutItem.orientation || 'vertical'
            const isTopSpan = ori === 'custom' && idx === 0
            const zItems = layoutItem.items?.[z.id] || []
            return (
              <div
                key={z.id}
                style={isTopSpan ? { gridColumn: '1 / -1' } : {}}
                className="bg-gray-100 overflow-hidden relative"
              >
                {zItems[0]?.thumbnail_url
                  ? <img src={zItems[0].thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <Image size={10} className="text-gray-300" />
                    </div>
                }
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-2 pt-1.5 pb-2.5 text-center">
        <div className="text-[11px] font-semibold text-gray-700">{itemCount} item{itemCount !== 1 ? 's' : ''}</div>
        <div className="text-[10px] text-gray-400 capitalize">{layoutItem.orientation || 'vertical'}</div>
        <div className="text-[10px] text-gray-400">{totalDur}s total</div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(layoutItem.id) }}
        className="absolute top-5 right-1.5 p-0.5 text-gray-300 hover:text-red-500 transition-colors"
      ><X size={11} /></button>
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ isOpen, onClose, layouts }) {
  const [selectedLayoutId, setSelectedLayoutId] = useState(null)

  useEffect(() => {
    if (layouts.length > 0 && !selectedLayoutId) {
      setSelectedLayoutId(layouts[0].id)
    }
  }, [layouts])

  if (!isOpen) return null

  const selectedLayout = layouts.find(l => l.id === selectedLayoutId) || layouts[0]
  const selectedOri = selectedLayout?.orientation || 'vertical'
  const selectedLayoutZones = getZonesForLayout(selectedOri)

  const getGridStyle = () => {
    if (selectedOri === 'horizontal') return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
    if (selectedOri === 'top-bottom') return { gridTemplateColumns: '1fr',     gridTemplateRows: '1fr 1fr' }
    if (selectedOri === 'custom')     return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
    if (selectedOri === 'pip')        return { gridTemplateColumns: '1fr',     gridTemplateRows: '1fr' }
    return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
  }

  const isPortrait = selectedOri !== 'horizontal'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Preview</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={18} /></button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
          {layouts.map(layout => (
            <button
              key={layout.id}
              onClick={() => setSelectedLayoutId(layout.id)}
              className={`px-4 py-2 text-xs font-bold rounded-full whitespace-nowrap transition-colors ${
                selectedLayoutId === layout.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{layout.name}</button>
          ))}
        </div>

        <div className="flex-1 p-6 bg-gray-100 overflow-auto flex items-center justify-center">
          <div
            className="bg-white rounded-lg shadow-2xl overflow-hidden border-8 border-gray-800"
            style={{
              width:  isPortrait ? 270 : 480,
              height: isPortrait ? 480 : 270,
            }}
          >
            <div className="w-full h-full" style={{ display: 'grid', gap: '2px', background: '#333', ...getGridStyle() }}>
              {selectedLayoutZones.map((zone, idx) => {
                const isTopSpan = selectedOri === 'custom' && idx === 0
                const zoneItems = selectedLayout?.items?.[zone.id] || []
                const currentItem = zoneItems[0] || null
                return (
                  <div
                    key={zone.id}
                    style={isTopSpan ? { gridColumn: '1 / -1' } : {}}
                    className="relative overflow-hidden bg-black"
                  >
                    {currentItem
                      ? renderItemContent(currentItem)
                      : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                          <p className="text-white text-xs opacity-30">{zone.name}</p>
                        </div>
                      )
                    }
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-300">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function PlaylistBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [name, setName] = useState('Untitled Playlist')
  const [editingName, setEditingName] = useState(false)
  const nameRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!id)
  const [showPreview, setShowPreview] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const [orientation, setOrientation] = useState('vertical')
  const [layouts, setLayouts] = useState([])
  const [selectedLayoutId, setSelectedLayoutId] = useState(null)
  const [activeZone, setActiveZone] = useState('zone-main')
  const [selectedItemId, setSelectedItemId] = useState(null)

  const [activePanel, setActivePanel] = useState('media')
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaType, setMediaType] = useState('all')
  const [mediaFiles, setMediaFiles] = useState([])
  const [widgetsList, setWidgetsList] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [loadingWidgets, setLoadingWidgets] = useState(false)
  const [dragActive, setDragActive] = useState(null)

  const canvasRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Derived — selected layout and its zones
  const selectedLayout = layouts.find(l => l.id === selectedLayoutId) || layouts[0]
  const selectedOri = selectedLayout?.orientation || orientation
  const selectedLayoutZones = getZonesForLayout(selectedOri)

  // Canvas dimensions based on selected layout orientation
  const isPortrait = selectedOri !== 'horizontal'
  const CANVAS_W = isPortrait ? 240 : 420
  const CANVAS_H = isPortrait ? 427 : 236

  const canvasGridStyle = {
    display:             'grid',
    gap:                 '2px',
    background:          '#d1d5db',
    gridTemplateColumns: selectedOri === 'horizontal' ? '1fr 1fr'
                       : selectedOri === 'top-bottom' ? '1fr'
                       : selectedOri === 'custom'     ? '1fr 1fr'
                       : selectedOri === 'pip'        ? '1fr'
                       : '1fr',
    gridTemplateRows:    selectedOri === 'horizontal' ? '1fr'
                       : selectedOri === 'top-bottom' ? '1fr 1fr'
                       : selectedOri === 'custom'     ? '1fr 1fr'
                       : selectedOri === 'pip'        ? '1fr'
                       : '1fr',
  }

  // ── Initialize empty layout for new playlist ──────────────────────────────
  useEffect(() => {
    if (!id && !initialized) {
      const emptyLayout = makeEmptyLayout('vertical')
      setLayouts([emptyLayout])
      setSelectedLayoutId(emptyLayout.id)
      setActiveZone('zone-main')
      setOrientation('vertical')
      setInitialized(true)
      setLoading(false)
    }
  }, [id, initialized])

  useEffect(() => {
    if (id) fetchPlaylist()
  }, [id])

  useEffect(() => { fetchMedia() }, [])

  useEffect(() => {
    const timer = setTimeout(fetchMedia, 300)
    return () => clearTimeout(timer)
  }, [mediaSearch, mediaType])

  useEffect(() => {
    if (activePanel === 'widgets' && widgetsList.length === 0) fetchWidgets()
  }, [activePanel])

  // ── Fetch playlist ────────────────────────────────────────────────────────
  const fetchPlaylist = async () => {
    setLoading(true)
    try {
      const res = await playlistsAPI.getOne(id)
      const d = res.data

      setName(d.name || 'Untitled Playlist')
      const ori = d.layout_type || 'vertical'
      setOrientation(ori)

      if (d.layouts && d.layouts.length > 0) {
        const itemsByLayout = d.items_by_layout || {}

        const loadedLayouts = d.layouts.map((layout, index) => {
          const layoutOri = layout.orientation || ori
          const layoutZones = getZonesForLayout(layoutOri)

          // Restore zone bounds: stored > canonical
          const canonicalZoneBounds = Object.fromEntries(layoutZones.map(z => [z.id, z.bounds]))
          let storedZoneBounds = {}
          try {
            const zb = layout.zone_bounds
            if (zb) storedZoneBounds = typeof zb === 'string' ? JSON.parse(zb) : zb
          } catch (e) {}
          const zoneBounds = { ...canonicalZoneBounds, ...storedZoneBounds }

          const layoutItems = itemsByLayout[layout.id] || {}

          // Build items per zone for THIS layout's orientation
          const normalizedItems = {}
          layoutZones.forEach(z => {
            normalizedItems[z.id] = (layoutItems[z.id] || []).map(item => ({
              id:            item.id || uid(),
              media_id:      item.media_id      || null,
              widget_id:     item.widget_id     || null,
              widget_type:   item.widget_type   || null,
              widget_config: item.widget_config || {},
              item_type:     item.item_type     || (item.widget_type ? 'widget' : 'media'),
              duration:      item.duration      || 10,
              bounds:        item.bounds        || { x: 0, y: 0, w: 100, h: 100 },
              media_name:    item.media_name    || null,
              secure_url:    item.secure_url    || null,
              thumbnail_url: item.thumbnail_url || null,
              resource_type: item.resource_type || null,
            }))
          })

          return {
            id:          layout.id,
            name:        layout.name || `Layout ${index + 1}`,
            orientation: layoutOri,
            width:       layout.width  || 1920,
            height:      layout.height || 1080,
            position:    index,
            zoneBounds,
            items:       normalizedItems,
          }
        })

        setLayouts(loadedLayouts)
        setSelectedLayoutId(loadedLayouts[0]?.id)
        const firstZones = getZonesForLayout(loadedLayouts[0]?.orientation || ori)
        setActiveZone(firstZones[0]?.id || 'zone-main')
      } else {
        const defaultLayout = makeEmptyLayout(ori)
        setLayouts([defaultLayout])
        setSelectedLayoutId(defaultLayout.id)
        const zones = getZonesForLayout(ori)
        setActiveZone(zones[0]?.id || 'zone-main')
      }

      setInitialized(true)
    } catch (error) {
      console.error('❌ Failed to load playlist:', error)
      toast.error('Failed to load playlist')
    } finally {
      setLoading(false)
    }
  }

  const fetchMedia = async () => {
    setLoadingMedia(true)
    try {
      const params = { limit: 60 }
      if (mediaSearch) params.search = mediaSearch
      if (mediaType !== 'all') params.type = mediaType
      const res = await mediaAPI.getAll(params)
      setMediaFiles(res.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMedia(false)
    }
  }

  const fetchWidgets = async () => {
    setLoadingWidgets(true)
    try {
      const res = await widgetsAPI.getAll({ limit: 60 })
      setWidgetsList(res.data || [])
    } catch {
      setWidgetsList(Object.entries(WIDGET_META).map(([type, m]) => ({
        id: `def-${type}`,
        name: m.label,
        widget_type: type
      })))
    } finally {
      setLoadingWidgets(false)
    }
  }

  // ── Layout management ─────────────────────────────────────────────────────

  const addNewLayout = (layoutOrientation = 'vertical') => {
    const l = makeEmptyLayout(layoutOrientation)
    setLayouts(prev => [...prev, l])
    setSelectedLayoutId(l.id)
    const zones = getZonesForLayout(layoutOrientation)
    setActiveZone(zones[0].id)
    toast.success(`Layout added (${layoutOrientation})`)
  }

  const changeLayoutOrientation = (newOri) => {
    if (!selectedLayoutId) return
    const newZones = getZonesForLayout(newOri)
    const newZoneBounds = Object.fromEntries(newZones.map(z => [z.id, z.bounds]))
    const newItems = Object.fromEntries(newZones.map(z => [z.id, []]))

    setLayouts(prev => prev.map(l => {
      if (l.id !== selectedLayoutId) return l
      return {
        ...l,
        orientation: newOri,
        zoneBounds:  newZoneBounds,
        items:       newItems,
      }
    }))
    setActiveZone(newZones[0].id)
    toast('Zone layout changed — items reset for this layout')
  }

  const deleteLayout = (layoutId) => {
    if (layouts.length === 1) { toast.error('At least one layout required'); return }
    const remaining = layouts.filter(l => l.id !== layoutId)
    setLayouts(remaining)
    if (selectedLayoutId === layoutId) {
      const nextLayout = remaining[0]
      setSelectedLayoutId(nextLayout?.id || null)
      const nextZones = getZonesForLayout(nextLayout?.orientation || orientation)
      setActiveZone(nextZones[0]?.id || 'zone-main')
    }
  }

  // ── Media / Widget add ────────────────────────────────────────────────────

  const addMediaToActive = useCallback((media) => {
    const layoutId = selectedLayoutId || layouts[0]?.id
    if (!layoutId) return

    setLayouts(prev => prev.map(l => {
      if (l.id !== layoutId) return l
      const zoneItems = l.items?.[activeZone] || []
      const newItem = {
        id:            uid(),
        media_id:      media.id,
        media_name:    media.name,
        thumbnail_url: media.thumbnail_url,
        secure_url:    media.secure_url,
        resource_type: media.resource_type,
        duration:      media.resource_type === 'video' ? Math.round(media.duration || 10) : 10,
        bounds:        { x: 0, y: 0, w: 100, h: 100 },
        item_type:     'media',
      }
      return { ...l, items: { ...l.items, [activeZone]: [...zoneItems, newItem] } }
    }))
  }, [selectedLayoutId, layouts, activeZone])

  const addWidgetToActive = useCallback((widget) => {
    const layoutId = selectedLayoutId || layouts[0]?.id
    if (!layoutId) return

    const meta = WIDGET_META[widget.widget_type] || {}
    setLayouts(prev => prev.map(l => {
      if (l.id !== layoutId) return l
      const zoneItems = l.items?.[activeZone] || []
      const newItem = {
        id:            uid(),
        widget_type:   widget.widget_type,
        widget_config: widget.config || {},
        widget_id:     widget.id || null,
        media_name:    widget.name || meta.label || widget.widget_type,
        resource_type: 'widget',
        duration:      15,
        bounds:        { x: 0, y: 0, w: 100, h: 100 },
        item_type:     'widget',
      }
      return { ...l, items: { ...l.items, [activeZone]: [...zoneItems, newItem] } }
    }))
  }, [selectedLayoutId, layouts, activeZone])

  const removeItem = useCallback((itemId, zoneId, layoutId) => {
    setLayouts(prev => prev.map(l => {
      if (l.id !== layoutId) return l
      return { ...l, items: { ...l.items, [zoneId]: (l.items?.[zoneId] || []).filter(i => i.id !== itemId) } }
    }))
    if (selectedItemId === itemId) setSelectedItemId(null)
  }, [selectedItemId])

  const changeDuration = useCallback((itemId, duration, zoneId, layoutId) => {
    setLayouts(prev => prev.map(l => {
      if (l.id !== layoutId) return l
      return { ...l, items: { ...l.items, [zoneId]: (l.items?.[zoneId] || []).map(i => i.id === itemId ? { ...i, duration } : i) } }
    }))
  }, [])

  const updateItemBounds = useCallback((itemId, zoneId, layoutId, bounds) => {
    setLayouts(prev => prev.map(l => {
      if (l.id !== layoutId) return l
      return { ...l, items: { ...l.items, [zoneId]: (l.items?.[zoneId] || []).map(i => i.id === itemId ? { ...i, bounds } : i) } }
    }))
  }, [])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => setDragActive(active)

  const handleDragEnd = useCallback(({ active, over }) => {
    setDragActive(null)
    if (!over) return
    const activeData = active.data.current
    const overData = over.data?.current
    if (!activeData || !overData?.layoutId || !overData?.zoneId) return

    if (activeData.source === 'panel') {
      setSelectedLayoutId(overData.layoutId)
      setActiveZone(overData.zoneId)
      if (activeData.type === 'media') addMediaToActive(activeData.item)
      else if (activeData.type === 'widget') addWidgetToActive(activeData.item)
    }
  }, [addMediaToActive, addWidgetToActive])

  // ── Save ──────────────────────────────────────────────────────────────────

  const doSave = async () => {
    if (!name.trim()) { toast.error('Playlist name required'); return null }

    setSaving(true)
    try {
      const allItems = []

      layouts.forEach((layout, layoutIdx) => {
        const layoutZones = getZonesForLayout(layout.orientation || 'vertical')
        const canonicalZoneBounds = Object.fromEntries(layoutZones.map(z => [z.id, z.bounds]))
        const resolvedZoneBounds = { ...canonicalZoneBounds, ...(layout.zoneBounds || {}) }

        Object.entries(layout.items || {}).forEach(([zoneId, zoneItems]) => {
          const zoneBounds = resolvedZoneBounds[zoneId] || { x: 0, y: 0, w: 100, h: 100 }

          zoneItems.forEach((item, itemIdx) => {
            const position = (layoutIdx * 1000) + (itemIdx * 10)

            const widgetConfig = {
              ...(item.widget_config || {}),
              zoneId,
              layoutId:    layout.id,
              zoneBounds,                                            // zone position 0-100
              bounds:      item.bounds || { x: 0, y: 0, w: 100, h: 100 },
              mediaName:    item.media_name    || null,
              thumbnailUrl: item.thumbnail_url || null,
              secureUrl:    item.secure_url    || null,
              resourceType: item.resource_type || null,
            }

            allItems.push({
              mediaId:    item.media_id    || null,
              widgetId:   item.widget_id   || null,
              widgetType: item.widget_type || null,
              widgetConfig,
              position,
              duration: item.duration || 10,
            })
          })
        })
      })

      const payload = {
        name:        name.trim(),
        layout_type: orientation,
        layouts: layouts.map((l, i) => {
          const layoutZones = getZonesForLayout(l.orientation || 'vertical')
          const canonicalZoneBounds = Object.fromEntries(layoutZones.map(z => [z.id, z.bounds]))
          return {
            id:          l.id,
            name:        l.name || `Layout ${i + 1}`,
            orientation: l.orientation || orientation,
            width:       l.width  || 1920,
            height:      l.height || 1080,
            position:    i,
            zone_bounds: { ...canonicalZoneBounds, ...(l.zoneBounds || {}) },
          }
        }),
      }

      let finalId = id
      if (!id) {
        const res = await playlistsAPI.create(payload)
        finalId = res.data.id
        navigate(`/playlists/${finalId}/builder`, { replace: true })
      } else {
        await playlistsAPI.update(id, payload)
      }

      await playlistsAPI.updateItems(finalId, { items: allItems })
      toast.success(id ? 'Playlist updated!' : 'Playlist created!')
      return finalId
    } catch (err) {
      console.error('❌ Save failed:', err)
      toast.error(err?.response?.data?.message || 'Failed to save')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => { await doSave() }
  const handleNext = async () => {
    const savedId = await doSave()
    if (savedId) navigate(`/playlists/${savedId}/publish`)
  }

  // ── Loading screen ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col" style={{ background: '#e8f0fe' }}>

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0 z-20" style={{ minHeight: 48 }}>

          {/* Left: Exit + playlist name */}
          <div className="flex items-center gap-2">
            <Link to="/playlists">
              <button className="px-4 py-1.5 bg-red-500 text-white text-xs font-bold rounded-full hover:bg-red-600 transition-colors">
                Exit
              </button>
            </Link>
            {editingName ? (
              <input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                className="bg-gray-800 text-white text-sm font-medium px-3 py-1.5 rounded-full border border-blue-500 focus:outline-none min-w-[180px]"
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setEditingName(true); setTimeout(() => nameRef.current?.select(), 30) }}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white text-sm font-semibold rounded-full hover:bg-gray-700 transition-colors"
              >
                {name || 'Untitled Playlist'}
                <Pencil size={11} className="text-gray-400" />
              </button>
            )}
          </div>

          {/* Center: per-layout zone orientation picker + New Layout */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Layout zones:</span>
            {[
              { k: 'vertical',   l: 'Full' },
              { k: 'horizontal', l: 'Left/Right' },
              { k: 'top-bottom', l: 'Top/Bottom' },
              { k: 'custom',     l: '3-Zone' },
              { k: 'pip',        l: 'PIP' },
            ].map(ori => (
              <button
                key={ori.k}
                onClick={() => changeLayoutOrientation(ori.k)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                  selectedLayout?.orientation === ori.k
                    ? 'bg-yellow-400 text-gray-900 shadow'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {ori.l}
              </button>
            ))}
            <button
              onClick={() => addNewLayout('vertical')}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-700 text-gray-200 text-xs font-bold rounded-full hover:bg-gray-600 transition-colors"
            >
              <Plus size={12} />New Layout
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-700 text-gray-200 text-xs font-bold rounded-full hover:bg-gray-600 transition-colors">
              <Wand2 size={12} />Auto Align
            </button>
          </div>

          {/* Right: Read Docs + Preview + Save + Next */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-colors">
              <BookOpenCheck size={12} />Read Docs
              <Info size={11} className="opacity-70" />
            </button>

            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-full hover:bg-purple-700 transition-colors"
            >
              <Eye size={12} />Preview
            </button>

            <div className="flex items-center bg-yellow-400 rounded-full overflow-hidden">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-gray-900 text-xs font-bold hover:bg-yellow-300 disabled:opacity-60 transition-colors"
              >
                {saving
                  ? <div className="w-3 h-3 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  : <Save size={12} />
                }
                Save
              </button>
              <div className="w-px h-4 bg-yellow-300" />
              <button className="px-2 py-1.5 text-gray-900 hover:bg-yellow-300 transition-colors">
                <ChevronDown size={12} />
              </button>
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-green-500 text-white text-xs font-bold rounded-full hover:bg-green-600 disabled:opacity-60 transition-colors"
            >
              {saving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Next →
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left Panel ── */}
          <aside className="flex flex-col bg-white border-r border-gray-200 flex-shrink-0" style={{ width: 380 }}>

            {/* Tab row */}
            <div className="flex items-center border-b border-gray-200 bg-white px-3 pt-3 pb-0 gap-1">
              {[
                { k: 'media',     l: 'Media' },
                { k: 'widgets',   l: 'Widgets' },
                { k: 'sequences', l: 'Sequences' },
              ].map(({ k, l }) => (
                <button
                  key={k}
                  onClick={() => setActivePanel(k)}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border ${
                    activePanel === k
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >{l}</button>
              ))}
            </div>

            {/* Search + Upload */}
            <div className="flex items-center gap-2 p-2.5 border-b border-gray-100">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={mediaSearch}
                  onChange={e => setMediaSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap">
                <Upload size={11} />+ Upload
              </button>
            </div>

            {/* Media type filter */}
            {activePanel === 'media' && (
              <div className="flex items-center justify-between gap-1 px-2.5 py-2 border-b border-gray-100">
                <div className="flex items-center gap-1">
                  {[
                    { k: 'all',    l: 'All' },
                    { k: 'image',  l: 'Images' },
                    { k: 'video',  l: 'Videos' },
                    { k: 'folder', l: 'Folders' },
                  ].map(({ k, l }) => (
                    <button
                      key={k}
                      onClick={() => setMediaType(k)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors ${
                        mediaType === k ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >{l}</button>
                  ))}
                </div>
                <button className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 text-[11px] font-semibold rounded-full hover:bg-gray-200 transition-colors whitespace-nowrap">
                  <Plus size={10} />Design
                </button>
              </div>
            )}

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-2.5">
              {activePanel === 'media' && (
                loadingMedia ? (
                  <div className="flex justify-center py-16">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : mediaFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Image size={36} className="text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">No media found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {mediaFiles.map(m => (
                      <DraggableMediaCard key={m.id} media={m} onAdd={addMediaToActive} />
                    ))}
                  </div>
                )
              )}

              {activePanel === 'widgets' && (
                loadingWidgets ? (
                  <div className="flex justify-center py-16">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : widgetsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Globe size={36} className="text-gray-200 mb-2" />
                    <p className="text-xs text-gray-400">No widgets found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {widgetsList.map(w => (
                      <DraggableWidgetCard key={w.id || w.widget_type} widget={w} onAdd={addWidgetToActive} />
                    ))}
                  </div>
                )
              )}

              {activePanel === 'sequences' && (
                <div className="flex flex-col items-center justify-center py-16">
                  <ListVideo size={36} className="text-gray-200 mb-2" />
                  <p className="text-xs text-gray-400">No sequences yet</p>
                </div>
              )}
            </div>
          </aside>

          {/* ── Center Canvas ── */}
          <main
            className="flex-1 flex flex-col overflow-hidden"
            style={{ background: '#e8f0fe' }}
            onClick={() => setSelectedItemId(null)}
          >
            <div className="flex-1 overflow-auto flex flex-col items-center pb-6">

              {/* Canvas top controls */}
              <div className="flex items-center gap-2 mt-5 mb-3">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-full hover:bg-blue-600 transition-colors shadow-sm">
                  <Maximize size={11} />Full Screen
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-full hover:bg-green-600 transition-colors shadow-sm">
                  <ArrowUp size={11} />Forward
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-400 text-white text-xs font-bold rounded-full hover:bg-orange-500 transition-colors shadow-sm">
                  <ArrowDown size={11} />Backward
                </button>
              </div>

              {/* Canvas — uses selectedLayoutZones (per-layout) */}
              <div
                ref={canvasRef}
                style={{ width: CANVAS_W, height: CANVAS_H, ...canvasGridStyle }}
                className="shadow-2xl rounded border border-gray-300 overflow-hidden"
              >
                {selectedLayoutZones.map((zone, idx) => {
                  const isTopSpan = selectedOri === 'custom' && idx === 0
                  return (
                    <div
                      key={zone.id}
                      style={{
                        ...(isTopSpan ? { gridColumn: '1 / -1' } : {}),
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onClick={e => { e.stopPropagation(); setActiveZone(zone.id) }}
                    >
                      <CanvasZoneDropArea
                        zone={zone}
                        layoutItem={selectedLayout}
                        isActive={activeZone === zone.id}
                        onSelect={setSelectedItemId}
                        selectedItemId={selectedItemId}
                        onRemove={removeItem}
                        onUpdateBounds={updateItemBounds}
                        containerW={CANVAS_W / (selectedOri === 'horizontal' ? 2 : 1)}
                        containerH={CANVAS_H / (selectedOri === 'top-bottom' || selectedOri === 'custom' ? 2 : 1)}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Layout cards row — each card uses its OWN zones */}
              <div className="flex items-start gap-3 mt-6 px-4 flex-wrap justify-center">
                {layouts.map(layoutItem => (
                  <LayoutThumbCard
                    key={layoutItem.id}
                    layoutItem={layoutItem}
                    isSelected={selectedLayoutId === layoutItem.id}
                    onSelect={() => {
                      setSelectedLayoutId(layoutItem.id)
                      const zones = getZonesForLayout(layoutItem.orientation || orientation)
                      setActiveZone(zones[0]?.id || 'zone-main')
                    }}
                    onDelete={deleteLayout}
                  />
                ))}

                {/* Add layout card */}
                <button
                  onClick={() => addNewLayout('vertical')}
                  className="flex-shrink-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-2xl bg-white/60 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                  style={{ width: 140, height: 140 }}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center">
                    <Plus size={18} className="text-gray-400 group-hover:text-blue-500" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400 group-hover:text-blue-500">Add Layout</span>
                </button>
              </div>
            </div>
          </main>

          {/* ── Right Panel ── */}
          <aside className="flex flex-col bg-white border-l border-gray-200 flex-shrink-0" style={{ width: 340 }}>
            <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800">Zone Settings</h3>
              {selectedLayout && (
                <span className="ml-2 text-[10px] text-gray-400 capitalize">
                  — {selectedLayout.orientation || 'vertical'}
                </span>
              )}
            </div>

            {/* Zone tab selector — shows zones for selected layout */}
            {selectedLayout && selectedLayoutZones.length > 1 && (
              <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto">
                {selectedLayoutZones.map(zone => (
                  <button
                    key={zone.id}
                    onClick={() => setActiveZone(zone.id)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${
                      activeZone === zone.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {zone.name}
                  </button>
                ))}
              </div>
            )}

            <ZoneSettings
              layout={selectedLayout}
              zones={selectedLayoutZones}
              selectedItemId={selectedItemId}
              onRemoveItem={removeItem}
              onDurationChange={changeDuration}
              activeZone={activeZone}
            />
          </aside>
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        layouts={layouts}
      />

      {/* Drag Overlay */}
      <DragOverlay>
        {dragActive && (
          <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-blue-500 shadow-2xl bg-white">
            {dragActive.data.current?.item?.thumbnail_url ? (
              <img src={dragActive.data.current.item.thumbnail_url} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image size={24} className="text-blue-500" />
              </div>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}