import { render, route } from "rwsdk/router";
import { SyncedStateServer, syncedStateRoutes } from "rwsdk/use-synced-state/worker";
import { defineApp, ErrorResponse } from "rwsdk/worker";

  import { Document } from "@/app/document";
  import { setCommonHeaders } from "@/app/headers";
  import { AppShell } from "@/app/shared/AppShell";
  import { Home } from "@/app/pages/home";
  import { Login } from "@/app/pages/login";
  import { Listings } from "@/app/pages/listings";
  import { Sell } from "@/app/pages/sell";
  import { Dashboard } from "@/app/pages/dashboard";
  import { Edit } from "@/app/pages/edit";
  import { ListingDetail } from "@/app/pages/listing";
  import { SellerProfile } from "@/app/pages/seller";
  import { Messages } from "@/app/pages/messages";
  import { SavedItems } from "@/app/pages/saved";
  import { RealtimeDebug } from "@/app/pages/realtime-debug";
import { getImageUrlValidationError, normalizeImageUrlForSave } from "@/app/pages/image-url";
import { LISTINGS_REALTIME_ROOM, NEW_LISTING_EVENT_KEY, type NewListingEvent } from "@/app/pages/listings.realtime";
import type { Listing } from "@/app/pages/listings.data";
import { buildGoogleAuthUrl, exchangeGoogleCode, upsertGoogleUser } from "@/auth/google";
import {
  authenticateLocalUser,
  createLocalUser,
  upsertDemoUser,
  validateDemoLogin,
  validatePasswordLoginInput,
  validateSignupInput,
} from "@/auth/local";
import type { AppContext, AuthUser } from "@/auth/types";
import { sessions, setupSessionStore } from "@/session/store";
import { SessionDurableObject as SessionDurableObjectImpl } from "@/session/durableObject";

export { SyncedStateServer };
export type { AppContext };

// Export a concrete class from the main worker module so Miniflare can wrap it reliably in local dev.
export class SessionDurableObject extends SessionDurableObjectImpl {}

  type ListingRow = {
    id: string;
    title: string;
    price: string;
    location: string;
    item_condition: string;
    category: string | null;
    description: string;
    image: string;
    image_url: string | null;
    image_key: string | null;
    thumbnail_key: string | null;
    sold: number;
    status: "active" | "sold" | "draft" | null;
    is_seeded: number;
    owner_id: string | null;
    seller_email: string | null;
    seller_name: string | null;
    created_at: string;
    updated_at: string;
  };

  type ListingStatus = "active" | "sold" | "draft";

  type ListingPayload = {
    title?: string;
    price?: string;
    location?: string;
    condition?: string;
    category?: string;
    description?: string;
    image?: string;
    imageUrl?: string;
    imageKey?: string;
    thumbnailKey?: string;
    thumbnailUrl?: string;
    sold?: boolean;
    status?: ListingStatus;
    isSeeded?: boolean;
  };

  type NormalizedListingPayload = {
    title: string;
    price: string;
    location: string;
    condition: string;
    category: string;
    description: string;
    image: string;
    imageKey: string;
    thumbnailKey: string;
    status: ListingStatus;
    sold: number;
    isSeeded: number;
    ownerId: string;
    sellerEmail: string;
    sellerName: string;
  };

  type DebugListingPayload = {
    title?: string;
    price?: number | string;
    description?: string;
  };

  type SavedListingRow = ListingRow & {
    saved_created_at: string;
  };

type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_name: string;
  seller_name: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  listing_title: string | null;
  listing_price: string | null;
  listing_image_url: string | null;
  latest_body: string | null;
  latest_sender_id: string | null;
  latest_created_at: string | null;
  unread_count: number | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type SchemaCheck = {
  ok: boolean;
  requiredVersions: string[];
  appliedVersions: string[];
  missingVersions: string[];
  listingColumns: string[];
  missingListingColumns: string[];
};

const REQUIRED_SCHEMA_VERSIONS = [
  "0001_create_listings",
  "0002_create_users",
  "0003_add_user_password_hash",
  "0004_listing_marketplace_fields",
  "0005_create_saved_listings",
  "0006_image_upload_metadata_and_schema_versions",
  "0007_create_marketplace_messages",
] as const;

const REQUIRED_LISTING_COLUMNS = [
  "id",
  "title",
  "description",
  "price",
  "category",
  "image_url",
  "image_key",
  "thumbnail_key",
  "owner_id",
  "seller_email",
  "seller_name",
  "status",
  "created_at",
  "updated_at",
] as const;

const IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 1024 * 1024;

let schemaReady: Promise<void> | null = null;
const DEFAULT_USER_ID = "campus-user";
const DEFAULT_SELLER_NAME = "Campus User";
let latestRealtimeDebugEvent: NewListingEvent | null = null;

const getRequester = (user: AuthUser | null) => {
  return {
    userId: user?.id ?? "",
    sellerEmail: user?.email ?? "",
    sellerName: user?.name || user?.email || DEFAULT_SELLER_NAME,
    isAdmin: false,
  };
};

const canManageListing = (user: AuthUser | null, listing: Listing) => {
  const requester = getRequester(user);
  return Boolean(requester.userId && (requester.isAdmin || listing.ownerId === requester.userId));
};

