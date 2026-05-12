CREATE TABLE IF NOT EXISTS app_schema_versions (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE listings ADD COLUMN image_key TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN thumbnail_key TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN image_updated_at TEXT;

CREATE TABLE IF NOT EXISTS uploaded_images (
  key TEXT PRIMARY KEY,
  thumbnail_key TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  owner_id TEXT NOT NULL,
  listing_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uploaded_images_owner_created_at ON uploaded_images(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_images_listing_id ON uploaded_images(listing_id);

INSERT OR IGNORE INTO app_schema_versions (version, description) VALUES
  ('0001_create_listings', 'Initial listings table and seed data'),
  ('0002_create_users', 'Users table'),
  ('0003_add_user_password_hash', 'Local auth password hash'),
  ('0004_listing_marketplace_fields', 'Marketplace listing ownership, status, and image URL fields'),
  ('0005_create_saved_listings', 'Persisted saved listings watchlist'),
  ('0006_image_upload_metadata_and_schema_versions', 'R2 listing image metadata and schema version tracking');
