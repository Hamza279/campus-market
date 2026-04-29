"use client";

import styles from "./placeholder.module.css";

export const Messages = () => {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Messages</h1>
        <p className={styles.subtitle}>
          Buyer and seller conversations will appear here when messaging is connected.
        </p>
      </header>

      <section className={styles.panel}>
        <h2>No messages yet</h2>
        <p>
          This is a safe placeholder route for the navigation menu. The existing contact-seller action still logs a
          placeholder message on the server.
        </p>
        <a href="/listings" className={styles.actionLink}>
          Browse listings
        </a>
      </section>
    </div>
  );
};
