CREATE TABLE IF NOT EXISTS saved_listings (
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_listings_user_created_at ON saved_listings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_id ON saved_listings(listing_id);
