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
    sold: number;
    is_seeded: number;
    owner_id: string | null;
    seller_name: string | null;
    created_at: string;
    updated_at: string;
  };

  type ListingPayload = {
    title?: string;
    price?: string;
    location?: string;
    condition?: string;
    category?: string;
    description?: string;
    image?: string;
    sold?: boolean;
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
    sold: number;
    isSeeded: number;
    ownerId: string;
    sellerName: string;
  };

  type DebugListingPayload = {
    title?: string;
    price?: number | string;
    description?: string;
  };

let schemaReady: Promise<void> | null = null;
const DEFAULT_USER_ID = "campus-user";
const DEFAULT_SELLER_NAME = "Campus User";
let latestRealtimeDebugEvent: NewListingEvent | null = null;

const getRequester = (user: AuthUser | null) => {
  return {
    userId: user?.id ?? "",
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
      "ALTER TABLE listings ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'",
      "ALTER TABLE listings ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'campus-admin'",
      "ALTER TABLE listings ADD COLUMN seller_name TEXT NOT NULL DEFAULT 'Campus User'",
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_identity ON users(provider, provider_id)",
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
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
  return Response.json(data, init);
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
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    location: row.location,
    condition: row.item_condition,
    category: row.category || "Other",
    description: row.description,
    image: row.image,
    sold: row.sold === 1,
    isSeeded: row.is_seeded === 1,
    ownerId: row.owner_id || DEFAULT_USER_ID,
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
  key: keyof Pick<ListingPayload, "title" | "price" | "location" | "condition" | "category" | "description" | "image">,
): string | undefined => {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" ? value : undefined;
};

const validateListingPayload = (payload: ListingPayload): string | null => {
  const stringFields = ["title", "price", "location", "condition", "category", "description", "image"] as const;

    for (const field of stringFields) {
      const value = payload[field];
      if (value !== undefined && typeof value !== "string") {
        return `${field} must be a string.`;
      }
    }

    if (payload.sold !== undefined && typeof payload.sold !== "boolean") {
      return "sold must be a boolean.";
    }

    if (payload.isSeeded !== undefined && typeof payload.isSeeded !== "boolean") {
      return "isSeeded must be a boolean.";
    }

    if (payload.image !== undefined) {
      const imageError = getImageUrlValidationError(payload.image);
      if (imageError) {
        return imageError;
      }
    }

    return null;
};

const normalizeListingPayload = (payload: ListingPayload): NormalizedListingPayload => {
  return {
    title: optionalStringField(payload, "title")?.trim() || "Untitled item",
    price: optionalStringField(payload, "price")?.trim() || "$0",
    location: optionalStringField(payload, "location")?.trim() || "Campus",
    condition: optionalStringField(payload, "condition")?.trim() || "Good",
    category: optionalStringField(payload, "category")?.trim() || "Other",
    description: optionalStringField(payload, "description")?.trim() || "No description provided.",
    image: normalizeImageUrlForSave(optionalStringField(payload, "image") ?? ""),
    sold: payload.sold === true ? 1 : 0,
    isSeeded: payload.isSeeded === true ? 1 : 0,
    ownerId: DEFAULT_USER_ID,
    sellerName: DEFAULT_SELLER_NAME,
  };
};

const validateInsertParams = (values: unknown[]): string | null => {
  for (const value of values) {
    const validType = typeof value === "string" || typeof value === "number";
    if (!validType || value === undefined || value === null) {
      return "Listing insert values must be plain strings or numbers.";
    }
  }

    const [id, title, price, location, condition, category, description, , , , ownerId, sellerName] = values;
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
            sold,
            is_seeded,
            owner_id,
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

const createListingRecord = async ({
  db,
  request,
  payload,
  ownerId,
  sellerName,
}: {
  db: D1Database;
  request: Request;
  payload: ListingPayload;
  ownerId: string;
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
      sold,
      is_seeded,
      owner_id,
      seller_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const payloadError = validateListingPayload(payload);
  if (payloadError) {
    return { error: payloadError, status: 400 };
  }

  const listing = normalizeListingPayload(payload);
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
    listing.sold,
    listing.isSeeded,
    ownerId,
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
        route("/login", ({ request, ctx }: { request: Request; ctx: AppContext }) => {
          if (ctx.user) {
            return redirect("/");
          }

          const url = new URL(request.url);
          const returnTo = url.searchParams.get("returnTo") ?? "/";
          return withAppShell(
            <Login
              googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
              appleEnabled={false}
              error={url.searchParams.get("error") ?? undefined}
              returnTo={returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/"}
            />,
            ctx.user,
          );
        }),

        route("/auth/google", async ({ request, response }) => {
          if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
            return redirect("/login?error=Google%20login%20needs%20configuration.", response.headers);
          }

          const url = new URL(request.url);
          const returnTo = url.searchParams.get("returnTo") || "/";
          const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
          const state = crypto.randomUUID();

          // Google OAuth starts here: store the CSRF state in the signed session cookie, then redirect to Google.
          await sessions.save(response.headers, { oauthState: state, returnTo: safeReturnTo });
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
            const returnTo = session.returnTo && session.returnTo.startsWith("/") ? session.returnTo : "/";

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
          return redirect("/", response.headers);
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
                    sold,
                    is_seeded,
                    owner_id,
                    seller_name,
                    created_at,
                    updated_at
                  FROM listings
                  ${mineOnly ? "WHERE owner_id = ?" : ""}
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

            const message =
              typeof payload === "object" && payload !== null && "message" in payload
                ? String((payload as { message?: unknown }).message ?? "").trim()
                : "";

            if (!message) {
              return json({ error: "Message is required." }, { status: 400 });
            }

            console.info("Contact seller placeholder", {
              listingId: listing.id,
              title: listing.title,
              sellerName: listing.sellerName,
              message,
            });

            return json({ ok: true });
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

            console.warn("Report listing placeholder", {
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
              return json({ error: "You do not have permission to update this listing." }, { status: 403 });
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

            const listing = normalizeListingPayload({
              ...existing,
              ...payload,
            });

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
                    sold = ?,
                    is_seeded = ?,
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
                listing.sold,
                listing.isSeeded,
                new Date().toISOString(),
                params.id,
              )
              .run();

            const updated = await getListingById(env.campusmarket_db, params.id);
            return json(updated);
          },

          delete: async ({ params, ctx }: { params: { id: string }; ctx: AppContext }) => {
            const existing = await getListingById(env.campusmarket_db, params.id);
            if (!existing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            if (!canManageListing(ctx.user, existing)) {
              return json({ error: "You do not have permission to delete this listing." }, { status: 403 });
            }

            await env.campusmarket_db
              .prepare(
                `
                  DELETE FROM listings
                  WHERE id = ?
                `,
              )
              .bind(params.id)
              .run();

            return json({ ok: true });
          },
        }),

        route("/api/dev/realtime-event", {
          get: async ({ request }) => {
            console.info("[worker] realtime debug event fetch", {
              method: request.method,
              url: request.url,
              hasEvent: latestRealtimeDebugEvent !== null,
            });

            return json({ event: latestRealtimeDebugEvent });
          },
          post: async ({ request }) => {
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
        route("/messages", ({ ctx }: { ctx: AppContext }) => withAppShell(<Messages />, ctx.user)),
        route("/saved", ({ ctx }: { ctx: AppContext }) => withAppShell(<SavedItems />, ctx.user)),
        route("/dev/realtime", ({ ctx }: { ctx: AppContext }) => withAppShell(<RealtimeDebug />, ctx.user)),
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

 
