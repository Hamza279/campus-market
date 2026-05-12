CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL DEFAULT '',
  seller_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (listing_id, buyer_id, seller_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_buyer_last_message ON conversations(buyer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_last_message ON conversations(seller_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_listing_id ON conversations(listing_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, sender_id, read_at);

INSERT OR IGNORE INTO app_schema_versions (version, description) VALUES
  ('0007_create_marketplace_messages', 'Persistent buyer and seller marketplace conversations');
