import type { AuthUser } from "./types";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const getGoogleCredentials = (env: Env) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured.");
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
};

export const getAppUrl = (request: Request, env: Env) => {
  return (env.APP_URL || env.BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
};

export const getGoogleRedirectUri = (request: Request, env: Env) => {
  return `${getAppUrl(request, env)}/auth/callback/google`;
};

export const buildGoogleAuthUrl = (request: Request, env: Env, state: string) => {
  const { clientId } = getGoogleCredentials(env);
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleRedirectUri(request, env));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
};

export const exchangeGoogleCode = async (request: Request, env: Env, code: string): Promise<GoogleUserInfo> => {
  const { clientId, clientSecret } = getGoogleCredentials(env);
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getGoogleRedirectUri(request, env),
    }),
  });

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed.");
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch Google user profile.");
  }

  return (await userInfoResponse.json()) as GoogleUserInfo;
};

export const upsertGoogleUser = async (db: D1Database, profile: GoogleUserInfo): Promise<AuthUser> => {
  if (!profile.sub || !profile.email) {
    throw new Error("Google profile did not include an id and email.");
  }

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
    .bind("google", profile.sub)
    .first<AuthUser>();

  if (existing) {
    await db
      .prepare(
        `
          UPDATE users
          SET email = ?, name = ?, avatar_url = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(profile.email, profile.name ?? null, profile.picture ?? null, now, existing.id)
      .run();

    return {
      ...existing,
      email: profile.email,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      updatedAt: now,
    };
  }

  const user: AuthUser = {
    id: crypto.randomUUID(),
    provider: "google",
    providerId: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
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
