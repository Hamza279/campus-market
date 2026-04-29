"use client";

import styles from "./placeholder.module.css";

export const SavedItems = () => {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Saved Items</h1>
        <p className={styles.subtitle}>
          Saved listings are currently stored in the browser from the Listings page.
        </p>
      </header>

      <section className={styles.panel}>
        <h2>Saved view coming next</h2>
        <p>
          This route keeps the menu complete without changing the current saved-listing behavior. A full saved-items
          page can read the existing local saved IDs in a later pass.
        </p>
        <a href="/listings" className={styles.actionLink}>
          Open listings
        </a>
      </section>
    </div>
  );
};
