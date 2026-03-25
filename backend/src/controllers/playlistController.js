// src/controllers/playlistController.js
// ============================================================
// AEKADS Playlist Controller
// ============================================================
const { query, transaction } = require('../config/database')
const { AppError } = require('../middlewares/errorHandler')
const { createAuditLog } = require('../services/auditService')

// Lazy import — avoids circular dependency:
// playlistController → sockets → playlistController
const getSocketIO = () => require('../sockets').getSocketIO()

// ─── POST /api/playlists ──────────────────────────────────────────────────────
const createPlaylist = async (req, res, next) => {
  try {
    const { name, description, isLoop, transitionType, tags, layout_type, layouts } = req.body
    const { orgId, userId } = req.user

    if (!name?.trim()) throw new AppError('Playlist name is required', 400)

    const layoutsJson = layouts ? JSON.stringify(layouts.map((l, index) => ({
      id:          l.id,
      name:        l.name || `Layout ${index + 1}`,
      orientation: l.orientation || layout_type || 'vertical',
      width:       l.width  || 1920,
      height:      l.height || 1080,
      position:    index,
      zone_bounds: l.zone_bounds || null,   // ← SAVE zone_bounds
    }))) : '[]'

    const result = await query(`
      INSERT INTO wilyer_playlists
        (org_id, created_by, name, description, is_loop, transition_type, tags, layout_type, layouts, version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, 1)
      RETURNING *
    `, [
      orgId, userId,
      name.trim(),
      description || null,
      isLoop ?? true,
      transitionType || 'none',
      Array.isArray(tags) ? tags : [],
      layout_type || 'vertical',
      layoutsJson
    ])

    const playlist = result.rows[0]
    await createAuditLog({ orgId, userId, action: 'playlist.create', entityType: 'playlist', entityId: playlist.id, newValues: { name } })
    res.status(201).json({ success: true, data: playlist })
  } catch (err) {
    console.error('Create playlist error:', err)
    next(err)
  }
}
// ─── PATCH /api/playlists/:id ─────────────────────────────────────────────────
const updatePlaylist = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orgId, userId } = req.user
    const { name, description, layout_type, layouts, isLoop, transitionType, tags } = req.body

    let layoutsJson = null
    if (layouts) {
      layoutsJson = JSON.stringify(layouts.map((l, index) => ({
        id:          l.id,
        name:        l.name || `Layout ${index + 1}`,
        orientation: l.orientation || layout_type || 'vertical',
        width:       l.width  || 1920,
        height:      l.height || 1080,
        position:    index,
        zone_bounds: l.zone_bounds || null,   // ← SAVE zone_bounds
      })))
    }

    const result = await query(`
      UPDATE wilyer_playlists SET
        name            = COALESCE($1, name),
        description     = COALESCE($2, description),
        layout_type     = COALESCE($3, layout_type),
        layouts         = COALESCE($4::jsonb, layouts),
        is_loop         = COALESCE($5, is_loop),
        transition_type = COALESCE($6, transition_type),
        tags            = COALESCE($7, tags),
        version         = version + 1,
        updated_at      = NOW()
      WHERE id = $8 AND org_id = $9 AND deleted_at IS NULL
      RETURNING *
    `, [
      name?.trim() || null,
      description ?? null,
      layout_type || null,
      layoutsJson,
      isLoop ?? null,
      transitionType || null,
      Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : null),
      id, orgId,
    ])

    if (!result.rows[0]) throw new AppError('Playlist not found', 404)
    await createAuditLog({ orgId, userId, action: 'playlist.update', entityType: 'playlist', entityId: id, newValues: { name, layout_type } })
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    console.error('Update playlist error:', err)
    next(err)
  }
}

