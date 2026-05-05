import styles from "./login.module.css";

interface LoginProps {
  googleEnabled: boolean;
  appleEnabled: boolean;
  error?: string;
  success?: string;
  returnTo?: string;
}

export const Login = ({ googleEnabled, appleEnabled, error, success, returnTo = "/" }: LoginProps) => {
  const googleHref = `/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <p className={styles.eyebrow}>CampusMarket account</p>
        <h1 id="login-title">Log in to sell and manage listings</h1>
        <p className={styles.subtitle}>Use demo login locally, or continue with a configured identity provider.</p>

        {error ? <p className={styles.errorMessage}>{error}</p> : null}
        {success ? <p className={styles.successMessage}>{success}</p> : null}

        <form className={styles.localForm} method="post" action="/login">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className={styles.formRow}>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" autoComplete="name" placeholder="Alex Student" required />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="alex@example.edu" required />
          </div>
          <button className={styles.submitButton} type="submit">
            Log in with demo account
          </button>
        </form>

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
