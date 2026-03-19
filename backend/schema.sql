-- ============================================================
-- AEKADS Digital Signage SaaS Platform
-- Complete PostgreSQL Schema v1.0
-- Using Sequential IDs
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- SEQUENCES
-- ============================================================
CREATE SEQUENCE organizations_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE subscription_plans_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE subscriptions_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE roles_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE permissions_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE role_permissions_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE users_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE user_roles_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE refresh_tokens_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE screen_groups_id_seq START 1 INCREMENT 1;3n 
CREATE SEQUENCE screens_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE folders_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE media_files_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE playlists_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE playlist_items_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE screen_playlist_assignments_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE schedules_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE playback_logs_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE device_heartbeats_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE analytics_summary_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE screen_logs_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE audit_logs_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE notifications_id_seq START 1 INCREMENT 1;
CREATE SEQUENCE playlist_versions_id_seq START 1 INCREMENT 1;

-- ============================================================
-- ORGANIZATIONS (Multi-tenant)
-- ============================================================
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY DEFAULT nextval('organizations_id_seq'),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#0F172A',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    timezone VARCHAR(100) DEFAULT 'UTC',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_limits (
  org_id       UUID PRIMARY KEY REFERENCES organizations(id),
  max_screens  INTEGER DEFAULT 5,
  max_storage  BIGINT DEFAULT 10737418240, -- 10 GB
  plan_name    VARCHAR(50) DEFAULT 'free',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================ 
-- SUBSCRIPTION PLANS
-- ============================================================
CREATE TABLE subscription_plans (
    id INTEGER PRIMARY KEY DEFAULT nextval('subscription_plans_id_seq'),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    max_screens INTEGER NOT NULL DEFAULT 5,
    max_users INTEGER NOT NULL DEFAULT 3,
    max_storage_gb INTEGER NOT NULL DEFAULT 10,
    max_playlists INTEGER DEFAULT 50,
    features JSONB DEFAULT '{}',
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY DEFAULT nextval('subscriptions_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(30) DEFAULT 'active',
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    external_subscription_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
    id INTEGER PRIMARY KEY DEFAULT nextval('roles_id_seq'),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY DEFAULT nextval('permissions_id_seq'),
    module VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module, action)
);

