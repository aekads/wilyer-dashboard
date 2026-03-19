// src/controllers/widgetController.js
// ============================================================
// AEKADS Widget Controller — Full CRUD + Player endpoint
// ============================================================

const { query, transaction } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { createAuditLog } = require('../services/auditService');
const logger = require('../utils/logger');

// ── Per-type default configs ──────────────────────────────────
const WIDGET_DEFAULTS = {
  clock:          { timezone:'UTC', format:'12h', showDate:true, showSeconds:true, dateFormat:'dddd, MMMM D YYYY' },
  weather:        { city:'', country:'US', unit:'celsius', showForecast:true, days:3, showHumidity:true, showWind:true },
  rss_feed:       { url:'', maxItems:5, scrollSpeed:50, showImages:true, showDate:true, autoScroll:true },
  web_url:        { url:'', zoom:1.0, scrollable:false, reloadInterval:300 },
  notice_board:   { messages:[], scrollDirection:'up', speed:40, showBullets:true, bulletColor:'#3B82F6' },
  live_counter:   { label:'Count', count:0, unit:'', prefix:'', suffix:'', animateOnLoad:true },
  qr_code:        { url:'', size:300, errorLevel:'M', label:'', showLabel:true, foregroundColor:'#000000', backgroundColor:'#FFFFFF' },
  social_feed:    { platform:'twitter', username:'', hashtag:'', maxPosts:6 },
  stock_ticker:   { symbols:['AAPL','GOOG','MSFT'], currency:'USD', showChange:true, showPercent:true, scrollSpeed:40 },
  youtube:        { videoId:'', autoplay:true, muted:true, loop:true, showControls:false, startAt:0 },
  google_slides:  { presentationId:'', autoAdvance:true, slideInterval:10, loop:true },
  custom_html:    { html:'<div style="color:white;padding:20px">Custom Widget</div>', css:'', js:'', sandboxed:true },
  countdown:      { targetDate:'', label:'Countdown', showDays:true, showHours:true, showMinutes:true, showSeconds:true, expiredMessage:'Time is up!' },
  google_traffic: { lat:0, lon:0, zoom:12, showControls:false },
};

const VALID_TYPES = Object.keys(WIDGET_DEFAULTS);

// ── helpers ───────────────────────────────────────────────────
const mergeConfig = (type, cfg = {}) => ({ ...WIDGET_DEFAULTS[type], ...cfg });

const validateConfig = (type, cfg) => {
  if (type === 'rss_feed'   && !cfg.url)             throw new AppError('RSS URL is required', 400);
  if (type === 'web_url'    && !cfg.url)             throw new AppError('URL is required for Web Page widget', 400);
  if (type === 'youtube'    && !cfg.videoId)         throw new AppError('Video ID is required for YouTube widget', 400);
  if (type === 'google_slides' && !cfg.presentationId) throw new AppError('Presentation ID is required', 400);
  if (type === 'qr_code'    && !cfg.url)             throw new AppError('URL is required for QR Code widget', 400);
  if (type === 'weather'    && !cfg.city && !cfg.lat) throw new AppError('City or coordinates required for Weather widget', 400);
  if (type === 'countdown'  && !cfg.targetDate)      throw new AppError('Target date is required for Countdown widget', 400);
};

