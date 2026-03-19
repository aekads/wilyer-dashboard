-- ============================================================
-- Widget System Migration
-- Supports: Clock, Weather, RSS Feed, Web URL, Notice Board,
--           Live Counter, QR Code, Social Feed, Stock Ticker,
--           YouTube, Google Slides, Custom HTML
-- ============================================================

-- ── Widget type enum ──────────────────────────────────────────
CREATE TYPE widget_type AS ENUM (
  'clock',
  'weather',
  'rss_feed',
  'web_url',
  'notice_board',
  'live_counter',
  'qr_code',
  'social_feed',
  'stock_ticker',
  'youtube',
  'google_slides',
  'custom_html',
  'countdown',
  'google_traffic'
);

-- ── Widget theme enum ─────────────────────────────────────────
CREATE TYPE widget_theme AS ENUM ('light', 'dark', 'transparent', 'custom');

-- ── Main widgets table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS widgets (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID          NOT NULL REFERENCES users(id),

  name            VARCHAR(255)  NOT NULL,
  type            widget_type   NOT NULL,
  description     TEXT,

  -- Visual settings
  theme           widget_theme  NOT NULL DEFAULT 'dark',
  background_color VARCHAR(20),       -- hex color
  text_color       VARCHAR(20),
  font_size        INTEGER DEFAULT 24, -- px
  font_family      VARCHAR(100) DEFAULT 'inherit',
  border_radius    INTEGER DEFAULT 8,  -- px
  padding          INTEGER DEFAULT 16, -- px

  -- Type-specific config (JSONB — flexible per widget type)
  config          JSONB         NOT NULL DEFAULT '{}',

  -- Refresh & caching
  refresh_interval INTEGER DEFAULT 300,  -- seconds; 0 = no refresh
  cache_duration   INTEGER DEFAULT 60,   -- seconds for player-side caching

  -- Status
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  is_deleted      BOOLEAN       NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,

  -- Approval (for unapproved tab)
  is_approved     BOOLEAN       NOT NULL DEFAULT TRUE,
  approved_by     UUID          REFERENCES users(id),
  approved_at     TIMESTAMPTZ,

  -- Preview thumbnail (generated or uploaded)
  preview_url     TEXT,

  -- Audit
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT widget_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_widgets_org_id    ON widgets(org_id);
CREATE INDEX IF NOT EXISTS idx_widgets_type      ON widgets(type);
CREATE INDEX IF NOT EXISTS idx_widgets_is_active ON widgets(is_active);
CREATE INDEX IF NOT EXISTS idx_widgets_config    ON widgets USING gin(config);

-- ── Widget usage in playlists ─────────────────────────────────
-- Playlist items can reference a widget_id instead of (or alongside) a media_id
ALTER TABLE playlist_items
  ADD COLUMN IF NOT EXISTS widget_id UUID REFERENCES widgets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'media'; -- 'media' | 'widget'

-- ── Widget play logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS widget_play_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id   UUID        NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  screen_id   UUID        NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL,
  played_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration    INTEGER,    -- seconds displayed
  error       TEXT        -- null if ok
);

CREATE INDEX IF NOT EXISTS idx_wpl_widget_id ON widget_play_logs(widget_id);
CREATE INDEX IF NOT EXISTS idx_wpl_screen_id ON widget_play_logs(screen_id);
CREATE INDEX IF NOT EXISTS idx_wpl_played_at ON widget_play_logs(played_at);

-- ============================================================
-- CONFIG SCHEMAS (documentation via comments)
-- ============================================================

-- clock config example:
-- { "timezone": "America/New_York", "format": "12h", "showDate": true,
--   "showSeconds": true, "dateFormat": "dddd, MMMM D" }

-- weather config example:
-- { "city": "New York", "country": "US", "unit": "celsius",
--   "apiKey": "...", "showForecast": true, "days": 3, "lat": 40.71, "lon": -74.00 }

-- rss_feed config example:
-- { "url": "https://feeds.bbci.co.uk/news/rss.xml", "maxItems": 5,
--   "scrollSpeed": 50, "showImages": true, "showDate": true }

-- web_url config example:
-- { "url": "https://example.com", "zoom": 1.0, "scrollable": false }

-- notice_board config example:
-- { "messages": [{"text": "Hello!", "color": "#fff"}],
--   "scrollDirection": "up", "speed": 40, "showBullets": true }

-- live_counter config example:
-- { "label": "Visitors Today", "count": 1284, "unit": "",
--   "animateOnLoad": true, "prefix": "", "suffix": "+" }

-- qr_code config example:
-- { "url": "https://example.com", "size": 300, "errorLevel": "M",
--   "label": "Scan me", "showLabel": true, "color": "#000000" }

-- social_feed config example:
-- { "platform": "twitter", "username": "example", "hashtag": "#news",
--   "maxPosts": 6, "accessToken": "..." }

-- stock_ticker config example:
-- { "symbols": ["AAPL","GOOG","TSLA"], "currency": "USD",
--   "apiKey": "...", "showChange": true, "showPercent": true }

-- youtube config example:
-- { "videoId": "dQw4w9WgXcQ", "autoplay": true, "muted": true,
--   "loop": true, "showControls": false, "startAt": 0 }

-- countdown config example:
-- { "targetDate": "2025-12-31T23:59:59Z", "label": "New Year!",
--   "showDays": true, "showHours": true, "showMinutes": true, "showSeconds": true }

-- custom_html config example:
-- { "html": "<div>...</div>", "css": "body{}", "js": "setInterval(...)" }