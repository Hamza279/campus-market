"use client";

import { useEffect, useState } from "react";
import { ListingCard } from "@/app/shared/ListingCard";
import { getPublicProfile, type MarketplaceProfile } from "./profile.data";
import styles from "./seller.module.css";
import { getListings, Listing } from "./listings.data";

interface SellerProfileProps {
  sellerId: string;
}

export const SellerProfile = ({ sellerId }: SellerProfileProps) => {
  const [items, setItems] = useState<Listing[]>([]);
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [publicProfile, listings] = await Promise.all([getPublicProfile(sellerId), getListings()]);
        if (!cancelled) {
          setProfile(publicProfile);
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

  const sellerName = profile?.name ?? items[0]?.sellerName ?? "505 Market seller";
  const sellerBio =
    profile?.bio ||
    "This seller has not customized their profile yet, but you can still browse their active listings and message them from an item page.";

  return (
    <div className={styles.page}>
      <a href="/listings" className={styles.backButton}>
        Back to Browse
      </a>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1>{sellerName}</h1>
          <a href="/messages" className={styles.profileAction}>
            Message sellers
          </a>
        </div>
        <p className={styles.subtitle}>See who this seller is, where they like to meet, and what else they have listed on 505 Market.</p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.profileCard}>
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt={sellerName} className={styles.avatarImage} />
        ) : (
          <div className={styles.avatar}>{sellerName.slice(0, 1).toUpperCase()}</div>
        )}
        <div className={styles.profileContent}>
          <h2>About this seller</h2>
          <p>{sellerBio}</p>
          <div className={styles.profileStats}>
            <div>
              <strong>{items.length}</strong>
              <span>Listings</span>
            </div>
            <div>
              <strong>{profile?.responseTime || "Fast"}</strong>
              <span>Replies</span>
            </div>
          </div>
          <div className={styles.metaList}>
            <span>{profile?.campusAffiliation || "UNM or local community seller"}</span>
            <span>{profile?.neighborhood || "Neighborhood not shared yet"}</span>
            <span>{profile?.meetupLocation || "Meetup spot shared in messages"}</span>
            <span>{profile?.responseTime || "Response time not shared yet"}</span>
            <span>{profile?.interests || "General marketplace seller"}</span>
            <span>{profile?.contactPreference || "Message through 505 Market"}</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Listings from {sellerName}</h2>
          <span>{items.length} active</span>
        </div>
        {!loaded ? <p>Loading seller listings...</p> : null}
        {loaded && items.length === 0 ? <p>This seller does not have any active listings right now.</p> : null}
        <div className={styles.grid}>
          {items.map((item) => (
            <ListingCard
              key={item.id}
              listing={item}
              href={`/listings/${item.id}`}
              postedLabel={item.createdAt ? "Recently posted" : undefined}
              statusLabel={item.sold ? "Sold" : "Active"}
              statusTone={item.sold ? "sold" : "active"}
              footerActions={
                <a href={`/listings/${item.id}#contact-seller`} className={styles.contactLink}>
                  Contact seller
                </a>
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
};