// ─────────────────────────────────────────────────────────────
// GET /api/widgets/types  — catalogue (no auth needed for UI)
// ─────────────────────────────────────────────────────────────
const getWidgetTypes = (req, res) => {
  res.json({ success: true, data: [
    { type:'clock',          label:'Clock',          icon:'Clock',        color:'#3B82F6', desc:'Digital clock with timezone support' },
    { type:'weather',        label:'Weather',        icon:'Cloud',        color:'#0EA5E9', desc:'Live weather & multi-day forecast' },
    { type:'rss_feed',       label:'RSS Feed',       icon:'Rss',          color:'#F97316', desc:'Live news from any RSS feed' },
    { type:'web_url',        label:'Web Page',       icon:'Globe',        color:'#10B981', desc:'Embed any website or web app' },
    { type:'notice_board',   label:'Notice Board',   icon:'MessageSquare',color:'#8B5CF6', desc:'Scrolling notices & announcements' },
    { type:'live_counter',   label:'Live Counter',   icon:'Hash',         color:'#EC4899', desc:'Animated number counter' },
    { type:'qr_code',        label:'QR Code',        icon:'QrCode',       color:'#374151', desc:'QR code linking to any URL' },
    { type:'social_feed',    label:'Social Feed',    icon:'Share2',       color:'#06B6D4', desc:'Twitter / Instagram posts' },
    { type:'stock_ticker',   label:'Stock Ticker',   icon:'TrendingUp',   color:'#059669', desc:'Live stock prices & market data' },
    { type:'youtube',        label:'YouTube',        icon:'Youtube',      color:'#EF4444', desc:'Autoplay YouTube video' },
    { type:'google_slides',  label:'Google Slides',  icon:'Presentation', color:'#F59E0B', desc:'Auto-advancing slides presentation' },
    { type:'custom_html',    label:'Custom HTML',    icon:'Code',         color:'#7C3AED', desc:'Custom HTML / CSS / JS widget' },
    { type:'countdown',      label:'Countdown',      icon:'Timer',        color:'#F43F5E', desc:'Countdown timer to target date' },
    { type:'google_traffic', label:'Traffic Map',    icon:'Map',          color:'#14B8A6', desc:'Live traffic map for any location' },
  ]});
};

