CREATE TABLE lesson4_data_migrations (
 version TEXT PRIMARY KEY,
 digest TEXT NOT NULL,
 applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
