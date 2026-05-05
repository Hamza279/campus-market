import styles from "./login.module.css";

interface LoginProps {
  googleEnabled: boolean;
  appleEnabled: boolean;
  error?: string;
  returnTo?: string;
}

export const Login = ({ googleEnabled, appleEnabled, error, returnTo = "/" }: LoginProps) => {
  const googleHref = `/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <p className={styles.eyebrow}>CampusMarket account</p>
        <h1 id="login-title">Log in to sell and manage listings</h1>
        <p className={styles.subtitle}>Use a supported identity provider to keep your marketplace profile secure.</p>

        {error ? <p className={styles.errorMessage}>{error}</p> : null}

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
