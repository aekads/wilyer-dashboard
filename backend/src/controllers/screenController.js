// src/controllers/screenController.js
// ============================================================
// AEKADS Screen Controller — Exact 6-Step Flow Implementation
// ============================================================
//
// HTTP ENDPOINTS:
//
//  ── DEVICE (no auth) ──────────────────────────────────────
//  POST /device/generate-code    STEP 1
//  GET  /device/check-pair       STEP 2 HTTP polling fallback
//  POST /device/heartbeat        ongoing (authKey in header)
//  GET  /device/content          HTTP fallback for content fetch
//
//  ── ADMIN (JWT) ───────────────────────────────────────────
//  POST /pair                    STEP 3 + triggers STEP 4
//  POST /:id/assign-playlist     STEP 5
//  GET  /                        list all screens
//  GET  /:id                     single screen detail
//  PATCH /:id                    update screen metadata
//  DELETE /:id                   soft-delete screen
//  POST /:id/sync                force re-push content
//  POST /:id/rotate-key          rotate AES encryption key
//  GET  /health                  org-level health stats
//
// ============================================================

const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { query, transaction } = require('../config/database');
const { AppError }           = require('../middlewares/errorHandler');
const { createAuditLog }     = require('../services/auditService');
const {
  generateAESKey,
  generateTempAuthKey,
  encryptForDevice,
} = require('../utils/encryption');
const logger = require('../utils/logger');

// Lazy getters — avoids circular dependency at module load time.
const getSocketIO        = ()    => require('../sockets').getSocketIO();
const sendToScreen       = (...a) => require('../sockets').sendToScreen(...a);
const notifyDevicePaired = (...a) => require('../sockets').notifyDevicePaired(...a);