const ensureMarketplaceSchema = (db: D1Database) => {
  schemaReady ??= (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT 'Campus',
        item_condition TEXT NOT NULL DEFAULT 'Good',
        category TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        sold INTEGER NOT NULL DEFAULT 0 CHECK (sold IN (0, 1)),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'draft')),
        is_seeded INTEGER NOT NULL DEFAULT 0 CHECK (is_seeded IN (0, 1)),
        owner_id TEXT NOT NULL DEFAULT 'campus-admin',
        seller_email TEXT NOT NULL DEFAULT '',
        seller_name TEXT NOT NULL DEFAULT 'Campus User',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "ALTER TABLE listings ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'",
      "ALTER TABLE listings ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'campus-admin'",
      "ALTER TABLE listings ADD COLUMN seller_name TEXT NOT NULL DEFAULT 'Campus User'",
      "ALTER TABLE listings ADD COLUMN image_url TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE listings ADD COLUMN image_key TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE listings ADD COLUMN thumbnail_key TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE listings ADD COLUMN image_updated_at TEXT",
      "ALTER TABLE listings ADD COLUMN seller_email TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE listings ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
      "UPDATE listings SET image_url = image WHERE image_url = ''",
      "UPDATE listings SET status = 'sold' WHERE sold = 1 AND status != 'sold'",
      "CREATE INDEX IF NOT EXISTS idx_listings_status_created_at ON listings(status, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_listings_owner_created_at ON listings(owner_id, created_at DESC)",
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        password_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "ALTER TABLE users ADD COLUMN password_hash TEXT",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_identity ON users(provider, provider_id)",
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
      `CREATE TABLE IF NOT EXISTS saved_listings (
        user_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, listing_id),
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
      )`,
      "CREATE INDEX IF NOT EXISTS idx_saved_listings_user_created_at ON saved_listings(user_id, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_id ON saved_listings(listing_id)",
      `CREATE TABLE IF NOT EXISTS conversations (
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
      )`,
      "CREATE INDEX IF NOT EXISTS idx_conversations_buyer_last_message ON conversations(buyer_id, last_message_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_conversations_seller_last_message ON conversations(seller_id, last_message_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_conversations_listing_id ON conversations(listing_id)",
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        body TEXT NOT NULL,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,
      "CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC)",
      "CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, sender_id, read_at)",
      `CREATE TABLE IF NOT EXISTS uploaded_images (
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
      )`,
      "CREATE INDEX IF NOT EXISTS idx_uploaded_images_owner_created_at ON uploaded_images(owner_id, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_uploaded_images_listing_id ON uploaded_images(listing_id)",
      `CREATE TABLE IF NOT EXISTS app_schema_versions (
        version TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      ...REQUIRED_SCHEMA_VERSIONS.map((version) => `INSERT OR IGNORE INTO app_schema_versions (version, description) VALUES ('${version}', 'Runtime verified schema component')`),
    ];

    for (const statement of statements) {
      try {
        await db.prepare(statement).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes("duplicate column")) {
          throw error;
        }
      }
    }
  })();

  return schemaReady;
};

const json = (data: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  return Response.json(data, {
    ...init,
    headers,
  });
};

const headersToRecord = (headers: Headers): Record<string, string> => {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

const logListingCreateDebug = (
  label: string,
  details: {
    request: Request;
    rawBodyText: string;
    parsedPayload: unknown;
    sql: string;
    boundValues: unknown[];
    error?: unknown;
  },
) => {
  console.error(label, {
    method: details.request.method,
    headers: headersToRecord(details.request.headers),
    rawBodyText: details.rawBodyText,
    parsedPayload: details.parsedPayload,
    sql: details.sql,
    boundValues: details.boundValues,
    d1Error:
      details.error instanceof Error
        ? {
            name: details.error.name,
            message: details.error.message,
            stack: details.error.stack,
          }
        : details.error,
  });
};

const toListing = (row: ListingRow): Listing => {
  const status = row.status === "draft" || row.status === "sold" || row.status === "active" ? row.status : row.sold === 1 ? "sold" : "active";
  const imageUrl = row.image_url || row.image || "";
  const ownerId = row.owner_id || DEFAULT_USER_ID;
  const thumbnailKey = row.thumbnail_key || "";

  return {
    id: row.id,
    title: row.title,
    price: row.price,
    location: row.location,
    condition: row.item_condition,
    category: row.category || "Other",
    description: row.description,
    image: imageUrl,
    imageUrl,
    imageKey: row.image_key || "",
    thumbnailUrl: thumbnailKey ? `/cdn/listing-images/${thumbnailKey}` : imageUrl,
    thumbnailKey,
    sold: status === "sold",
    status,
    isSeeded: row.is_seeded === 1,
    ownerId,
    sellerId: ownerId,
    sellerEmail: row.seller_email || "",
    sellerName: row.seller_name || DEFAULT_SELLER_NAME,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const isListingPayload = (value: unknown): value is ListingPayload => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const optionalStringField = (
  payload: ListingPayload,
  key: keyof Pick<ListingPayload, "title" | "price" | "location" | "condition" | "category" | "description" | "image" | "imageUrl" | "imageKey" | "thumbnailKey" | "thumbnailUrl">,
): string | undefined => {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" ? value : undefined;
};

const validateListingPayload = (payload: ListingPayload): string | null => {
  const stringFields = ["title", "price", "location", "condition", "category", "description", "image", "imageUrl", "imageKey", "thumbnailKey", "thumbnailUrl", "status"] as const;

    for (const field of stringFields) {
      const value = payload[field];
      if (value !== undefined && typeof value !== "string") {
        return `${field} must be a string.`;
      }
    }

    if (payload.status !== undefined && !["active", "sold", "draft"].includes(payload.status)) {
      return "status must be active, sold, or draft.";
    }

    if (payload.sold !== undefined && typeof payload.sold !== "boolean") {
      return "sold must be a boolean.";
    }

    if (payload.isSeeded !== undefined && typeof payload.isSeeded !== "boolean") {
      return "isSeeded must be a boolean.";
    }

    const suppliedImage = payload.imageUrl ?? payload.image;
    if (suppliedImage !== undefined) {
      const imageError = getImageUrlValidationError(suppliedImage);
      if (imageError) {
        return imageError;
      }
    }

    return null;
};

const normalizeListingPayload = (
  payload: ListingPayload,
  ownerId = DEFAULT_USER_ID,
  sellerName = DEFAULT_SELLER_NAME,
  sellerEmail = "",
): NormalizedListingPayload => {
  const status = payload.sold === true ? "sold" : (payload.status ?? "active");
  const image = normalizeImageUrlForSave(optionalStringField(payload, "imageUrl") ?? optionalStringField(payload, "image") ?? "");

  return {
    title: optionalStringField(payload, "title")?.trim() || "",
    price: optionalStringField(payload, "price")?.trim() || "",
    location: optionalStringField(payload, "location")?.trim() || "Campus",
    condition: optionalStringField(payload, "condition")?.trim() || "Good",
    category: optionalStringField(payload, "category")?.trim() || "",
    description: optionalStringField(payload, "description")?.trim() || "No description provided.",
    image,
    imageKey: optionalStringField(payload, "imageKey")?.trim() || "",
    thumbnailKey: optionalStringField(payload, "thumbnailKey")?.trim() || "",
    status,
    sold: status === "sold" ? 1 : 0,
    isSeeded: payload.isSeeded === true ? 1 : 0,
    ownerId,
    sellerEmail,
    sellerName,
  };
};

const validateListingRequiredFields = (payload: NormalizedListingPayload): string | null => {
  if (!payload.title.trim()) {
    return "Title is required.";
  }

  const numericPrice = Number.parseFloat(payload.price.replace(/[^0-9.]/g, ""));
  if (!payload.price.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
    return "Enter a valid price.";
  }

  if (!payload.category.trim()) {
    return "Category is required.";
  }

  if (payload.image && getImageUrlValidationError(payload.image)) {
    return "Enter a valid http or https image URL.";
  }

  return null;
};

const validateInsertParams = (values: unknown[]): string | null => {
  for (const value of values) {
    const validType = typeof value === "string" || typeof value === "number";
    if (!validType || value === undefined || value === null) {
      return "Listing insert values must be plain strings or numbers.";
    }
  }

    const [id, title, price, location, condition, category, description, , , , , , , , ownerId, , sellerName] = values;
    const requiredStrings = { id, title, price, location, condition, category, description, ownerId, sellerName };
    for (const [field, value] of Object.entries(requiredStrings)) {
      if (typeof value !== "string" || value.trim().length === 0) {
        return `${field} cannot be empty.`;
      }
    }

  return null;
};

const isDebugListingPayload = (value: unknown): value is DebugListingPayload => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizeDebugListingPayload = (payload: DebugListingPayload): ListingPayload => {
  const rawPrice =
    typeof payload.price === "number"
      ? payload.price
      : typeof payload.price === "string"
        ? Number.parseFloat(payload.price)
        : 10;
  const normalizedPrice = Number.isFinite(rawPrice) ? rawPrice : 10;

  return {
    title: typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "Test item",
    price: `$${normalizedPrice.toFixed(2)}`,
    location: "Realtime Lab",
    condition: "New",
    category: "Supplies",
    description:
      typeof payload.description === "string" && payload.description.trim()
        ? payload.description.trim()
        : "Realtime test",
    image: "",
  };
};

const getListingById = async (db: D1Database, id: string): Promise<Listing | null> => {
  await ensureMarketplaceSchema(db);

    const row = await db
      .prepare(
        `
          SELECT
            id,
            title,
            price,
            location,
            item_condition,
            category,
            description,
            image,
            image_url,
            image_key,
            thumbnail_key,
            sold,
            status,
            is_seeded,
            owner_id,
            seller_email,
            seller_name,
            created_at,
            updated_at
          FROM listings
          WHERE id = ?
        `,
      )
      .bind(id)
      .first<ListingRow>();

  return row ? toListing(row) : null;
};

const getSchemaCheck = async (db: D1Database): Promise<SchemaCheck> => {
  await ensureMarketplaceSchema(db);

  const versionResult = await db.prepare("SELECT version FROM app_schema_versions ORDER BY version").all<{ version: string }>();
  const appliedVersions = (versionResult.results ?? []).map((row) => row.version);
  const missingVersions = REQUIRED_SCHEMA_VERSIONS.filter((version) => !appliedVersions.includes(version));

  const columnResult = await db.prepare("PRAGMA table_info(listings)").all<{ name: string }>();
  const listingColumns = (columnResult.results ?? []).map((row) => row.name);
  const missingListingColumns = REQUIRED_LISTING_COLUMNS.filter((column) => !listingColumns.includes(column));

  return {
    ok: missingVersions.length === 0 && missingListingColumns.length === 0,
    requiredVersions: [...REQUIRED_SCHEMA_VERSIONS],
    appliedVersions,
    missingVersions,
    listingColumns,
    missingListingColumns,
  };
};

const getR2ImageUrl = (request: Request, key: string) => {
  const url = new URL(request.url);
  url.pathname = `/cdn/listing-images/${key}`;
  url.search = "";
  return url.toString();
};

const validateImagePart = (file: File, maxBytes: number) => {
  if (!IMAGE_CONTENT_TYPES.has(file.type)) {
    return "Upload a JPG, PNG, or WebP image.";
  }

  if (file.size <= 0) {
    return "Image file is required.";
  }

  if (file.size > maxBytes) {
    return `Image must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`;
  }

  return null;
};

const deleteR2Object = async (bucket: R2Bucket, key: string) => {
  if (!key) {
    return;
  }

  try {
    await bucket.delete(key);
  } catch (error) {
    console.error("[worker] failed to delete R2 object", { key, error });
  }
};

const deleteListingImages = async (env: Env, listing: Listing) => {
  await Promise.all([deleteR2Object(env.LISTING_IMAGES, listing.imageKey), deleteR2Object(env.LISTING_IMAGES, listing.thumbnailKey)]);
};

const parseListingIdPayload = async (request: Request): Promise<{ listingId: string } | { error: string }> => {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return { error: "Invalid JSON body." };
  }

  const listingId =
    typeof payload === "object" && payload !== null && "listingId" in payload
      ? String((payload as { listingId?: unknown }).listingId ?? "").trim()
      : "";

  if (!listingId) {
    return { error: "listingId is required." };
  }

  return { listingId };
};

const getSavedListingsForUser = async (db: D1Database, userId: string): Promise<Listing[]> => {
  await ensureMarketplaceSchema(db);

  const result = await db
    .prepare(
      `
        SELECT
          listings.id,
          listings.title,
          listings.price,
          listings.location,
          listings.item_condition,
          listings.category,
          listings.description,
          listings.image,
          listings.image_url,
          listings.image_key,
          listings.thumbnail_key,
          listings.sold,
          listings.status,
          listings.is_seeded,
          listings.owner_id,
          listings.seller_email,
          listings.seller_name,
          listings.created_at,
          listings.updated_at,
          saved_listings.created_at AS saved_created_at
        FROM saved_listings
        INNER JOIN listings ON listings.id = saved_listings.listing_id
        WHERE saved_listings.user_id = ? AND listings.status != 'draft'
        ORDER BY saved_listings.created_at DESC
      `,
    )
    .bind(userId)
    .all<SavedListingRow>();

  return (result.results ?? []).map(toListing);
};

const toConversationSummary = (row: ConversationRow, userId: string) => ({
  id: row.id,
  listingId: row.listing_id,
  listingTitle: row.listing_title ?? "Listing",
  listingPrice: row.listing_price ?? "",
  listingImage: row.listing_image_url ?? "",
  buyerId: row.buyer_id,
  sellerId: row.seller_id,
  buyerName: row.buyer_name,
  sellerName: row.seller_name,
  otherParticipantName: row.buyer_id === userId ? row.seller_name : row.buyer_name,
  latestMessage: row.latest_body ?? "",
  latestSenderId: row.latest_sender_id ?? "",
  latestMessageAt: row.latest_created_at ?? row.last_message_at,
  unreadCount: Number(row.unread_count ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMessage = (row: MessageRow) => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  body: row.body,
  readAt: row.read_at,
  createdAt: row.created_at,
});

const getConversationSummaries = async (db: D1Database, userId: string) => {
  await ensureMarketplaceSchema(db);

  const result = await db
    .prepare(
      `
        SELECT
          conversations.id,
          conversations.listing_id,
          conversations.buyer_id,
          conversations.seller_id,
          conversations.buyer_name,
          conversations.seller_name,
          conversations.created_at,
          conversations.updated_at,
          conversations.last_message_at,
          listings.title AS listing_title,
          listings.price AS listing_price,
          listings.image_url AS listing_image_url,
          latest.body AS latest_body,
          latest.sender_id AS latest_sender_id,
          latest.created_at AS latest_created_at,
          (
            SELECT COUNT(*)
            FROM messages unread
            WHERE unread.conversation_id = conversations.id
              AND unread.sender_id != ?
              AND unread.read_at IS NULL
          ) AS unread_count
        FROM conversations
        INNER JOIN listings ON listings.id = conversations.listing_id
        LEFT JOIN messages latest ON latest.id = (
          SELECT id
          FROM messages
          WHERE conversation_id = conversations.id
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        )
        WHERE conversations.buyer_id = ? OR conversations.seller_id = ?
        ORDER BY conversations.last_message_at DESC, conversations.updated_at DESC
      `,
    )
    .bind(userId, userId, userId)
    .all<ConversationRow>();

  return (result.results ?? []).map((row) => toConversationSummary(row, userId));
};

const getConversationForUser = async (db: D1Database, conversationId: string, userId: string) => {
  await ensureMarketplaceSchema(db);

  const row = await db
    .prepare(
      `
        SELECT
          conversations.id,
          conversations.listing_id,
          conversations.buyer_id,
          conversations.seller_id,
          conversations.buyer_name,
          conversations.seller_name,
          conversations.created_at,
          conversations.updated_at,
          conversations.last_message_at,
          listings.title AS listing_title,
          listings.price AS listing_price,
          listings.image_url AS listing_image_url,
          latest.body AS latest_body,
          latest.sender_id AS latest_sender_id,
          latest.created_at AS latest_created_at,
          (
            SELECT COUNT(*)
            FROM messages unread
            WHERE unread.conversation_id = conversations.id
              AND unread.sender_id != ?
              AND unread.read_at IS NULL
          ) AS unread_count
        FROM conversations
        INNER JOIN listings ON listings.id = conversations.listing_id
        LEFT JOIN messages latest ON latest.id = (
          SELECT id
          FROM messages
          WHERE conversation_id = conversations.id
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        )
        WHERE conversations.id = ?
          AND (conversations.buyer_id = ? OR conversations.seller_id = ?)
        LIMIT 1
      `,
    )
    .bind(userId, conversationId, userId, userId)
    .first<ConversationRow>();

  return row ? toConversationSummary(row, userId) : null;
};

const getMessagesForConversation = async (db: D1Database, conversationId: string) => {
  const result = await db
    .prepare(
      `
        SELECT id, conversation_id, sender_id, body, read_at, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, id ASC
      `,
    )
    .bind(conversationId)
    .all<MessageRow>();

  return (result.results ?? []).map(toMessage);
};

const createMessage = async (db: D1Database, conversationId: string, senderId: string, body: string) => {
  const messageId = crypto.randomUUID();

  await db.batch([
    db
      .prepare(
        `
          INSERT INTO messages (id, conversation_id, sender_id, body)
          VALUES (?, ?, ?, ?)
        `,
      )
      .bind(messageId, conversationId, senderId, body),
    db
      .prepare(
        `
          UPDATE conversations
          SET updated_at = CURRENT_TIMESTAMP, last_message_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
      )
      .bind(conversationId),
  ]);

  const row = await db
    .prepare(
      `
        SELECT id, conversation_id, sender_id, body, read_at, created_at
        FROM messages
        WHERE id = ?
      `,
    )
    .bind(messageId)
    .first<MessageRow>();

  if (!row) {
    throw new Error("Message could not be saved.");
  }

  return toMessage(row);
};

