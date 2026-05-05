interface Env {
  SESSION_DURABLE_OBJECT: DurableObjectNamespace<import("@/session/durableObject").SessionDurableObject>;
  AUTH_SECRET_KEY?: string;
  AUTH_SECRET?: string;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APP_URL?: string;
  BASE_URL?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
}
