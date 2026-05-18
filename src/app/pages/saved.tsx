"use client";

import { useCallback, useEffect, useState } from "react";
import { ListingCard } from "@/app/shared/ListingCard";
import styles from "./placeholder.module.css";
import { getSavedListings, Listing, unsaveListing } from "./listings.data";

export const SavedItems = () => {
  const [items, setItems] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());

  const loadSavedListings = useCallback(async () => {
    try {
      const savedListings = await getSavedListings();
      setItems(savedListings);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load saved listings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedListings();
  }, [loadSavedListings]);

  const handleUnsave = async (listing: Listing) => {
    setRemovingIds((current) => new Set(current).add(listing.id));

    try {
      await unsaveListing(listing.id);
      setItems((current) => current.filter((item) => item.id !== listing.id));
      setError(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove saved listing.");
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(listing.id);
        return next;
      });
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Saved items</h1>
        <p className={styles.subtitle}>Keep track of listings you want to revisit, compare, or message about later.</p>
      </header>

      {error ? <p className={styles.errorMessage}>{error}</p> : null}

      {isLoading ? (
        <section className={styles.panel}>
          <h2>Loading saved items</h2>
          <p>Fetching your saved listings.</p>
        </section>
      ) : items.length === 0 ? (
        <section className={styles.panel}>
          <h2>You have not saved anything yet</h2>
          <p>When you find something you like on Browse, save it and it will show up here across devices.</p>
          <a href="/listings" className={styles.actionLink}>
            Browse listings
          </a>
        </section>
      ) : (
        <section className={styles.grid} aria-label="Saved listings">
          {items.map((item) => (
            <ListingCard
              key={item.id}
              listing={item}
              href={`/listings/${item.id}`}
              footerActions={
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleUnsave(item)}
                  disabled={removingIds.has(item.id)}
                >
                  {removingIds.has(item.id) ? "Removing..." : "Remove from saved"}
                </button>
              }
            />
          ))}
        </section>
      )}
    </div>
  );
};