const findOrCreateConversation = async (db: D1Database, listing: Listing, buyer: AuthUser) => {
  const sellerId = listing.ownerId || listing.sellerId;
  const buyerName = buyer.name || buyer.email || "Buyer";
  const sellerName = listing.sellerName || listing.sellerEmail || "Seller";

  const existing = await db
    .prepare(
      `
        SELECT id
        FROM conversations
        WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?
        LIMIT 1
      `,
    )
    .bind(listing.id, buyer.id, sellerId)
    .first<{ id: string }>();

  if (existing) {
    return existing.id;
  }

  const conversationId = crypto.randomUUID();
  await db
    .prepare(
      `
        INSERT INTO conversations (id, listing_id, buyer_id, seller_id, buyer_name, seller_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(conversationId, listing.id, buyer.id, sellerId, buyerName, sellerName)
    .run();

  return conversationId;
};

const createListingRecord = async ({
  db,
  request,
  payload,
  ownerId,
  sellerEmail,
  sellerName,
}: {
  db: D1Database;
  request: Request;
  payload: ListingPayload;
  ownerId: string;
  sellerEmail: string;
  sellerName: string;
}): Promise<{ listing?: Listing; error?: string; status?: number }> => {
  const insertSql = `
    INSERT INTO listings (
      id,
      title,
      price,
      location,
      item_condition,
      category,
      description,
      image,
      image_url,
      image_key,
      thumbnail_key,
      sold,
      status,
      is_seeded,
      owner_id,
      seller_email,
      seller_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const payloadError = validateListingPayload(payload);
  if (payloadError) {
    return { error: payloadError, status: 400 };
  }

  const listing = normalizeListingPayload(payload, ownerId, sellerName, sellerEmail);
  const requiredError = validateListingRequiredFields(listing);
  if (requiredError) {
    return { error: requiredError, status: 400 };
  }

  const id = crypto.randomUUID();
  const insertParams = [
    id,
    listing.title,
    listing.price,
    listing.location,
    listing.condition,
    listing.category,
    listing.description,
    listing.image,
    listing.image,
    listing.imageKey,
    listing.thumbnailKey,
    listing.sold,
    listing.status,
    listing.isSeeded,
    ownerId,
    listing.sellerEmail,
    sellerName,
  ] as const;

  const insertParamError = validateInsertParams([...insertParams]);
  if (insertParamError) {
    logListingCreateDebug("Invalid listing create insert values.", {
      request,
      rawBodyText: JSON.stringify(payload),
      parsedPayload: payload,
      sql: insertSql,
      boundValues: [...insertParams],
    });
    return { error: insertParamError, status: 400 };
  }

  try {
    await db.prepare(insertSql).bind(...insertParams).run();
    if (listing.imageKey) {
      await db.prepare("UPDATE uploaded_images SET listing_id = ? WHERE key = ? AND owner_id = ?").bind(id, listing.imageKey, ownerId).run();
    }
  } catch (error) {
    logListingCreateDebug("D1 listing create insert failed.", {
      request,
      rawBodyText: JSON.stringify(payload),
      parsedPayload: payload,
      sql: insertSql,
      boundValues: [...insertParams],
      error,
    });
    return { error: "Failed to create listing.", status: 500 };
  }

  const created = await getListingById(db, id);
  if (!created) {
    return { error: "Created listing could not be reloaded.", status: 500 };
  }

  return { listing: created };
};

const getUserById = async (db: D1Database, id: string): Promise<AuthUser | null> => {
  await ensureMarketplaceSchema(db);

  return await db
    .prepare(
      `
        SELECT
          id,
          provider,
          provider_id AS providerId,
          email,
          name,
          avatar_url AS avatarUrl,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE id = ?
      `,
    )
    .bind(id)
    .first<AuthUser>();
};

const redirect = (location: string, headers = new Headers()) => {
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
};

const isLocalRequest = (request: Request) => {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
};

const safeReturnTo = (returnTo: string | null | undefined) => {
  return returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
};

const loginLocation = ({
  error,
  success,
  returnTo,
  mode = "login",
}: {
  error?: string;
  success?: string;
  returnTo: string;
  mode?: "login" | "signup";
}) => {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  if (mode === "signup") {
    params.set("mode", "signup");
  }
  if (error) {
    params.set("error", error);
  }
  if (success) {
    params.set("success", success);
  }
  return `/login?${params.toString()}`;
};

const loginRedirect = (request: Request) => {
  const url = new URL(request.url);
  const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);
  return redirect(`/login?returnTo=${returnTo}`);
};

const requireUser = ({ ctx, request }: { ctx: AppContext; request: Request }) => {
  if (!ctx.user) {
    return loginRedirect(request);
  }
};

const publishNewListingEvent = async (env: Env, listing: Listing) => {
  const roomId = env.SYNCED_STATE_SERVER.idFromName(LISTINGS_REALTIME_ROOM);
  const room = env.SYNCED_STATE_SERVER.get(roomId);
  const event: NewListingEvent = {
    eventId: crypto.randomUUID(),
    listingId: listing.id,
    title: listing.title,
    occurredAt: new Date().toISOString(),
  };

  latestRealtimeDebugEvent = event;
  await room.setState(event, NEW_LISTING_EVENT_KEY);
};

const withAppShell = (children: React.ReactNode, currentUser: AuthUser | null = null) => {
  return <AppShell currentUser={currentUser}>{children}</AppShell>;
};

const createApp = (env: Env) => {
  return defineApp([
    setCommonHeaders(),
    async ({ ctx, request, response }) => {
      await ensureMarketplaceSchema(env.campusmarket_db);
      setupSessionStore(env);

      try {
        ctx.session = await sessions.load(request);
      } catch (error) {
        if (error instanceof ErrorResponse && error.code === 401) {
          await sessions.remove(request, response.headers);
          ctx.session = null;
          ctx.user = null;
          return;
        }

        throw error;
      }

      ctx.user = ctx.session?.userId ? await getUserById(env.campusmarket_db, ctx.session.userId) : null;
    },
    ...syncedStateRoutes(() => env.SYNCED_STATE_SERVER),
    render(Document, [
        route("/login", {
          get: ({ request, ctx }: { request: Request; ctx: AppContext }) => {
            const url = new URL(request.url);
            const returnTo = safeReturnTo(url.searchParams.get("returnTo") ?? "/dashboard");
            const mode = url.searchParams.get("mode") === "signup" ? "signup" : "login";
            const demoEnabled = isLocalRequest(request);

            if (ctx.user) {
              return redirect(returnTo === "/" ? "/dashboard" : returnTo);
            }

            return withAppShell(
              <Login
                googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
                appleEnabled={false}
                error={url.searchParams.get("error") ?? undefined}
                success={url.searchParams.get("loggedOut") === "1" ? "Logged out." : (url.searchParams.get("success") ?? undefined)}
                returnTo={returnTo}
                mode={mode}
                demoEnabled={demoEnabled}
              />,
              ctx.user,
            );
          },

          post: async ({ request, response, ctx }: { request: Request; response: { headers: Headers }; ctx: AppContext }) => {
            if (ctx.user) {
              return redirect("/", response.headers);
            }

            const formData = await request.formData();
            const returnTo = safeReturnTo(String(formData.get("returnTo") ?? "/dashboard"));
            const intent = String(formData.get("intent") ?? "login");

            if (intent === "signup") {
              const signupInput = validateSignupInput({
                name: formData.get("name"),
                email: formData.get("email"),
                password: formData.get("password"),
                passwordConfirm: formData.get("passwordConfirm"),
              });

              if ("error" in signupInput) {
                return redirect(loginLocation({ error: signupInput.error, returnTo, mode: "signup" }), response.headers);
              }

              const createdUser = await createLocalUser(env.campusmarket_db, signupInput);
              if ("error" in createdUser) {
                return redirect(loginLocation({ error: createdUser.error, returnTo, mode: "signup" }), response.headers);
              }

              await sessions.save(response.headers, { userId: createdUser.id, oauthState: null, returnTo: null }, { maxAge: true });
              return redirect("/dashboard", response.headers);
            }

            if (intent === "demo") {
              if (!isLocalRequest(request)) {
                return redirect(loginLocation({ error: "Demo login is only available locally.", returnTo }), response.headers);
              }

              const demoLogin = validateDemoLogin({
                name: formData.get("name"),
                email: formData.get("email"),
              });

              if ("error" in demoLogin) {
                return redirect(loginLocation({ error: demoLogin.error, returnTo }), response.headers);
              }

              const user = await upsertDemoUser(env.campusmarket_db, demoLogin);
              await sessions.save(response.headers, { userId: user.id, oauthState: null, returnTo: null }, { maxAge: true });
              return redirect(returnTo === "/" ? "/dashboard" : returnTo, response.headers);
            }

            const localLogin = validatePasswordLoginInput({
              email: formData.get("email"),
              password: formData.get("password"),
            });

            if ("error" in localLogin) {
              return redirect(
                loginLocation({ error: localLogin.error, returnTo }),
                response.headers,
              );
            }

            const user = await authenticateLocalUser(env.campusmarket_db, localLogin);
            if ("error" in user) {
              return redirect(loginLocation({ error: user.error, returnTo }), response.headers);
            }

            await sessions.save(response.headers, { userId: user.id, oauthState: null, returnTo: null }, { maxAge: true });
            return redirect(returnTo === "/" ? "/dashboard" : returnTo, response.headers);
          },
        }),

        route("/auth/google", async ({ request, response }) => {
          if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
            return redirect("/login?error=Google%20login%20needs%20configuration.", response.headers);
          }

          const url = new URL(request.url);
          const returnTo = url.searchParams.get("returnTo") || "/";
          const sanitizedReturnTo = safeReturnTo(returnTo);
          const state = crypto.randomUUID();

          // Google OAuth starts here: store the CSRF state in the signed session cookie, then redirect to Google.
          await sessions.save(response.headers, { oauthState: state, returnTo: sanitizedReturnTo });
          return redirect(buildGoogleAuthUrl(request, env, state), response.headers);
        }),

        route("/auth/callback/google", async ({ request, response }) => {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            return redirect(`/login?error=${encodeURIComponent(error)}`, response.headers);
          }

          const session = await sessions.load(request);
          if (!code || !state || !session?.oauthState || state !== session.oauthState) {
            return redirect("/login?error=Invalid%20Google%20login%20response.", response.headers);
          }

          try {
            // Google OAuth callback is handled here: exchange the code, read the Google profile, and upsert the user.
            const profile = await exchangeGoogleCode(request, env, code);
            const user = await upsertGoogleUser(env.campusmarket_db, profile);
            const returnTo = safeReturnTo(session.returnTo);

            // The authenticated session is created here after Google has verified the user.
            await sessions.save(response.headers, { userId: user.id, oauthState: null, returnTo: null }, { maxAge: true });
            return redirect(returnTo, response.headers);
          } catch (callbackError) {
            console.error("Google OAuth callback failed", callbackError);
            return redirect("/login?error=Google%20login%20failed.", response.headers);
          }
        }),

        route("/logout", async ({ request, response }) => {
          // Logout clears the server-side durable session and expires the signed session cookie.
          await sessions.remove(request, response.headers);
          return redirect("/login?loggedOut=1", response.headers);
        }),

        route("/api/health/schema", {
          get: async () => {
            const schema = await getSchemaCheck(env.campusmarket_db);
            return json(schema, { status: schema.ok ? 200 : 500 });
          },
        }),

        route("/cdn/listing-images/:ownerId/:file", {
          get: async ({ params }: { params: { ownerId: string; file: string } }) => {
            const key = `${params.ownerId}/${params.file}`;
            const object = await env.LISTING_IMAGES.get(key);
            if (!object) {
              return new Response("Not found.", { status: 404 });
            }

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set("Cache-Control", "public, max-age=31536000, immutable");
            headers.set("ETag", object.httpEtag);
            headers.set("X-Content-Type-Options", "nosniff");
            return new Response(object.body, { headers });
          },
        }),

        route("/api/uploads/listing-image", {
          post: async ({ request, ctx }: { request: Request; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required to upload listing images." }, { status: 401 });
            }

            const contentType = request.headers.get("content-type") ?? "";
            if (!contentType.toLowerCase().includes("multipart/form-data")) {
              return json({ error: "Upload must use multipart/form-data." }, { status: 400 });
            }

            let formData: FormData;
            try {
              formData = await request.formData();
            } catch {
              return json({ error: "Invalid upload body." }, { status: 400 });
            }

            const image = formData.get("image");
            const thumbnail = formData.get("thumbnail");
            if (!(image instanceof File)) {
              return json({ error: "Image file is required." }, { status: 400 });
            }

            const imageError = validateImagePart(image, MAX_IMAGE_BYTES);
            if (imageError) {
              return json({ error: imageError }, { status: 400 });
            }

            if (!(thumbnail instanceof File)) {
              return json({ error: "Image thumbnail is required." }, { status: 400 });
            }

            const thumbnailError = validateImagePart(thumbnail, MAX_THUMBNAIL_BYTES);
            if (thumbnailError) {
              return json({ error: thumbnailError }, { status: 400 });
            }

            const extension = IMAGE_EXTENSIONS[image.type];
            const id = crypto.randomUUID();
            const ownerPath = ctx.user.id.replace(/[^a-zA-Z0-9_-]/g, "");
            const imageKey = `${ownerPath}/${id}.${extension}`;
            const thumbnailKey = `${ownerPath}/${id}-thumb.webp`;
            const imageUrl = getR2ImageUrl(request, imageKey);
            const thumbnailUrl = getR2ImageUrl(request, thumbnailKey);

            await env.LISTING_IMAGES.put(imageKey, await image.arrayBuffer(), {
              httpMetadata: {
                contentType: image.type,
                cacheControl: "public, max-age=31536000, immutable",
              },
              customMetadata: {
                ownerId: ctx.user.id,
                originalName: image.name.slice(0, 120),
              },
            });

            try {
              await env.LISTING_IMAGES.put(thumbnailKey, await thumbnail.arrayBuffer(), {
                httpMetadata: {
                  contentType: thumbnail.type || "image/webp",
                  cacheControl: "public, max-age=31536000, immutable",
                },
                customMetadata: {
                  ownerId: ctx.user.id,
                  sourceKey: imageKey,
                },
              });

              await env.campusmarket_db
                .prepare(
                  `
                    INSERT INTO uploaded_images (
                      key,
                      thumbnail_key,
                      url,
                      thumbnail_url,
                      content_type,
                      size,
                      owner_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                  `,
                )
                .bind(imageKey, thumbnailKey, imageUrl, thumbnailUrl, image.type, image.size, ctx.user.id)
                .run();
            } catch (error) {
              await deleteR2Object(env.LISTING_IMAGES, imageKey);
              await deleteR2Object(env.LISTING_IMAGES, thumbnailKey);
              throw error;
            }

            return json({
              imageUrl,
              imageKey,
              thumbnailUrl,
              thumbnailKey,
            });
          },
        }),

        route("/api/saved-listings", {
          get: async ({ request, ctx }: { request: Request; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required." }, { status: 401 });
            }

            const url = new URL(request.url);
            if (url.searchParams.get("includeListings") === "1") {
              return json(await getSavedListingsForUser(env.campusmarket_db, ctx.user.id));
            }

            const result = await env.campusmarket_db
              .prepare(
                `
                  SELECT listing_id
                  FROM saved_listings
                  WHERE user_id = ?
                  ORDER BY created_at DESC
                `,
              )
              .bind(ctx.user.id)
              .all<{ listing_id: string }>();

            return json((result.results ?? []).map((row) => row.listing_id));
          },

          post: async ({ request, ctx }: { request: Request; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required to save listings." }, { status: 401 });
            }

            const parsed = await parseListingIdPayload(request);
            if ("error" in parsed) {
              return json({ error: parsed.error }, { status: 400 });
            }

            const listing = await getListingById(env.campusmarket_db, parsed.listingId);
            if (!listing || listing.status === "draft") {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            await env.campusmarket_db
              .prepare(
                `
                  INSERT OR IGNORE INTO saved_listings (user_id, listing_id)
                  VALUES (?, ?)
                `,
              )
              .bind(ctx.user.id, parsed.listingId)
              .run();

            return json({ ok: true });
          },
        }),

        route("/api/saved-listings/:id", {
          delete: async ({ params, ctx }: { params: { id: string }; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required to unsave listings." }, { status: 401 });
            }

            await env.campusmarket_db
              .prepare(
                `
                  DELETE FROM saved_listings
                  WHERE user_id = ? AND listing_id = ?
                `,
              )
              .bind(ctx.user.id, params.id)
              .run();

            return json({ ok: true });
          },
        }),

        route("/api/messages", {
          get: async ({ ctx }: { ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required to view messages." }, { status: 401 });
            }

            return json(await getConversationSummaries(env.campusmarket_db, ctx.user.id));
          },
        }),

        route("/api/messages/:id", {
          get: async ({ params, ctx }: { params: { id: string }; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required to view messages." }, { status: 401 });
            }

            const conversation = await getConversationForUser(env.campusmarket_db, params.id, ctx.user.id);
            if (!conversation) {
              return json({ error: "Conversation not found." }, { status: 404 });
            }

            await env.campusmarket_db
              .prepare(
                `
                  UPDATE messages
                  SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
                  WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL
                `,
              )
              .bind(params.id, ctx.user.id)
              .run();

            return json({
              conversation: {
                ...conversation,
                unreadCount: 0,
              },
              messages: await getMessagesForConversation(env.campusmarket_db, params.id),
              currentUserId: ctx.user.id,
            });
          },

          post: async ({ params, request, ctx }: { params: { id: string }; request: Request; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required to send messages." }, { status: 401 });
            }

            const conversation = await getConversationForUser(env.campusmarket_db, params.id, ctx.user.id);
            if (!conversation) {
              return json({ error: "Conversation not found." }, { status: 404 });
            }

            let payload: unknown = null;
            try {
              payload = await request.json();
            } catch {
              payload = null;
            }

            const body =
              typeof payload === "object" && payload !== null && "message" in payload
                ? String((payload as { message?: unknown }).message ?? "").trim()
                : "";

            if (!body) {
              return json({ error: "Message is required." }, { status: 400 });
            }

            if (body.length > 2000) {
              return json({ error: "Message must be 2000 characters or fewer." }, { status: 400 });
            }

            const message = await createMessage(env.campusmarket_db, params.id, ctx.user.id, body);
            return json({ message });
          },
        }),

        route("/api/listings", {
          get: async ({ request, ctx }: { request: Request; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            const url = new URL(request.url);
            const mineOnly = url.searchParams.get("mine") === "1";

            if (mineOnly && !ctx.user) {
              return json({ error: "Login required." }, { status: 401 });
            }

            const listingSql = `
                  SELECT
                    id,
                    title,
                    price,
                    location,
                    item_condition,
                    category,
                    description,
                    image,
                    image_url,
                    image_key,
                    thumbnail_key,
                    sold,
                    status,
                    is_seeded,
                    owner_id,
                    seller_email,
                    seller_name,
                    created_at,
                    updated_at
                  FROM listings
                  ${mineOnly ? "WHERE owner_id = ?" : "WHERE status != 'draft'"}
                  ORDER BY created_at DESC, id DESC
                `;
            const prepared = env.campusmarket_db.prepare(listingSql);
            const result = mineOnly
              ? await prepared.bind(ctx.user!.id).all<ListingRow>()
              : await prepared.all<ListingRow>();

            return json((result.results ?? []).map(toListing));
          },

          post: async ({ request, ctx }: { request: Request; ctx: AppContext }) => {
            try {
              await ensureMarketplaceSchema(env.campusmarket_db);

              if (!ctx.user) {
                return json({ error: "Login required to create a listing." }, { status: 401 });
              }

              const contentType = request.headers.get("content-type") ?? "";
              let rawBodyText = "";
              let payload: unknown = null;

              if (!contentType.toLowerCase().includes("application/json")) {
                return json({ error: "Content-Type must be application/json." }, { status: 400 });
              }

              try {
                rawBodyText = await request.text();
              } catch (error) {
                logListingCreateDebug("Failed to read listing create request body.", {
                  request,
                  rawBodyText,
                  parsedPayload: payload,
                  sql: "READ_BODY",
                  boundValues: [],
                  error,
                });
                return json({ error: "Invalid request body." }, { status: 400 });
              }

              if (rawBodyText.trim().length === 0) {
                return json({ error: "JSON body is required." }, { status: 400 });
              }

              try {
                payload = JSON.parse(rawBodyText);
              } catch (error) {
                logListingCreateDebug("Invalid listing create JSON body.", {
                  request,
                  rawBodyText,
                  parsedPayload: payload,
                  sql: "PARSE_JSON",
                  boundValues: [],
                  error,
                });
                return json({ error: "Invalid JSON body." }, { status: 400 });
              }

              if (!isListingPayload(payload)) {
                return json({ error: "JSON body must be an object." }, { status: 400 });
              }

              const requester = getRequester(ctx.user);
              const createdResult = await createListingRecord({
                db: env.campusmarket_db,
                request,
                payload,
                ownerId: requester.userId,
                sellerEmail: requester.sellerEmail,
                sellerName: requester.sellerName,
              });

              if (!createdResult.listing) {
                return json({ error: createdResult.error ?? "Failed to create listing." }, { status: createdResult.status ?? 500 });
              }

              try {
                await publishNewListingEvent(env, createdResult.listing);
              } catch (error) {
                console.error("[worker] publishNewListingEvent failed for /api/listings", {
                  error,
                  listingId: createdResult.listing.id,
                });
                return json({ error: error instanceof Error ? error.message : "Failed to publish realtime event." }, { status: 500 });
              }

              return new Response(JSON.stringify(createdResult.listing), {
                status: 201,
                headers: { "Content-Type": "application/json" },
              });
            } catch (error) {
              console.error("[worker] /api/listings POST crashed", error);
              return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown server error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          },
        }),

        route("/api/listings/:id/contact", {
          post: async ({ params, request, ctx }: { params: { id: string }; request: Request; ctx: AppContext }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            if (!ctx.user) {
              return json({ error: "Login required to contact sellers." }, { status: 401 });
            }

            const listing = await getListingById(env.campusmarket_db, params.id);
            if (!listing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            if (listing.ownerId === ctx.user.id || listing.sellerId === ctx.user.id) {
              return json({ error: "You cannot message yourself about your own listing." }, { status: 400 });
            }

            let payload: unknown = null;
            try {
              payload = await request.json();
            } catch {
              payload = null;
            }

            const message =
              typeof payload === "object" && payload !== null && "message" in payload
                ? String((payload as { message?: unknown }).message ?? "").trim()
                : "";

            if (!message) {
              return json({ error: "Message is required." }, { status: 400 });
            }

            if (message.length > 2000) {
              return json({ error: "Message must be 2000 characters or fewer." }, { status: 400 });
            }

            const conversationId = await findOrCreateConversation(env.campusmarket_db, listing, ctx.user);
            await createMessage(env.campusmarket_db, conversationId, ctx.user.id, message);

            return json({ ok: true, conversationId });
          },
        }),

        route("/api/listings/:id/report", {
          post: async ({ params, request }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);
            const listing = await getListingById(env.campusmarket_db, params.id);
            if (!listing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            let payload: unknown = null;
            try {
              payload = await request.json();
            } catch {
              payload = null;
            }

            const reason =
              typeof payload === "object" && payload !== null && "reason" in payload
                ? String((payload as { reason?: unknown }).reason ?? "").trim()
                : "";

            if (!reason) {
              return json({ error: "Report reason is required." }, { status: 400 });
            }

            console.warn("Report listing submitted", {
              listingId: listing.id,
              title: listing.title,
              reason,
            });

            return json({ ok: true });
          },
        }),

        route("/api/listings/:id", {
          get: async ({ params }) => {
            const listing = await getListingById(env.campusmarket_db, params.id);
            if (!listing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            return json(listing);
          },

          put: async ({ params, request, ctx }: { params: { id: string }; request: Request; ctx: AppContext }) => {
            const existing = await getListingById(env.campusmarket_db, params.id);
            if (!existing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            if (!canManageListing(ctx.user, existing)) {
              return json(
                { error: ctx.user ? "You do not have permission to update this listing." : "Login required to update this listing." },
                { status: ctx.user ? 403 : 401 },
              );
            }

            let payload: unknown = null;

            try {
              payload = await request.json();
            } catch {
              payload = null;
            }

            if (!isListingPayload(payload)) {
              return json({ error: "Invalid JSON body." }, { status: 400 });
            }

            const payloadError = validateListingPayload(payload);
            if (payloadError) {
              return json({ error: payloadError }, { status: 400 });
            }

            const listing = normalizeListingPayload(
              {
                ...existing,
                ...payload,
              },
              existing.ownerId,
              existing.sellerName,
              existing.sellerEmail,
            );
            const requiredError = validateListingRequiredFields(listing);
            if (requiredError) {
              return json({ error: requiredError }, { status: 400 });
            }

            await env.campusmarket_db
              .prepare(
                `
                  UPDATE listings
                  SET
                    title = ?,
                    price = ?,
                    location = ?,
                    item_condition = ?,
                    category = ?,
                    description = ?,
                    image = ?,
                    image_url = ?,
                    image_key = ?,
                    thumbnail_key = ?,
                    sold = ?,
                    status = ?,
                    is_seeded = ?,
                    image_updated_at = ?,
                    updated_at = ?
                  WHERE id = ?
                `,
              )
              .bind(
                listing.title,
                listing.price,
                listing.location,
                listing.condition,
                listing.category,
                listing.description,
                listing.image,
                listing.image,
                listing.imageKey,
                listing.thumbnailKey,
                listing.sold,
                listing.status,
                listing.isSeeded,
                new Date().toISOString(),
                new Date().toISOString(),
                params.id,
              )
              .run();

            if (listing.imageKey) {
              await env.campusmarket_db
                .prepare("UPDATE uploaded_images SET listing_id = ? WHERE key = ? AND owner_id = ?")
                .bind(params.id, listing.imageKey, ctx.user!.id)
                .run();
            }

            if (existing.imageKey && existing.imageKey !== listing.imageKey) {
              await deleteListingImages(env, existing);
              await env.campusmarket_db.prepare("DELETE FROM uploaded_images WHERE key = ?").bind(existing.imageKey).run();
            }

            const updated = await getListingById(env.campusmarket_db, params.id);
            return json(updated);
          },

          delete: async ({ params, ctx }: { params: { id: string }; ctx: AppContext }) => {
            const existing = await getListingById(env.campusmarket_db, params.id);
            if (!existing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            if (!canManageListing(ctx.user, existing)) {
              return json(
                { error: ctx.user ? "You do not have permission to delete this listing." : "Login required to delete this listing." },
                { status: ctx.user ? 403 : 401 },
              );
            }

            await deleteListingImages(env, existing);
            await env.campusmarket_db.batch([
              env.campusmarket_db.prepare("DELETE FROM saved_listings WHERE listing_id = ?").bind(params.id),
              env.campusmarket_db.prepare("DELETE FROM uploaded_images WHERE listing_id = ? OR key = ?").bind(params.id, existing.imageKey),
              env.campusmarket_db.prepare("DELETE FROM listings WHERE id = ?").bind(params.id),
            ]);

            return json({ ok: true });
          },
        }),

        route("/api/dev/realtime-event", {
          get: async ({ request }) => {
            if (!isLocalRequest(request)) {
              return json({ error: "Not found." }, { status: 404 });
            }

            console.info("[worker] realtime debug event fetch", {
              method: request.method,
              url: request.url,
              hasEvent: latestRealtimeDebugEvent !== null,
            });

            return json({ event: latestRealtimeDebugEvent });
          },
          post: async ({ request }) => {
            if (!isLocalRequest(request)) {
              return json({ error: "Not found." }, { status: 404 });
            }

            try {
              await ensureMarketplaceSchema(env.campusmarket_db);

              const contentType = request.headers.get("content-type") ?? "";
              if (!contentType.toLowerCase().includes("application/json")) {
                return new Response(JSON.stringify({ error: "Content-Type must be application/json." }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                });
              }

              const rawBodyText = await request.text();
              let payload: unknown = null;

              try {
                payload = rawBodyText.trim() ? JSON.parse(rawBodyText) : {};
              } catch (error) {
                console.error("[worker] /api/dev/realtime-event invalid JSON", {
                  error,
                  rawBodyText,
                });
                return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                });
              }

              if (!isDebugListingPayload(payload)) {
                return new Response(JSON.stringify({ error: "JSON body must be an object." }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                });
              }

              const normalizedPayload = normalizeDebugListingPayload(payload);
              const createdResult = await createListingRecord({
                db: env.campusmarket_db,
                request,
                payload: normalizedPayload,
                ownerId: DEFAULT_USER_ID,
                sellerEmail: "",
                sellerName: DEFAULT_SELLER_NAME,
              });

              if (!createdResult.listing) {
                return new Response(JSON.stringify({ error: createdResult.error ?? "Failed to create test listing." }), {
                  status: createdResult.status ?? 500,
                  headers: { "Content-Type": "application/json" },
                });
              }

              try {
                await publishNewListingEvent(env, createdResult.listing);
              } catch (error) {
                console.error("[worker] publishNewListingEvent failed for /api/dev/realtime-event", {
                  error,
                  listingId: createdResult.listing.id,
                });
                return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to publish realtime event." }), {
                  status: 500,
                  headers: { "Content-Type": "application/json" },
                });
              }

              return new Response(
                JSON.stringify({
                  success: true,
                  listing: createdResult.listing,
                  event: latestRealtimeDebugEvent,
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                },
              );
            } catch (error) {
              console.error("[worker] /api/dev/realtime-event POST crashed", error);
              return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown server error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          },
        }),

        route("/", ({ ctx }: { ctx: AppContext }) => withAppShell(<Home />, ctx.user)),
        route("/listings", ({ ctx }: { ctx: AppContext }) => withAppShell(<Listings />, ctx.user)),
        route("/sell", [
          requireUser,
          ({ ctx }: { ctx: AppContext }) => withAppShell(<Sell />, ctx.user),
        ]),
        route("/dashboard", [
          requireUser,
          ({ ctx }: { ctx: AppContext }) => withAppShell(<Dashboard />, ctx.user),
        ]),
        route("/messages", [
          requireUser,
          ({ ctx }: { ctx: AppContext }) => withAppShell(<Messages />, ctx.user),
        ]),
        route("/messages/:conversationId", [
          requireUser,
          ({ params, ctx }: { params: { conversationId: string }; ctx: AppContext }) =>
            withAppShell(<Messages conversationId={params.conversationId} />, ctx.user),
        ]),
        route("/saved", ({ ctx }: { ctx: AppContext }) => withAppShell(<SavedItems />, ctx.user)),
        route("/dev/realtime", ({ request, ctx }: { request: Request; ctx: AppContext }) => {
          if (!isLocalRequest(request)) {
            return new Response("Not found.", { status: 404 });
          }

          return withAppShell(<RealtimeDebug />, ctx.user);
        }),
        route("/edit/:id", [
          requireUser,
          ({ params, ctx }: { params: { id: string }; ctx: AppContext }) => withAppShell(<Edit listingId={params.id} />, ctx.user),
        ]),
        route("/listings/:id", ({ params, ctx }: { params: { id: string }; ctx: AppContext }) =>
          withAppShell(<ListingDetail listingId={params.id} />, ctx.user),
        ),
        route("/listing/:id", ({ params, ctx }: { params: { id: string }; ctx: AppContext }) =>
          withAppShell(<ListingDetail listingId={params.id} />, ctx.user),
        ),
        route("/seller/:id", ({ params, ctx }: { params: { id: string }; ctx: AppContext }) =>
          withAppShell(<SellerProfile sellerId={params.id} />, ctx.user),
        ),
    ]),
  ]);
};

export default {
  async fetch(request: Request, env: Env, cf: ExecutionContext) {
    return createApp(env).fetch(request, env, cf);
  },
};

 
