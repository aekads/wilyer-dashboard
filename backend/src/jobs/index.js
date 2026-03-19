// src/jobs/index.js
// ============================================================
// AEKADS Background Jobs - Node-Cron Only (No Redis)
// ============================================================
const cron = require('node-cron');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { broadcastToOrg, broadcastToScreen, sendNotification } = require('../sockets');

// ── Initialize Jobs ─────────────────────────────────────────
const initializeJobs = () => {
  try {
    // Setup all cron jobs
    setupCronJobs();
    logger.info('✅ Background jobs initialized successfully');
  } catch (err) {
    logger.error('Failed to initialize background jobs:', err.message);
    // Still attempt to setup cron jobs even if there's an error
    setupCronJobs();
  }
};

// ── Schedule Activation Function ────────────────────────────
const processScheduleActivation = async (scheduleId, action) => {
  logger.info(`Processing schedule ${action}: ${scheduleId}`);

  try {
    const schedule = await query(`
      SELECT s.*, p.id AS playlist_id
      FROM wilyer_schedules s
      JOIN wilyer_playlists p ON p.id = s.playlist_id
      WHERE s.id = $1 AND s.status = 'active'
    `, [scheduleId]);

    if (!schedule.rows[0]) {
      logger.warn(`Schedule ${scheduleId} not found or not active`);
      return;
    }

    const { org_id, playlist_id, screen_ids, group_ids } = schedule.rows[0];

    if (action === 'activate') {
      // Get all target screens
      let targetScreenIds = [...(screen_ids || [])];

      if (group_ids?.length > 0) {
        const groupScreens = await query(
          `SELECT id FROM wilyer_screens WHERE group_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
          [group_ids]
        );
        targetScreenIds.push(...groupScreens.rows.map(s => s.id));
      }

      // Remove duplicates
      targetScreenIds = [...new Set(targetScreenIds)];

      // Assign playlist to screens
      for (const screenId of targetScreenIds) {
        await query(
          `UPDATE wilyer_screens SET assigned_playlist_id = $1 WHERE id = $2`,
          [playlist_id, screenId]
        );

        // Broadcast to specific screen
        try {
          broadcastToScreen(screenId, 'playlist:update', {
            playlistId: playlist_id,
            action: 'schedule_activate',
            scheduleId
          });
        } catch (err) {
          logger.error(`Failed to broadcast to screen ${screenId}:`, err.message);
        }
      }

      logger.info(`Schedule activated: ${scheduleId} → ${targetScreenIds.length} screens`);

    } else if (action === 'deactivate') {
      // Update schedule status
      await query(
        `UPDATE wilyer_schedules SET status = 'expired' WHERE id = $1`,
        [scheduleId]
      );

      // Broadcast to organization
      try {
        broadcastToOrg(org_id, 'schedule:expired', { scheduleId });
      } catch (err) {
        logger.error(`Failed to broadcast schedule expiry:`, err.message);
      }
    }

  } catch (err) {
    logger.error(`Schedule job failed: ${scheduleId}`, err);
    throw err;
  }
};

// ── Notification Function ───────────────────────────────────
const processNotification = async (jobData) => {
  const { orgId, userId, type, title, message, actionUrl } = jobData;

  try {
    await query(`
      INSERT INTO wilyer_notifications (org_id, user_id, type, title, message, action_url)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [orgId, userId, type, title, message, actionUrl]);

    if (userId) {
      try {
        sendNotification(userId, { type, title, message, actionUrl });
      } catch (err) {
        logger.error(`Failed to send notification to user ${userId}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('Failed to process notification:', err);
  }
};

// ── Analytics Aggregation Function ──────────────────────────
const aggregateAnalytics = async (date, orgId = null) => {
  logger.info(`Aggregating analytics for ${date} org:${orgId || 'all'}`);

  try {
    const orgFilter = orgId ? `AND pl.org_id = '${orgId}'` : '';

    // Aggregate daily stats per screen + media
    await query(`
      INSERT INTO wilyer_analytics_summary (org_id, screen_id, media_id, playlist_id, date, period, play_count, total_duration)
      SELECT 
        pl.org_id,
        pl.screen_id,
        pl.media_id,
        pl.playlist_id,
        $1::date AS date,
        'daily' AS period,
        COUNT(*) AS play_count,
        COALESCE(SUM(pl.duration_played), 0) AS total_duration
      FROM wilyer_playback_logs pl
      WHERE DATE(pl.played_at) = $1::date
      ${orgFilter}
      GROUP BY pl.org_id, pl.screen_id, pl.media_id, pl.playlist_id
      ON CONFLICT (org_id, screen_id, media_id, date, period) 
      DO UPDATE SET 
        play_count = EXCLUDED.play_count,
        total_duration = EXCLUDED.total_duration,
        updated_at = NOW()
    `, [date]);

    logger.info(`Analytics aggregated successfully for ${date}`);
  } catch (err) {
    logger.error(`Analytics aggregation failed for ${date}:`, err);
    throw err;
  }
};

// ── Cron Jobs ────────────────────────────────────────────────
const setupCronJobs = () => {

  // Every minute: Check active schedules
  cron.schedule('* * * * *', async () => {
    try {
      await processActiveSchedules();
    } catch (err) {
      logger.error('Schedule cron error:', err.message);
    }
  });

  // Every 2 minutes: Mark offline screens
  cron.schedule('*/2 * * * *', async () => {
    try {
      await markOfflineScreens();
    } catch (err) {
      logger.error('Offline detection cron error:', err.message);
    }
  });

  // Every hour: Clean expired refresh tokens
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await query(
        `DELETE FROM wilyer_refresh_tokens WHERE expires_at < NOW() OR (is_revoked = TRUE AND revoked_at < NOW() - INTERVAL '7 days')`
      );
      if (result.rowCount > 0) {
        logger.info(`Cleaned ${result.rowCount} expired refresh tokens`);
      }
    } catch (err) {
      logger.error('Token cleanup error:', err.message);
    }
  });

  // Every day at 2am: Aggregate analytics
  cron.schedule('0 2 * * *', async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      await aggregateAnalytics(dateStr);
    } catch (err) {
      logger.error('Analytics cron error:', err.message);
    }
  });

  // Every day at 9am: Check license expiry and send warnings
  cron.schedule('0 9 * * *', async () => {
    try {
      await checkLicenseExpiry();
    } catch (err) {
      logger.error('License check error:', err.message);
    }
  });

  // Every 5 minutes: Check for schedules that need deactivation
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processExpiredSchedules();
    } catch (err) {
      logger.error('Schedule expiry check error:', err.message);
    }
  });

  logger.info('✅ All cron jobs scheduled successfully');
};

// ── Job Functions ─────────────────────────────────────────────

const processActiveSchedules = async () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun, 1=Mon...
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM

  // Find schedules that should activate now
  const toActivate = await query(`
    SELECT id FROM wilyer_schedules
    WHERE status = 'active'
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      AND (start_time IS NULL OR start_time <= $1::time)
      AND (end_time IS NULL OR end_time >= $1::time)
      AND (
        recurrence_type = 'none'
        OR recurrence_type = 'daily'
        OR (recurrence_type = 'weekly' AND $2 = ANY(recurrence_days))
      )
      AND NOT EXISTS (
        -- Avoid reprocessing recently activated wilyer_schedules
        SELECT 1 FROM wilyer_schedule_activation_log 
        WHERE schedule_id = wilyer_schedules.id 
          AND activated_at > NOW() - INTERVAL '1 minute'
      )
  `, [currentTime, currentDay]);

  for (const schedule of toActivate.rows) {
    try {
      await processScheduleActivation(schedule.id, 'activate');
      
      // Log activation
      await query(
        `INSERT INTO wilyer_schedule_activation_log (schedule_id, activated_at) VALUES ($1, NOW())`,
        [schedule.id]
      );
    } catch (err) {
      logger.error(`Failed to activate schedule ${schedule.id}:`, err.message);
    }
  }

  if (toActivate.rows.length > 0) {
    logger.info(`Processed ${toActivate.rows.length} schedule activations`);
  }
};

const processExpiredSchedules = async () => {
  // Find schedules that should be deactivated
  const toDeactivate = await query(`
    SELECT id FROM wilyer_schedules
    WHERE status = 'active'
      AND (
        end_date < CURRENT_DATE
        OR (end_time IS NOT NULL AND end_time < CURRENT_TIME)
      )
  `);

  for (const schedule of toDeactivate.rows) {
    try {
      await processScheduleActivation(schedule.id, 'deactivate');
    } catch (err) {
      logger.error(`Failed to deactivate schedule ${schedule.id}:`, err.message);
    }
  }
};

const markOfflineScreens = async () => {
  const result = await query(`
    UPDATE wilyer_screens 
    SET status = 'offline', last_offline_at = NOW()
    WHERE status = 'online' 
      AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '2 minutes')
      AND deleted_at IS NULL
    RETURNING id, org_id
  `);

  for (const screen of result.rows) {
    try {
      broadcastToOrg(screen.org_id, 'screen:status_change', {
        screenId: screen.id,
        status: 'offline',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error(`Failed to broadcast offline status for screen ${screen.id}:`, err.message);
    }
  }

  if (result.rowCount > 0) {
    logger.info(`Marked ${result.rowCount} screens offline`);
  }
};

const checkLicenseExpiry = async () => {
  // Warn about licenses expiring in 7 days
  const expiringSoon = await query(`
    SELECT s.id, s.device_name, s.org_id, s.license_expires_at
    FROM wilyer_screens s
    WHERE s.license_expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      AND s.license_status = 'active'
      AND s.deleted_at IS NULL
  `);

  for (const screen of expiringSoon.rows) {
    try {
      await query(`
        INSERT INTO wilyer_notifications (org_id, type, title, message)
        VALUES ($1, 'license_expiry', $2, $3)
      `, [
        screen.org_id,
        `License Expiring Soon: ${screen.device_name}`,
        `Screen "${screen.device_name}" license expires on ${new Date(screen.license_expires_at).toDateString()}`
      ]);
    } catch (err) {
      logger.error(`Failed to create license expiry notification for screen ${screen.id}:`, err.message);
    }
  }

  if (expiringSoon.rows.length > 0) {
    logger.info(`Created ${expiringSoon.rows.length} license expiry notifications`);
  }
};

// ── Public API ────────────────────────────────────────────────

/**
 * Add a notification to the queue (immediate processing)
 */
const addNotification = async (notificationData) => {
  try {
    await processNotification(notificationData);
    return true;
  } catch (err) {
    logger.error('Failed to add notification:', err);
    return false;
  }
};

/**
 * Trigger analytics aggregation manually
 */
const triggerAnalyticsAggregation = async (date, orgId = null) => {
  try {
    await aggregateAnalytics(date, orgId);
    return true;
  } catch (err) {
    logger.error('Failed to trigger analytics aggregation:', err);
    return false;
  }
};

/**
 * Manually activate a schedule
 */
const activateSchedule = async (scheduleId) => {
  try {
    await processScheduleActivation(scheduleId, 'activate');
    return true;
  } catch (err) {
    logger.error(`Failed to manually activate schedule ${scheduleId}:`, err);
    return false;
  }
};

module.exports = {  
  initializeJobs,    
  addNotification,
  triggerAnalyticsAggregation,
  activateSchedule
};