const { getFullPlaylistData, buildPlayablePayload } = require('./playlistController');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** 6-char code shown on APK screen. Excludes ambiguous chars: 0/O, 1/I/L */
const generatePairingCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/** Signed device JWT valid for 1 year */
const generateDeviceToken = (screenId, orgId) =>
  jwt.sign(
    { screenId, orgId, type: 'device', iat: Math.floor(Date.now() / 1000) },
    process.env.DEVICE_JWT_SECRET,
    { expiresIn: '365d' },
  );

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Device Registers & Gets Pairing Code
// POST /api/screens/device/generate-code
// ─────────────────────────────────────────────────────────────────────────────
const generateDeviceCode = async (req, res, next) => {
  try {
    const { hardwareId, deviceModel, appVersion, resolution, orientation } = req.body;
    if (!hardwareId) throw new AppError('hardwareId is required', 400);

    console.log(`📱 [STEP 1] generate-code: hardwareId=${hardwareId}`);

    const existing = await query(
      `SELECT s.id FROM wilyer_screens s
       JOIN wilyer_device_pairing_codes dpc ON dpc.id = s.pairing_code_id
       WHERE dpc.hardware_id = $1 AND s.deleted_at IS NULL`,
      [hardwareId],
    );

    if (existing.rows[0]) {
      console.log(`ℹ️  [STEP 1] Already paired: hardwareId=${hardwareId}`);
      return res.json({
        success: true,
        data: { paired: true, message: 'Device already paired', screenId: existing.rows[0].id },
      });
    }

    let code = null;
    for (let i = 0; i < 10; i++) {
      const candidate = generatePairingCode();
      const dupe = await query(
        `SELECT id FROM wilyer_device_pairing_codes
         WHERE code=$1 AND expires_at > NOW() AND paired_at IS NULL`,
        [candidate],
      );
      if (!dupe.rows[0]) { code = candidate; break; }
    }
    if (!code) throw new AppError('Could not generate unique pairing code. Try again.', 500);

    const authKey   = generateTempAuthKey();
    const secretKey = generateAESKey();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `DELETE FROM wilyer_device_pairing_codes WHERE hardware_id=$1 AND paired_at IS NULL`,
      [hardwareId],
    );

    await query(
      `INSERT INTO wilyer_device_pairing_codes
         (code, hardware_id, device_model, app_version, resolution, orientation,
          temp_auth_key, aes_secret_key, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        code, hardwareId,
        deviceModel  || null,
        appVersion   || null,
        resolution   || null,
        orientation  || 'landscape',
        authKey,
        secretKey.toString('base64'),
        expiresAt,
      ],
    );

    console.log(`✅ [STEP 1] Code generated: ${code} authKey=${authKey.slice(0, 8)}...`);
    logger.info(`Pairing code ${code} generated for device ${hardwareId}`);

    res.json({
      success: true,
      data: {
        pairingCode: code,
        authKey,
        secretKey:   secretKey.toString('base64'),
        expiresAt:   expiresAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 Polling Fallback
// GET /api/screens/device/check-pair?code=AB3X9Z&authKey=a3f8c2...
// ─────────────────────────────────────────────────────────────────────────────
const checkPairingStatus = async (req, res, next) => {
  try {
    const { code, authKey } = req.query;
    if (!code)    throw new AppError('code query param required', 400);
    if (!authKey) throw new AppError('authKey required', 400);

    const result = await query(
      `SELECT
         dpc.*,
         s.id            AS screen_id,
         s.screen_seq_id,
         s.device_name,
         s.device_token,
         s.org_id
       FROM wilyer_device_pairing_codes dpc
       LEFT JOIN wilyer_screens s ON s.pairing_code_id = dpc.id
       WHERE dpc.code=$1 AND dpc.temp_auth_key=$2`,
      [code.toUpperCase().trim(), authKey],
    );

    const row = result.rows[0];
    if (!row) return res.json({ success: true, data: { paired: false, status: 'invalid' } });

    if (!row.paired_at && new Date(row.expires_at) < new Date()) {
      return res.json({ success: true, data: { paired: false, status: 'expired' } });
    }
    if (!row.paired_at) {
      return res.json({ success: true, data: { paired: false, status: 'pending' } });
    }

    let deviceToken = row.device_token;
    if (!deviceToken) {
      deviceToken = generateDeviceToken(row.screen_id, row.org_id);
      await query(`UPDATE wilyer_screens SET device_token=$1 WHERE id=$2`, [deviceToken, row.screen_id]);
    }

    res.json({
      success: true,
      data: {
        paired:      true,
        status:      'paired',
        screenId:    row.screen_id,
        screenSeqId: row.screen_seq_id,
        deviceToken,
        deviceName:  row.device_name,
        orgId:       row.org_id,
        secretKey:   row.aes_secret_key,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 + STEP 4 — Admin Pairs Screen → Server notifies device
// POST /api/screens/pair
// ─────────────────────────────────────────────────────────────────────────────
const pairScreen = async (req, res, next) => {
  try {
    const { pairingCode, deviceName, location, groupId, tags } = req.body;
    const { orgId, userId } = req.user;

    if (!pairingCode || !deviceName) {
      throw new AppError('pairingCode and deviceName are required', 400);
    }

    const code = pairingCode.toUpperCase().trim();
    console.log(`🔗 [STEP 3] pairScreen: code=${code} orgId=${orgId}`);

    const codeRes = await query(
      `SELECT * FROM wilyer_device_pairing_codes
       WHERE code=$1 AND expires_at > NOW() AND paired_at IS NULL`,
      [code],
    );
    if (!codeRes.rows[0]) {
      throw new AppError('Invalid or expired pairing code. Ask the device to regenerate a new code.', 400);
    }

    const deviceRecord = codeRes.rows[0];

    const countRes = await query(
      `SELECT COUNT(*) FROM wilyer_screens WHERE org_id=$1 AND deleted_at IS NULL`,
      [orgId],
    );
    const used       = parseInt(countRes.rows[0].count);
    const maxScreens = req.orgLimits?.maxScreens || 5;
    if (used >= maxScreens) {
      throw new AppError(`Screen limit reached (${maxScreens}). Upgrade plan to add more.`, 403);
    }

    const screen = await transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO wilyer_screens (
           org_id, group_id, device_name, location, tags,
           hardware_id, device_model, resolution, orientation, app_version,
           device_token, aes_secret_key, encryption_key_version, pairing_code_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          orgId,
          groupId || null,
          deviceName.trim(),
          location?.trim() || null,
          tags
            ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean))
            : [],
          deviceRecord.hardware_id,
          deviceRecord.device_model,
          deviceRecord.resolution,
          deviceRecord.orientation || 'landscape',
          deviceRecord.app_version,
          'pending',
          deviceRecord.aes_secret_key,
          1,
          deviceRecord.id,
        ],
      );

      await client.query(
        `UPDATE wilyer_device_pairing_codes
         SET paired_at=NOW(), paired_screen_id=$1
         WHERE id=$2`,
        [ins.rows[0].screen_seq_id, deviceRecord.id],
      );

      return ins.rows[0];
    });

    const finalDeviceToken = generateDeviceToken(screen.id, orgId);
    await query(`UPDATE wilyer_screens SET device_token=$1 WHERE id=$2`, [finalDeviceToken, screen.id]);
    screen.device_token = finalDeviceToken;

    console.log(`✅ [STEP 3] Screen created: screenId=${screen.id}`);

    // STEP 4: notify device via "message" event → response_type: "screen_linked"
    notifyDevicePaired(deviceRecord.temp_auth_key, {
      screenId:    screen.id,
      screenSeqId: screen.screen_seq_id,
      deviceName:  screen.device_name,
      deviceToken: finalDeviceToken,
      orgId,
      linkedUserId: userId,
    });

    console.log(`📣 [STEP 4] screen_linked sent → authKey=${deviceRecord.temp_auth_key.slice(0, 8)}...`);

    await createAuditLog({
      orgId, userId,
      action:     'screen.pair',
      entityType: 'screen',
      entityId:   screen.id,
      newValues:  { deviceName, location, hardwareId: deviceRecord.hardware_id },
    });

    res.status(201).json({
      success: true,
      data: {
        screen,
        message: `"${deviceName}" paired successfully. The device will navigate to player automatically.`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/screens
// ─────────────────────────────────────────────────────────────────────────────
const getScreens = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const {
      status, groupId, search,
      page  = 1,
      limit = 20,
      only_deleted = false,   // NEW — fetch deleted screens for the Deleted tab.
      assigned_playlist_id,  
    } = req.query;
 
    const offset = (page - 1) * limit;
 
    // Base condition switches between active vs deleted
    let conditions = ['s.org_id = $1'];
    let params     = [orgId];
    let idx        = 2;
 
    if (only_deleted === 'true' || only_deleted === true) {
      // Deleted tab: only rows with deleted_at set
      conditions.push('s.deleted_at IS NOT NULL');
    } else {
      // Normal tab: only active rows
      conditions.push('s.deleted_at IS NULL');
    }
 
    if (status)  { conditions.push(`s.status = $${idx++}`);   params.push(status); }
    if (groupId) { conditions.push(`s.group_id = $${idx++}`); params.push(groupId); }
    if (search)  {
      conditions.push(`(s.device_name ILIKE $${idx} OR s.location ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
 

    // ADD after groupId:
  if (assigned_playlist_id) {
    conditions.push(`s.assigned_playlist_id = $${idx++}`);
    params.push(assigned_playlist_id);
  }
    const where = conditions.join(' AND ');
 
    const [rows, total, limits] = await Promise.all([
      query(
        `SELECT
           s.*,
           sg.name  AS group_name,
           p.name   AS playlist_name,
           p.status AS playlist_status,
           CASE
             WHEN s.deleted_at IS NOT NULL                            THEN 'deleted'
             WHEN s.last_seen > NOW() - INTERVAL '60 seconds'        THEN 'online'
             WHEN s.last_seen > NOW() - INTERVAL '5 minutes'         THEN 'idle'
             ELSE 'offline'
           END AS real_status,
           COALESCE(ROUND(
             (SELECT COUNT(*) FROM wilyer_device_heartbeats dh
              WHERE dh.screen_id = s.id AND dh.timestamp > NOW() - INTERVAL '24 hours')::numeric
             / GREATEST(24*60*2, 1) * 100, 2
           ), 0) AS uptime_24h
         FROM wilyer_screens s
         LEFT JOIN wilyer_screen_groups sg ON sg.id = s.group_id
         LEFT JOIN wilyer_playlists p      ON p.id  = s.assigned_playlist_id
         WHERE ${where}
         ORDER BY s.screen_seq_id ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      query(`SELECT COUNT(*) FROM wilyer_screens s WHERE ${where}`, params),
      query(`SELECT max_screens FROM wilyer_org_limits WHERE org_id = $1`, [orgId]),
    ]);
 
    const totalCount = parseInt(total.rows[0].count);
    const maxScreens = limits.rows[0]?.max_screens || 5;
 
    // Count active screens (for license display — always exclude deleted)
    const activeCount = only_deleted === 'true'
      ? (await query(`SELECT COUNT(*) FROM wilyer_screens WHERE org_id=$1 AND deleted_at IS NULL`, [orgId])).rows[0].count
      : totalCount;
 
    res.json({
      success: true,
      data:    rows.rows,
      meta: {
        total:  totalCount,
        page:   parseInt(page),
        limit:  parseInt(limit),
        pages:  Math.ceil(totalCount / parseInt(limit)),
        licenses: {
          total:     maxScreens,
          used:      parseInt(activeCount),
          available: Math.max(0, maxScreens - parseInt(activeCount)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/screens/:id
// ─────────────────────────────────────────────────────────────────────────────
const getScreen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orgId } = req.user;

    const result = await query(
      `SELECT
         s.*,
         sg.name AS group_name,
         p.name  AS playlist_name,
         p.status AS playlist_status,
         p.total_duration AS playlist_duration,
         (SELECT row_to_json(dh) FROM wilyer_device_heartbeats dh
          WHERE dh.screen_id=s.id ORDER BY dh.timestamp DESC LIMIT 1) AS last_heartbeat,
         (SELECT COUNT(*) FROM wilyer_playback_logs pl
          WHERE pl.screen_id=s.id AND pl.played_at > CURRENT_DATE) AS today_plays
       FROM wilyer_screens s
       LEFT JOIN wilyer_screen_groups sg ON sg.id=s.group_id
       LEFT JOIN wilyer_playlists p ON p.id=s.assigned_playlist_id
       WHERE s.id=$1 AND s.org_id=$2 AND s.deleted_at IS NULL`,
      [id, orgId],
    );

    if (!result.rows[0]) throw new AppError('Screen not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/screens/:id
// ─────────────────────────────────────────────────────────────────────────────
const updateScreen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orgId, userId } = req.user;
    const {
      deviceName, location, groupId, orientation, resolution, tags,
      // Support clearing playlist assignment from PlaylistPublish
      assignedPlaylistId, assigned_playlist_id,
    } = req.body;
 
    // Allow explicitly setting to null to unassign playlist
    const newPlaylistId = ('assignedPlaylistId' in req.body)
      ? (assignedPlaylistId ?? null)
      : ('assigned_playlist_id' in req.body)
        ? (assigned_playlist_id ?? null)
        : undefined  // not in body — don't touch it
 
    // Build dynamic SET clause
    const setClauses = []
    const values     = []
    let idx = 1
 
    if (deviceName    !== undefined) { setClauses.push(`device_name = $${idx++}`); values.push(deviceName) }
    if (location      !== undefined) { setClauses.push(`location    = $${idx++}`); values.push(location || null) }
    if (groupId       !== undefined) { setClauses.push(`group_id    = $${idx++}`); values.push(groupId || null) }
    if (orientation   !== undefined) { setClauses.push(`orientation = $${idx++}`); values.push(orientation) }
    if (resolution    !== undefined) { setClauses.push(`resolution  = $${idx++}`); values.push(resolution) }
    if (tags          !== undefined) {
      const tagsArr = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())
      setClauses.push(`tags = $${idx++}`)
      values.push(tagsArr)
    }
    if (newPlaylistId !== undefined) {
      // Explicitly clear or set playlist assignment
      setClauses.push(`assigned_playlist_id = $${idx++}`)
      values.push(newPlaylistId)
    }
 
    if (setClauses.length === 0) {
      return res.json({ success: true, message: 'Nothing to update' })
    }
 
    setClauses.push(`updated_at = NOW()`)
    values.push(id, orgId)
 
    const result = await query(
      `UPDATE wilyer_screens SET ${setClauses.join(', ')}
       WHERE id = $${idx++} AND org_id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
      values
    )
 
    if (!result.rows[0]) throw new AppError('Screen not found', 404)
    await createAuditLog({ orgId, userId, action: 'screen.update', entityType: 'screen', entityId: id })
    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Admin Assigns Playlist → Push to Device
// POST /api/screens/:id/assign-playlist
// ─────────────────────────────────────────────────────────────────────────────
//
// The payload delivered to the APK via the "message" socket event is:
//
//   (AES-encrypted envelope whose decrypted content is)
//   {
//     "type": "playable_data",
//     "data": {
//       "playlistObjectArrayList": [ { ... } ],
//       "scheduleDataObjectArrayList": null
//     }
//   }
//
const assignPlaylist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { playlistId } = req.body;
    const { orgId, userId } = req.user;

    console.log(`🎬 [STEP 5] assignPlaylist: screenId=${id} playlistId=${playlistId}`);

    if (!playlistId) throw new AppError('playlistId is required', 400);

    const screenCheck = await query(
      `SELECT id, device_name FROM wilyer_screens
       WHERE id=$1 AND org_id=$2 AND deleted_at IS NULL`,
      [id, orgId],
    );
    if (!screenCheck.rows[0]) throw new AppError('Screen not found', 404);

    const playlist = await query(
      `SELECT id, name, status, version FROM wilyer_playlists
       WHERE id=$1 AND org_id=$2 AND deleted_at IS NULL`,
      [playlistId, orgId],
    );
    if (!playlist.rows[0])                       throw new AppError('Playlist not found', 404);
    if (playlist.rows[0].status !== 'published') throw new AppError('Only published playlists can be assigned', 400);

    const newVersion = (playlist.rows[0].version || 0) + 1;

    // ── Persist assignment ─────────────────────────────────────────────────
    await transaction(async (client) => {
      await client.query(
        `UPDATE wilyer_screens SET
           assigned_playlist_id     = $1,
           current_playlist_version = $2,
           updated_at               = NOW()
         WHERE id=$3 AND org_id=$4`,
        [playlistId, newVersion, id, orgId],
      );
      await client.query(
        `INSERT INTO wilyer_playlist_assignments
           (screen_id, playlist_id, version, assigned_by, assigned_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (screen_id, version) DO NOTHING`,
        [id, playlistId, newVersion, userId],
      );
    });

    console.log(`💾 [STEP 5] Assignment saved: screenId=${id} v${newVersion}`);

    // ── Build APK payload and deliver ─────────────────────────────────────
    const playlistData = await getFullPlaylistData(playlistId, orgId);

    if (playlistData) {
      // buildPlayablePayload returns the exact JSON the APK expects:
      // { type:"playable_data", data:{ playlistObjectArrayList:[...], scheduleDataObjectArrayList:null } }
      const payload = buildPlayablePayload(playlistData, newVersion);

      console.log(
        `📦 [STEP 5] Payload built:`,
        `playlists=${payload.data.playlistObjectArrayList.length}`,
        `layouts=${payload.data.playlistObjectArrayList[0]?.layoutObjectArrayList?.length ?? 0}`,
      );

      // sendToScreen fetches authKey, encrypts payload, emits "message" event
      const delivered = await sendToScreen(id, 'playlist', payload);

      if (!delivered) {
        // Device offline — store full payload for delivery on reconnect
        await query(
          `INSERT INTO wilyer_pending_sync (screen_id, playlist_id, version, data, created_at)
           VALUES ($1,$2,$3,$4,NOW())
           ON CONFLICT (screen_id) DO UPDATE SET
             playlist_id = EXCLUDED.playlist_id,
             version     = EXCLUDED.version,
             data        = EXCLUDED.data,
             created_at  = NOW()`,
          [id, playlistId, newVersion, JSON.stringify(payload)],
        );
        console.log(`📝 [STEP 5] Saved to pending_sync (device offline): screenId=${id}`);
      } else {
        console.log(`📡 [STEP 5] Delivered live to screenId=${id}`);
      }
    } else {
      console.warn(`⚠️  [STEP 5] getFullPlaylistData returned null for playlistId=${playlistId}`);
    }

    await createAuditLog({
      orgId, userId,
      action:     'screen.playlist_assign',
      entityType: 'screen',
      entityId:   id,
      newValues:  { playlistId, version: newVersion },
    });

    res.json({
      success: true,
      message: 'Playlist assigned successfully',
      data:    { screenId: id, playlistId, version: newVersion },
    });
  } catch (err) {
    console.error('❌ [STEP 5] assignPlaylist error:', err);
    next(err);
  }
};


// PATCH /api/screens/:id/restore — Restore a soft-deleted screen  NEW
// ─────────────────────────────────────────────────────────────────────────────
const restoreScreen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orgId, userId } = req.user;
 
    // Check it exists and IS deleted
    const check = await query(
      `SELECT id, device_name, deleted_at FROM wilyer_screens WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
 
    if (!check.rows[0]) {
      throw new AppError('Screen not found', 404);
    }
    if (!check.rows[0].deleted_at) {
      throw new AppError('Screen is not deleted', 400);
    }
 
    // Restore: clear deleted_at, set status back to offline
    await query(
      `UPDATE wilyer_screens
       SET deleted_at = NULL,
           status     = 'offline',
           updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
 
    await createAuditLog({
      orgId, userId,
      action:     'screen.restore',
      entityType: 'screen',
      entityId:   id,
      newValues:  { deviceName: check.rows[0].device_name },
    });
 
    logger.info(`Screen restored: ${id} by user ${userId}`);
 
    res.json({
      success: true,
      message: `"${check.rows[0].device_name}" restored successfully`,
    });
  } catch (err) {
    next(err);
  }
};
 

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/screens/:id — UPDATED to support ?permanent=true
// Existing soft-delete behaviour is fully preserved when permanent is not set
// ─────────────────────────────────────────────────────────────────────────────
const deleteScreen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orgId, userId } = req.user;
    const permanent = req.query.permanent === 'true';
 
    if (permanent) {
      // ── Hard delete — only allowed if already soft-deleted ──
      const check = await query(
        `SELECT id, device_name, deleted_at FROM wilyer_screens WHERE id = $1 AND org_id = $2`,
        [id, orgId],
      );
 
      if (!check.rows[0]) throw new AppError('Screen not found', 404);
 
      // Require soft-delete first (safety guard — can be removed if desired)
      if (!check.rows[0].deleted_at) {
        throw new AppError(
          'Screen must be soft-deleted before permanent deletion. Delete it first, then permanently remove it from the Deleted tab.',
          400
        );
      }
 
      // Hard delete
      await query(`DELETE FROM wilyer_screens WHERE id = $1 AND org_id = $2`, [id, orgId]);
 
      const io = getSocketIO();
      if (io) io.to(`screen:${id}`).emit('screen:deleted');
 
      await createAuditLog({
        orgId, userId,
        action:     'screen.permanent_delete',
        entityType: 'screen',
        entityId:   id,
        newValues:  { deviceName: check.rows[0].device_name },
      });
 
      logger.info(`Screen permanently deleted: ${id} by user ${userId}`);
 
      return res.json({ success: true, message: 'Screen permanently deleted' });
    }
 
    // ── Soft delete (original behaviour unchanged) ─────────────
    const result = await query(
      `UPDATE wilyer_screens
       SET deleted_at = NOW(),
           status     = 'offline',
           updated_at = NOW()
       WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
       RETURNING id, device_name`,
      [id, orgId],
    );
 
    if (!result.rows[0]) throw new AppError('Screen not found', 404);
 
    const io = getSocketIO();
    if (io) io.to(`screen:${id}`).emit('screen:deleted');
 
    await createAuditLog({
      orgId, userId,
      action:     'screen.delete',
      entityType: 'screen',
      entityId:   id,
      newValues:  { deviceName: result.rows[0].device_name },
    });
 
    res.json({ success: true, message: 'Screen deleted' });
  } catch (err) {
    next(err);
  }
};
 

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/screens/health
// ─────────────────────────────────────────────────────────────────────────────
const getScreensHealth = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN last_seen > NOW() - INTERVAL '60 seconds' THEN 1 END) AS online,
         COUNT(CASE WHEN last_seen <= NOW() - INTERVAL '60 seconds' OR last_seen IS NULL THEN 1 END) AS offline,
         ROUND(
           COUNT(CASE WHEN last_seen > NOW() - INTERVAL '60 seconds' THEN 1 END)::numeric
           / GREATEST(COUNT(*)::numeric,1) * 100, 2
         ) AS online_percentage
       FROM wilyer_screens WHERE org_id=$1 AND deleted_at IS NULL`,
      [orgId],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/screens/device/heartbeat
// ─────────────────────────────────────────────────────────────────────────────
const heartbeat = async (req, res, next) => {
  try {
    const { screenId, orgId } = req.device;
    const {
      cpuUsage, memoryUsage, diskUsage, temperature,
      currentPlaylistId, currentMediaId, currentItemPosition,
      appVersion, currentPlaylistVersion,
    } = req.body;

    await query(
      `UPDATE wilyer_screens SET
         status='online', last_seen=NOW(),
         current_ip=$1,
         app_version=COALESCE($2, app_version),
         last_sync_version=COALESCE($3, last_sync_version)
       WHERE id=$4`,
      [req.ip, appVersion, currentPlaylistVersion, screenId],
    );
    await query(
      `INSERT INTO wilyer_device_heartbeats
         (screen_id, org_id, cpu_usage, memory_usage, disk_usage, temperature,
          current_playlist_id, current_media_id, current_item_position, app_version, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [screenId, orgId, cpuUsage, memoryUsage, diskUsage, temperature,
       currentPlaylistId, currentMediaId, currentItemPosition, appVersion, req.ip],
    );

    const io = getSocketIO();
    if (io) {
      io.to(`org:${orgId}`).emit('screen:heartbeat', {
        screenId, status: 'online', timestamp: new Date(),
        metrics: { cpuUsage, memoryUsage, diskUsage, temperature },
        currentPlaylistId, currentMediaId,
      });
    }

    const screen = await query(
      `SELECT assigned_playlist_id, current_playlist_version FROM wilyer_screens WHERE id=$1`,
      [screenId],
    );
    const needsSync =
      screen.rows[0]?.assigned_playlist_id &&
      screen.rows[0]?.current_playlist_version !== currentPlaylistVersion;

    res.json({
      success: true,
      data: {
        assignedPlaylistId: screen.rows[0]?.assigned_playlist_id,
        serverTime:         new Date().toISOString(),
        needsSync:          !!needsSync,
        requiredVersion:    needsSync ? screen.rows[0].current_playlist_version : undefined,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/screens/device/content  — HTTP fallback (no socket)
// Returns the identical payload structure the socket push would deliver
// ─────────────────────────────────────────────────────────────────────────────
const getDeviceContent = async (req, res, next) => {
  try {
    const { screenId, orgId } = req.device;

    const s = await query(
      `SELECT assigned_playlist_id, current_playlist_version FROM wilyer_screens WHERE id=$1`,
      [screenId],
    );

    if (!s.rows[0]?.assigned_playlist_id) {
      return res.json({ success: true, data: null, message: 'No playlist assigned' });
    }

    const playlistData = await getFullPlaylistData(s.rows[0].assigned_playlist_id, orgId);
    if (!playlistData) return res.json({ success: true, data: null, message: 'Playlist not found' });

    // Return same structure as socket: { type:"playable_data", data:{...} }
    const payload = buildPlayablePayload(
      playlistData,
      s.rows[0].current_playlist_version || playlistData.version,
    );

    res.json({ success: true, data: payload });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/screens/:id/sync — Force re-push current playlist
// ─────────────────────────────────────────────────────────────────────────────
const syncScreen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orgId } = req.user;

    const screen = await query(
      `SELECT assigned_playlist_id, current_playlist_version FROM wilyer_screens
       WHERE id=$1 AND org_id=$2`,
      [id, orgId],
    );

    if (!screen.rows[0]?.assigned_playlist_id) {
      return res.json({ success: true, message: 'No playlist assigned' });
    }

    const playlistData = await getFullPlaylistData(
      screen.rows[0].assigned_playlist_id, orgId,
    );
    if (!playlistData) return res.json({ success: false, message: 'Playlist not found' });

    const payload = {
      ...buildPlayablePayload(
        playlistData,
        screen.rows[0].current_playlist_version || playlistData.version,
      ),
      force_sync: true,
    };

    const sent = await sendToScreen(id, 'playlist', payload);
    console.log(`🔄 [SYNC] screenId=${id} sent=${sent}`);

    res.json({
      success: true,
      message: sent ? 'Sync delivered to device' : 'Device offline — will sync on reconnect',
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/screens/:id/rotate-key
// ─────────────────────────────────────────────────────────────────────────────
const rotateDeviceKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orgId, userId } = req.user;

    const newKey        = crypto.randomBytes(32);
    const newKeyVersion = await _getNextKeyVersion(id);

    await query(
      `UPDATE wilyer_screens SET
         aes_secret_key=$1, encryption_key_version=$2, updated_at=NOW()
       WHERE id=$3 AND org_id=$4`,
      [newKey.toString('base64'), newKeyVersion, id, orgId],
    );

    await sendToScreen(id, 'key:rotate', {
      newKey:    newKey.toString('base64'),
      version:   newKeyVersion,
      timestamp: Date.now(),
    });

    await createAuditLog({ orgId, userId, action: 'screen.key_rotate', entityType: 'screen', entityId: id });
    console.log(`🔑 [KEY-ROTATE] screenId=${id} newVersion=${newKeyVersion}`);
    res.json({ success: true, message: 'Encryption key rotated successfully' });
  } catch (err) { next(err); }
};

const _getNextKeyVersion = async (screenId) => {
  const r = await query('SELECT encryption_key_version FROM wilyer_screens WHERE id=$1', [screenId]);
  return (r.rows[0]?.encryption_key_version || 0) + 1;
};

// And this controller function:
const unassignPlaylist = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orgId, userId } = req.user
 
    await query(
      `UPDATE wilyer_screens
       SET assigned_playlist_id = NULL,
           current_playlist_version = NULL,
           updated_at = NOW()
       WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [id, orgId]
    )
 
    // Notify device
    const io = getSocketIO()
    if (io) io.to(`screen:${id}`).emit('playlist:unassigned', { screenId: id })
 
    await createAuditLog({
      orgId, userId,
      action: 'screen.playlist_unassign',
      entityType: 'screen',
      entityId: id,
    })
 
    res.json({ success: true, message: 'Playlist unassigned from screen' })
  } catch (err) {
    next(err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  generateDeviceCode,
  checkPairingStatus,
  heartbeat,
  getDeviceContent,
  pairScreen,
  getScreens,       // ← updated version
  getScreen,
  updateScreen,
  assignPlaylist,
  deleteScreen,     // ← updated version (soft + permanent)
  restoreScreen,    // ← new
  getScreensHealth,
  syncScreen,
  rotateDeviceKey,
  unassignPlaylist
};