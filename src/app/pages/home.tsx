"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";
import { ListingCard } from "@/app/shared/ListingCard";
import styles from "./home.module.css";
import { getListingImageSrc } from "./image-url";
import { LISTING_FEED_PAGE_SIZE, useListingFeed } from "./listing-feed";
import { getRecentlyViewedListings } from "./recently-viewed";
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

const getListingTime = (createdAt?: string) => {
  const timestamp = createdAt ? Date.parse(createdAt) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getPostedLabel = (createdAt?: string): string => {
  const timestamp = getListingTime(createdAt);
  if (!timestamp) {
    return "Recently listed";
  }

  const elapsedDays = Math.floor((Date.now() - timestamp) / 86400000);
  if (elapsedDays <= 0) {
    return "Listed today";
  }

  if (elapsedDays === 1) {
    return "Listed yesterday";
  }

  return `Listed ${elapsedDays} days ago`;
};

export const Home = () => {
  const { items, isLoading, isLoadingMore, error, loadMore, hasMore, refresh } = useListingFeed({ pageSize: LISTING_FEED_PAGE_SIZE });
  const [listingEvent] = useSyncedState<NewListingEvent | null>(null, NEW_LISTING_EVENT_KEY, LISTINGS_REALTIME_ROOM);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listingEvent) {
      refresh();
    }
  }, [listingEvent, refresh]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  const activeListings = useMemo(() => items.filter((listing) => !listing.sold), [items]);
  const heroListing = activeListings[0] ?? items[0];
  const heroListingImage = getListingImageSrc(heroListing?.galleryUrls[0] || heroListing?.thumbnailUrl || heroListing?.imageUrl || heroListing?.image || "");
  const featuredListings = activeListings.slice(0, 6);
  const trendingCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of activeListings) {
      counts.set(listing.category, (counts.get(listing.category) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
  }, [activeListings]);
  const recentlyViewedListings = useMemo(() => getRecentlyViewedListings(items), [items]);

  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Simple local student marketplace</p>
            <h1 className={styles.heroTitle}>The easiest way to buy and sell around campus.</h1>
            <p className={styles.heroText}>
              505 Market helps UNM students and nearby neighbors post items fast, message safely, and meet in familiar places without guessing how the app works.
            </p>
            <div className={styles.heroHighlights}>
              <span>Post in minutes</span>
              <span>Message real local sellers</span>
              <span>Meet on or near campus</span>
            </div>
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
            <div className={styles.heroListing}>
              <img src={heroListingImage} alt={heroListing?.title ?? "Featured 505 Market listing"} className={styles.heroListingImage} />
              <span className={styles.heroListingOverlay} />
              <span className={styles.heroListingTag}>{heroListing?.category ?? "Fresh listings"}</span>
              <span className={styles.heroListingStatus}>{heroListing ? getPostedLabel(heroListing.createdAt) : "New seller posts appear here"}</span>
              <strong className={styles.heroListingTitle}>{heroListing?.title ?? "New campus finds"}</strong>
              <span className={styles.heroListingMeta}>
                {heroListing ? `${heroListing.meetupArea || heroListing.location} - ${heroListing.condition}` : "Browse student-posted items"}
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
                <strong className={styles.miniStatValue}>{featuredListings.length || LISTING_FEED_PAGE_SIZE}</strong>
                <span className={styles.miniStatLabel}>Fresh items</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.trustSection} aria-labelledby="trust-title">
        <div className={styles.trustCard}>
          <div>
            <p className={styles.sectionEyebrow}>Trust and safety</p>
            <h2 className={styles.trustTitle} id="trust-title">
              Meet safely and keep it simple.
            </h2>
            <p className={styles.trustText}>
              Start with messages in 505 Market, choose a public meetup spot, and confirm the item details before you head out.
            </p>
          </div>
          <div className={styles.trustChecklist}>
            <span>Use a public campus or neighborhood meetup spot</span>
            <span>Ask questions before you meet</span>
            <span>Inspect the item before paying</span>
          </div>
        </div>
      </section>

      {trendingCategories.length > 0 ? (
        <section className={styles.section} aria-labelledby="trending-title">
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Trending now</p>
              <h2 className={styles.sectionTitle} id="trending-title">
                Popular categories from recent posts.
              </h2>
            </div>
            <a className={styles.sectionButton} href="/listings">
              Browse all
            </a>
          </div>
          <div className={styles.trendingRow}>
            {trendingCategories.map((category) => (
              <a key={category.label} className={styles.trendingCard} href={`/listings?category=${encodeURIComponent(category.label)}`}>
                <strong>{category.label}</strong>
                <span>{category.count} live listings</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

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

      {recentlyViewedListings.length > 0 ? (
        <section className={styles.section} aria-labelledby="recently-viewed-title">
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Recently viewed</p>
              <h2 className={styles.sectionTitle} id="recently-viewed-title">
                Pick up where you left off.
              </h2>
            </div>
            <a className={styles.sectionButton} href="/listings">
              Browse more
            </a>
          </div>
          <div className={styles.featuredGrid}>
            {recentlyViewedListings.slice(0, 3).map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={`/listings/${listing.id}`}
                featuredLabel="Viewed recently"
                postedLabel={getPostedLabel(listing.createdAt)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="featured-title">
        <div className={styles.sectionHeaderRow}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Latest listings</p>
            <h2 className={styles.sectionTitle} id="featured-title">
              Good finds around campus.
            </h2>
          </div>
          <a className={styles.sectionButton} href="/listings">
            See all listings
          </a>
        </div>
        <div className={styles.featuredGrid}>
          {isLoading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div className={styles.featuredSkeleton} key={index} aria-hidden="true">
                <span />
                <strong />
                <p />
                <p />
              </div>
            ))
          ) : error ? (
            <div className={styles.emptyFeatured}>
              <h3>Listings could not load</h3>
              <p>{error}</p>
              <a className={styles.sectionButton} href="/listings">
                Try Browse
              </a>
            </div>
          ) : featuredListings.length > 0 ? (
            featuredListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={`/listings/${listing.id}`}
                featuredLabel="Fresh listing"
                postedLabel={getPostedLabel(listing.createdAt)}
              />
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
        <div ref={loadMoreRef} className={styles.feedSentinel} aria-hidden="true" />
        {isLoadingMore ? <p className={styles.feedStatus}>Loading more listings…</p> : null}
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
