import type { AuthUser } from "./types";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_SALT_BYTES = 16;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const toStringValue = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

const bytesToHex = (bytes: Uint8Array) => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const hexToBytes = (hex: string) => {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const timingSafeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
};

const legacyHashPassword = async (password: string) => {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
};

const derivePasswordHash = async (password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBuffer,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(derivedBits);
};

const hashPassword = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const hash = await derivePasswordHash(password, salt);
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
};

const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> => {
  const [algorithm, iterationsValue, saltValue, hashValue] = storedHash.split("$");
  if (algorithm === PASSWORD_ALGORITHM && iterationsValue && saltValue && hashValue) {
    const iterations = Number.parseInt(iterationsValue, 10);
    const salt = hexToBytes(saltValue);
    const expectedHash = hexToBytes(hashValue);

    if (!Number.isFinite(iterations) || iterations < 1 || !salt || !expectedHash) {
      return { valid: false, needsUpgrade: false };
    }

    const actualHash = await derivePasswordHash(password, salt, iterations);
    return {
      valid: timingSafeEqual(actualHash, expectedHash),
      needsUpgrade: iterations < PASSWORD_ITERATIONS,
    };
  }

  const legacyHash = await legacyHashPassword(password);
  return {
    valid: timingSafeEqual(new TextEncoder().encode(legacyHash), new TextEncoder().encode(storedHash)),
    needsUpgrade: legacyHash === storedHash,
  };
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
          bio,
          campus_affiliation AS campusAffiliation,
          neighborhood,
          meetup_location AS meetupLocation,
          response_time AS responseTime,
          interests,
          contact_preference AS contactPreference,
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
    bio: null,
    campusAffiliation: null,
    neighborhood: null,
    meetupLocation: null,
    responseTime: null,
    interests: null,
    contactPreference: null,
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

  const passwordCheck = await verifyPassword(credentials.password, user.passwordHash);
  if (!passwordCheck.valid) {
    return { error: "Invalid email or password." };
  }

  if (passwordCheck.needsUpgrade) {
    await db
      .prepare(
        `
          UPDATE users
          SET password_hash = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(await hashPassword(credentials.password), new Date().toISOString(), user.id)
      .run();
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
          bio,
          campus_affiliation AS campusAffiliation,
          neighborhood,
          meetup_location AS meetupLocation,
          response_time AS responseTime,
          interests,
          contact_preference AS contactPreference,
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
      bio: existing.bio,
      campusAffiliation: existing.campusAffiliation,
      neighborhood: existing.neighborhood,
      meetupLocation: existing.meetupLocation,
      responseTime: existing.responseTime,
      interests: existing.interests,
      contactPreference: existing.contactPreference,
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
    bio: null,
    campusAffiliation: null,
    neighborhood: null,
    meetupLocation: null,
    responseTime: null,
    interests: null,
    contactPreference: null,
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