// ─── GET /api/playlists ───────────────────────────────────────────────────────
// ─── GET /api/playlists ───────────────────────────────────────────────────────
const getPlaylists = async (req, res, next) => {
  try {
    const { orgId } = req.user
    const { status, search, type, page = 1, limit = 20 } = req.query
    const offset = (page - 1) * limit

    let conditions = ['p.org_id = $1', 'p.deleted_at IS NULL']
    let params = [orgId]
    let idx = 2

    if (status) { conditions.push(`p.status = $${idx++}`); params.push(status) }
    if (type)   { conditions.push(`p.layout_type = $${idx++}`); params.push(type) }
    if (search) { conditions.push(`p.name ILIKE $${idx++}`); params.push(`%${search}%`) }

    const where = conditions.join(' AND ')

    const [playlists, total] = await Promise.all([
      query(`
        SELECT
          p.id,
          p.org_id,
          p.created_by,
          p.name,
          p.description,
          p.status,
          p.layout_type,
          p.layouts,
          p.is_loop,
          p.transition_type,
          p.tags,
          p.version,
          p.published_at,
          p.published_by,
          p.total_duration,
          p.created_at,
          p.updated_at,
          p.deleted_at,
          u.first_name || ' ' || u.last_name AS creator_name,
          COUNT(DISTINCT pi.id)::int AS item_count,
          COUNT(DISTINCT s.id)::int AS screen_count
        FROM wilyer_playlists p
        LEFT JOIN wilyer_users u ON u.id = p.created_by
        LEFT JOIN wilyer_playlist_items pi ON pi.playlist_id = p.id AND pi.is_active = TRUE
        LEFT JOIN wilyer_screens s ON s.assigned_playlist_id = p.id AND s.deleted_at IS NULL
        WHERE ${where}
        GROUP BY 
          p.id, 
          p.org_id,
          p.created_by,
          p.name,
          p.description,
          p.status,
          p.layout_type,
          p.layouts,
          p.is_loop,
          p.transition_type,
          p.tags,
          p.version,
          p.published_at,
          p.published_by,
          p.total_duration,
          p.created_at,
          p.updated_at,
          p.deleted_at,
          u.first_name,
          u.last_name
        ORDER BY p.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, [...params, limit, offset]),
      query(`SELECT COUNT(*) FROM wilyer_playlists p WHERE ${where}`, params),
    ])

    res.json({
      success: true,
      data: playlists.rows,
      meta: {
        total: parseInt(total.rows[0].count),
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(total.rows[0].count) / limit),
      },
    })
  } catch (err) { 
    console.error('Error in getPlaylists:', err);
    next(err); 
  }
};

// ─── GET /api/playlists/:id ───────────────────────────────────────────────────
const getPlaylist = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orgId } = req.user

    const playlistResult = await query(`
      SELECT p.*,
        u.first_name || ' ' || u.last_name AS creator_name,
        pub.first_name || ' ' || pub.last_name AS publisher_name
      FROM wilyer_playlists p
      LEFT JOIN wilyer_users u ON u.id = p.created_by
      LEFT JOIN wilyer_users pub ON pub.id = p.published_by
      WHERE p.id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL
    `, [id, orgId])

    if (!playlistResult.rows[0]) throw new AppError('Playlist not found', 404)

    const playlist = playlistResult.rows[0]

    let layouts = parseJsonField(playlist.layouts, [])

    // Parse zone_bounds in each layout
    layouts = layouts.map(l => ({
      ...l,
      zone_bounds: parseJsonField(l.zone_bounds, null),
    }))

    if (layouts.length === 0 && playlist.layout_type) {
      layouts = [{
        id:          'layout-default',
        name:        'Main Layout',
        orientation: playlist.layout_type,
        width:       1920,
        height:      1080,
        position:    0,
        zone_bounds: null,
      }]
    }

    const itemsResult = await query(`
      SELECT
        pi.*,
        mf.name         AS media_name,
        mf.secure_url,
        mf.thumbnail_url,
        mf.resource_type,
        mf.format,
        mf.duration     AS media_duration,
        mf.width        AS media_width,
        mf.height       AS media_height,
        w.name          AS widget_name,
        w.type          AS widget_type_from_table,
        w.config        AS widget_config_from_table
      FROM wilyer_playlist_items pi
      LEFT JOIN wilyer_media_files mf ON mf.id = pi.media_id
      LEFT JOIN wilyer_widgets w ON w.id = pi.widget_id
      WHERE pi.playlist_id = $1
      ORDER BY pi.position ASC
    `, [id])

    const itemsByLayout = buildItemsByLayout(itemsResult.rows, layouts)
    const items = itemsResult.rows.map(row => normalizeItemRow(row))

    res.json({
      success: true,
      data: {
        ...playlist,
        layouts,
        items,
        items_by_layout: itemsByLayout
      }
    })
  } catch (err) {
    console.error('Get playlist error:', err)
    next(err)
  }
}
// ─── PUT /api/playlists/:id/items ─────────────────────────────────────────────
const updatePlaylistItems = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orgId, userId } = req.user
    const { items } = req.body

    if (!Array.isArray(items)) throw new AppError('items must be an array', 400)

    const playlist = await query(
      `SELECT id, version FROM wilyer_playlists WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [id, orgId]
    )
    if (!playlist.rows[0]) throw new AppError('Playlist not found', 404)

    let newVersion
    await transaction(async (client) => {
      await client.query(`DELETE FROM wilyer_playlist_items WHERE playlist_id = $1`, [id])

      if (items.length > 0) {
        const rows = items.map((item, index) => {
          const pos = item.position !== undefined ? item.position : index * 10
         const wConfig = {
  ...(item.widgetConfig || {}),
  zoneId:      item.widgetConfig?.zoneId   || item.zoneId   || 'zone-main',
  layoutId:    item.widgetConfig?.layoutId || item.layoutId || null,
  bounds:      item.widgetConfig?.bounds   || { x: 0, y: 0, w: 100, h: 100 },
  mediaName:    item.widgetConfig?.mediaName    || null,
  thumbnailUrl: item.widgetConfig?.thumbnailUrl || null,
  secureUrl:    item.widgetConfig?.secureUrl    || null,
  resourceType: item.widgetConfig?.resourceType || null,
}

// Add this validation
if (!item.widgetConfig?.zoneId && !item.zoneId) {
  console.warn(`⚠️  [PLAYLIST] Item at position ${pos} has no zoneId — defaulting to zone-main`)
}
          return [
            id,
            item.mediaId    || null,
            item.widgetId   || null,
            item.widgetType || null,
            JSON.stringify(wConfig),
            pos,
            item.duration || 10,
            true,
            item.widgetType ? 'widget' : 'media',
          ]
        })

        const placeholders = rows.map((_, i) => {
          const b = i * 9
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`
        }).join(',')

        await client.query(`
          INSERT INTO wilyer_playlist_items
            (playlist_id, media_id, widget_id, widget_type, widget_config,
             position, duration, is_active, item_type)
          VALUES ${placeholders}
        `, rows.flat())
      }

      const updated = await client.query(`
        UPDATE wilyer_playlists SET version = version + 1, updated_at = NOW()
        WHERE id = $1 RETURNING version
      `, [id])
      newVersion = updated.rows[0].version
    })

    console.log(`✅ [PLAYLIST] Items saved for playlist ${id}, new version: ${newVersion}`)

    // ── Push updated playlist to all assigned screens via "message" event ────
    const io = getSocketIO()
    if (io) {
      const playlistData = await getFullPlaylistData(id, orgId)
      const screens = await query(
        `SELECT id FROM wilyer_screens WHERE assigned_playlist_id = $1 AND deleted_at IS NULL`,
        [id]
      )

      if (playlistData && screens.rows.length > 0) {
        console.log(`📡 [PLAYLIST] Pushing v${newVersion} to ${screens.rows.length} screen(s)`)

        for (const screen of screens.rows) {
          try {
            const { encryptForDevice } = require('../utils/encryption')
            const dbScreen = await query(
              `SELECT s.aes_secret_key, dpc.temp_auth_key AS auth_key
               FROM wilyer_screens s
               JOIN wilyer_device_pairing_codes dpc ON dpc.id = s.pairing_code_id
               WHERE s.id = $1 AND s.deleted_at IS NULL`,
              [screen.id]
            )
            if (!dbScreen.rows[0]) {
              console.warn(`⚠️  [PLAYLIST] Screen ${screen.id} not found — skipping`)
              continue
            }

            const { aes_secret_key, auth_key } = dbScreen.rows[0]
            const room     = io.sockets.adapter.rooms.get(auth_key)
            const roomSize = room?.size || 0

            if (roomSize > 0) {
              const aesKey    = Buffer.from(aes_secret_key, 'base64')
              const payload   = buildPlayablePayload(playlistData, newVersion)
              const encrypted = encryptForDevice(payload, aesKey)
              // "message" is the single server→device event name (per flow diagram)
              io.to(auth_key).emit('message', encrypted)
              console.log(`✅ [PLAYLIST] Pushed to screen ${screen.id} room "${auth_key}" (${roomSize} socket(s))`)
            } else {
              console.log(`⚠️  [PLAYLIST] Screen ${screen.id} offline — skipping live push`)
            }
          } catch (e) {
            console.error(`❌ [PLAYLIST] Push failed for screen ${screen.id}:`, e.message)
          }
        }
      }
    } else {
      console.warn('⚠️  [PLAYLIST] Socket.io not ready — skipping live push')
    }

    res.json({
      success: true,
      message: 'Playlist items updated successfully',
      data: { count: items.length, version: newVersion }
    })
  } catch (err) {
    console.error('Update playlist items error:', err)
    next(err)
  }
}

// ─── POST /api/playlists/:id/publish ─────────────────────────────────────────
const publishPlaylist = async (req, res, next) => {
  try {
    const { id } = req.params
    const { action } = req.body
    const { orgId, userId } = req.user

    if (!['publish', 'unpublish'].includes(action))
      throw new AppError('action must be "publish" or "unpublish"', 400)

    const newStatus = action === 'publish' ? 'published' : 'draft'

    const result = await query(`
      UPDATE wilyer_playlists SET
        status       = $1,
        published_at = ${action === 'publish' ? 'NOW()' : 'NULL'},
        published_by = ${action === 'publish' ? `$4` : 'NULL'},
        updated_at   = NOW()
      WHERE id = $2 AND org_id = $3 AND deleted_at IS NULL
      RETURNING *
    `, action === 'publish' ? [newStatus, id, orgId, userId] : [newStatus, id, orgId])

    if (!result.rows[0]) throw new AppError('Playlist not found', 404)

    if (action === 'unpublish') {
      const screens = await query(
        `SELECT id FROM wilyer_screens WHERE assigned_playlist_id = $1 AND deleted_at IS NULL`, [id]
      )
      const io = getSocketIO()
      screens.rows.forEach(s => {
        io?.to(`screen:${s.id}`).emit('playlist:unpublished', { playlistId: id })
      })
    }

    await createAuditLog({ orgId, userId, action: `playlist.${action}`, entityType: 'playlist', entityId: id })
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
}

// ─── GET /api/playlists/:id/preview ──────────────────────────────────────────
const previewPlaylist = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orgId } = req.user
    const items = await query(`
      SELECT pi.*, mf.secure_url, mf.thumbnail_url, mf.resource_type, mf.name AS media_name
      FROM wilyer_playlist_items pi
      LEFT JOIN wilyer_media_files mf ON mf.id = pi.media_id
      JOIN wilyer_playlists p ON p.id = pi.playlist_id
      WHERE pi.playlist_id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL
      ORDER BY pi.position ASC
    `, [id, orgId])
    res.json({ success: true, data: items.rows })
  } catch (err) { next(err) }
}

// ─── DELETE /api/playlists/:id ────────────────────────────────────────────────
const deletePlaylist = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orgId, userId } = req.user
    const usage = await query(
      `SELECT COUNT(*) FROM wilyer_screens WHERE assigned_playlist_id = $1 AND deleted_at IS NULL`, [id]
    )
    if (parseInt(usage.rows[0].count) > 0)
      throw new AppError('Cannot delete a playlist assigned to screens. Unassign first.', 400)
    await query(`UPDATE wilyer_playlists SET deleted_at = NOW() WHERE id = $1 AND org_id = $2`, [id, orgId])
    await createAuditLog({ orgId, userId, action: 'playlist.delete', entityType: 'playlist', entityId: id })
    res.json({ success: true, message: 'Playlist deleted' })
  } catch (err) { next(err) }
}

// ─── GET /api/playlists/:id/versions ─────────────────────────────────────────
const getVersionHistory = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orgId } = req.user
    const p = await query(`SELECT id FROM wilyer_playlists WHERE id = $1 AND org_id = $2`, [id, orgId])
    if (!p.rows[0]) throw new AppError('Playlist not found', 404)
    const versions = await query(`
      SELECT pv.*, u.first_name || ' ' || u.last_name AS creator_name
      FROM wilyer_playlist_versions pv
      LEFT JOIN wilyer_users u ON u.id = pv.created_by
      WHERE pv.playlist_id = $1 ORDER BY pv.version DESC LIMIT 20
    `, [id])
    res.json({ success: true, data: versions.rows })
  } catch (err) { next(err) }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function parseJsonField(field, fallback) {
  if (!field) return fallback
  if (typeof field !== 'string') return field
  try { return JSON.parse(field) } catch { return fallback }
}

function normalizeItemRow(row) {
  const wConfig = parseJsonField(row.widget_config, {})
  return {
    id:             row.id,
    playlist_id:    row.playlist_id,
    media_id:       row.media_id,
    widget_id:      row.widget_id,
    widget_type:    row.widget_type || row.widget_type_from_table || null,
    widget_config:  wConfig,
    item_type:      row.item_type || (row.widget_type ? 'widget' : 'media'),
    position:       row.position,
    duration:       row.duration,
    is_active:      row.is_active,
    created_at:     row.created_at,
    updated_at:     row.updated_at,
    layout_id:      wConfig.layoutId  || null,
    zone_id:        wConfig.zoneId    || 'zone-main',
    bounds:         wConfig.bounds    || { x: 0, y: 0, w: 100, h: 100 },
    media_name:     row.media_name    || wConfig.mediaName    || null,
    secure_url:     row.secure_url    || wConfig.secureUrl    || null,
    thumbnail_url:  row.thumbnail_url || wConfig.thumbnailUrl || null,
    resource_type:  row.resource_type || wConfig.resourceType || null,
    format:         row.format        || null,
    media_duration: row.media_duration || null,
    width:          row.media_width   || null,
    height:         row.media_height  || null,
  }
}

function buildItemsByLayout(rows, layouts) {
  const defaultLayoutId = layouts[0]?.id || 'default'
  const itemsByLayout = {}
  layouts.forEach(layout => { itemsByLayout[layout.id] = {} })

  rows.forEach(row => {
    const item     = normalizeItemRow(row)
    const layoutId = item.layout_id || defaultLayoutId
    const zoneId   = item.zone_id   || 'zone-main'

    if (!itemsByLayout[layoutId])         itemsByLayout[layoutId] = {}
    if (!itemsByLayout[layoutId][zoneId]) itemsByLayout[layoutId][zoneId] = []

    itemsByLayout[layoutId][zoneId].push({
      id:             item.id,
      media_id:       item.media_id,
      widget_id:      item.widget_id,
      widget_type:    item.widget_type,
      widget_config:  item.widget_config,
      item_type:      item.item_type,
      position:       item.position,
      duration:       item.duration,
      bounds:         item.bounds,
      media_name:     item.media_name,
      secure_url:     item.secure_url,
      thumbnail_url:  item.thumbnail_url,
      resource_type:  item.resource_type,
      format:         item.format,
      media_duration: item.media_duration,
      width:          item.width,
      height:         item.height,
      media: item.media_id ? {
        id:            item.media_id,
        name:          item.media_name,
        secure_url:    item.secure_url,
        thumbnail_url: item.thumbnail_url,
        resource_type: item.resource_type,
        format:        item.format,
        duration:      item.media_duration,
        width:         item.width,
        height:        item.height,
      } : null,
    })
  })

  Object.values(itemsByLayout).forEach(zones =>
    Object.values(zones).forEach(zoneItems =>
      zoneItems.sort((a, b) => a.position - b.position)
    )
  )
  return itemsByLayout
}

/**
 * Fetch full playlist + items from DB.
 * Exported for screenController and sockets.
 */
const getFullPlaylistData = async (playlistId, orgId) => {
  try {
    const [playlistRes, itemsRes] = await Promise.all([
      query(
        `SELECT * FROM wilyer_playlists WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
        [playlistId, orgId]
      ),
      query(`
        SELECT
          pi.*,
          mf.name         AS media_name,
          mf.secure_url,
          mf.thumbnail_url,
          mf.resource_type,
          mf.format,
          mf.duration     AS media_duration,
          mf.width        AS media_width,
          mf.height       AS media_height
        FROM wilyer_playlist_items pi
        LEFT JOIN wilyer_media_files mf ON mf.id = pi.media_id
        WHERE pi.playlist_id = $1
          AND (pi.is_active = TRUE OR pi.is_active IS NULL)
        ORDER BY pi.position ASC
      `, [playlistId])
    ])

    if (!playlistRes.rows[0]) return null

    const pl = playlistRes.rows[0]
    let layouts = parseJsonField(pl.layouts, [])

    // Parse zone_bounds for each layout
    layouts = layouts.map(l => ({
      ...l,
      zone_bounds: parseJsonField(l.zone_bounds, null),
    }))

    // Fallback if no layouts saved
    if (layouts.length === 0) {
      layouts = [{
        id:          'layout-default',
        name:        'Main Layout',
        orientation: pl.layout_type || 'vertical',
        width:       1920,
        height:      1080,
        position:    0,
        zone_bounds: null,
      }]
    }

    const itemsByLayout = buildItemsByLayout(itemsRes.rows, layouts)
    const totalDuration = itemsRes.rows.reduce((s, r) => s + (r.duration || 10), 0)

    return {
      id:              pl.id,
      name:            pl.name,
      description:     pl.description,
      status:          pl.status,
      version:         pl.version || 1,
      layout_type:     pl.layout_type || 'vertical',
      layouts,
      is_loop:         pl.is_loop !== false,
      transition_type: pl.transition_type || 'none',
      total_duration:  pl.total_duration || totalDuration,
      items_by_layout: itemsByLayout,
      items:           itemsRes.rows.map(normalizeItemRow),
    }
  } catch (err) {
    console.error('Failed to get full playlist data:', err)
    return null
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// APK PAYLOAD BUILDER
// ─────────────────────────────────────────────────────────────────────────────
//
// OUTPUT — what the APK receives after AES decryption of the "message" event:
//
// {
//   "type": "playable_data",
//   "data": {
//     "playlistObjectArrayList": [
//       {
//         "playlistId": "uuid-here",
//         "playlistName": "My Playlist",
//         "isLoop": true,
//         "transitionType": "none",
//         "totalDuration": 30000,
//         "layoutObjectArrayList": [
//           {
//             "layoutId": "layout-uuid",
//             "layoutName": "Main Layout",
//             "layoutDuration": 30000,
//             "uiRotation": 0,
//             "zoneObjectArrayList": [
//               {
//                 "zoneId": "zone-main",
//                 "zoneName": "Main Zone",
//                 "zoneContentType": "image",
//                 "zoneConfig": {
//                   "zoneWidth": 1.0,
//                   "zoneHeight": 1.0,
//                   "zonePositionX": 0.0,
//                   "zonePositionY": 0.0,
//                   "zonePositionZ": 0.0
//                 },
//                 "sequenceObject": {
//                   "sequenceId": "seq-layout-uuid-zone-main",
//                   "sequenceName": "Sequence Main Zone",
//                   "mediaItems": [
//                     {
//                       "mediaId": "item-uuid",
//                       "mediaName": "photo.jpg",
//                       "mediaType": "image",
//                       "mediaRemotePath": "https://res.cloudinary.com/…/photo.jpg",
//                       "mediaDuration": 10000,
//                       "mediaLocalPath": null
//                     }
//                   ]
//                 },
//                 "sequenceScheduleDataObjectArrayList": null,
//                 "sequenceTriggerDataObjectArrayList":  null
//               }
//             ],
//             "layoutScheduleDataObjectArrayList": null,
//             "layoutTriggerDataObjectArrayList":  null
//           }
//         ],
//         "layoutScheduleDataObjectArrayList": null,
//         "layoutTriggerDataObjectArrayList":  null
//       }
//     ],
//     "scheduleDataObjectArrayList": null
//   }
// }
//


// function buildPlayablePayload(playlistData, version) {
//   const layouts       = playlistData.layouts        || []
//   const itemsByLayout = playlistData.items_by_layout || {}

//   const layoutObjectArrayList = layouts.map((layout, layoutIndex) => {
//     const zonesMap = itemsByLayout[layout.id] || {}

//     const zoneObjectArrayList = Object.entries(zonesMap).map(([zoneId, zoneItems]) => {
//       // bounds: stored as 0–100 pct in DB → convert to 0.0–1.0 for APK
//       const bounds = zoneItems[0]?.bounds || { x: 0, y: 0, w: 100, h: 100 }

//       // mediaItems — EXACTLY the 6 fields the APK contract defines
//       const mediaItems = zoneItems.map((item, idx) => ({
//         mediaId:         String(item.id),
//         mediaName:       item.media_name || item.widget_type || `item-${idx}`,
//         mediaType:       resolveMediaType(item),
//         mediaRemotePath: item.secure_url || item.widget_config?.url || null,
//         mediaDuration:   (item.duration || 10) * 1000,  // seconds → ms
//         mediaLocalPath:  null,
//       }))

//       return {
//         zoneId:          String(zoneId),
//         zoneName:        resolveZoneName(zoneId),
//         zoneContentType: resolveZoneContentType(zoneItems),
//         zoneConfig: {
//           zoneWidth:     pctToFloat(bounds.w),
//           zoneHeight:    pctToFloat(bounds.h),
//           zonePositionX: pctToFloat(bounds.x),
//           zonePositionY: pctToFloat(bounds.y),
//           zonePositionZ: 0.0,
//         },
//         sequenceObject: {
//           sequenceId:   `seq-${layout.id}-${zoneId}`,
//           sequenceName: `Sequence ${resolveZoneName(zoneId)}`,
//           mediaItems,
//         },
//         sequenceScheduleDataObjectArrayList: null,
//         sequenceTriggerDataObjectArrayList:  null,
//       }
//     })

//     return {
//       layoutId:       String(layout.id),
//       layoutName:     layout.name || `Layout ${layoutIndex + 1}`,
//       layoutDuration: calcLayoutDuration(zonesMap),
//       uiRotation:     resolveRotation(layout),
//       zoneObjectArrayList,
//       layoutScheduleDataObjectArrayList: null,
//       layoutTriggerDataObjectArrayList:  null,
//     }
//   })

//   // ── Root envelope — exactly matches APK contract ──────────────────────────
//   return {
//     type: 'playable_data',
//     data: {
//       playlistObjectArrayList: [
//         {
//           playlistId:    String(playlistData.id),
//           playlistName:  playlistData.name,
//           isLoop:        playlistData.is_loop !== false,
//           transitionType: playlistData.transition_type || 'none',
//           totalDuration: (playlistData.total_duration || 0) * 1000,  // seconds → ms
//           layoutObjectArrayList,
//           layoutScheduleDataObjectArrayList: null,
//           layoutTriggerDataObjectArrayList:  null,
//         }
//       ],
//       scheduleDataObjectArrayList: null,
//     },
//   }
//   // NOTE: `version` is intentionally excluded from the APK payload.
//   //       It is a server-side tracking field only.
// }

function getCanonicalZoneBounds(orientation) {
  const presets = {
    'vertical':   { 'zone-main':          { x: 0,  y: 0,  w: 100, h: 100 } },
    'horizontal': {
      'zone-left':           { x: 0,  y: 0,  w: 50,  h: 100 },
      'zone-right':          { x: 50, y: 0,  w: 50,  h: 100 },
    },
    'top-bottom': {
      'zone-top':            { x: 0,  y: 0,  w: 100, h: 50  },
      'zone-bottom':         { x: 0,  y: 50, w: 100, h: 50  },
    },
    'custom': {
      'zone-top':            { x: 0,  y: 0,  w: 100, h: 50  },
      'zone-bottom-left':    { x: 0,  y: 50, w: 50,  h: 50  },
      'zone-bottom-right':   { x: 50, y: 50, w: 50,  h: 50  },
    },
    'pip': {
      'zone-main':           { x: 0,  y: 0,  w: 100, h: 100 },
      'zone-pip':            { x: 65, y: 60, w: 30,  h: 35  },
    },
  }
  return presets[orientation] || presets['vertical']
}

function buildPlayablePayload(playlistData, version) {
  const layouts       = playlistData.layouts        || []
  const itemsByLayout = playlistData.items_by_layout || {}

  const layoutObjectArrayList = layouts.map((layout, layoutIndex) => {
    const zonesMap = itemsByLayout[layout.id] || {}

    // 1. zone_bounds stored on layout (now actually saved!)
    let storedZoneBounds = {}
    try {
      const zb = layout.zone_bounds
      if (zb) storedZoneBounds = typeof zb === 'string' ? JSON.parse(zb) : zb
    } catch (e) {}

    // 2. Canonical fallback
    const canonicalZoneBounds = getCanonicalZoneBounds(layout.orientation || 'vertical')

    // 3. Merge: stored wins
    const resolvedZoneBounds = { ...canonicalZoneBounds, ...storedZoneBounds }

    console.log(`[PAYLOAD] Layout "${layout.name}" orientation="${layout.orientation}"`)
    console.log(`[PAYLOAD] zones in DB:`, Object.keys(zonesMap))
    console.log(`[PAYLOAD] resolvedZoneBounds:`, resolvedZoneBounds)

    // 4. Build zones — only zones with items
    const zoneObjectArrayList = Object.entries(zonesMap)
      .filter(([, zoneItems]) => zoneItems && zoneItems.length > 0)
      .map(([zoneId, zoneItems]) => {

        // Zone bounds priority: widgetConfig.zoneBounds > layout zone_bounds > canonical
        const firstItemConfig = zoneItems[0]?.widget_config || {}
        const wConfigZoneBounds = firstItemConfig.zoneBounds
        const zoneBounds =
          (wConfigZoneBounds && typeof wConfigZoneBounds === 'object' && wConfigZoneBounds.w
            ? wConfigZoneBounds
            : null)
          || resolvedZoneBounds[zoneId]
          || { x: 0, y: 0, w: 100, h: 100 }

        console.log(`[PAYLOAD]   Zone "${zoneId}" bounds:`, zoneBounds, `items: ${zoneItems.length}`)

        const mediaItems = zoneItems.map((item, idx) => ({
          mediaId:         String(item.id),
          mediaName:       item.media_name || item.widget_type || `item-${idx}`,
          mediaType:       resolveMediaType(item),
          mediaRemotePath: item.secure_url || item.widget_config?.secureUrl || null,
          mediaDuration:   (item.duration || 10) * 1000,
          mediaLocalPath:  null,
        }))

        return {
          zoneId:          String(zoneId),
          zoneName:        resolveZoneName(zoneId),
          zoneContentType: resolveZoneContentType(zoneItems),
          zoneConfig: {
            zoneWidth:     pctToFloat(zoneBounds.w),
            zoneHeight:    pctToFloat(zoneBounds.h),
            zonePositionX: pctToFloat(zoneBounds.x),
            zonePositionY: pctToFloat(zoneBounds.y),
            zonePositionZ: 0.0,
          },
          sequenceObject: {
            sequenceId:   `seq-${layout.id}-${zoneId}`,
            sequenceName: `Sequence ${resolveZoneName(zoneId)}`,
            mediaItems,
          },
          sequenceScheduleDataObjectArrayList: null,
          sequenceTriggerDataObjectArrayList:  null,
        }
      })

    return {
      layoutId:       String(layout.id),
      layoutName:     layout.name || `Layout ${layoutIndex + 1}`,
      layoutDuration: calcLayoutDuration(zonesMap),
      uiRotation:     resolveRotation(layout),
      zoneObjectArrayList,
      layoutScheduleDataObjectArrayList: null,
      layoutTriggerDataObjectArrayList:  null,
    }
  })

  return {
    type: 'playable_data',
    data: {
      playlistObjectArrayList: [{
        playlistId:    String(playlistData.id),
        playlistName:  playlistData.name,
        isLoop:        playlistData.is_loop !== false,
        transitionType: playlistData.transition_type || 'none',
        totalDuration: (playlistData.total_duration || 0) * 1000,
        layoutObjectArrayList,
        layoutScheduleDataObjectArrayList: null,
        layoutTriggerDataObjectArrayList:  null,
      }],
      scheduleDataObjectArrayList: null,
    },
  }
}
// ADD this new helper — canonical zone bounds by orientation
function getCanonicalZonesForOrientation(orientation) {
  if (orientation === 'horizontal') return [
    { id: 'zone-left',         bounds: { x: 0,  y: 0,  w: 50,  h: 100 } },
    { id: 'zone-right',        bounds: { x: 50, y: 0,  w: 50,  h: 100 } },
  ]
  if (orientation === 'custom') return [
    { id: 'zone-top',          bounds: { x: 0,  y: 0,  w: 100, h: 50  } },
    { id: 'zone-bottom-left',  bounds: { x: 0,  y: 50, w: 50,  h: 50  } },
    { id: 'zone-bottom-right', bounds: { x: 50, y: 50, w: 50,  h: 50  } },
  ]
  return [
    { id: 'zone-main',         bounds: { x: 0,  y: 0,  w: 100, h: 100 } },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure transform helpers
// ─────────────────────────────────────────────────────────────────────────────

/** 0–100 percentage → 0.0–1.0 float. Already-normalised values pass through. */
function pctToFloat(value) {
  if (value == null) return 0.0
  const n = parseFloat(value)
  if (isNaN(n)) return 0.0
  return parseFloat((n > 1 ? n / 100 : n).toFixed(6))
}

/** Readable zone name from its id string */
function resolveZoneName(zoneId) {
  const map = {
    'zone-main':          'Main Zone',
    'zone-left':          'Left Zone',
    'zone-right':         'Right Zone',
    'zone-top':           'Top Zone',
    'zone-bottom':        'Bottom Zone',
    'zone-bottom-left':   'Bottom Left Zone',
    'zone-bottom-right':  'Bottom Right Zone',
    'zone-pip':           'PIP Zone',
  }
  return map[zoneId] || String(zoneId)
}

/** mediaType string for APK renderer */
function resolveMediaType(item) {
  if (item.widget_type && item.widget_type !== 'media') return item.widget_type
  const rt = (item.resource_type || '').toLowerCase()
  if (rt === 'video') return 'video'
  if (rt === 'image') return 'image'
  if (rt === 'raw')   return 'document'
  const url = (item.secure_url || '').toLowerCase()
  if (/\.(mp4|mov|avi|mkv|webm)(\?|$)/.test(url))      return 'video'
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/.test(url)) return 'image'
  return 'unknown'
}

/** Zone-level content type for APK */
function resolveZoneContentType(items) {
  if (!items?.length) return 'unknown'
  const pureMedia = ['video', 'image', 'unknown', 'document']
  const types = items.map(resolveMediaType)
  if (types.some(t => !pureMedia.includes(t))) return 'widget'
  const unique = [...new Set(types)]
  if (unique.length === 1 && unique[0] === 'video') return 'video'
  if (unique.length === 1 && unique[0] === 'image') return 'image'
  return 'mixed'
}

/** Max zone duration (ms) — zones play in parallel so layout ends at the longest */
function calcLayoutDuration(zonesMap) {
  let max = 0
  Object.values(zonesMap).forEach(items => {
    const total = items.reduce((s, i) => s + (i.duration || 10) * 1000, 0)
    if (total > max) max = total
  })
  return max || 10_000
}

/** orientation → APK uiRotation integer */
function resolveRotation(layout) {
  const o = (layout.orientation || '').toLowerCase()
  if (o === 'portrait')          return 90
  if (o === 'portrait_reverse')  return 270
  if (o === 'landscape_reverse') return 180
  return 0
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  createPlaylist,
  updatePlaylist,
  getPlaylists,
  getPlaylist,
  updatePlaylistItems,
  publishPlaylist,
  previewPlaylist,
  deletePlaylist,
  getVersionHistory,
  getFullPlaylistData,
  buildPlayablePayload,
}