ALTER TABLE listings ADD COLUMN image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN seller_email TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'draft'));

UPDATE listings
SET
  image_url = CASE WHEN image_url = '' THEN image ELSE image_url END,
  status = CASE WHEN sold = 1 THEN 'sold' ELSE status END;

CREATE INDEX IF NOT EXISTS idx_listings_status_created_at ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_owner_created_at ON listings(owner_id, created_at DESC);
