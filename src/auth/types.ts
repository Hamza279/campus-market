export interface AuthUser {
  id: string;
  provider: string;
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppContext {
  session: import("@/session/durableObject").Session | null;
  user: AuthUser | null;
}
