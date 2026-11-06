-- Additive and repeatable: existing accounts, IDs, owners and content are retained.
-- Legacy tables are created ONLY for a fresh installation; no ALTER/DROP/REPLACE.
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
 session_token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS organizations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 description TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 owner_user_id INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS organization_members (
 id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id INTEGER NOT NULL REFERENCES organizations(id),
 user_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'active',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS pages (
 id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id INTEGER NOT NULL REFERENCES organizations(id),
 title TEXT NOT NULL, slug TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id,slug)
);
CREATE TABLE IF NOT EXISTS archive_records (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL,
 content TEXT NOT NULL, author_user_id INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ra_user_security (
 user_id INTEGER PRIMARY KEY REFERENCES users(id), recovery_hash TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ra_usernames (
 normalized TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id)
);
INSERT OR IGNORE INTO ra_usernames(normalized,user_id) SELECT lower(username),id FROM users ORDER BY id;
CREATE TABLE IF NOT EXISTS ra_org_state (
 organization_id INTEGER PRIMARY KEY REFERENCES organizations(id), deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ra_org_roles (
 organization_id INTEGER NOT NULL REFERENCES organizations(id), user_id INTEGER NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('editor','viewer')), PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS ra_document_state (
 kind TEXT NOT NULL CHECK(kind IN ('record','page')), document_id INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL CHECK(status IN ('draft','published','deleted')),
 sources TEXT NOT NULL DEFAULT '[]', edit_token TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(kind,document_id)
);
CREATE TABLE IF NOT EXISTS ra_revisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, document_id INTEGER NOT NULL,
 version INTEGER NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL DEFAULT '',
 content TEXT NOT NULL, status TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
 sources TEXT NOT NULL DEFAULT '[]', author_user_id INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(kind,document_id,version)
);
CREATE TABLE IF NOT EXISTS ra_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER REFERENCES users(id),
 organization_id INTEGER, action TEXT NOT NULL, kind TEXT, document_id INTEGER,
 details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ra_rate_limits (
 key TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 1, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ra_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS ra_pages_org_status ON pages(organization_id,status);
CREATE INDEX IF NOT EXISTS ra_revision_doc ON ra_revisions(kind,document_id,version DESC);
CREATE INDEX IF NOT EXISTS ra_audit_org ON ra_audit(organization_id,id DESC);
CREATE INDEX IF NOT EXISTS ra_limits_expiry ON ra_rate_limits(expires_at);
