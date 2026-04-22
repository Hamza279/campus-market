CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price TEXT NOT NULL,
  location TEXT NOT NULL,
  item_condition TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold IN (0, 1)),
  is_seeded INTEGER NOT NULL DEFAULT 0 CHECK (is_seeded IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_is_seeded ON listings(is_seeded, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_sold ON listings(sold);

INSERT OR IGNORE INTO listings (
  id,
  title,
  price,
  location,
  item_condition,
  description,
  image,
  sold,
  is_seeded
) VALUES
  (
    '1',
    'Campus Textbook Bundle',
    '$48',
    'Dorm A',
    'Gently used',
    'A stack of core semester textbooks with minimal highlighting and a soft cover study guide.',
    '',
    0,
    1
  ),
  (
    '2',
    'Laptop Stand + Mouse',
    '$32',
    'North Quad',
    'Excellent',
    'A compact desk setup with adjustable laptop stand and ergonomic wireless mouse.',
    '',
    0,
    1
  ),
  (
    '3',
    'Bicycle with Lock',
    '$85',
    'West Hall',
    'Good',
    'A commuter bike with a sturdy lock and one lightly scuffed pannier bag.',
    '',
    0,
    1
  ),
  (
    '4',
    'Desk Lamp + Power Strip',
    '$20',
    'Library',
    'Very good',
    'A bright LED desk lamp with adjustable arm and a six-outlet power strip.',
    '',
    0,
    1
  ),
  (
    '5',
    'Backpack & Water Bottle',
    '$28',
    'Student Center',
    'Like new',
    'A roomy campus backpack paired with an insulated reusable water bottle.',
    '',
    0,
    1
  ),
  (
    '6',
    'Studio Headphones',
    '$55',
    'Music Building',
    'Excellent',
    'Over-ear headphones with strong bass response and noise-isolating cushions.',
    '',
    0,
    1
  );
