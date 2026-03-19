// src/pages/Analytics.jsx
import { useState, useEffect } from 'react'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, BarElement, LineElement, CategoryScale,
  LinearScale, PointElement, Tooltip, Legend, Filler
} from 'chart.js'
import {
  BarChart3, Download, TrendingUp, Monitor, Play, Clock,
  Film, Image, RefreshCw, Calendar
} from 'lucide-react'
import { analyticsAPI } from '../services/api'
import { PageLoader, StatCard, Badge, ProgressBar, SearchInput } from '../components/ui'
import { formatBytes, formatDate, formatDuration, downloadBlob } from '../utils'
import toast from 'react-hot-toast'

ChartJS.register(ArcElement, BarElement, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler)

const CHART_OPT = {
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0d1220', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
      titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 10, cornerRadius: 8,
    }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', font: { size: 11 } }, beginAtZero: true },
  },
}

export default function Analytics() {
  const [dashboard, setDashboard] = useState(null)
  const [topMedia, setTopMedia]   = useState([])
  const [popLogs, setPopLogs]     = useState([])
  const [period, setPeriod]       = useState('7d')
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => { fetchAll() }, [period])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [dash, media, pop] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getTopMedia(period),
        analyticsAPI.getProofOfPlay({ limit: 20 }),
      ])
      setDashboard(dash.data)
      setTopMedia(media.data)
      setPopLogs(pop.data)
    } finally { setLoading(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await analyticsAPI.exportCSV({ type: 'playback' })
      downloadBlob(new Blob([res]), `aekads-analytics-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`)
      toast.success('Analytics exported!')
    } finally { setExporting(false) }
  }

  if (loading) return <PageLoader />

  const trendLabels = dashboard?.trend?.map(t => new Date(t.date).toLocaleDateString('en', { weekday: 'short' })) ?? []
  const trendValues = dashboard?.trend?.map(t => t.plays) ?? []

  const playbackData = {
    labels: trendLabels,
    datasets: [{
      data: trendValues,
      backgroundColor: 'rgba(51,97,255,0.25)',
      borderColor: '#3361ff',
      borderWidth: 2,
      borderRadius: 6,
    }]
  }

  const lineData = {
    labels: trendLabels,
    datasets: [{
      data: trendValues,
      borderColor: '#00d4ff',
      backgroundColor: 'rgba(0,212,255,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: '#00d4ff',
    }]
  }

  const maxMediaPlay = topMedia[0]?.play_count ?? 1

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Performance insights for your signage network</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex gap-1.5 p-1 bg-surface-700/50 rounded-xl">
            {['24h','7d','30d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'bg-brand-600 text-white shadow-glow-sm' : 'text-slate-400 hover:text-white'}`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={fetchAll} className="btn-secondary p-2"><RefreshCw size={14} /></button>
          <button onClick={handleExport} disabled={exporting} className="btn-secondary gap-2">
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Screens"     value={dashboard?.screens?.total ?? '—'}   icon={Monitor}  iconBg="bg-brand-500/15"   iconColor="text-brand-400" />
        <StatCard title="Online Now"        value={dashboard?.screens?.online ?? '—'}  icon={TrendingUp} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" />
        <StatCard title="Today's Plays"     value={dashboard?.playback?.plays_today ?? '—'} icon={Play} iconBg="bg-orange-500/15" iconColor="text-orange-400" />
        <StatCard title="Active Screens"    value={dashboard?.playback?.active_screens_today ?? '—'} icon={BarChart3} iconBg="bg-purple-500/15" iconColor="text-purple-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-white">Playback Volume</h3>
              <p className="text-xs text-slate-500">Plays per day</p>
            </div>
            <BarChart3 size={16} className="text-brand-400" />
          </div>
          <Bar data={playbackData} options={CHART_OPT} height={120} />
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-white">Trend Line</h3>
              <p className="text-xs text-slate-500">Rolling view</p>
            </div>
            <TrendingUp size={16} className="text-accent-cyan" />
          </div>
          <Line data={lineData} options={CHART_OPT} height={120} />
        </div>
      </div>

      {/* Top Media */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold text-white mb-4">Top Media by Plays</h3>
          {topMedia.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No playback data yet</p>
          ) : (
            <div className="space-y-3">
              {topMedia.slice(0, 8).map((media, i) => (
                <div key={media.id} className="flex items-center gap-3">
                  <span className="text-slate-600 font-mono text-xs w-5 flex-shrink-0">{i+1}</span>
                  <div className="w-10 h-6 bg-surface-700 rounded overflow-hidden flex-shrink-0">
                    {media.thumbnail_url
                      ? <img src={media.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          {media.resource_type === 'video' ? <Film size={10} className="text-slate-500" /> : <Image size={10} className="text-slate-500" />}
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{media.name}</div>
                    <ProgressBar value={media.play_count} max={maxMediaPlay}
                      color={i === 0 ? 'bg-brand-500' : i < 3 ? 'bg-purple-500' : 'bg-surface-400'}
                      className="mt-1" />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-white">{media.play_count.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">plays</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Proof of Play logs */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
            <h3 className="font-display font-semibold text-white">Recent Proof of Play</h3>
            <Badge variant="blue" dot>Live</Badge>
          </div>
          <div className="overflow-y-auto max-h-80">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Screen</th>
                  <th>Media</th>
                  <th>Time</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {popLogs.map(log => (
                  <tr key={log.id}>
                    <td><span className="text-white text-xs font-medium">{log.screen_name ?? '—'}</span></td>
                    <td><span className="text-slate-400 text-xs truncate max-w-28 block">{log.media_name ?? log.widget_type ?? '—'}</span></td>
                    <td><span className="text-slate-500 text-xs">{new Date(log.played_at).toLocaleTimeString()}</span></td>
                    <td><span className="text-slate-400 text-xs font-mono">{log.duration_played ?? 0}s</span></td>
                  </tr>
                ))}
                {popLogs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-600 text-sm">No playback logs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
