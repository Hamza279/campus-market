import type { AuthUser } from "./types";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const validateLocalLogin = ({
  name,
  email,
}: {
  name: FormDataEntryValue | null;
  email: FormDataEntryValue | null;
}): { name: string; email: string } | { error: string } => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? normalizeEmail(email) : "";

  if (!normalizedName) {
    return { error: "Name is required." };
  }

  if (normalizedName.length > 80) {
    return { error: "Name must be 80 characters or fewer." };
  }

  if (!normalizedEmail) {
    return { error: "Email is required." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  return { name: normalizedName, email: normalizedEmail };
};

export const upsertLocalUser = async (
  db: D1Database,
  profile: {
    name: string;
    email: string;
  },
): Promise<AuthUser> => {
  const email = normalizeEmail(profile.email);
  const now = new Date().toISOString();
  const existing = await db
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
        WHERE provider = ? AND provider_id = ?
      `,
    )
    .bind("local", email)
    .first<AuthUser>();

  if (existing) {
    await db
      .prepare(
        `
          UPDATE users
          SET email = ?, name = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(email, profile.name, now, existing.id)
      .run();

    return {
      ...existing,
      email,
      name: profile.name,
      updatedAt: now,
    };
  }

  const user: AuthUser = {
    id: crypto.randomUUID(),
    provider: "local",
    providerId: email,
    email,
    name: profile.name,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .prepare(
      `
        INSERT INTO users (
          id,
          provider,
          provider_id,
          email,
          name,
          avatar_url,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(user.id, user.provider, user.providerId, user.email, user.name, user.avatarUrl, user.createdAt, user.updatedAt)
    .run();

  return user;
};
