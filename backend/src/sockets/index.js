// src/sockets/index.js
// ============================================================
// AEKADS Socket.io — Exact 6-Step Flow Implementation
// ============================================================
//
// ╔══════════════════════════════════════════════════════════╗
// ║  THE 6-STEP FLOW (matches flow diagram exactly)         ║
// ╠══════════════════════════════════════════════════════════╣
// ║                                                          ║
// ║  STEP 1  APK → HTTP POST /device/generate-code          ║
// ║          ← { pairingCode, authKey, secretKey }          ║
// ║          APK saves all 3 to Room DB                     ║
// ║          APK shows "482951" on screen                   ║
// ║                                                          ║
// ║  STEP 2  APK → Socket connect ?authKey=a3f8c2...        ║
// ║          Server: socket.join(authKey)                   ║
// ║          APK emits: checkForPairing  → no response yet  ║
// ║          APK emits: playerData       → no content yet   ║
// ║          Both sides waiting...                          ║
// ║                                                          ║
// ║  STEP 3  Admin → HTTP POST /screens/pair                ║
// ║          { pairingCode, screenName, userId }            ║
// ║          Server: isPaired=true, linkedUser saved        ║
// ║          ← { status: 100 }                              ║
// ║                                                          ║
// ║  STEP 4  Server → io.to(authKey).emit("message", ...)   ║
// ║          Unencrypted JSON:                              ║
// ║          { message:[{ response_type:"screen_linked",    ║
// ║            status:"100", linkedUserId, screenName }] }  ║
// ║          APK: saves linkedUser, isPaired=true           ║
// ║          APK: navigates to MediaPlayFragment ✓          ║
// ║                                                          ║
// ║  STEP 5  Admin → HTTP POST /screens/:id/assign-playlist ║
// ║          Server: saves to DB                            ║
// ║          Server: io.to(authKey).emit("message",         ║
// ║                    AES_ENCRYPT(playable_data_json))     ║
// ║                                                          ║
// ║  STEP 6  APK receives encrypted "message"               ║
// ║          AES-decrypts with secretKey from Room DB       ║
// ║          Reads type = "playable_data"                   ║
// ║          Saves to Room DB → renders content ✓           ║
// ║                                                          ║
// ║  RESTART APK reads authKey from Room DB                 ║
// ║          Reconnects socket with same authKey            ║
// ║          Emits playerData → server re-sends content     ║
// ║          Plays immediately ✓                            ║
// ╚══════════════════════════════════════════════════════════╝
//
// ── SOCKET ROOMS ────────────────────────────────────────────
//
//  "{authKey}"              Pre-pair AND post-pair device room.
//                           The authKey IS the room name.
//
//  "org:{orgId}"            All admin dashboard sockets for an org.
//  "user:{userId}"          Individual admin user socket.
//  "screen_monitor:{id}"    Admin sockets monitoring a live feed.
//
// ── EVENTS: Server → Device ─────────────────────────────────
//
//  ALL server→device messages use the single event name "message".
//
//  STEP 4 (pairing confirm) — plain JSON, NOT encrypted:
//    { message: [{ response_type: "screen_linked", status: "100", ... }] }
//
//  STEP 5/6 (content delivery) — AES-encrypted bytes:
//    AES_ENCRYPT({
//      type: "playable_data",
//      data: {
//        playlistObjectArrayList: [ { ... } ],
//        scheduleDataObjectArrayList: null
//      }
//    })
//
// ── EVENTS: Device → Server ─────────────────────────────────
//
//  checkForPairing    Poll: has admin entered the code yet?
//  playerData         Request current content (pre-pair = silent)
//  encrypted:message  Post-pair telemetry (playback, metrics, sync …)
//  encrypted:ack      ACK for a delivered message
//
// ============================================================

const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');
const logger      = require('../utils/logger');
const { query }   = require('../config/database');
const { encryptForDevice, decryptFromDevice } = require('../utils/encryption');
const { getFullPlaylistData, buildPlayablePayload } = require('../controllers/playlistController');

