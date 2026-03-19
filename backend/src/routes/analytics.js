// src/routes/analytics.js
// ============================================================
// AEKADS Analytics — auto-detects table prefix (wilyer_ or plain)
// Dashboard endpoint NEVER crashes — returns zeros on any DB error
// ============================================================
const express = require('express');
const router  = express.Router();
const { authenticate }                        = require('../middlewares/auth');
const { requirePermission, requireOrgAccess } = require('../middlewares/rbac');
const { query }                               = require('../config/database');

router.use(authenticate, requireOrgAccess);

// ── Detect which table prefix is in use (cached after first call) ─────────
let _tablePrefix = null;
const getPrefix = async () => {
  if (_tablePrefix !== null) return _tablePrefix;
  try {
    await query(`SELECT 1 FROM wilyer_screens LIMIT 1`);
    _tablePrefix = 'wilyer_';
  } catch {
    _tablePrefix = '';
  }
  return _tablePrefix;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', requirePermission('analytics', 'read'), async (req, res) => {
  const orgId = req.user.orgId;

  const zero = {
    screens:  { total: 0, online: 0, offline: 0, license_issues: 0 },
    media:    { total_files: 0, total_bytes: '0', videos: 0, images: 0 },
    playback: { plays_today: 0, active_screens_today: 0 },
    trend:    [],
  };

  try {
    const p = await getPrefix();

    const screens_tbl  = `${p}screens`;
    const media_tbl    = `${p}media_files`;
    const playback_tbl = `${p}playback_logs`;

    // Media deleted condition differs between schemas
    const mediaDeleted = p === 'wilyer_' ? `deleted_at IS NULL` : `is_deleted = FALSE`;

    const [screenStats, mediaStats, playbackToday, trend] = await Promise.all([

      query(`
        SELECT
          COUNT(*)::int                                                                    AS total,
          COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '60 seconds')::int          AS online,
          COUNT(*) FILTER (WHERE last_seen IS NULL OR last_seen <= NOW() - INTERVAL '60 seconds')::int AS offline,
          COUNT(*) FILTER (WHERE license_expires_at IS NOT NULL AND license_expires_at < NOW())::int   AS license_issues
        FROM ${screens_tbl}
        WHERE org_id = $1 AND deleted_at IS NULL
      `, [orgId]).catch(() => ({ rows: [zero.screens] })),

      query(`
        SELECT
          COUNT(*)::int                        AS total_files,
          COALESCE(SUM(file_size), 0)::bigint  AS total_bytes,
          COUNT(*) FILTER (WHERE resource_type = 'video')::int AS videos,
          COUNT(*) FILTER (WHERE resource_type = 'image')::int AS images
        FROM ${media_tbl}
        WHERE org_id = $1 AND ${mediaDeleted}
      `, [orgId]).catch(() => ({ rows: [zero.media] })),

      query(`
        SELECT
          COUNT(*)::int                  AS plays_today,
          COUNT(DISTINCT screen_id)::int AS active_screens_today
        FROM ${playback_tbl}
        WHERE org_id = $1 AND played_at >= CURRENT_DATE
      `, [orgId]).catch(() => ({ rows: [zero.playback] })),

      query(`
        SELECT DATE(played_at) AS date, COUNT(*)::int AS plays
        FROM ${playback_tbl}
        WHERE org_id = $1 AND played_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(played_at)
        ORDER BY date ASC
      `, [orgId]).catch(() => ({ rows: [] })),
    ]);

    res.json({
      success: true,
      data: {
        screens:  screenStats.rows[0]   || zero.screens,
        media:    mediaStats.rows[0]    || zero.media,
        playback: playbackToday.rows[0] || zero.playback,
        trend:    trend.rows,
      }
    });
  } catch (err) {
    console.error('[analytics/dashboard] error:', err.message);
    res.json({ success: true, data: zero });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/screens/:id/uptime
// ─────────────────────────────────────────────────────────────────────────────
router.get('/screens/:id/uptime', requirePermission('analytics', 'read'), async (req, res, next) => {
  try {
    const { orgId }          = req.user;
    const { id }             = req.params;
    const { period = '24h' } = req.query;
    const p = await getPrefix();

    const intervals = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
    const expected  = { '24h': 24*60*2,    '7d': 7*24*60*2, '30d': 30*24*60*2 };
    const interval  = intervals[period] || '24 hours';

    const result = await query(`
      SELECT COUNT(*)::int                   AS heartbeat_count,
             MIN(timestamp)                  AS first_seen,
             MAX(timestamp)                  AS last_seen,
             AVG(cpu_usage)::numeric(5,2)    AS avg_cpu,
             AVG(memory_usage)::numeric(5,2) AS avg_memory
      FROM ${p}device_heartbeats
      WHERE screen_id = $1
        AND timestamp > NOW() - INTERVAL '${interval}'
        AND screen_id IN (SELECT id FROM ${p}screens WHERE org_id = $2 AND deleted_at IS NULL)
    `, [id, orgId]).catch(() => ({ rows: [{ heartbeat_count: 0 }] }));

    const heartbeats = parseInt(result.rows[0]?.heartbeat_count || 0);
    const expectedN  = expected[period] || expected['24h'];
    const uptimePct  = Math.min(100, (heartbeats / expectedN) * 100).toFixed(1);

    res.json({ success: true, data: { ...result.rows[0], period, uptime_percentage: uptimePct } });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/proof-of-play
// ─────────────────────────────────────────────────────────────────────────────
router.get('/proof-of-play', requirePermission('analytics', 'read'), async (req, res, next) => {
  try {
    const { orgId }   = req.user;
    const { screenId, mediaId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const p = await getPrefix();

    let conditions = ['pl.org_id = $1'];
    let params     = [orgId];
    let idx        = 2;

    if (screenId)  { conditions.push(`pl.screen_id = $${idx++}`);  params.push(screenId); }
    if (mediaId)   { conditions.push(`pl.media_id = $${idx++}`);   params.push(mediaId); }
    if (startDate) { conditions.push(`pl.played_at >= $${idx++}`); params.push(startDate); }
    if (endDate)   { conditions.push(`pl.played_at <= ($${idx++}::date + INTERVAL '1 day')`); params.push(endDate); }

    const where  = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const logs = await query(`
      SELECT pl.id, pl.played_at, pl.duration_played, pl.completed,
             s.device_name AS screen_name, s.location,
             mf.name       AS media_name,  mf.resource_type,
             pp.name       AS playlist_name
      FROM ${p}playback_logs pl
      LEFT JOIN ${p}screens     s  ON s.id  = pl.screen_id
      LEFT JOIN ${p}media_files mf ON mf.id = pl.media_id
      LEFT JOIN ${p}playlists   pp ON pp.id = pl.playlist_id
      WHERE ${where}
      ORDER BY pl.played_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, parseInt(limit), offset]);

    res.json({ success: true, data: logs.rows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/media
// ─────────────────────────────────────────────────────────────────────────────
router.get('/media', requirePermission('analytics', 'read'), async (req, res, next) => {
  try {
    const { orgId }         = req.user;
    const { period = '7d' } = req.query;
    const p = await getPrefix();

    const intervals = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
    const interval  = intervals[period] || '7 days';
    const mediaDeleted = p === 'wilyer_' ? 'deleted_at IS NULL' : 'is_deleted = FALSE';

    const result = await query(`
      SELECT mf.id, mf.name, mf.thumbnail_url, mf.resource_type,
             COUNT(pl.id)::int                         AS play_count,
             COALESCE(SUM(pl.duration_played), 0)::int AS total_play_time
      FROM ${p}media_files mf
      LEFT JOIN ${p}playback_logs pl
        ON  pl.media_id  = mf.id
        AND pl.played_at > NOW() - INTERVAL '${interval}'
      WHERE mf.org_id = $1 AND ${mediaDeleted}
      GROUP BY mf.id
      ORDER BY play_count DESC
      LIMIT 20
    `, [orgId]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/export
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export', requirePermission('analytics', 'read'), async (req, res, next) => {
  try {
    const { orgId }              = req.user;
    const { startDate, endDate } = req.query;
    const p = await getPrefix();

    const data = await query(`
      SELECT s.device_name, s.location,
             mf.name AS media_name, mf.resource_type,
             pl.played_at, pl.duration_played, pl.completed
      FROM ${p}playback_logs pl
      JOIN  ${p}screens     s  ON s.id  = pl.screen_id
      LEFT JOIN ${p}media_files mf ON mf.id = pl.media_id
      WHERE pl.org_id = $1
        AND ($2::date IS NULL OR pl.played_at >= $2::date)
        AND ($3::date IS NULL OR pl.played_at <= $3::date + INTERVAL '1 day')
      ORDER BY pl.played_at DESC
      LIMIT 10000
    `, [orgId, startDate || null, endDate || null]);

    const headers = ['Screen', 'Location', 'Media', 'Type', 'Played At', 'Duration (s)', 'Completed'];
    const rows    = data.rows.map(r => [
      r.device_name, r.location, r.media_name, r.resource_type,
      r.played_at?.toISOString(), r.duration_played, r.completed,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(c => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="aekads-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;