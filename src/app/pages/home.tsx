"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { ListingCard } from "@/app/shared/ListingCard";
import styles from "./home.module.css";
import { getListingImageSrc } from "./image-url";
import { getListings, type Listing } from "./listings.data";
import { LISTINGS_REALTIME_ROOM, NEW_LISTING_EVENT_KEY, type NewListingEvent } from "./listings.realtime";

const categories = [
  { label: "Books", icon: "BOOK", tone: "blue", description: "Textbooks, novels, course packs" },
  { label: "Electronics", icon: "TECH", tone: "teal", description: "Laptop gear, headphones, chargers" },
  { label: "Furniture", icon: "DESK", tone: "amber", description: "Desks, chairs, lamps, shelves" },
  { label: "Supplies", icon: "BAG", tone: "rose", description: "Backpacks, calculators, class tools" },
  { label: "Bikes", icon: "BIKE", tone: "green", description: "Bikes, locks, helmets, scooters" },
  { label: "Dorm", icon: "DORM", tone: "violet", description: "Mini fridges, bedding, decor" },
] as const;

const steps = [
  {
    step: "01",
    title: "Browse",
    text: "Scan active listings by category, location, condition, and price before you reach out.",
  },
  {
    step: "02",
    title: "Message seller",
    text: "Contact the seller with a simple note and confirm the item details or pickup window.",
  },
  {
    step: "03",
    title: "Meet safely on campus",
    text: "Choose a public campus spot, inspect the item, and finish the exchange in person.",
  },
] as const;

const getListingTime = (listing: Listing): number => {
  const timestamp = listing.createdAt ? Date.parse(listing.createdAt) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const Home = () => {
  const [items, setItems] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingEvent] = useSyncedState<NewListingEvent | null>(null, NEW_LISTING_EVENT_KEY, LISTINGS_REALTIME_ROOM);

  const loadListings = useCallback(async () => {
    try {
      const listings = await getListings();
      setItems(listings);
      setListingError(null);
    } catch (error) {
      console.warn("[home] failed to load featured listings", error);
      setListingError(error instanceof Error ? error.message : "Failed to load listings.");
    } finally {
      setLoadingListings(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();

    const refreshOnReturn = () => {
      void loadListings();
    };

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
    };
  }, [loadListings]);

  useEffect(() => {
    if (listingEvent) {
      void loadListings();
    }
  }, [listingEvent, loadListings]);

  const featuredListings = useMemo(() => {
    return items
      .filter((listing) => !listing.sold)
      .sort((a, b) => getListingTime(b) - getListingTime(a))
      .slice(0, 3);
  }, [items]);

  const heroListing = featuredListings[0];
  const heroListingImage = getListingImageSrc(heroListing?.thumbnailUrl || heroListing?.imageUrl || heroListing?.image || "");

  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Simple local student marketplace</p>
            <h1 className={styles.heroTitle}>Buy, sell, and meet nearby with 505 Market.</h1>
            <p className={styles.heroText}>
              505 Market is a student-friendly place to find textbooks, furniture, bikes, tech, and other everyday items around campus.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="/listings">
                Browse listings
              </a>
              <a className={styles.secondaryButton} href="/sell">
                Sell an item
              </a>
            </div>
          </div>

          <aside className={styles.heroCard} aria-label="Marketplace snapshot">
            <div className={styles.heroCardHeader}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span className={styles.heroCardKicker}>Fresh on 505 Market</span>
            </div>
            <div className={loadingListings ? `${styles.heroListing} ${styles.heroListingLoading}` : styles.heroListing}>
              <img src={heroListingImage} alt={heroListing?.title ?? "Featured 505 Market listing"} className={styles.heroListingImage} />
              <span className={styles.heroListingOverlay} />
              <span className={styles.heroListingTag}>{heroListing?.category ?? "Fresh listings"}</span>
              <strong className={styles.heroListingTitle}>{heroListing?.title ?? "New campus finds"}</strong>
              <span className={styles.heroListingMeta}>
                {heroListing ? `${heroListing.location} - ${heroListing.condition}` : "Browse student-posted items"}
              </span>
              <div className={styles.heroListingFooter}>
                <strong className={styles.heroListingPrice}>{heroListing?.price ?? "Live"}</strong>
                <a className={styles.smallButton} href={heroListing ? `/listings/${heroListing.id}` : "/listings"}>
                  View deal
                </a>
              </div>
            </div>
            <div className={styles.miniStats}>
              <div className={styles.miniStat}>
                <strong className={styles.miniStatValue}>{categories.length}</strong>
                <span className={styles.miniStatLabel}>Categories</span>
              </div>
              <div className={styles.miniStat}>
                <strong className={styles.miniStatValue}>Fast</strong>
                <span className={styles.miniStatLabel}>Posting</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="categories-title">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Explore categories</p>
            <h2 className={styles.sectionTitle} id="categories-title">
            Start with categories that make sense to first-time shoppers.
          </h2>
        </div>
        <div className={styles.categoryGrid}>
          {categories.map((category) => (
            <a className={`${styles.categoryCard} ${styles[category.tone]}`} href={`/listings?category=${encodeURIComponent(category.label)}`} key={category.label}>
              <span className={styles.categoryIcon}>{category.icon}</span>
              <strong className={styles.categoryTitle}>{category.label}</strong>
              <span className={styles.categoryDescription}>{category.description}</span>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="featured-title">
        <div className={styles.sectionHeaderRow}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Featured listings</p>
            <h2 className={styles.sectionTitle} id="featured-title">
              Good finds around campus.
            </h2>
          </div>
          <a className={styles.sectionButton} href="/listings">
            See all listings
          </a>
        </div>
        <div className={styles.featuredGrid}>
          {loadingListings ? (
            Array.from({ length: 3 }, (_, index) => (
              <div className={styles.featuredSkeleton} key={index} aria-hidden="true">
                <span />
                <strong />
                <p />
                <p />
              </div>
            ))
          ) : listingError ? (
            <div className={styles.emptyFeatured}>
              <h3>Listings could not load</h3>
              <p>{listingError}</p>
              <a className={styles.sectionButton} href="/listings">
                Try Browse
              </a>
            </div>
          ) : featuredListings.length > 0 ? (
            featuredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} href={`/listings/${listing.id}`} featuredLabel="Featured" />
            ))
          ) : (
            <div className={styles.emptyFeatured}>
              <h3>No live listings yet</h3>
              <p>Be the first seller on 505 Market. Your newest listing will show up here automatically.</p>
              <a className={styles.sectionButton} href="/sell">
                Sell an item
              </a>
            </div>
          )}
        </div>
      </section>

      <section className={styles.howSection} aria-labelledby="how-title">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>How it works</p>
          <h2 className={styles.sectionTitle} id="how-title">
            Simple enough to use between classes.
          </h2>
        </div>
        <div className={styles.stepGrid}>
          {steps.map((item) => (
            <article className={styles.stepCard} key={item.title}>
              <span className={styles.stepNumber}>{item.step}</span>
              <strong className={styles.stepTitle}>{item.title}</strong>
              <p className={styles.stepText}>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection} aria-labelledby="cta-title">
        <div className={styles.ctaCard}>
          <div className={styles.ctaCopy}>
            <p className={styles.sectionEyebrow}>Ready when you are</p>
            <h2 className={styles.ctaTitle} id="cta-title">
              Post your first listing or browse what students near UNM are selling today.
            </h2>
          </div>
          <div className={styles.ctaActions}>
            <a className={styles.primaryButton} href="/sell">
              Sell an item
            </a>
            <a className={styles.secondaryButton} href="/listings">
              Browse listings
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
