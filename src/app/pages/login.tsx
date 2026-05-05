import styles from "./login.module.css";

interface LoginProps {
  googleEnabled: boolean;
  appleEnabled: boolean;
  error?: string;
  success?: string;
  returnTo?: string;
  mode?: "login" | "signup";
  demoEnabled?: boolean;
}

export const Login = ({
  googleEnabled,
  appleEnabled,
  error,
  success,
  returnTo = "/dashboard",
  mode = "login",
  demoEnabled = false,
}: LoginProps) => {
  const googleHref = `/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  const signupHref = `/login?mode=signup&returnTo=${encodeURIComponent(returnTo)}`;
  const isSignup = mode === "signup";

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <p className={styles.eyebrow}>CampusMarket account</p>
        <h1 id="login-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className={styles.subtitle}>Create an account to buy, sell, message, and save items.</p>

        <div className={styles.tabs} role="tablist" aria-label="Authentication mode">
          <a className={!isSignup ? `${styles.tab} ${styles.activeTab}` : styles.tab} href={loginHref}>
            Log In
          </a>
          <a className={isSignup ? `${styles.tab} ${styles.activeTab}` : styles.tab} href={signupHref}>
            Sign Up
          </a>
        </div>

        {error ? <p className={styles.errorMessage}>{error}</p> : null}
        {success ? <p className={styles.successMessage}>{success}</p> : null}

        {isSignup ? (
          <form className={styles.authForm} method="post" action="/login">
            <input type="hidden" name="intent" value="signup" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className={styles.formRow}>
              <label htmlFor="signup-name">Full name</label>
              <input id="signup-name" name="name" type="text" autoComplete="name" placeholder="Alex Student" required />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="signup-email">Email</label>
              <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="alex@example.edu" required />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="signup-password-confirm">Re-enter password</label>
              <input
                id="signup-password-confirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Confirm your password"
                required
              />
            </div>
            <button className={styles.submitButton} type="submit">
              Create account
            </button>
          </form>
        ) : (
          <form className={styles.authForm} method="post" action="/login">
            <input type="hidden" name="intent" value="login" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className={styles.formRow}>
              <label htmlFor="login-email">Email</label>
              <input id="login-email" name="email" type="email" autoComplete="email" placeholder="alex@example.edu" required />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="login-password">Password</label>
              <input id="login-password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <button className={styles.submitButton} type="submit">
              Log in
            </button>
          </form>
        )}

        {demoEnabled ? (
          <details className={styles.demoBox}>
            <summary>Use local demo login</summary>
            <form className={styles.demoForm} method="post" action="/login">
              <input type="hidden" name="intent" value="demo" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <input name="name" type="text" autoComplete="name" placeholder="Demo name" required />
              <input name="email" type="email" autoComplete="email" placeholder="demo@example.edu" required />
              <button type="submit">Continue as demo user</button>
            </form>
          </details>
        ) : null}

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <div className={styles.providerList}>
          {googleEnabled ? (
            <a className={styles.providerButton} href={googleHref}>
              <span className={styles.providerMark}>G</span>
              Continue with Google
            </a>
          ) : (
            <button className={styles.providerButton} type="button" disabled>
              <span className={styles.providerMark}>G</span>
              Google login needs configuration.
            </button>
          )}

          <button className={styles.providerButton} type="button" disabled={!appleEnabled}>
            <span className={styles.providerMark}>A</span>
            {appleEnabled ? "Continue with Apple" : "Apple login coming soon."}
          </button>
        </div>
      </section>
    </div>
  );
};
