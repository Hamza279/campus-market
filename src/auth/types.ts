export interface AuthUser {
  id: string;
  provider: string;
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  campusAffiliation: string | null;
  neighborhood: string | null;
  meetupLocation: string | null;
  responseTime: string | null;
  interests: string | null;
  contactPreference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppContext {
  session: import("@/session/durableObject").Session | null;
  user: AuthUser | null;
}
