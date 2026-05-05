import { defineDurableSession } from "rwsdk/auth";

export let sessions: ReturnType<typeof createSessionStore>;

const createSessionStore = (env: Env) => {
  const secretKey = env.AUTH_SECRET_KEY || env.AUTH_SECRET || env.SESSION_SECRET;

  return defineDurableSession({
    sessionDurableObject: env.SESSION_DURABLE_OBJECT,
    secretKey,
  });
};

export const setupSessionStore = (env: Env) => {
  sessions = createSessionStore(env);
  return sessions;
};
