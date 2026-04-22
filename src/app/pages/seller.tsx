"use client";

import { useEffect, useState } from "react";
import styles from "./seller.module.css";
import { getListings, Listing } from "./listings.data";

interface SellerProfileProps {
  sellerId: string;
}

export const SellerProfile = ({ sellerId }: SellerProfileProps) => {
  const [items, setItems] = useState<Listing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const listings = await getListings();
        if (!cancelled) {
          setItems(listings.filter((listing) => listing.ownerId === sellerId));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load seller profile.");
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const sellerName = items[0]?.sellerName ?? "Campus User";

  return (
    <div className={styles.page}>
      <a href="/listings" className={styles.backButton}>
        Back to listings
      </a>
      <header className={styles.header}>
        <h1>{sellerName}</h1>
        <p className={styles.subtitle}>Seller profile placeholder for CampusMarket.</p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.profileCard}>
        <div className={styles.avatar}>{sellerName.slice(0, 1).toUpperCase()}</div>
        <div>
          <h2>Campus seller</h2>
          <p>Verified profile, ratings, and response time can live here later.</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Seller listings</h2>
        {!loaded ? <p>Loading seller listings...</p> : null}
        {loaded && items.length === 0 ? <p>No listings found for this seller.</p> : null}
        <div className={styles.grid}>
          {items.map((item) => (
            <a key={item.id} href={`/listings/${item.id}`} className={styles.card}>
              <strong>{item.title}</strong>
              <span>{item.price}</span>
              <small>{item.sold ? "Sold" : "Active"}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
