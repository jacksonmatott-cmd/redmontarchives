CREATE TABLE IF NOT EXISTS ra_document_details (
 kind TEXT NOT NULL CHECK(kind IN ('record','page')), document_id INTEGER NOT NULL,
 tags TEXT NOT NULL DEFAULT '[]', summary TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(kind,document_id)
);
CREATE TABLE IF NOT EXISTS ra_corrections (
 id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, document_id INTEGER NOT NULL,
 reporter_user_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ra_corrections_status ON ra_corrections(status,id DESC);
