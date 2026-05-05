import type { AuthUser } from "./types";

const PASSWORD_MIN_LENGTH = 8;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const toStringValue = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

const hashPassword = async (password: string) => {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const selectUserByEmail = async (db: D1Database, email: string) => {
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
          password_hash AS passwordHash,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM users
        WHERE email = ?
        LIMIT 1
      `,
    )
    .bind(email)
    .first<AuthUser & { passwordHash?: string | null }>();
};

export const validateSignupInput = ({
  name,
  email,
  password,
  passwordConfirm,
}: {
  name: FormDataEntryValue | null;
  email: FormDataEntryValue | null;
  password: FormDataEntryValue | null;
  passwordConfirm: FormDataEntryValue | null;
}): { name: string; email: string; password: string } | { error: string } => {
  const normalizedName = toStringValue(name);
  const normalizedEmail = normalizeEmail(toStringValue(email));
  const rawPassword = typeof password === "string" ? password : "";
  const rawPasswordConfirm = typeof passwordConfirm === "string" ? passwordConfirm : "";

  if (!normalizedName) {
    return { error: "Full name is required." };
  }

  if (normalizedName.length > 80) {
    return { error: "Full name must be 80 characters or fewer." };
  }

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  if (rawPassword.length < PASSWORD_MIN_LENGTH) {
    return { error: "Password must be at least 8 characters." };
  }

  if (rawPassword !== rawPasswordConfirm) {
    return { error: "Passwords do not match." };
  }

  return { name: normalizedName, email: normalizedEmail, password: rawPassword };
};

export const validatePasswordLoginInput = ({
  email,
  password,
}: {
  email: FormDataEntryValue | null;
  password: FormDataEntryValue | null;
}): { email: string; password: string } | { error: string } => {
  const normalizedEmail = normalizeEmail(toStringValue(email));
  const rawPassword = typeof password === "string" ? password : "";

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  if (!rawPassword) {
    return { error: "Password is required." };
  }

  return { email: normalizedEmail, password: rawPassword };
};

export const validateDemoLogin = ({
  name,
  email,
}: {
  name: FormDataEntryValue | null;
  email: FormDataEntryValue | null;
}): { name: string; email: string } | { error: string } => {
  const normalizedName = toStringValue(name);
  const normalizedEmail = normalizeEmail(toStringValue(email));

  if (!normalizedName) {
    return { error: "Name is required." };
  }

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return { error: "Enter a valid email address." };
  }

  return { name: normalizedName, email: normalizedEmail };
};

export const createLocalUser = async (
  db: D1Database,
  profile: {
    name: string;
    email: string;
    password: string;
  },
): Promise<AuthUser | { error: string }> => {
  const email = normalizeEmail(profile.email);
  const existing = await selectUserByEmail(db, email);

  if (existing) {
    return { error: "Account already exists. Please log in." };
  }

  const now = new Date().toISOString();
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
          password_hash,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      user.id,
      user.provider,
      user.providerId,
      user.email,
      user.name,
      user.avatarUrl,
      await hashPassword(profile.password),
      user.createdAt,
      user.updatedAt,
    )
    .run();

  return user;
};

export const authenticateLocalUser = async (
  db: D1Database,
  credentials: {
    email: string;
    password: string;
  },
): Promise<AuthUser | { error: string }> => {
  const email = normalizeEmail(credentials.email);
  const user = await selectUserByEmail(db, email);

  if (!user || user.provider !== "local" || !user.passwordHash) {
    return { error: "Invalid email or password." };
  }

  const passwordHash = await hashPassword(credentials.password);
  if (passwordHash !== user.passwordHash) {
    return { error: "Invalid email or password." };
  }

  const { passwordHash: _passwordHash, ...authUser } = user;
  return authUser;
};

export const upsertDemoUser = async (
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
    .bind("demo", email)
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
    provider: "demo",
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