// ─────────────────────────────────────────────────────────────
// GET /api/widgets/defaults/:type
// ─────────────────────────────────────────────────────────────
const getWidgetDefaults = (req, res, next) => {
  try {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) throw new AppError(`Unknown widget type: ${type}`, 400);
    res.json({ success: true, data: { type, defaults: WIDGET_DEFAULTS[type] } });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/widgets/stats
// ─────────────────────────────────────────────────────────────
const getWidgetStats = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const r = await query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(CASE WHEN is_active = TRUE  THEN 1 END)    AS active,
        COUNT(CASE WHEN is_active = FALSE THEN 1 END)    AS inactive,
        COUNT(CASE WHEN is_approved = FALSE THEN 1 END)  AS unapproved
      FROM wilyer_widgets WHERE org_id = $1 AND is_deleted = FALSE
    `, [orgId]);
    res.json({ success: true, data: r.rows[0] });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/widgets
// ─────────────────────────────────────────────────────────────
const createWidget = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const {
      name, type, description,
      theme = 'dark', backgroundColor, textColor,
      fontSize = 24, fontFamily = 'inherit', borderRadius = 8, padding = 16,
      config = {}, refreshInterval = 300, cacheDuration = 60, previewUrl,
    } = req.body;

    if (!name?.trim())                 throw new AppError('Widget name is required', 400);
    if (!VALID_TYPES.includes(type))   throw new AppError(`Invalid widget type: ${type}`, 400);

    const mergedCfg = mergeConfig(type, config);
    validateConfig(type, mergedCfg);

    const r = await query(`
      INSERT INTO wilyer_widgets (
        org_id, created_by, name, type, description,
        theme, background_color, text_color, font_size, font_family, border_radius, padding,
        config, refresh_interval, cache_duration, preview_url
      ) VALUES ($1,$2,$3,$4,$5, $6,$7,$8,$9,$10,$11,$12, $13,$14,$15,$16)
      RETURNING *
    `, [
      orgId, userId, name.trim(), type, description?.trim() || null,
      theme, backgroundColor || null, textColor || null, fontSize, fontFamily, borderRadius, padding,
      JSON.stringify(mergedCfg), refreshInterval, cacheDuration, previewUrl || null,
    ]);

    const widget = r.rows[0];
    await createAuditLog({ orgId, userId, action:'widget.create', entityType:'widget', entityId:widget.id,
      newValues:{ name:widget.name, type:widget.type } });
    logger.info(`Widget created: ${widget.name} (${type}) by ${userId}`);
    res.status(201).json({ success:true, data:widget });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/widgets
// ─────────────────────────────────────────────────────────────
const getWidgets = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const { type, search, isActive, page=1, limit=48, sortBy='created_at', sortOrder='desc' } = req.query;

    const conds = ['w.org_id=$1','w.is_deleted=FALSE'];
    const params = [orgId];
    let idx = 2;

    if (type) { conds.push(`w.type=$${idx++}`); params.push(type); }
    if (search) { conds.push(`(w.name ILIKE $${idx} OR w.description ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (isActive !== undefined) { conds.push(`w.is_active=$${idx++}`); params.push(isActive==='true'); }

    const safe = ['created_at','name','type','updated_at'].includes(sortBy) ? sortBy : 'created_at';
    const ord  = sortOrder==='asc' ? 'ASC' : 'DESC';
    const where = conds.join(' AND ');
    const off   = (parseInt(page)-1) * parseInt(limit);

    const [rows, cnt] = await Promise.all([
      query(`
        SELECT w.*, u.first_name||' '||u.last_name AS created_by_name,
          (SELECT COUNT(*) FROM wilyer_playlist_items pi WHERE pi.widget_id=w.id) AS playlist_usage_count
        FROM wilyer_widgets w
        LEFT JOIN wilyer_users u ON u.id=w.created_by
        WHERE ${where}
        ORDER BY w.${safe} ${ord}
        LIMIT $${idx} OFFSET $${idx+1}
      `, [...params, parseInt(limit), off]),
      query(`SELECT COUNT(*) FROM wilyer_widgets w WHERE ${where}`, params),
    ]);

    res.json({ success:true, data:rows.rows, meta:{ total:parseInt(cnt.rows[0].count), page:parseInt(page), limit:parseInt(limit) } });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/widgets/:id
// ─────────────────────────────────────────────────────────────
const getWidget = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const r = await query(`
      SELECT w.*, u.first_name||' '||u.last_name AS created_by_name,
        (SELECT COUNT(*) FROM wilyer_playlist_items pi WHERE pi.widget_id=w.id) AS playlist_usage_count,
        (SELECT json_agg(json_build_object('id',p.id,'name',p.name,'status',p.status))
         FROM wilyer_playlist_items pi2 JOIN wilyer_playlists p ON p.id=pi2.playlist_id
         WHERE pi2.widget_id=w.id LIMIT 5) AS used_in_playlists
      FROM wilyer_widgets w LEFT JOIN wilyer_users u ON u.id=w.created_by
      WHERE w.id=$1 AND w.org_id=$2 AND w.is_deleted=FALSE
    `, [req.params.id, orgId]);
    if (!r.rows[0]) throw new AppError('Widget not found', 404);
    res.json({ success:true, data:r.rows[0] });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/widgets/:id
// ─────────────────────────────────────────────────────────────
const updateWidget = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { id } = req.params;
    const {
      name, description, theme, backgroundColor, textColor,
      fontSize, fontFamily, borderRadius, padding,
      config, refreshInterval, cacheDuration, isActive, previewUrl,
    } = req.body;

    const cur = await query('SELECT * FROM wilyer_widgets WHERE id=$1 AND org_id=$2 AND is_deleted=FALSE', [id, orgId]);
    if (!cur.rows[0]) throw new AppError('Widget not found', 404);
    const w = cur.rows[0];

    let finalCfg = w.config;
    if (config) {
      finalCfg = mergeConfig(w.type, { ...w.config, ...config });
      validateConfig(w.type, finalCfg);
    }

    const r = await query(`
      UPDATE wilyer_widgets SET
        name=COALESCE($1,name), description=COALESCE($2,description),
        theme=COALESCE($3,theme), background_color=COALESCE($4,background_color),
        text_color=COALESCE($5,text_color), font_size=COALESCE($6,font_size),
        font_family=COALESCE($7,font_family), border_radius=COALESCE($8,border_radius),
        padding=COALESCE($9,padding), config=$10,
        refresh_interval=COALESCE($11,refresh_interval),
        cache_duration=COALESCE($12,cache_duration),
        is_active=COALESCE($13,is_active),
        preview_url=COALESCE($14,preview_url),
        updated_at=NOW()
      WHERE id=$15 AND org_id=$16 RETURNING *
    `, [
      name?.trim(), description?.trim(), theme, backgroundColor, textColor,
      fontSize, fontFamily, borderRadius, padding,
      JSON.stringify(finalCfg), refreshInterval, cacheDuration,
      isActive !== undefined ? isActive : null, previewUrl,
      id, orgId,
    ]);

    await createAuditLog({ orgId, userId, action:'widget.update', entityType:'widget', entityId:id,
      oldValues:{ name:w.name }, newValues:{ name:name||w.name } });
    res.json({ success:true, data:r.rows[0] });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/widgets/:id
// ─────────────────────────────────────────────────────────────
const deleteWidget = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { id } = req.params;
    const usage = await query('SELECT COUNT(*) FROM wilyer_playlist_items WHERE widget_id=$1', [id]);
    if (parseInt(usage.rows[0].count) > 0)
      throw new AppError('Cannot delete widget used in playlists. Remove it from playlists first.', 400);
    const r = await query(
      'UPDATE wilyer_widgets SET is_deleted=TRUE,deleted_at=NOW() WHERE id=$1 AND org_id=$2 RETURNING name', [id, orgId]);
    if (!r.rows[0]) throw new AppError('Widget not found', 404);
    await createAuditLog({ orgId, userId, action:'widget.delete', entityType:'widget', entityId:id });
    res.json({ success:true, message:'Widget deleted' });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/widgets/:id/duplicate
// ─────────────────────────────────────────────────────────────
const duplicateWidget = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const src = await query('SELECT * FROM wilyer_widgets WHERE id=$1 AND org_id=$2 AND is_deleted=FALSE', [req.params.id, orgId]);
    if (!src.rows[0]) throw new AppError('Widget not found', 404);
    const r = await query(`
      INSERT INTO wilyer_widgets (
        org_id,created_by,name,type,description,
        theme,background_color,text_color,font_size,font_family,border_radius,padding,
        config,refresh_interval,cache_duration
      ) SELECT $1,$2,name||' (Copy)',type,description,
        theme,background_color,text_color,font_size,font_family,border_radius,padding,
        config,refresh_interval,cache_duration
      FROM wilyer_widgets WHERE id=$3 RETURNING *
    `, [orgId, userId, req.params.id]);
    res.status(201).json({ success:true, data:r.rows[0] });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/widgets/:id/approve
// ─────────────────────────────────────────────────────────────
const approveWidget = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { approve = true } = req.body;
    const r = await query(
      'UPDATE wilyer_widgets SET is_approved=$1,approved_by=$2,approved_at=NOW() WHERE id=$3 AND org_id=$4 RETURNING *',
      [Boolean(approve), userId, req.params.id, orgId]
    );
    if (!r.rows[0]) throw new AppError('Widget not found', 404);
    res.json({ success:true, data:r.rows[0] });
  } catch(err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/widgets/:id/render  — APK player endpoint
// ─────────────────────────────────────────────────────────────
const renderWidget = async (req, res, next) => {
  try {
    const r = await query(`
      SELECT w.* FROM wilyer_widgets w
      WHERE w.id=$1 AND w.is_deleted=FALSE AND w.is_active=TRUE AND w.is_approved=TRUE
    `, [req.params.id]);
    if (!r.rows[0]) throw new AppError('Widget not found or inactive', 404);
    const w = r.rows[0];
    res.json({ success:true, data:{
      id: w.id, type: w.type, name: w.name,
      theme: w.theme, backgroundColor: w.background_color, textColor: w.text_color,
      fontSize: w.font_size, fontFamily: w.font_family,
      borderRadius: w.border_radius, padding: w.padding,
      config: w.config, refreshInterval: w.refresh_interval, cacheDuration: w.cache_duration,
      serverTime: new Date().toISOString(),
    }});
  } catch(err) { next(err); }
};

module.exports = {
  getWidgetTypes, getWidgetDefaults, getWidgetStats,
  createWidget, getWidgets, getWidget, updateWidget, deleteWidget,
  duplicateWidget, approveWidget, renderWidget,
};