let io = null;

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISE
// ─────────────────────────────────────────────────────────────────────────────

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin:  process.env.FRONTEND_URL?.split(',') || ['http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout:       60_000,
    pingInterval:      25_000,
    transports:        ['websocket', 'polling'],
    maxHttpBufferSize: 10 * 1024 * 1024,
  });

  // ── Auth Middleware ──────────────────────────────────────────────────────────
  //
  // Two connection types:
  //
  //  A) Admin dashboard   — auth: { token: "<JWT>" }
  //  B) Device            — auth: { authKey: "<hex>" }
  //     The authKey is from STEP 1, stored permanently in the APK Room DB.
  //
  io.use(async (socket, next) => {
    try {
      const { token, authKey, timestamp } = socket.handshake.auth || {};

      if (timestamp && Date.now() - timestamp > 30_000) {
        console.warn(`⚠️  [AUTH] Timestamp expired — socket ${socket.id}`);
        return next(new Error('Timestamp expired'));
      }

      // ── A) Admin ─────────────────────────────────────────────────────────
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = {
          userId:      decoded.userId,
          orgId:       decoded.orgId,
          type:        'user',
          permissions: decoded.permissions,
        };
        socket.data = { type: 'user', userId: decoded.userId, orgId: decoded.orgId };
        console.log(`🔑 [AUTH] Admin: userId=${decoded.userId} orgId=${decoded.orgId}`);
        return next();
      }

      // ── B) Device with authKey ────────────────────────────────────────────
      if (authKey) {
        const codeRow = await query(
          `SELECT
             dpc.id,
             dpc.hardware_id,
             dpc.aes_secret_key,
             dpc.expires_at,
             dpc.paired_at,
             s.id           AS screen_id,
             s.org_id,
             s.device_token
           FROM wilyer_device_pairing_codes dpc
           LEFT JOIN wilyer_screens s ON s.pairing_code_id = dpc.id
           WHERE dpc.temp_auth_key = $1`,
          [authKey],
        );

        if (!codeRow.rows[0]) {
          console.warn(`⚠️  [AUTH] Unknown authKey: ${authKey.slice(0, 8)}...`);
          return next(new Error('Invalid auth key'));
        }

        const row = codeRow.rows[0];

        // Expired key is allowed ONLY if device is already paired
        // (APK reconnects long after the 15-min code window using its saved authKey)
        if (!row.paired_at && new Date(row.expires_at) < new Date()) {
          console.warn(`⚠️  [AUTH] Expired authKey for unpaired device: ${row.hardware_id}`);
          return next(new Error('Auth key expired. Generate a new pairing code.'));
        }

        const aesKey = Buffer.from(row.aes_secret_key, 'base64');

        socket.device = {
          authKey,
          hardwareId: row.hardware_id,
          screenId:   row.screen_id || null,
          orgId:      row.org_id    || null,
          aesKey,
          isPaired:   !!row.paired_at,
          codeId:     row.id,
          type:       'device',
        };
        socket.data = { type: 'device', authKey, hardwareId: row.hardware_id };

        const state = row.paired_at ? 'paired' : 'pre-pair';
        console.log(`🔑 [AUTH] Device (${state}): hardwareId=${row.hardware_id}`);
        return next();
      }

      console.warn(`⚠️  [AUTH] No credentials — socket ${socket.id}`);
      return next(new Error('Authentication required'));

    } catch (err) {
      logger.error('Socket auth error:', err.message);
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [CONNECT] socket=${socket.id} type=${socket.data?.type}`);
    if      (socket.user)   handleAdminConnection(socket);
    else if (socket.device) handleDeviceConnection(socket);
    else { socket.disconnect(true); }
  });

  logger.info('✅ Socket.io initialized');
  console.log('✅ [SOCKET] Socket.io server initialized');
  return io;
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE CONNECTION HANDLER
// ─────────────────────────────────────────────────────────────────────────────

const handleDeviceConnection = (socket) => {
  const { authKey, hardwareId, screenId, orgId, aesKey, isPaired } = socket.device;
  const state = isPaired ? 'paired' : 'pre-pair';

  console.log(`📺 [DEVICE] Connected (${state}): hardwareId=${hardwareId}`);
  logger.info(`Device connected: ${hardwareId} isPaired=${isPaired}`);

  // The authKey IS the room — same room for the full device lifecycle
  socket.join(authKey);
  console.log(`🏠 [DEVICE] Joined room: "${authKey}"`);

  if (isPaired && screenId) {
    socket.join(`screen:${screenId}`);
    if (orgId) socket.join(`org:${orgId}`);
    console.log(`🏠 [DEVICE] Also joined: screen:${screenId}, org:${orgId}`);
    updateDeviceStatus(screenId, 'online');
    io.to(`org:${orgId}`).emit('screen:status_change', {
      screenId, status: 'online', timestamp: new Date().toISOString(),
    });
  }

  // ── STEP 2: checkForPairing ──────────────────────────────────────────────
  // APK emits this after connecting.
  // If admin already paired before the socket connected, reply immediately.
  socket.on('checkForPairing', async () => {
    console.log(`🔍 [DEVICE] checkForPairing: hardwareId=${hardwareId}`);
    try {
      const result = await query(
        `SELECT
           dpc.paired_at,
           s.id            AS screen_id,
           s.screen_seq_id,
           s.device_name,
           s.device_token,
           s.org_id
         FROM wilyer_device_pairing_codes dpc
         LEFT JOIN wilyer_screens s ON s.pairing_code_id = dpc.id
         WHERE dpc.temp_auth_key = $1`,
        [authKey],
      );

      const row = result.rows[0];
      if (!row?.paired_at) {
        console.log(`ℹ️  [DEVICE] Not yet paired — silent`);
        return;
      }

      console.log(`✅ [DEVICE] Already paired — sending screen_linked`);
      _sendScreenLinked(authKey, {
        screenId:    row.screen_id,
        screenSeqId: row.screen_seq_id,
        deviceName:  row.device_name,
        deviceToken: row.device_token,
        orgId:       row.org_id,
      });

    } catch (err) {
      logger.error('checkForPairing error:', err);
      console.error(`❌ [DEVICE] checkForPairing error:`, err.message);
    }
  });

  // ── STEP 2 / RESTART: playerData ────────────────────────────────────────
  // Pre-pair:  stay silent (no content yet)
  // Post-pair: AES-encrypt and send currently assigned playlist
  socket.on('playerData', async () => {
    console.log(`📥 [DEVICE] playerData: hardwareId=${hardwareId} isPaired=${isPaired}`);

    if (!isPaired || !screenId) {
      console.log(`ℹ️  [DEVICE] playerData — not paired yet, no content`);
      return;
    }

    await _sendCurrentContent(authKey, screenId, orgId, aesKey);
  });

  // ── Post-pair encrypted telemetry ────────────────────────────────────────
  socket.on('encrypted:message', async (encryptedData) => {
    if (!isPaired) {
      console.warn(`⚠️  [DEVICE] encrypted:message from unpaired device — ignored`);
      return;
    }

    let decrypted;
    try {
      decrypted = decryptFromDevice(encryptedData, aesKey);
      console.log(`📨 [DEVICE] encrypted:message type="${decrypted.type}"`);
    } catch (err) {
      logger.error(`Decrypt failed for ${hardwareId}:`, err.message);
      socket.emit('encrypted:error', encryptForDevice(
        { type: 'error', message: 'Failed to process message', timestamp: Date.now() },
        aesKey,
      ));
      return;
    }

    try {
      switch (decrypted.type) {
        case 'playback:report':        await handlePlaybackReport(screenId, orgId, decrypted.data); break;
        case 'metrics:report':         await handleMetricsReport(screenId, orgId, decrypted.data); break;
        case 'sync:response':          await handleSyncResponse(screenId, decrypted.data); break;
        case 'screenshot:response':    await handleScreenshotResponse(screenId, orgId, decrypted.data); break;
        case 'content:request':        await handleContentRequest(socket, screenId, decrypted.data); break;
        case 'playlist:sync_complete': await handlePlaylistSyncComplete(screenId, decrypted.data); break;
        default:
          console.warn(`⚠️  [DEVICE] Unknown type="${decrypted.type}"`);
      }
    } catch (err) {
      logger.error(`Handler error ${decrypted.type}:`, err);
    }
  });

  socket.on('encrypted:ack', (encryptedData) => {
    if (!isPaired) return;
    try {
      const ack = decryptFromDevice(encryptedData, aesKey);
      console.log(`✅ [DEVICE] ACK messageType="${ack.messageType}"`);
    } catch (err) {
      console.error(`❌ [DEVICE] ACK decrypt failed:`, err.message);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`📺 [DEVICE] Disconnected: hardwareId=${hardwareId} reason=${reason}`);
    logger.info(`Device disconnected: ${hardwareId}`);
    if (!isPaired || !screenId) return;

    io.to(`org:${orgId}`).emit('screen:status_change', {
      screenId, status: 'offline', timestamp: new Date().toISOString(),
    });

    setTimeout(async () => {
      try {
        const room = io.sockets.adapter.rooms.get(authKey);
        if (!room || room.size === 0) {
          await query(
            `UPDATE wilyer_screens SET status='offline', last_offline_at=NOW()
             WHERE id=$1 AND status='online'`,
            [screenId],
          );
          console.log(`💤 [DEVICE] Marked offline: screenId=${screenId}`);
        }
      } catch (err) {
        logger.error('Offline mark failed:', err);
      }
    }, 10_000);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CONNECTION HANDLER
// ─────────────────────────────────────────────────────────────────────────────

const handleAdminConnection = (socket) => {
  const { userId, orgId } = socket.user;
  console.log(`👤 [ADMIN] Connected: userId=${userId} orgId=${orgId}`);

  socket.join(`org:${orgId}`);
  socket.join(`user:${userId}`);

  socket.on('screen:subscribe',   (screenId) => socket.join(`screen_monitor:${screenId}`));
  socket.on('screen:unsubscribe', (screenId) => socket.leave(`screen_monitor:${screenId}`));

  socket.on('screen:preview_request', (screenId) => {
    io.to(`screen:${screenId}`).emit('preview:requested', {
      requestedBy: userId,
      timestamp:   Date.now(),
    });
  });

  socket.on('screen:command', async ({ screenId, command, payload }) => {
    const allowed = ['refresh', 'reboot', 'screenshot', 'volume', 'brightness', 'sync'];
    if (!allowed.includes(command)) return;
    try {
      const screenRow = await query(
        `SELECT s.aes_secret_key, dpc.temp_auth_key AS auth_key
         FROM wilyer_screens s
         JOIN wilyer_device_pairing_codes dpc ON dpc.id = s.pairing_code_id
         WHERE s.id = $1 AND s.org_id = $2`,
        [screenId, orgId],
      );
      if (!screenRow.rows[0]) return;

      const aesKey    = Buffer.from(screenRow.rows[0].aes_secret_key, 'base64');
      const encrypted = encryptForDevice({ command, payload, timestamp: Date.now() }, aesKey);
      io.to(screenRow.rows[0].auth_key).emit('message', encrypted);
      console.log(`📡 [ADMIN] Command "${command}" → screenId=${screenId}`);
    } catch (err) {
      logger.error('screen:command error:', err);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`👤 [ADMIN] Disconnected: userId=${userId} reason=${reason}`);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Send screen_linked to the waiting device
// ─────────────────────────────────────────────────────────────────────────────
//
// This message is sent PLAIN (not encrypted) because:
//   - The device needs it before it has confirmed its AES key is usable
//   - The flow diagram shows unencrypted JSON for screen_linked
//
// Shape:
//   event:   "message"
//   payload: { message: [{ response_type:"screen_linked", status:"100", ... }] }
//
const _sendScreenLinked = (authKey, screenData) => {
  if (!io) return;
  io.to(authKey).emit('message', {
    message: [
      {
        response_type: 'screen_linked',
        status:        '100',
        screenId:      screenData.screenId,
        screenSeqId:   screenData.screenSeqId,
        deviceToken:   screenData.deviceToken,
        deviceName:    screenData.deviceName,
        linkedUserId:  screenData.linkedUserId || null,
        orgId:         screenData.orgId,
      },
    ],
  });
  console.log(`📣 [PAIR] screen_linked → room "${authKey}" screenId=${screenData.screenId}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// RESTART PATH — Re-send current playlist to a reconnecting device
// ─────────────────────────────────────────────────────────────────────────────
//
// After AES-encrypting buildPlayablePayload() output, the device receives:
//
//   event:   "message"
//   payload: AES_ENCRYPT({
//     type: "playable_data",
//     data: {
//       playlistObjectArrayList: [ { playlistId, playlistName, layoutObjectArrayList, ... } ],
//       scheduleDataObjectArrayList: null
//     }
//   })
//
const _sendCurrentContent = async (authKey, screenId, orgId, aesKey) => {
  try {
    const screen = await query(
      `SELECT assigned_playlist_id, current_playlist_version FROM wilyer_screens WHERE id=$1`,
      [screenId],
    );

    const row = screen.rows[0];
    if (!row?.assigned_playlist_id) {
      console.log(`ℹ️  [CONTENT] No playlist assigned: screenId=${screenId}`);
      return;
    }

    const playlistData = await getFullPlaylistData(row.assigned_playlist_id, orgId);
    if (!playlistData) {
      console.error(`❌ [CONTENT] Playlist data not found: screenId=${screenId}`);
      return;
    }

    // buildPlayablePayload produces:
    // { type:"playable_data", data:{ playlistObjectArrayList:[...], scheduleDataObjectArrayList:null } }
    const payload   = buildPlayablePayload(playlistData, row.current_playlist_version);
    const encrypted = encryptForDevice(payload, aesKey);

    io.to(authKey).emit('message', encrypted);
    console.log(
      `✅ [CONTENT] Pushed to room "${authKey}"`,
      `v${row.current_playlist_version}`,
      `layouts=${payload.data.playlistObjectArrayList[0]?.layoutObjectArrayList?.length ?? 0}`,
    );
  } catch (err) {
    logger.error('_sendCurrentContent failed:', err);
    console.error(`❌ [CONTENT] Error screenId=${screenId}:`, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL TELEMETRY HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

const updateDeviceStatus = async (screenId, status) => {
  try {
    await query(`UPDATE wilyer_screens SET status=$1, last_seen=NOW() WHERE id=$2`, [status, screenId]);
    console.log(`📊 [STATUS] screenId=${screenId} → ${status}`);
  } catch (err) { logger.error('updateDeviceStatus failed:', err); }
};

const handlePlaybackReport = async (screenId, orgId, data) => {
  try {
    const { mediaId, playlistId, itemPosition, durationPlayed, completed, timestamp } = data;
    await query(
      `INSERT INTO wilyer_playback_logs
         (screen_id, org_id, media_id, playlist_id, item_position,
          duration_played, completed, played_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [screenId, orgId, mediaId, playlistId, itemPosition,
       durationPlayed, completed, new Date(timestamp || Date.now())],
    );
    io.to(`screen_monitor:${screenId}`).emit('playback:update', {
      screenId, mediaId, playlistId, itemPosition, durationPlayed, completed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) { logger.error('handlePlaybackReport failed:', err); }
};

const handleMetricsReport = async (screenId, orgId, data) => {
  try {
    const {
      cpuUsage, memoryUsage, diskUsage, temperature,
      currentPlaylistId, currentMediaId, currentItemPosition,
      appVersion, ipAddress, timestamp,
    } = data;
    await query(
      `UPDATE wilyer_screens SET status='online', last_seen=NOW(),
         app_version=COALESCE($1,app_version), current_ip=$2 WHERE id=$3`,
      [appVersion, ipAddress, screenId],
    );
    await query(
      `INSERT INTO wilyer_device_heartbeats
         (screen_id, org_id, cpu_usage, memory_usage, disk_usage, temperature,
          current_playlist_id, current_media_id, current_item_position,
          app_version, ip_address, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [screenId, orgId, cpuUsage, memoryUsage, diskUsage, temperature,
       currentPlaylistId, currentMediaId, currentItemPosition,
       appVersion, ipAddress, new Date(timestamp || Date.now())],
    );
    io.to(`screen_monitor:${screenId}`).emit('metrics:update', {
      screenId, cpuUsage, memoryUsage, diskUsage, temperature,
      currentPlaylistId, currentMediaId, timestamp: new Date().toISOString(),
    });
  } catch (err) { logger.error('handleMetricsReport failed:', err); }
};

const handleScreenshotResponse = async (screenId, orgId, data) => {
  try {
    const { imageBase64, timestamp } = data;
    io.to(`org:${orgId}`).emit('screenshot:ready', {
      screenId, imageBase64,
      timestamp: new Date(timestamp || Date.now()).toISOString(),
    });
  } catch (err) { logger.error('handleScreenshotResponse failed:', err); }
};

const handleContentRequest = async (socket, screenId, data) => {
  try {
    const { mediaIds } = data;
    if (!mediaIds?.length) return;
    const media = await query(
      `SELECT id, secure_url, resource_type, format FROM wilyer_media_files WHERE id=ANY($1::uuid[])`,
      [mediaIds],
    );
    const encrypted = encryptForDevice(
      { type: 'content:response', media: media.rows },
      socket.device.aesKey,
    );
    socket.emit('encrypted:content', encrypted);
  } catch (err) { logger.error('handleContentRequest failed:', err); }
};

const handlePlaylistSyncComplete = async (screenId, data) => {
  try {
    const { playlistId, version } = data;
    await query(
      `UPDATE wilyer_playlist_assignments SET synced_at=NOW()
       WHERE screen_id=$1 AND playlist_id=$2 AND version=$3`,
      [screenId, playlistId, version],
    );
    await query(`UPDATE wilyer_screens SET last_sync_version=$1 WHERE id=$2`, [version, screenId]);
    console.log(`🔄 [SYNC] Complete: screenId=${screenId} playlist=${playlistId} v${version}`);
  } catch (err) { logger.error('handlePlaylistSyncComplete failed:', err); }
};

const handleSyncResponse = async (screenId, data) => {
  try {
    const { currentVersion } = data;
    await query(`UPDATE wilyer_screens SET last_sync_version=$1 WHERE id=$2`, [currentVersion, screenId]);
  } catch (err) { logger.error('handleSyncResponse failed:', err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — called from HTTP controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STEP 4 — Called by pairScreen() after creating the screen record.
 * Sends plain-JSON "message" event with response_type:"screen_linked".
 */
const notifyDevicePaired = (authKey, screenData) => {
  if (!io) { console.warn('⚠️  [PAIR] Socket.io not ready'); return; }
  _sendScreenLinked(authKey, screenData);
};

/**
 * STEP 5 — Push AES-encrypted playlist payload to a screen via its authKey room.
 *
 * `data` is the plain object from buildPlayablePayload():
 * {
 *   type: "playable_data",
 *   data: {
 *     playlistObjectArrayList: [ { ... } ],
 *     scheduleDataObjectArrayList: null
 *   }
 * }
 *
 * Returns true if device room is live, false if offline.
 * Caller is responsible for storing to pending_sync when false.
 */
const sendToScreen = async (screenId, messageType, data) => {
  try {
    console.log(`📤 [sendToScreen] screenId=${screenId} type=${messageType}`);
    if (!io) return false;

    const screenRow = await query(
      `SELECT s.aes_secret_key, dpc.temp_auth_key AS auth_key
       FROM wilyer_screens s
       JOIN wilyer_device_pairing_codes dpc ON dpc.id = s.pairing_code_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [screenId],
    );

    if (!screenRow.rows[0]) {
      console.error(`❌ [sendToScreen] Screen not found: ${screenId}`);
      return false;
    }

    const { aes_secret_key, auth_key } = screenRow.rows[0];
    const room     = io.sockets.adapter.rooms.get(auth_key);
    const roomSize = room?.size || 0;

    console.log(`📊 [sendToScreen] Room "${auth_key}" — ${roomSize} socket(s)`);

    if (roomSize === 0) {
      console.warn(`⚠️  [sendToScreen] Device offline: screenId=${screenId}`);
      return false;
    }

    const aesKey = Buffer.from(aes_secret_key, 'base64');

    // Encrypt the exact APK payload — data already has type:"playable_data" structure
    // from buildPlayablePayload(). We do NOT wrap it further.
    const encrypted = encryptForDevice(data, aesKey);

    // "message" is the one and only server→device event name
    io.to(auth_key).emit('message', encrypted);
    console.log(`✅ [sendToScreen] Emitted "message" to room "${auth_key}"`);
    return true;

  } catch (err) {
    logger.error('sendToScreen error:', err);
    console.error(`❌ [sendToScreen] Error screenId=${screenId}:`, err.message);
    return false;
  }
};

/** Broadcast plain event to all admin sockets in an org */
const broadcastToOrg = (orgId, event, data) => {
  if (io) io.to(`org:${orgId}`).emit(event, data);
};

/** Broadcast plain event to a specific screen's named room */
const broadcastToScreen = (screenId, event, data) => {
  if (io) io.to(`screen:${screenId}`).emit(event, data);
};

/** Push notification to a specific logged-in admin user */
const sendNotification = (userId, notification) => {
  if (io) io.to(`user:${userId}`).emit('notification:new', notification);
};

const getSocketIO = () => io;

module.exports = {
  initializeSocket,
  getSocketIO,
  notifyDevicePaired,
  broadcastToOrg,
  broadcastToScreen,
  sendToScreen,
  sendNotification,
};