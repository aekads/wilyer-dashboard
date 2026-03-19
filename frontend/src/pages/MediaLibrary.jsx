// src/pages/MediaLibrary.jsx
// ============================================================
// AEKADS Media Library — Media Files + Widgets
// Fully Responsive Design with Perfect Styling
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image, Video, Upload, Search, Trash2, X, Film,
  CheckSquare, Square, Folder, FolderOpen, ChevronRight, ChevronDown,
  Grid3x3, List, Plus, Move, Download, Copy, MoreHorizontal, Info,
  Clock, Cloud, Rss, Globe, MessageSquare, Hash, QrCode,
  Share2, TrendingUp, Youtube, Presentation, Code, Timer,
  Map, Layers, LayoutGrid, Eye, EyeOff, Star, AlertTriangle,
  RefreshCw, Pencil, Settings, Loader2, Check, MoreVertical,
  Zap, Layout, SortAsc, Palette, Menu
} from 'lucide-react';
import { mediaAPI, widgetsAPI } from '../services/api';
import { formatBytes, formatDate } from '../utils';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const ACCEPT = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'video/*': ['.mp4', '.webm', '.mov']
};
const MEDIA_LIMIT = 30;

const WIDGET_CATALOGUE = [
  { type: 'clock',          label: 'Clock',          icon: Clock,        color: '#3B82F6', bg: '#EFF6FF', desc: 'Digital clock with timezone' },
  { type: 'weather',        label: 'Weather',         icon: Cloud,        color: '#0EA5E9', bg: '#F0F9FF', desc: 'Live weather & forecast' },
  { type: 'rss_feed',       label: 'RSS Feed',        icon: Rss,          color: '#F97316', bg: '#FFF7ED', desc: 'Live news from any feed' },
  { type: 'web_url',        label: 'Web Page',        icon: Globe,        color: '#10B981', bg: '#ECFDF5', desc: 'Embed any website' },
  { type: 'notice_board',   label: 'Notice Board',    icon: MessageSquare,color: '#8B5CF6', bg: '#F5F3FF', desc: 'Scrolling notices' },
  { type: 'live_counter',   label: 'Live Counter',    icon: Hash,         color: '#EC4899', bg: '#FDF4FF', desc: 'Animated counter' },
  { type: 'qr_code',        label: 'QR Code',         icon: QrCode,       color: '#374151', bg: '#F9FAFB', desc: 'QR code for any URL' },
  { type: 'social_feed',    label: 'Social Feed',     icon: Share2,       color: '#06B6D4', bg: '#ECFEFF', desc: 'Twitter / Instagram' },
  { type: 'stock_ticker',   label: 'Stock Ticker',    icon: TrendingUp,   color: '#059669', bg: '#ECFDF5', desc: 'Live market data' },
  { type: 'youtube',        label: 'YouTube',         icon: Youtube,      color: '#EF4444', bg: '#FEF2F2', desc: 'Autoplay YouTube video' },
  { type: 'google_slides',  label: 'Google Slides',   icon: Presentation, color: '#F59E0B', bg: '#FFFBEB', desc: 'Slides presentation' },
  { type: 'custom_html',    label: 'Custom HTML',     icon: Code,         color: '#7C3AED', bg: '#F5F3FF', desc: 'HTML / CSS / JS widget' },
  { type: 'countdown',      label: 'Countdown',       icon: Timer,        color: '#F43F5E', bg: '#FFF1F2', desc: 'Countdown timer' },
  { type: 'google_traffic', label: 'Traffic Map',     icon: Map,          color: '#14B8A6', bg: '#F0FDFA', desc: 'Live traffic map' },
];

const WIDGET_TYPE_MAP = Object.fromEntries(WIDGET_CATALOGUE.map(w => [w.type, w]));

const WIDGET_DEFAULTS = {
  clock:          { timezone: 'UTC', format: '12h', showDate: true, showSeconds: true, dateFormat: 'dddd, MMMM D YYYY' },
  weather:        { city: '', country: 'US', unit: 'celsius', showForecast: true, days: 3, showHumidity: true, showWind: true },
  rss_feed:       { url: '', maxItems: 5, scrollSpeed: 50, showImages: true, showDate: true, autoScroll: true },
  web_url:        { url: '', zoom: 1.0, scrollable: false, reloadInterval: 300 },
  notice_board:   { messages: [], scrollDirection: 'up', speed: 40, showBullets: true, bulletColor: '#3B82F6' },
  live_counter:   { label: 'Count', count: 0, unit: '', prefix: '', suffix: '', animateOnLoad: true },
  qr_code:        { url: '', size: 300, errorLevel: 'M', label: '', showLabel: true, foregroundColor: '#000000', backgroundColor: '#FFFFFF' },
  social_feed:    { platform: 'twitter', username: '', hashtag: '', maxPosts: 6 },
  stock_ticker:   { symbols: ['AAPL', 'GOOG', 'MSFT'], currency: 'USD', showChange: true, showPercent: true, scrollSpeed: 40 },
  youtube:        { videoId: '', autoplay: true, muted: true, loop: true, showControls: false, startAt: 0 },
  google_slides:  { presentationId: '', autoAdvance: true, slideInterval: 10, loop: true },
  custom_html:    { html: '<div style="color:white;padding:20px">Custom Widget</div>', css: '', js: '', sandboxed: true },
  countdown:      { targetDate: '', label: 'Countdown', showDays: true, showHours: true, showMinutes: true, showSeconds: true, expiredMessage: 'Time is up!' },
  google_traffic: { lat: 0, lon: 0, zoom: 12, showControls: false },
};

// ─────────────────────────────────────────────────────────────
// Shared UI helpers with responsive styling
// ─────────────────────────────────────────────────────────────
function Input({ label, value, onChange, placeholder, type = 'text', required, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>}
      <input 
        type={type} 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder} 
        required={required}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-slate-300"
      />
    </div>
  );
}

