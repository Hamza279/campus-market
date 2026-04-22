import { render, route } from "rwsdk/router";
  import { defineApp } from "rwsdk/worker";

  import { Document } from "@/app/document";
  import { setCommonHeaders } from "@/app/headers";
  import { Home } from "@/app/pages/home";
  import { Listings } from "@/app/pages/listings";
  import { Sell } from "@/app/pages/sell";
  import { Dashboard } from "@/app/pages/dashboard";
  import { Edit } from "@/app/pages/edit";
  import { ListingDetail } from "@/app/pages/listing";
  import { SellerProfile } from "@/app/pages/seller";
  import type { Listing } from "@/app/pages/listings.data";

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

  let schemaReady: Promise<void> | null = null;
  const DEFAULT_USER_ID = "campus-user";
  const DEFAULT_SELLER_NAME = "Campus User";

  const getRequester = (request: Request) => {
    const userId = request.headers.get("x-campus-user-id")?.trim() || DEFAULT_USER_ID;
    const role = request.headers.get("x-campus-user-role")?.trim().toLowerCase() || "user";
    return {
      userId,
      isAdmin: role === "admin",
    };
  };

  const canManageListing = (request: Request, listing: Listing) => {
    const requester = getRequester(request);
    return requester.isAdmin || listing.ownerId === requester.userId;
  };

  const ensureMarketplaceSchema = (db: D1Database) => {
    schemaReady ??= (async () => {
      const statements = [
        "ALTER TABLE listings ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'",
        "ALTER TABLE listings ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'campus-admin'",
        "ALTER TABLE listings ADD COLUMN seller_name TEXT NOT NULL DEFAULT 'Campus User'",
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
      image: optionalStringField(payload, "image")?.trim() || "",
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

  const createApp = (env: Env) => {
    return defineApp([
      setCommonHeaders(),
      render(Document, [
        route("/api/listings", {
          get: async () => {
            await ensureMarketplaceSchema(env.campusmarket_db);

            const result = await env.campusmarket_db
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
                  ORDER BY is_seeded DESC, created_at DESC, id DESC
                `,
              )
              .all<ListingRow>();

            return json((result.results ?? []).map(toListing));
          },

          post: async ({ request }) => {
            await ensureMarketplaceSchema(env.campusmarket_db);

            const contentType = request.headers.get("content-type") ?? "";
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
                sql: insertSql,
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
                sql: insertSql,
                boundValues: [],
                error,
              });
              return json({ error: "Invalid JSON body." }, { status: 400 });
            }

            if (!isListingPayload(payload)) {
              return json({ error: "JSON body must be an object." }, { status: 400 });
            }

            const payloadError = validateListingPayload(payload);
            if (payloadError) {
              return json({ error: payloadError }, { status: 400 });
            }

            const listing = normalizeListingPayload(payload);
            const requester = getRequester(request);
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
              requester.userId,
              DEFAULT_SELLER_NAME,
            ] as const;
            const insertParamError = validateInsertParams([...insertParams]);
            if (insertParamError) {
              logListingCreateDebug("Invalid listing create insert values.", {
                request,
                rawBodyText,
                parsedPayload: payload,
                sql: insertSql,
                boundValues: [...insertParams],
              });
              return json({ error: insertParamError }, { status: 400 });
            }

            try {
              await env.campusmarket_db.prepare(insertSql).bind(...insertParams).run();
            } catch (error) {
              logListingCreateDebug("D1 listing create insert failed.", {
                request,
                rawBodyText,
                parsedPayload: payload,
                sql: insertSql,
                boundValues: [...insertParams],
                error,
              });
              return json({ error: "Failed to create listing." }, { status: 500 });
            }

            const created = await getListingById(env.campusmarket_db, id);

            return json(created, { status: 201 });
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

          put: async ({ params, request }) => {
            const existing = await getListingById(env.campusmarket_db, params.id);
            if (!existing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            if (!canManageListing(request, existing)) {
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

          delete: async ({ params, request }) => {
            const existing = await getListingById(env.campusmarket_db, params.id);
            if (!existing) {
              return json({ error: "Listing not found." }, { status: 404 });
            }

            if (!canManageListing(request, existing)) {
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

        route("/", Home),
        route("/listings", Listings),
        route("/sell", () => <Sell />),
        route("/dashboard", () => <Dashboard />),
        route("/edit/:id", ({ params }) => <Edit listingId={params.id} />),
        route("/listings/:id", ({ params }) => <ListingDetail listingId={params.id} />),
        route("/listing/:id", ({ params }) => <ListingDetail listingId={params.id} />),
        route("/seller/:id", ({ params }) => <SellerProfile sellerId={params.id} />),
      ]),
    ]);
  };

  export default {
    async fetch(request: Request, env: Env, cf: ExecutionContext) {
      return createApp(env).fetch(request, env, cf);
    },
  };

 