-- ============================================================
-- ROLE_PERMISSIONS
-- ============================================================
CREATE TABLE role_permissions (
    id INTEGER PRIMARY KEY DEFAULT nextval('role_permissions_id_seq'),
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id INTEGER PRIMARY KEY DEFAULT nextval('users_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verified_at TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    preferences JSONB DEFAULT '{}',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email, org_id)
);

-- ============================================================
-- USER_ROLES
-- ============================================================
CREATE TABLE user_roles (
    id INTEGER PRIMARY KEY DEFAULT nextval('user_roles_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY DEFAULT nextval('refresh_tokens_id_seq'),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCREEN GROUPS
-- ============================================================
CREATE TABLE screen_groups (
    id INTEGER PRIMARY KEY DEFAULT nextval('screen_groups_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags VARCHAR(100)[],
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FOLDERS
-- ============================================================
CREATE TABLE folders (
    id INTEGER PRIMARY KEY DEFAULT nextval('folders_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, parent_id, name)
);

-- ============================================================
-- SCREENS
-- ============================================================
CREATE TABLE screens (
    id INTEGER PRIMARY KEY DEFAULT nextval('screens_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES screen_groups(id) ON DELETE SET NULL,
    device_name VARCHAR(255) NOT NULL,
    pairing_code VARCHAR(10) UNIQUE,
    device_token_hash VARCHAR(255) UNIQUE,
    location VARCHAR(500),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    status VARCHAR(30) DEFAULT 'offline',
    license_status VARCHAR(30) DEFAULT 'trial',
    license_expires_at TIMESTAMPTZ,
    resolution VARCHAR(20),
    orientation VARCHAR(20) DEFAULT 'landscape',
    os_info VARCHAR(255),
    app_version VARCHAR(50),
    last_seen TIMESTAMPTZ,
    current_ip INET,
    assigned_playlist_id INTEGER,
    metadata JSONB DEFAULT '{}',
    is_paired BOOLEAN DEFAULT FALSE,
    paired_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEDIA FILES
-- ============================================================
CREATE TABLE media_files (
    id INTEGER PRIMARY KEY DEFAULT nextval('media_files_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    name VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    cloudinary_public_id VARCHAR(500) UNIQUE NOT NULL,
    cloudinary_folder VARCHAR(255),
    secure_url TEXT NOT NULL,
    thumbnail_url TEXT,
    format VARCHAR(20),
    resource_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    duration DECIMAL(10,2),
    bitrate INTEGER,
    tags VARCHAR(100)[],
    play_count INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by INTEGER REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYLISTS
-- ============================================================
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY DEFAULT nextval('playlists_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    thumbnail_url TEXT,
    total_duration INTEGER DEFAULT 0,
    is_loop BOOLEAN DEFAULT TRUE,
    transition_type VARCHAR(50) DEFAULT 'none',
    tags VARCHAR(100)[],
    deleted_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYLIST ITEMS
-- ============================================================
CREATE TABLE playlist_items (
    id INTEGER PRIMARY KEY DEFAULT nextval('playlist_items_id_seq'),
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES media_files(id) ON DELETE SET NULL,
    widget_type VARCHAR(50),
    widget_config JSONB DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 10,
    transition_in VARCHAR(50) DEFAULT 'none',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCREEN PLAYLIST ASSIGNMENTS
-- ============================================================
CREATE TABLE screen_playlist_assignments (
    id INTEGER PRIMARY KEY DEFAULT nextval('screen_playlist_assignments_id_seq'),
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(screen_id, playlist_id)
);

-- ============================================================
-- SCHEDULES
-- ============================================================
CREATE TABLE schedules (
    id INTEGER PRIMARY KEY DEFAULT nextval('schedules_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(500) NOT NULL,
    description TEXT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    screen_ids INTEGER[],
    group_ids INTEGER[],
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    timezone VARCHAR(100) DEFAULT 'UTC',
    recurrence_type VARCHAR(30) DEFAULT 'none',
    recurrence_days INTEGER[],
    recurrence_config JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    status VARCHAR(30) DEFAULT 'active',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYBACK LOGS (Partitioned by year)
-- ============================================================
CREATE TABLE playback_logs (
    id INTEGER DEFAULT nextval('playback_logs_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
    media_id INTEGER REFERENCES media_files(id) ON DELETE SET NULL,
    widget_type VARCHAR(50),
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_played INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, played_at)
) PARTITION BY RANGE (played_at);

-- Create partitions for current and next year
CREATE TABLE playback_logs_2025 PARTITION OF playback_logs
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE playback_logs_2026 PARTITION OF playback_logs
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE playback_logs_default PARTITION OF playback_logs DEFAULT;

-- ============================================================
-- DEVICE HEARTBEATS (Partitioned by year)
-- ============================================================
CREATE TABLE device_heartbeats (
    id INTEGER DEFAULT nextval('device_heartbeats_id_seq'),
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    temperature DECIMAL(5,2),
    current_playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
    current_media_id INTEGER REFERENCES media_files(id) ON DELETE SET NULL,
    app_version VARCHAR(50),
    ip_address INET,
    signal_strength INTEGER,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE TABLE device_heartbeats_2025 PARTITION OF device_heartbeats
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE device_heartbeats_2026 PARTITION OF device_heartbeats
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE device_heartbeats_default PARTITION OF device_heartbeats DEFAULT;

-- ============================================================
-- ANALYTICS SUMMARY
-- ============================================================
CREATE TABLE analytics_summary (
    id INTEGER PRIMARY KEY DEFAULT nextval('analytics_summary_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    screen_id INTEGER REFERENCES screens(id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES media_files(id) ON DELETE CASCADE,
    playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    period VARCHAR(20) NOT NULL,
    play_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    uptime_seconds INTEGER DEFAULT 0,
    downtime_seconds INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, screen_id, media_id, date, period)
);

-- ============================================================
-- SCREEN LOGS
-- ============================================================
CREATE TABLE screen_logs (
    id INTEGER PRIMARY KEY DEFAULT nextval('screen_logs_id_seq'),
    screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY DEFAULT nextval('audit_logs_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(200) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY DEFAULT nextval('notifications_id_seq'),
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYLIST VERSIONS
-- ============================================================
CREATE TABLE playlist_versions (
    id INTEGER PRIMARY KEY DEFAULT nextval('playlist_versions_id_seq'),
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADD FOREIGN KEY constraint for screens
-- ============================================================
ALTER TABLE screens 
    ADD CONSTRAINT fk_screens_playlist 
    FOREIGN KEY (assigned_playlist_id) REFERENCES playlists(id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES
-- ============================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_deleted ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;

-- Folders
CREATE INDEX idx_folders_org_id ON folders(org_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);

-- Screens
CREATE INDEX idx_screens_org ON screens(org_id);
CREATE INDEX idx_screens_status ON screens(status);
CREATE INDEX idx_screens_pairing ON screens(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX idx_screens_last_seen ON screens(last_seen);
CREATE INDEX idx_screens_group ON screens(group_id);
CREATE INDEX idx_screens_deleted ON screens(deleted_at) WHERE deleted_at IS NULL;

-- Media
CREATE INDEX idx_media_org ON media_files(org_id);
CREATE INDEX idx_media_uploader ON media_files(uploaded_by);
CREATE INDEX idx_media_folder ON media_files(folder_id);
CREATE INDEX idx_media_type ON media_files(resource_type);
CREATE INDEX idx_media_deleted ON media_files(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_tags ON media_files USING GIN(tags);

-- Playlists
CREATE INDEX idx_playlists_org ON playlists(org_id);
CREATE INDEX idx_playlists_status ON playlists(status);
CREATE INDEX idx_playlists_deleted ON playlists(deleted_at) WHERE deleted_at IS NULL;

-- Playlist items
CREATE INDEX idx_playlist_items_playlist ON playlist_items(playlist_id);
CREATE INDEX idx_playlist_items_media ON playlist_items(media_id);
CREATE INDEX idx_playlist_items_position ON playlist_items(playlist_id, position);

-- Schedules
CREATE INDEX idx_schedules_org ON schedules(org_id);
CREATE INDEX idx_schedules_playlist ON schedules(playlist_id);
CREATE INDEX idx_schedules_dates ON schedules(start_date, end_date);
CREATE INDEX idx_schedules_status ON schedules(status);

-- Playback logs
CREATE INDEX idx_playback_logs_screen ON playback_logs(screen_id, played_at);
CREATE INDEX idx_playback_logs_org ON playback_logs(org_id, played_at);
CREATE INDEX idx_playback_logs_media ON playback_logs(media_id, played_at);

-- Heartbeats
CREATE INDEX idx_heartbeats_screen ON device_heartbeats(screen_id, timestamp);

-- Audit logs
CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Refresh tokens
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_token ON refresh_tokens(token_hash);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_org ON notifications(org_id, created_at);

-- Role permissions
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- Analytics summary
CREATE INDEX idx_analytics_org_date ON analytics_summary(org_id, date);
CREATE INDEX idx_analytics_screen ON analytics_summary(screen_id, date);

-- ============================================================
-- SEED DATA - Permissions
-- ============================================================
INSERT INTO permissions (module, action, slug, description) VALUES
-- Users module
('users', 'create', 'users:create', 'Create new users'),
('users', 'read', 'users:read', 'View users'),
('users', 'update', 'users:update', 'Update user details'),
('users', 'delete', 'users:delete', 'Delete users'),
('users', 'assign', 'users:assign', 'Assign roles to users'),
-- Screens module
('screens', 'create', 'screens:create', 'Register new screens'),
('screens', 'read', 'screens:read', 'View screens'),
('screens', 'update', 'screens:update', 'Update screen settings'),
('screens', 'delete', 'screens:delete', 'Delete screens'),
('screens', 'assign', 'screens:assign', 'Assign playlists to screens'),
-- Media module
('media', 'create', 'media:create', 'Upload media files'),
('media', 'read', 'media:read', 'View media library'),
('media', 'update', 'media:update', 'Edit media metadata'),
('media', 'delete', 'media:delete', 'Delete media files'),
-- Playlists module
('playlists', 'create', 'playlists:create', 'Create playlists'),
('playlists', 'read', 'playlists:read', 'View playlists'),
('playlists', 'update', 'playlists:update', 'Edit playlists'),
('playlists', 'delete', 'playlists:delete', 'Delete playlists'),
('playlists', 'publish', 'playlists:publish', 'Publish/unpublish playlists'),
-- Schedules module
('schedules', 'create', 'schedules:create', 'Create schedules'),
('schedules', 'read', 'schedules:read', 'View schedules'),
('schedules', 'update', 'schedules:update', 'Edit schedules'),
('schedules', 'delete', 'schedules:delete', 'Delete schedules'),
('schedules', 'schedule', 'schedules:schedule', 'Activate/deactivate schedules'),
-- Analytics module
('analytics', 'read', 'analytics:read', 'View basic analytics'),
('analytics', 'analytics_view', 'analytics:analytics_view', 'View advanced analytics & reports'),
-- Settings module
('settings', 'read', 'settings:read', 'View organization settings'),
('settings', 'update', 'settings:update', 'Update organization settings');

-- ============================================================
-- SEED DATA - System Roles
-- ============================================================
INSERT INTO roles (name, slug, description, is_system) VALUES
('Super Admin', 'super_admin', 'Full system access, bypasses all permission checks', TRUE),
('Admin', 'admin', 'Full organization access', TRUE),
('Manager', 'manager', 'Manage screens, playlists, and schedules', TRUE),
('Editor', 'editor', 'Create and edit content only', TRUE),
('Viewer', 'viewer', 'Read-only access', TRUE),
('Device', 'device', 'Screen device authentication role', TRUE);

-- ============================================================
-- SEED DATA - Subscription Plans
-- ============================================================
INSERT INTO subscription_plans (name, slug, max_screens, max_users, max_storage_gb, price_monthly, price_yearly, features) VALUES
('Starter', 'starter', 5, 3, 10, 29.00, 290.00, '{"analytics":false,"widgets":false,"api":false,"white_label":false}'),
('Pro', 'pro', 50, 15, 100, 99.00, 990.00, '{"analytics":true,"widgets":true,"api":true,"white_label":false}'),
('Enterprise', 'enterprise', 10000, 999, 5000, 499.00, 4990.00, '{"analytics":true,"widgets":true,"api":true,"white_label":true}');

-- Assign ALL permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.slug = 'admin';

-- Manager: all except user management and settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'manager'
  AND p.module NOT IN ('users', 'settings')
  AND p.action != 'delete';

-- Editor: media, playlists CRUD (no delete/publish)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'editor'
  AND p.module IN ('media', 'playlists')
  AND p.action IN ('create', 'read', 'update');

-- Viewer: read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.slug = 'viewer'
  AND p.action = 'read';

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_screens_updated BEFORE UPDATE ON screens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_media_updated BEFORE UPDATE ON media_files FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_playlists_updated BEFORE UPDATE ON playlists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schedules_updated BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_folders_updated BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_analytics_summary_updated BEFORE UPDATE ON analytics_summary FOR EACH ROW EXECUTE FUNCTION update_updated_at();