function Select({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>}
      <select 
        value={value} 
        onChange={onChange}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all hover:border-slate-300 appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <button 
        type="button" 
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-blue-500' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Widget Config Forms (unchanged but with responsive containers)
// ─────────────────────────────────────────────────────────────
function WidgetConfigForm({ type, config, onChange }) {
  const set = (key) => (e) => onChange({ ...config, [key]: e.target?.value ?? e });
  const setToggle = (key) => (val) => onChange({ ...config, [key]: val });

  switch (type) {
    case 'clock': return (
      <div className="space-y-4">
        <Select label="Timezone" value={config.timezone} onChange={set('timezone')} options={[
          { value: 'UTC', label: 'UTC' },
          { value: 'America/New_York', label: 'New York (EST)' },
          { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
          { value: 'Europe/London', label: 'London (GMT)' },
          { value: 'Europe/Paris', label: 'Paris (CET)' },
          { value: 'Asia/Kolkata', label: 'India (IST)' },
          { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
          { value: 'Asia/Dubai', label: 'Dubai (GST)' },
          { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
        ]} />
        <Select label="Format" value={config.format} onChange={set('format')} options={[
          { value: '12h', label: '12 Hour (AM/PM)' },
          { value: '24h', label: '24 Hour' },
        ]} />
        <Toggle label="Show Date" checked={config.showDate} onChange={setToggle('showDate')} />
        <Toggle label="Show Seconds" checked={config.showSeconds} onChange={setToggle('showSeconds')} />
        {config.showDate && <Input label="Date Format" value={config.dateFormat} onChange={set('dateFormat')} placeholder="dddd, MMMM D YYYY" />}
      </div>
    );
    case 'weather': return (
      <div className="space-y-4">
        <Input label="City" value={config.city} onChange={set('city')} placeholder="e.g. New York" required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Country Code" value={config.country} onChange={set('country')} placeholder="US" />
          <Select label="Unit" value={config.unit} onChange={set('unit')} options={[
            { value: 'celsius', label: 'Celsius (°C)' },
            { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
          ]} />
        </div>
        <Toggle label="Show Forecast" checked={config.showForecast} onChange={setToggle('showForecast')} />
        {config.showForecast && (
          <Select label="Forecast Days" value={config.days} onChange={(e) => onChange({ ...config, days: parseInt(e.target.value) })} options={[
            { value: 1, label: '1 Day' }, { value: 3, label: '3 Days' }, { value: 5, label: '5 Days' }
          ]} />
        )}
        <Toggle label="Show Humidity" checked={config.showHumidity} onChange={setToggle('showHumidity')} />
        <Toggle label="Show Wind Speed" checked={config.showWind} onChange={setToggle('showWind')} />
      </div>
    );
    case 'rss_feed': return (
      <div className="space-y-4">
        <Input label="RSS Feed URL" value={config.url} onChange={set('url')} placeholder="https://feeds.bbci.co.uk/news/rss.xml" required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max Items</label>
            <input type="number" min={1} max={20} value={config.maxItems} onChange={(e) => onChange({ ...config, maxItems: parseInt(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Scroll Speed</label>
            <input type="range" min={10} max={100} value={config.scrollSpeed} onChange={(e) => onChange({ ...config, scrollSpeed: parseInt(e.target.value) })} className="w-full mt-2 accent-blue-500" />
            <span className="text-xs text-slate-400">{config.scrollSpeed}px/s</span>
          </div>
        </div>
        <Toggle label="Auto Scroll" checked={config.autoScroll} onChange={setToggle('autoScroll')} />
        <Toggle label="Show Images" checked={config.showImages} onChange={setToggle('showImages')} />
        <Toggle label="Show Date" checked={config.showDate} onChange={setToggle('showDate')} />
      </div>
    );
    case 'web_url': return (
      <div className="space-y-4">
        <Input label="URL" value={config.url} onChange={set('url')} placeholder="https://example.com" required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Zoom Level</label>
            <input type="range" min={0.5} max={2} step={0.1} value={config.zoom} onChange={(e) => onChange({ ...config, zoom: parseFloat(e.target.value) })} className="w-full mt-2 accent-blue-500" />
            <span className="text-xs text-slate-400">{config.zoom}x</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Reload Every</label>
            <select value={config.reloadInterval} onChange={(e) => onChange({ ...config, reloadInterval: parseInt(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}>
              <option value={0}>Never</option>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={600}>10 min</option>
              <option value={1800}>30 min</option>
              <option value={3600}>1 hour</option>
            </select>
          </div>
        </div>
        <Toggle label="Scrollable" checked={config.scrollable} onChange={setToggle('scrollable')} />
      </div>
    );
    case 'notice_board': return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Messages</label>
          {(config.messages || []).map((msg, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={msg.text || msg} onChange={(e) => {
                const msgs = [...(config.messages || [])];
                msgs[i] = { ...(typeof msg === 'object' ? msg : {}), text: e.target.value };
                onChange({ ...config, messages: msgs });
              }} placeholder={`Message ${i + 1}`}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
              <button type="button" onClick={() => { const msgs = config.messages.filter((_, j) => j !== i); onChange({ ...config, messages: msgs }); }}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => onChange({ ...config, messages: [...(config.messages || []), { text: '' }] })}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium py-2 px-3 hover:bg-blue-50 rounded-lg transition-colors"><Plus size={14} /> Add Message</button>
        </div>
        <Select label="Scroll Direction" value={config.scrollDirection} onChange={set('scrollDirection')} options={[
          { value: 'up', label: 'Scroll Up' }, { value: 'down', label: 'Scroll Down' },
          { value: 'left', label: 'Scroll Left' }, { value: 'right', label: 'Scroll Right' },
        ]} />
        <Toggle label="Show Bullets" checked={config.showBullets} onChange={setToggle('showBullets')} />
      </div>
    );
    case 'live_counter': return (
      <div className="space-y-4">
        <Input label="Label" value={config.label} onChange={set('label')} placeholder="e.g. Visitors Today" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Starting Count</label>
            <input type="number" value={config.count} onChange={(e) => onChange({ ...config, count: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
          </div>
          <Input label="Unit" value={config.unit} onChange={set('unit')} placeholder="e.g. users" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Prefix" value={config.prefix} onChange={set('prefix')} placeholder="e.g. $" />
          <Input label="Suffix" value={config.suffix} onChange={set('suffix')} placeholder="e.g. +" />
        </div>
        <Toggle label="Animate on Load" checked={config.animateOnLoad} onChange={setToggle('animateOnLoad')} />
      </div>
    );
    case 'qr_code': return (
      <div className="space-y-4">
        <Input label="URL / Content" value={config.url} onChange={set('url')} placeholder="https://example.com" required />
        <Input label="Label" value={config.label} onChange={set('label')} placeholder="e.g. Scan to visit" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Size (px)</label>
            <input type="number" min={100} max={600} step={50} value={config.size} onChange={(e) => onChange({ ...config, size: parseInt(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
          </div>
          <Select label="Error Level" value={config.errorLevel} onChange={set('errorLevel')} options={[
            { value: 'L', label: 'L (7%)' }, { value: 'M', label: 'M (15%)' },
            { value: 'Q', label: 'Q (25%)' }, { value: 'H', label: 'H (30%)' },
          ]} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Foreground</label>
            <input type="color" value={config.foregroundColor} onChange={set('foregroundColor')} className="w-full h-11 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Background</label>
            <input type="color" value={config.backgroundColor} onChange={set('backgroundColor')} className="w-full h-11 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300" />
          </div>
        </div>
        <Toggle label="Show Label" checked={config.showLabel} onChange={setToggle('showLabel')} />
      </div>
    );
    case 'youtube': return (
      <div className="space-y-4">
        <Input label="YouTube Video ID" value={config.videoId} onChange={set('videoId')} placeholder="dQw4w9WgXcQ" required />
        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200">
          Get from: youtube.com/watch?v=<strong className="text-slate-700">VIDEO_ID</strong>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Start At (sec)</label>
            <input type="number" min={0} value={config.startAt} onChange={(e) => onChange({ ...config, startAt: parseInt(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Toggle label="Autoplay" checked={config.autoplay} onChange={setToggle('autoplay')} />
          <Toggle label="Muted" checked={config.muted} onChange={setToggle('muted')} />
          <Toggle label="Loop" checked={config.loop} onChange={setToggle('loop')} />
          <Toggle label="Show Controls" checked={config.showControls} onChange={setToggle('showControls')} />
        </div>
      </div>
    );
    case 'countdown': return (
      <div className="space-y-4">
        <Input label="Widget Label" value={config.label} onChange={set('label')} placeholder="e.g. Event Starts In" />
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Target Date & Time <span className="text-red-400">*</span></label>
          <input type="datetime-local" value={config.targetDate ? config.targetDate.slice(0, 16) : ''} onChange={(e) => onChange({ ...config, targetDate: new Date(e.target.value).toISOString() })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
        </div>
        <Input label="Expired Message" value={config.expiredMessage} onChange={set('expiredMessage')} placeholder="Time is up!" />
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Show Days" checked={config.showDays} onChange={setToggle('showDays')} />
          <Toggle label="Show Hours" checked={config.showHours} onChange={setToggle('showHours')} />
          <Toggle label="Show Minutes" checked={config.showMinutes} onChange={setToggle('showMinutes')} />
          <Toggle label="Show Seconds" checked={config.showSeconds} onChange={setToggle('showSeconds')} />
        </div>
      </div>
    );
    case 'google_slides': return (
      <div className="space-y-4">
        <Input label="Google Slides Presentation ID" value={config.presentationId} onChange={set('presentationId')} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" required />
        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200">
          Get from: docs.google.com/presentation/d/<strong className="text-slate-700">PRESENTATION_ID</strong>/edit
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Slide Interval (seconds)</label>
          <input type="number" min={3} max={120} value={config.slideInterval} onChange={(e) => onChange({ ...config, slideInterval: parseInt(e.target.value) })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
        </div>
        <Toggle label="Auto Advance" checked={config.autoAdvance} onChange={setToggle('autoAdvance')} />
        <Toggle label="Loop" checked={config.loop} onChange={setToggle('loop')} />
      </div>
    );
    case 'stock_ticker': return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Stock Symbols (comma separated)</label>
          <input value={(config.symbols || []).join(', ')} onChange={(e) => onChange({ ...config, symbols: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) })}
            placeholder="AAPL, GOOG, MSFT, TSLA"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Scroll Speed</label>
          <input type="range" min={10} max={100} value={config.scrollSpeed} onChange={(e) => onChange({ ...config, scrollSpeed: parseInt(e.target.value) })} className="w-full accent-blue-500" />
          <span className="text-xs text-slate-400">{config.scrollSpeed}px/s</span>
        </div>
        <Toggle label="Show Change" checked={config.showChange} onChange={setToggle('showChange')} />
        <Toggle label="Show Percentage" checked={config.showPercent} onChange={setToggle('showPercent')} />
      </div>
    );
    case 'custom_html': return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">HTML</label>
          <textarea value={config.html} onChange={set('html')} rows={5} placeholder="<div>Your content here</div>"
            className="w-full bg-slate-900 text-green-400 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">CSS</label>
          <textarea value={config.css} onChange={set('css')} rows={3} placeholder="body { background: #000; }"
            className="w-full bg-slate-900 text-blue-400 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <Toggle label="Sandboxed (recommended)" checked={config.sandboxed} onChange={setToggle('sandboxed')} />
      </div>
    );
    case 'google_traffic': return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Latitude</label>
            <input type="number" step="0.0001" value={config.lat} onChange={(e) => onChange({ ...config, lat: parseFloat(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Longitude</label>
            <input type="number" step="0.0001" value={config.lon} onChange={(e) => onChange({ ...config, lon: parseFloat(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Zoom Level</label>
          <input type="range" min={8} max={18} value={config.zoom} onChange={(e) => onChange({ ...config, zoom: parseInt(e.target.value) })} className="w-full accent-blue-500" />
          <span className="text-xs text-slate-400">Zoom: {config.zoom}</span>
        </div>
        <Toggle label="Show Controls" checked={config.showControls} onChange={setToggle('showControls')} />
      </div>
    );
    case 'social_feed': return (
      <div className="space-y-4">
        <Select label="Platform" value={config.platform} onChange={set('platform')} options={[
          { value: 'twitter', label: 'Twitter / X' },
          { value: 'instagram', label: 'Instagram' },
        ]} />
        <Input label="Username" value={config.username} onChange={set('username')} placeholder="@username" />
        <Input label="Hashtag" value={config.hashtag} onChange={set('hashtag')} placeholder="#hashtag" />
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Max Posts</label>
          <input type="number" min={1} max={20} value={config.maxPosts} onChange={(e) => onChange({ ...config, maxPosts: parseInt(e.target.value) })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
        </div>
      </div>
    );
    default: return (
      <div className="p-6 bg-slate-50 rounded-xl text-sm text-slate-500 text-center border border-slate-200">
        Configuration for <strong>{type}</strong> will appear here.
      </div>
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Create / Edit Widget Modal — responsive
// ─────────────────────────────────────────────────────────────
function WidgetModal({ widget, onClose, onSuccess }) {
  const isEdit = !!widget?.id;
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [selectedType, setSelectedType] = useState(widget?.type || '');
  const [form, setForm] = useState({
    name: widget?.name || '',
    description: widget?.description || '',
    theme: widget?.theme || 'dark',
    refreshInterval: widget?.refresh_interval || 300,
    config: widget?.config || {},
  });
  const [loading, setLoading] = useState(false);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setForm(f => ({
      ...f,
      config: { ...WIDGET_DEFAULTS[type] },
      name: f.name || WIDGET_CATALOGUE.find(w => w.type === type)?.label + ' Widget',
    }));
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Widget name is required');
    setLoading(true);
    try {
      if (isEdit) {
        await widgetsAPI.update(widget.id, { ...form, type: selectedType });
        toast.success('Widget updated');
      } else {
        await widgetsAPI.create({ ...form, type: selectedType, is_approved: true, is_active: true });
        toast.success('Widget created');
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save widget');
    } finally {
      setLoading(false);
    }
  };

  const meta = WIDGET_TYPE_MAP[selectedType];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 12 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 sm:gap-3">
            {meta && (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                <meta.icon size={16} style={{ color: meta.color }} />
              </div>
            )}
            <div>
              <h2 className="font-bold text-slate-800 text-sm sm:text-base">{isEdit ? 'Edit Widget' : step === 1 ? 'Add Widget' : `New ${meta?.label || ''} Widget`}</h2>
              {step === 2 && !isEdit && <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Configure and save to your library</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && !isEdit && (
              <button onClick={() => setStep(1)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 sm:px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap">← Change Type</button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-4 sm:p-6">
              <p className="text-sm text-slate-500 mb-4">Choose a widget type to add to your library:</p>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
                {WIDGET_CATALOGUE.map(w => (
                  <button key={w.type} onClick={() => handleTypeSelect(w.type)}
                    className="flex items-start gap-2 p-3 sm:p-4 rounded-xl border-2 border-slate-100 hover:border-blue-300 hover:shadow-md transition-all text-left group">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: w.bg }}>
                      <w.icon size={16} sm:size={20} style={{ color: w.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-slate-700 group-hover:text-blue-700 truncate">{w.label}</div>
                      <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 line-clamp-2">{w.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} id="widget-form" className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Input label="Widget Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lobby Clock" required className="col-span-2 sm:col-span-1" />
                <Input label="Description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" className="col-span-2 sm:col-span-1" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <Select label="Theme" value={form.theme} onChange={(e) => setForm(f => ({ ...f, theme: e.target.value }))} options={[
                  { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' },
                  { value: 'transparent', label: 'Transparent' }, { value: 'custom', label: 'Custom' },
                ]} />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Refresh (sec)</label>
                  <input type="number" min={0} max={3600} value={form.refreshInterval} onChange={(e) => setForm(f => ({ ...f, refreshInterval: parseInt(e.target.value) || 300 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Settings size={14} className="text-slate-400" /> Widget Configuration
                </h4>
                <WidgetConfigForm type={selectedType} config={form.config} onChange={(cfg) => setForm(f => ({ ...f, config: cfg }))} />
              </div>
            </form>
          )}
        </div>

        {step === 2 && (
          <div className="flex items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/50">
            <button type="button" onClick={onClose} className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            <button type="submit" form="widget-form" disabled={loading}
              className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
              {loading ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><Check size={14} />{isEdit ? 'Save Changes' : 'Create Widget'}</>}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Widget Card — responsive
// ─────────────────────────────────────────────────────────────
function WidgetCard({ widget, onEdit, onDelete, onDuplicate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = WIDGET_TYPE_MAP[widget.type] || { label: widget.type, icon: Zap, color: '#6B7280', bg: '#F9FAFB' };
  const Icon = meta.icon;

  return (
    <motion.div 
      layout 
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden transition-all hover:shadow-md hover:border-blue-200 group"
    >
      <div className="h-1.5" style={{ background: meta.color }} />
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
              <Icon size={16} style={{ color: meta.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-bold text-slate-800 leading-tight truncate">{widget.name}</div>
              <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 font-medium">{meta.label}</div>
            </div>
          </div>
          <div className="relative flex-shrink-0 ml-1">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <MoreVertical size={14} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-36 sm:w-40 overflow-hidden">
                    <button onClick={() => { setMenuOpen(false); onEdit(widget); }} className="w-full px-3 py-2 text-left text-xs sm:text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"><Pencil size={12} className="text-slate-400" /> Edit</button>
                    <button onClick={() => { setMenuOpen(false); onDuplicate(widget); }} className="w-full px-3 py-2 text-left text-xs sm:text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"><Copy size={12} className="text-slate-400" /> Duplicate</button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => { setMenuOpen(false); onDelete(widget); }} className="w-full px-3 py-2 text-left text-xs sm:text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"><Trash2 size={12} /> Delete</button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {widget.description && <p className="text-xs text-slate-400 mb-2 sm:mb-3 line-clamp-2">{widget.description}</p>}

        <div className="bg-slate-50 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-mono text-slate-500 truncate mb-2 sm:mb-3 border border-slate-100">
          {widget.type === 'clock' && `${widget.config?.timezone} · ${widget.config?.format}`}
          {widget.type === 'weather' && `${widget.config?.city || 'No city'} · ${widget.config?.unit}`}
          {widget.type === 'rss_feed' && (widget.config?.url ? (() => { try { return new URL(widget.config.url).hostname } catch { return widget.config.url } })() : 'No URL')}
          {widget.type === 'web_url' && (widget.config?.url ? (() => { try { return new URL(widget.config.url).hostname } catch { return widget.config.url } })() : 'No URL')}
          {widget.type === 'youtube' && `youtube.com/watch?v=${widget.config?.videoId || '...'}`}
          {widget.type === 'qr_code' && (widget.config?.url || 'No URL')}
          {widget.type === 'countdown' && (widget.config?.targetDate ? new Date(widget.config.targetDate).toLocaleDateString() : 'No date')}
          {widget.type === 'stock_ticker' && (widget.config?.symbols || []).slice(0, 3).join(', ')}
          {widget.type === 'notice_board' && `${(widget.config?.messages || []).length} message${(widget.config?.messages || []).length !== 1 ? 's' : ''}`}
          {widget.type === 'live_counter' && `${widget.config?.label || 'Counter'} · ${widget.config?.count || 0}`}
          {widget.type === 'custom_html' && 'Custom HTML/CSS/JS'}
          {widget.type === 'google_slides' && (widget.config?.presentationId ? `${widget.config.presentationId.slice(0, 12)}...` : 'No presentation')}
          {widget.type === 'social_feed' && `${widget.config?.platform} · @${widget.config?.username || '?'}`}
          {widget.type === 'google_traffic' && `${widget.config?.lat?.toFixed(2)}, ${widget.config?.lon?.toFixed(2)}`}
        </div>

        <div className="flex items-center justify-end">
          {widget.playlist_usage_count > 0 && (
            <span className="text-[9px] sm:text-[10px] text-slate-400">Used in {widget.playlist_usage_count} playlist{widget.playlist_usage_count !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modals: Folder, Move, Confirm (responsive)
// ─────────────────────────────────────────────────────────────
function NewFolderModal({ isOpen, onClose, onSuccess, currentFolder }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Folder name is required'); return; }
    setLoading(true);
    try {
      await mediaAPI.createFolder({ name: name.trim(), parentId: currentFolder });
      toast.success('Folder created');
      onSuccess?.();
      onClose();
      setName('');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create folder');
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2"><Folder size={16} className="text-blue-500" />Create New Folder</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Folder Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g., Marketing Videos"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Folder'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MoveFolderModal({ isOpen, onClose, onConfirm }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => { if (isOpen) loadFolders(); }, [isOpen]);

  const loadFolders = async () => {
    try {
      const res = await mediaAPI.getFolders();
      const flat = res.data || [];
      const map = {}; const roots = [];
      flat.forEach(f => { map[f.id] = { ...f, children: [] }; });
      flat.forEach(f => { if (f.parent_id && map[f.parent_id]) map[f.parent_id].children.push(map[f.id]); else roots.push(map[f.id]); });
      setFolders(roots.sort((a, b) => a.name.localeCompare(b.name)));
    } catch { console.error('Failed to load folders'); }
  };

  const toggle = (id, e) => { e.stopPropagation(); const s = new Set(expanded); s.has(id) ? s.delete(id) : s.add(id); setExpanded(s); };

  const renderFolder = (folder, level = 0) => {
    const isOpen = expanded.has(folder.id);
    const hasKids = folder.children?.length > 0;
    const isSel = selectedFolder === folder.id;
    return (
      <div key={folder.id}>
        <div className={`flex items-center gap-1 px-2 py-1.5 sm:py-2 rounded-lg cursor-pointer mb-0.5 transition-colors ${isSel ? 'bg-blue-50 border border-blue-400 text-blue-600' : 'hover:bg-slate-100 text-slate-700'}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }} onClick={() => setSelectedFolder(folder.id)}>
          <button onClick={(e) => toggle(folder.id, e)} className="w-4 flex-shrink-0 flex items-center justify-center">
            {hasKids ? (isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : <span className="w-3" />}
          </button>
          <Folder size={14} className={isSel ? 'text-blue-500' : 'text-slate-400'} />
          <span className={`text-xs sm:text-sm flex-1 ml-1 truncate ${isSel ? 'font-semibold' : ''}`}>{folder.name}</span>
        </div>
        {isOpen && hasKids && folder.children.map(c => renderFolder(c, level + 1))}
      </div>
    );
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2"><Move size={16} className="text-blue-500" />Move to Folder</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="mb-4 max-h-64 sm:max-h-72 overflow-y-auto border border-slate-200 rounded-xl p-2">
          <div onClick={() => setSelectedFolder(null)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedFolder === null ? 'bg-blue-50 border border-blue-400 text-blue-600' : 'hover:bg-slate-100 text-slate-700'}`}>
            <Folder size={14} className={selectedFolder === null ? 'text-blue-500' : 'text-slate-400'} />
            <span className="text-xs sm:text-sm">Root (No Folder)</span>
          </div>
          {folders.map(f => renderFolder(f))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onConfirm(selectedFolder)} className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors">Move Here</button>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = true }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-sm shadow-xl">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: danger ? '#FEF2F2' : '#EFF6FF' }}>
          {danger ? <Trash2 size={18} className="text-red-500" /> : <AlertTriangle size={18} className="text-blue-500" />}
        </div>
        <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-3 sm:px-4 py-2 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Media Card — responsive
// ─────────────────────────────────────────────────────────────
function MediaCard({ media, selected, onSelect, onDelete, onClick, onMove, onCopyUrl }) {
  const isVideo = media.resource_type === 'video';

  return (
    <motion.div 
      layout 
      onClick={() => onClick(media)}
      className={`group relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 border-2 ${selected ? 'ring-2 ring-blue-500 border-transparent shadow-lg' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}`}
      style={{ width: '100%', maxWidth: 290 }}
    >
      <div className="absolute top-2 left-2 z-10" onClick={e => { e.stopPropagation(); onSelect(media.id); }}>
        {selected
          ? <CheckSquare size={16} className="text-blue-500 bg-white rounded shadow" />
          : <Square size={16} className="text-slate-300 bg-white/80 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity" />
        }
      </div>

      <div className="absolute top-2 right-2 z-10">
        <button className="w-6 h-6 sm:w-7 sm:h-7 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
          onClick={e => e.stopPropagation()}>
          <MoreVertical size={12} className="text-slate-600" />
        </button>
      </div>

      <div className="bg-slate-100 relative overflow-hidden aspect-[3/4]">
        {media.thumbnail_url
          ? <img src={media.thumbnail_url} alt={media.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center">
              {isVideo ? <Film size={32} className="text-slate-300" /> : <Image size={32} className="text-slate-300" />}
            </div>
        }
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/80 rounded-full flex items-center justify-center shadow-lg">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 px-2 text-[8px] sm:text-[9px] text-white/80 font-mono text-center truncate">
          {media.width && media.height ? `${media.width} × ${media.height}` : ''}
          {media.bit_rate ? ` · ${media.bit_rate} kbps` : ''}
        </div>
      </div>

      <div className="px-2 sm:px-3 pt-2 pb-1">
        <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{media.name}</div>
        <div className="flex items-center gap-1 text-[8px] sm:text-[10px] text-slate-400 mt-0.5 flex-wrap">
          <span className="uppercase font-bold">{isVideo ? 'VIDEO' : (media.format?.toUpperCase() || 'IMG')}</span>
          <span>·</span>
          <span>{formatBytes(media.file_size)}</span>
          <span>·</span>
          <span className="text-blue-500 font-semibold">0 Screens</span>
        </div>
      </div>

      <div className="flex items-center gap-1 px-2 sm:px-3 pb-2 sm:pb-3 pt-1">
        <button onClick={e => { e.stopPropagation(); onCopyUrl(media); }}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-yellow-400 flex items-center justify-center hover:bg-yellow-500 transition-colors shadow-sm">
          <Pencil size={10} className="text-white" />
        </button>
        <button onClick={e => { e.stopPropagation(); onMove(media); }}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-400 flex items-center justify-center hover:bg-orange-500 transition-colors shadow-sm">
          <Move size={10} className="text-white" />
        </button>
        <button onClick={e => { e.stopPropagation(); onCopyUrl(media); }}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-violet-500 flex items-center justify-center hover:bg-violet-600 transition-colors shadow-sm">
          <Copy size={10} className="text-white" />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(media); }}
          className="px-2 sm:px-3 py-1 rounded-full bg-red-500 text-white text-[10px] sm:text-xs font-bold hover:bg-red-600 transition-colors shadow-sm ml-auto">
          Delete
        </button>
      </div>
    </motion.div>
  );
}

function FolderCard({ folder, onClick }) {
  return (
    <motion.div 
      layout 
      onClick={() => onClick(folder.id)}
      className="group bg-white rounded-2xl overflow-hidden cursor-pointer transition-all border-2 border-slate-200 hover:border-blue-300 hover:shadow-md flex flex-col items-center justify-center p-3 sm:p-4"
      style={{ width: '100%', maxWidth: 100 }}
    >
      <Folder size={28} className="text-slate-500 group-hover:text-blue-500 transition-colors" />
      <div className="text-[10px] sm:text-xs font-semibold text-slate-700 truncate max-w-full text-center mt-1">{folder.name}</div>
      {folder.file_count !== undefined && <div className="text-[8px] sm:text-[10px] text-slate-400">{folder.file_count} file{folder.file_count !== 1 ? 's' : ''}</div>}
    </motion.div>
  );
}

function DetailPanel({ selected, onClose, onDelete, onMove, onCopyUrl }) {
  return (
    <motion.div 
      initial={{ x: 280, opacity: 0 }} 
      animate={{ x: 0, opacity: 1 }} 
      exit={{ x: 280, opacity: 0 }}
      className="w-64 sm:w-72 bg-white border-l border-slate-200 flex flex-col overflow-y-auto flex-shrink-0"
    >
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100">
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">File Details</h4>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X size={14} className="text-slate-500" /></button>
      </div>
      <div className="p-3 sm:p-4">
        <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden mb-3 sm:mb-4 border border-slate-100">
          {selected.resource_type === 'video'
            ? <video src={selected.secure_url} controls className="w-full h-full object-contain" />
            : <img src={selected.thumbnail_url || selected.secure_url} alt={selected.name} className="w-full h-full object-cover" />}
        </div>
        <h5 className="font-bold text-slate-800 text-xs sm:text-sm mb-1 break-all">{selected.name}</h5>
        {selected.folder_name && (
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 mb-2 sm:mb-3"><Folder size={10} />{selected.folder_name}</div>
        )}
        <div className="space-y-0.5 text-[10px] sm:text-xs">
          {[
            ['Type', selected.resource_type],
            ['Format', selected.format?.toUpperCase()],
            ['Size', formatBytes(selected.file_size)],
            selected.width && ['Dimensions', `${selected.width} × ${selected.height}`],
            selected.duration && ['Duration', `${selected.duration.toFixed(1)}s`],
            ['Uploaded', formatDate(selected.created_at)],
            selected.uploader_name && ['By', selected.uploader_name],
          ].filter(Boolean).map(([label, value]) => (
            <div key={label} className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-700 font-medium truncate ml-2">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 sm:mt-4 space-y-1.5">
          <a href={selected.secure_url} target="_blank" rel="noreferrer" className="w-full px-3 py-2 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 flex items-center justify-center gap-2 text-[10px] sm:text-xs border border-slate-200 transition-colors">
            <Download size={12} />Download
          </a>
          <button onClick={() => onCopyUrl(selected)} className="w-full px-3 py-2 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 flex items-center justify-center gap-2 text-[10px] sm:text-xs border border-slate-200 transition-colors">
            <Copy size={12} />Copy URL
          </button>
          <button onClick={() => onMove(selected)} className="w-full px-3 py-2 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 flex items-center justify-center gap-2 text-[10px] sm:text-xs border border-slate-200 transition-colors">
            <Move size={12} />Move to Folder
          </button>
          <button onClick={() => onDelete(selected)} className="w-full px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 flex items-center justify-center gap-2 text-[10px] sm:text-xs transition-colors">
            <Trash2 size={12} />Delete File
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Upload Media Modal — responsive
// ─────────────────────────────────────────────────────────────
function UploadMediaModal({ isOpen, onClose, onSuccess, currentFolder }) {
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [done, setDone] = useState([]);

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const id = crypto.randomUUID();
      setUploadingFiles(p => [...p, { id, name: file.name, progress: 0, status: 'uploading' }]);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('name', file.name.replace(/\.[^.]+$/, ''));
        if (currentFolder) fd.append('folderId', currentFolder);
        await mediaAPI.upload(fd, prog =>
          setUploadingFiles(p => p.map(f => f.id === id ? { ...f, progress: prog } : f))
        );
        setUploadingFiles(p => p.map(f => f.id === id ? { ...f, progress: 100, status: 'done' } : f));
        setDone(d => [...d, file.name]);
        toast.success(`${file.name} uploaded`);
      } catch {
        setUploadingFiles(p => p.map(f => f.id === id ? { ...f, status: 'error' } : f));
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    onSuccess?.();
  }, [currentFolder]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT, maxSize: 500 * 1024 * 1024 });

  if (!isOpen) return null;

  const allDone = uploadingFiles.length > 0 && uploadingFiles.every(f => f.status === 'done' || f.status === 'error');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100">
          <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2"><Upload size={16} className="text-blue-500" />Upload Media</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>

        <div className="p-4 sm:p-6">
          <div {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all mb-4 ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}`}>
            <input {...getInputProps()} />
            <Upload size={24} className={`mx-auto mb-2 ${isDragActive ? 'text-blue-500 animate-bounce' : 'text-slate-300'}`} />
            <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-1">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400">or <span className="text-blue-500 font-semibold">click to browse</span></p>
            <p className="text-[8px] sm:text-[10px] text-slate-300 mt-2">JPG, PNG, GIF, WEBP, MP4, WEBM, MOV · max 500MB each</p>
          </div>

          {uploadingFiles.length > 0 && (
            <div className="space-y-2 max-h-40 sm:max-h-48 overflow-y-auto">
              {uploadingFiles.map(f => (
                <div key={f.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-50 rounded-xl">
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${f.status === 'done' ? 'bg-emerald-100' : f.status === 'error' ? 'bg-red-100' : 'bg-blue-100'}`}>
                    {f.status === 'done' ? <Check size={12} className="text-emerald-500" />
                      : f.status === 'error' ? <X size={12} className="text-red-500" />
                      : <Upload size={12} className="text-blue-500 animate-bounce" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] sm:text-xs text-slate-700 font-medium truncate mb-1">{f.name}</div>
                    {f.status === 'uploading' && (
                      <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-blue-500 rounded-full" animate={{ width: `${f.progress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                    )}
                    {f.status === 'done' && <div className="text-[8px] sm:text-[10px] text-emerald-500 font-semibold">Uploaded</div>}
                    {f.status === 'error' && <div className="text-[8px] sm:text-[10px] text-red-500 font-semibold">Failed</div>}
                  </div>
                  {f.status === 'uploading' && <span className="text-[10px] sm:text-xs text-blue-500 font-bold w-8 sm:w-9 text-right">{f.progress}%</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={onClose} className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
            {allDone ? 'Done' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MEDIA FILES TAB — fully responsive
// ─────────────────────────────────────────────────────────────
function MediaFilesTab({ onTotalChange }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('uploaded');
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folders, setFolders] = useState([]);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => { const t = setTimeout(() => { setPage(1); fetchFiles(1); }, 300); return () => clearTimeout(t); }, [search, typeFilter, currentFolder, sortBy]);

  const init = async () => {
    setLoading(true);
    try { await Promise.all([fetchFiles(1), fetchFolders()]); }
    finally { setLoading(false); }
  };

  const fetchFiles = async (p = page) => {
    const params = { limit: MEDIA_LIMIT, page: p, folderId: currentFolder || undefined };
    if (search) params.search = search;
    if (typeFilter !== 'all') params.type = typeFilter;
    if (sortBy) params.sort = sortBy;
    const res = await mediaAPI.getAll(params);
    if (p === 1) setFiles(res.data || []); else setFiles(prev => [...prev, ...(res.data || [])]);
    const t = res.meta?.total ?? (res.data || []).length;
    setTotal(t);
    onTotalChange?.(t);
  };

  const fetchFolders = async () => {
    try { const res = await mediaAPI.getFolders({ parentId: currentFolder }); setFolders(res.data || []); }
    catch { console.error('Failed to fetch folders'); }
  };

  const loadMore = async () => {
    const next = page + 1; setPage(next); setLoadingMore(true);
    await fetchFiles(next); setLoadingMore(false);
  };

  const handleDelete = async () => {
    try {
      await mediaAPI.delete(deleteTarget.id);
      setFiles(p => p.filter(f => f.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      setSelectedIds(p => p.filter(id => id !== deleteTarget.id));
      setTotal(t => t - 1); setDeleteTarget(null);
      toast.success('File deleted');
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to delete file'); }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map(id => mediaAPI.delete(id)));
      setFiles(p => p.filter(f => !selectedIds.includes(f.id)));
      setSelected(null); setSelectedIds([]); setTotal(t => t - selectedIds.length);
      toast.success(`${selectedIds.length} files deleted`);
    } catch { toast.error('Failed to delete some files'); }
  };

  const handleMove = async (fileIds, targetFolderId) => {
    try {
      await mediaAPI.moveFiles({ fileIds, folderId: targetFolderId });
      await fetchFiles(1); setSelectedIds([]); setMoveTarget(null); setShowMoveModal(false);
      toast.success(`${fileIds.length} files moved`); fetchFolders();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed to move files'); }
  };

  const handleCopyUrl = (media) => { navigator.clipboard.writeText(media.secure_url || media.url); toast.success('URL copied!'); };
  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleSelectAll = () => selectedIds.length === files.length ? setSelectedIds([]) : setSelectedIds(files.map(f => f.id));

  const folderCards = !currentFolder ? folders : [];
  const hasMore = files.length < total;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center py-12 sm:py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 size={24} className="animate-spin text-blue-400" /><span className="text-xs sm:text-sm text-slate-400">Loading files…</span></div>
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile Filter Toggle */}
        <div className="lg:hidden px-4 py-2 flex items-center justify-between bg-slate-100 border-b border-slate-200">
          <button 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-700 border border-slate-200"
          >
            <Menu size={14} /> Filters & Sort
          </button>
          <span className="text-xs text-slate-500">{total} files</span>
        </div>

        {/* Toolbar - Responsive */}
        <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block px-3 sm:px-4 lg:px-6 py-2 sm:py-3 bg-slate-100 border-b border-slate-200`}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            
            {/* Left: ALL MEDIA FILES + TOTAL - Hidden on mobile (shown in header) */}
            <div className="hidden lg:block lg:flex-1">
              <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">ALL MEDIA FILES</span>
              <span className="text-[10px] sm:text-xs text-slate-500 ml-2">TOTAL - {total}</span>
            </div>

            {/* Filter Pills - Scrollable on mobile */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 lg:pb-0 flex-nowrap lg:flex-wrap">
              {[
                { k: 'all', l: 'All' },
                { k: 'video', l: 'Videos' },
                { k: 'image', l: 'Photos' },
              ].map(({ k, l }) => (
                <button key={k} onClick={() => setTypeFilter(k)}
                  className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${typeFilter === k ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 border border-slate-300 bg-white hover:bg-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Right Controls - Stack on mobile */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sort by dropdown */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-slate-600 cursor-pointer hover:border-slate-300 flex-1 sm:flex-none min-w-[120px] sm:min-w-[140px]">
                <SortAsc size={12} className="text-slate-400 flex-shrink-0" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent text-[10px] sm:text-xs text-slate-600 focus:outline-none cursor-pointer w-full">
                  <option value="uploaded">Sort by Uploaded</option>
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                </select>
              </div>

              {/* Search - Hidden on smallest screens */}
              <div className="relative hidden sm:block">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                  className="pl-7 pr-2 py-1 sm:py-1.5 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-[10px] sm:text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-24 sm:w-28 lg:w-32" />
              </div>

              {/* New Folder button */}
              <button onClick={() => setShowNewFolderModal(true)}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap">
                <Plus size={12} /><span className="hidden xs:inline">New Folder</span>
              </button>

              {/* Grid / List toggle */}
              <div className="flex gap-0 border border-slate-200 rounded-lg sm:rounded-xl overflow-hidden bg-white">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-2 transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-100'}`}><Grid3x3 size={12} /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 sm:p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}><List size={12} /></button>
              </div>
            </div>
          </div>

          {/* Mobile Search - Show on mobile */}
          <div className="sm:hidden mt-2 relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..."
              className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="bg-blue-50 border-b border-blue-100 px-3 sm:px-4 lg:px-6 py-2 flex items-center gap-2 sm:gap-3 overflow-hidden flex-wrap">
              <span className="text-xs sm:text-sm text-blue-700 font-semibold">{selectedIds.length} selected</span>
              <button onClick={() => { setMoveTarget(selectedIds); setShowMoveModal(true); }} className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1"><Move size={10} />Move</button>
              <button onClick={handleBulkDelete} className="px-2 sm:px-3 py-1 text-[10px] sm:text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-1"><Trash2 size={10} />Delete</button>
              <button onClick={() => setSelectedIds([])} className="ml-auto text-slate-400 hover:text-slate-600"><X size={12} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-slate-50">
          {files.length === 0 && folderCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-slate-100"><Image size={20} className="text-slate-300" /></div>
              <p className="text-slate-600 font-semibold text-xs sm:text-sm mb-1">No media files</p>
              <p className="text-slate-400 text-[10px] sm:text-xs">Upload images and videos to get started</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="flex flex-wrap gap-2 sm:gap-3 lg:gap-4 items-start">
              {/* Folder cards */}
              {folderCards.map(folder => (
                <div key={folder.id} className="w-[70px] sm:w-[80px] lg:w-[100px]">
                  <FolderCard folder={folder} onClick={(id) => { setCurrentFolder(id); setPage(1); }} />
                </div>
              ))}
              {/* Media cards */}
              {files.map(media => (
                <div key={media.id} className="w-[140px] xs:w-[160px] sm:w-[180px] md:w-[200px] lg:w-[220px] xl:w-[250px] 2xl:w-[290px]">
                  <MediaCard 
                    media={media} 
                    selected={selectedIds.includes(media.id)}
                    onSelect={toggleSelect} 
                    onClick={m => setSelected(selected?.id === m.id ? null : m)}
                    onDelete={m => setDeleteTarget(m)} 
                    onMove={m => { setMoveTarget([m.id]); setShowMoveModal(true); }} 
                    onCopyUrl={handleCopyUrl} 
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[600px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 text-left text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase">File</th>
                    <th className="px-2 sm:px-4 py-2 text-left text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase hidden md:table-cell">Type</th>
                    <th className="px-2 sm:px-4 py-2 text-left text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase hidden md:table-cell">Size</th>
                    <th className="px-2 sm:px-4 py-2 text-left text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase hidden lg:table-cell">Modified</th>
                    <th className="px-2 sm:px-4 py-2 text-right text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {files.map(media => (
                    <tr key={media.id} className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.includes(media.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelected(selected?.id === media.id ? null : media)}>
                      <td className="px-2 sm:px-4 py-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div onClick={e => { e.stopPropagation(); toggleSelect(media.id); }}>
                            {selectedIds.includes(media.id) ? <CheckSquare size={12} className="text-blue-500" /> : <Square size={12} className="text-slate-300" />}
                          </div>
                          <div className="w-6 h-6 sm:w-7 sm:h-7 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                            {media.thumbnail_url ? <img src={media.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">{media.resource_type === 'video' ? <Film size={10} className="text-slate-400" /> : <Image size={10} className="text-slate-400" />}</div>}
                          </div>
                          <span className="font-medium text-slate-800 text-[10px] sm:text-xs truncate max-w-[100px] sm:max-w-[150px]">{media.name}</span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-xs text-slate-500 hidden md:table-cell">{media.format?.toUpperCase() || media.resource_type}</td>
                      <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-xs text-slate-500 hidden md:table-cell">{formatBytes(media.file_size)}</td>
                      <td className="px-2 sm:px-4 py-2 text-[10px] sm:text-xs text-slate-500 hidden lg:table-cell">{formatDate(media.created_at, 'MMM d, yyyy')}</td>
                      <td className="px-2 sm:px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={e => { e.stopPropagation(); handleCopyUrl(media); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"><Copy size={10} /></button>
                          <button onClick={e => { e.stopPropagation(); setMoveTarget([media.id]); setShowMoveModal(true); }} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"><Move size={10} /></button>
                          <button onClick={e => { e.stopPropagation(); setDeleteTarget(media); }} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={10} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasMore && (
            <div className="text-center mt-3 sm:mt-4">
              <button onClick={loadMore} disabled={loadingMore} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-[10px] sm:text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-sm inline-flex items-center gap-2 transition-colors">
                {loadingMore ? <><Loader2 size={10} className="animate-spin" />Loading…</> : `Load more (${total - files.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selected && (
          <DetailPanel key="detail" selected={selected} onClose={() => setSelected(null)}
            onDelete={m => setDeleteTarget(m)} onMove={m => { setMoveTarget([m.id]); setShowMoveModal(true); }} onCopyUrl={handleCopyUrl} />
        )}
      </AnimatePresence>

      {/* Modals */}
      <NewFolderModal isOpen={showNewFolderModal} onClose={() => setShowNewFolderModal(false)} onSuccess={() => { fetchFolders(); fetchFiles(1); }} currentFolder={currentFolder} />
      <MoveFolderModal isOpen={showMoveModal} onClose={() => { setShowMoveModal(false); setMoveTarget(null); }} onConfirm={folderId => handleMove(moveTarget, folderId)} />
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete File"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"?`} confirmLabel="Delete" />

      {/* Upload modal */}
      <UploadMediaModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onSuccess={() => { fetchFiles(1); fetchFolders(); }} currentFolder={currentFolder} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WIDGETS TAB — responsive
// ─────────────────────────────────────────────────────────────
function WidgetsTab({ onCountChange }) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [total, setTotal] = useState(0);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => { const t = setTimeout(fetchWidgets, 300); return () => clearTimeout(t); }, [search, typeFilter]);

  const init = async () => {
    setLoading(true);
    try { await fetchWidgets(); }
    finally { setLoading(false); }
  };

  const fetchWidgets = async () => {
    try {
      const params = { limit: 48 };
      if (search) params.search = search;
      if (typeFilter !== 'all') params.type = typeFilter;
      const res = await widgetsAPI.getAll(params);
      const list = res.data || [];
      setWidgets(list);
      const t = res.meta?.total || list.length;
      setTotal(t);
      onCountChange?.(t);
    } catch { toast.error('Failed to load widgets'); }
  };

  const handleDelete = async () => {
    try {
      await widgetsAPI.delete(deleteTarget.id);
      setWidgets(p => p.filter(w => w.id !== deleteTarget.id));
      setTotal(t => t - 1); setDeleteTarget(null);
      toast.success('Widget deleted');
      onCountChange?.(total - 1);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Cannot delete widget — it may be in use'); }
  };

  const handleDuplicate = async (widget) => {
    try {
      await widgetsAPI.duplicate(widget.id);
      toast.success(`"${widget.name}" duplicated`);
      fetchWidgets();
    } catch { toast.error('Failed to duplicate widget'); }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center py-12 sm:py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 size={24} className="animate-spin text-blue-400" /><span className="text-xs sm:text-sm text-slate-400">Loading widgets…</span></div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden px-4 py-2 flex items-center justify-between bg-slate-100 border-b border-slate-200">
        <button 
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-700 border border-slate-200"
        >
          <Menu size={14} /> Filters
        </button>
        <span className="text-xs text-slate-500">{total} widgets</span>
      </div>

      {/* Toolbar */}
      <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block px-3 sm:px-4 lg:px-6 py-2 sm:py-3 bg-slate-100 border-b border-slate-200`}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider hidden lg:inline">ALL WIDGETS</span>
            <span className="text-[10px] sm:text-xs text-slate-500 lg:ml-2">TOTAL - {total}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Type filter */}
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none min-w-[100px] sm:min-w-[120px] appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em', paddingRight: '1.5rem' }}>
              <option value="all">All Types</option>
              {WIDGET_CATALOGUE.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
            </select>

            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="pl-7 pr-2 py-1 sm:py-1.5 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-[10px] sm:text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-28 lg:w-32" />
            </div>

            <button onClick={fetchWidgets} className="p-1 border border-slate-200 bg-white rounded-lg sm:rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"><RefreshCw size={12} /></button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-slate-50">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-slate-100"><Layout size={20} className="text-slate-300" /></div>
            <p className="text-slate-600 font-semibold text-xs sm:text-sm mb-1">No widgets yet</p>
            <p className="text-slate-400 text-[10px] sm:text-xs mb-4">Create your first widget to display dynamic content on screens</p>
            <button onClick={() => setShowModal(true)} className="px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl inline-flex items-center gap-2 transition-colors">
              <Plus size={14} />Create Widget
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {widgets.map((widget) => (
              <WidgetCard key={widget.id} widget={widget}
                onEdit={(w) => { setEditTarget(w); setShowModal(true); }}
                onDelete={setDeleteTarget}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <WidgetModal key="widget-modal" widget={editTarget}
            onClose={() => { setShowModal(false); setEditTarget(null); }}
            onSuccess={() => { fetchWidgets(); }} />
        )}
      </AnimatePresence>
      
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Widget"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone. Widgets in use by playlists cannot be deleted.`} confirmLabel="Delete" danger />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE — fully responsive
// ─────────────────────────────────────────────────────────────
export default function MediaLibrary() {
  const [activeTab, setActiveTab] = useState('media');
  const [mediaTotal, setMediaTotal] = useState(0);
  const [widgetCount, setWidgetCount] = useState(0);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load counts on mount
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [mediaRes, widgetRes] = await Promise.all([
          mediaAPI.getAll({ limit: 1, page: 1 }),
          widgetsAPI.getAll({ limit: 1 }),
        ]);
        setMediaTotal(mediaRes.meta?.total || 0);
        setWidgetCount(widgetRes.meta?.total || (widgetRes.data || []).length);
      } catch { /* ignore */ }
    };
    loadCounts();
  }, []);

  const tabs = [
    { key: 'media',   label: `Media Files (${mediaTotal})` },
    { key: 'widgets', label: `Widgets (${widgetCount})` },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* ── Top Nav ── */}
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          
          {/* Left: Mobile Menu Toggle + Tab pills */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Menu size={18} className="text-slate-600" />
            </button>

            {/* Tab Pills - Hide on mobile when menu open? Actually keep visible but allow scroll */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 max-w-[calc(100vw-100px)] lg:max-w-none">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all whitespace-nowrap ${activeTab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 border border-slate-300 bg-white hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Create Widget - only on widgets tab, visible on mobile if space */}
            {activeTab === 'widgets' && (
              <button onClick={() => setShowWidgetModal(true)}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 whitespace-nowrap">
                <Plus size={12} />Create
              </button>
            )}
          </div>

          {/* Right: Read Docs + Upload Media */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#" className="hidden sm:flex items-center gap-1 text-[10px] sm:text-xs text-slate-500 hover:text-slate-700 font-medium">
              <Info size={12} />Docs
            </a>
            {activeTab === 'media' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 text-white rounded-full text-[10px] sm:text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-sm transition-colors whitespace-nowrap">
                <Upload size={12} />Upload
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu Panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden mt-2 pt-2 border-t border-slate-100"
            >
              <div className="flex flex-col gap-2">
                <a href="#" className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg">
                  <Info size={14} /> Documentation
                </a>
                {activeTab === 'media' && (
                  <button 
                    onClick={() => { setShowUploadModal(true); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Upload size={14} /> Upload Media
                  </button>
                )}
                {activeTab === 'widgets' && (
                  <button 
                    onClick={() => { setShowWidgetModal(true); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Plus size={14} /> Create Widget
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'media' && (
          <MediaFilesTab key="media-tab" onTotalChange={setMediaTotal} />
        )}
        {activeTab === 'widgets' && (
          <WidgetsTab key="widgets-tab" onCountChange={setWidgetCount} />
        )}
      </div>

      {/* Upload Modal */}
      <UploadMediaModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false);
        }}
      />

      {/* Create widget modal */}
      <AnimatePresence>
        {showWidgetModal && (
          <WidgetModal key="top-nav-widget-modal"
            onClose={() => setShowWidgetModal(false)}
            onSuccess={() => {
              setShowWidgetModal(false);
              setActiveTab('widgets');
              setWidgetCount(c => c + 1);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}