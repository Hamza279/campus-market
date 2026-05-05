import { DurableObject } from "cloudflare:workers";
import { MAX_SESSION_DURATION } from "rwsdk/auth";

export interface Session {
  userId?: string | null;
  oauthState?: string | null;
  returnTo?: string | null;
  createdAt: number;
}

export class SessionDurableObject extends DurableObject {
  private session: Session | undefined;

  async saveSession({
    userId = null,
    oauthState = null,
    returnTo = null,
  }: {
    userId?: string | null;
    oauthState?: string | null;
    returnTo?: string | null;
  }): Promise<Session> {
    const existing = await this.ctx.storage.get<Session>("session");
    const session: Session = {
      userId,
      oauthState,
      returnTo,
      createdAt: existing?.createdAt ?? Date.now(),
    };

    await this.ctx.storage.put("session", session);
    this.session = session;
    return session;
  }

  async getSession(): Promise<{ value: Session } | { error: string }> {
    if (this.session) {
      return { value: this.session };
    }

    const session = await this.ctx.storage.get<Session>("session");
    if (!session) {
      return { error: "Invalid session" };
    }

    if (session.createdAt + MAX_SESSION_DURATION < Date.now()) {
      await this.revokeSession();
      return { error: "Session expired" };
    }

    this.session = session;
    return { value: session };
  }

  async revokeSession() {
    await this.ctx.storage.delete("session");
    this.session = undefined;
  }
}
