"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initSyncedStateClient, useSyncedState } from "rwsdk/use-synced-state/client";
import styles from "./listings.module.css";
import { ListingCard } from "@/app/shared/ListingCard";
import { useListingFeed } from "./listing-feed";
import { getSavedListingIds, Listing, saveListing, unsaveListing } from "./listings.data";
import { LISTINGS_REALTIME_ROOM, NEW_LISTING_EVENT_KEY, type NewListingEvent } from "./listings.realtime";

type SortOption = "newest" | "price-asc" | "price-desc";
const SAVED_STORAGE_KEY = "campus-market-saved-listings";
const MAX_PROCESSED_EVENT_IDS = 100;

const parsePrice = (price: string): number => {
  const parsed = Number.parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getListingTime = (listing: Listing): number => {
  const timestamp = listing.createdAt ? Date.parse(listing.createdAt) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getPostedLabel = (listing: Listing): string => {
  const timestamp = getListingTime(listing);
  if (!timestamp) {
    return "Posted recently";
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedDays = Math.floor(elapsedMs / 86400000);

  if (elapsedDays <= 0) {
    return "Posted today";
  }

  if (elapsedDays === 1) {
    return "Posted 1 day ago";
  }

  if (elapsedDays < 14) {
    return `Posted ${elapsedDays} days ago`;
  }

  return `Posted ${new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
};

export const Listings = () => {
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [hideSold, setHideSold] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [savedMode, setSavedMode] = useState<"server" | "local">("local");
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const [flashSavedIds, setFlashSavedIds] = useState<Set<string>>(() => new Set());
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [listingEvent] = useSyncedState<NewListingEvent | null>(null, NEW_LISTING_EVENT_KEY, LISTINGS_REALTIME_ROOM);
  const processedEventIdsRef = useRef<string[]>([]);
  const mountedAtRef = useRef(Date.now());
  const toastTimeoutRef = useRef<number | null>(null);
  const highlightTimeoutsRef = useRef<Map<string, number>>(new Map());
  const flashTimeoutsRef = useRef<Map<string, number>>(new Map());
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { items, isLoading, isLoadingMore, hasMore, error: feedError, loadMore, refresh } = useListingFeed({ pageSize: 8 });

  const showNewListingToast = useCallback(() => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage("New item just posted");
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  const highlightListing = useCallback((listingId: string) => {
    setHighlightedIds((current) => {
      const next = new Set(current);
      next.add(listingId);
      return next;
    });

    const existingTimeout = highlightTimeoutsRef.current.get(listingId);
    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout);
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedIds((current) => {
        if (!current.has(listingId)) {
          return current;
        }

        const next = new Set(current);
        next.delete(listingId);
        return next;
      });
      highlightTimeoutsRef.current.delete(listingId);
    }, 3000);

    highlightTimeoutsRef.current.set(listingId, timeoutId);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialCategory = params.get("category");
    const initialSearch = params.get("q");

    if (initialCategory) {
      setCategoryFilter(initialCategory);
    }

    if (initialSearch) {
      setSearchQuery(initialSearch);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const saved = await getSavedListingIds();
        if (!cancelled) {
          setSavedIds(new Set(saved));
          setSavedMode("server");
        }
      } catch {
        if (cancelled) {
          return;
        }

        try {
          const saved = window.localStorage.getItem(SAVED_STORAGE_KEY);
          setSavedIds(saved ? new Set(JSON.parse(saved) as string[]) : new Set());
        } catch {
          setSavedIds(new Set());
        }
        setSavedMode("local");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (savedMode !== "local") {
      return;
    }

    try {
      window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(Array.from(savedIds)));
    } catch {
      // Local storage is a best-effort browser enhancement.
    }
  }, [savedIds, savedMode]);

  const toggleSavedListing = useCallback(
    (item: Listing) => {
      const wasSaved = savedIds.has(item.id);
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
      setFlashSavedIds((current) => new Set(current).add(item.id));

      const existingTimeout = flashTimeoutsRef.current.get(item.id);
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
      }

      flashTimeoutsRef.current.set(
        item.id,
        window.setTimeout(() => {
          setFlashSavedIds((current) => {
            if (!current.has(item.id)) {
              return current;
            }

            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
          flashTimeoutsRef.current.delete(item.id);
        }, 220),
      );

      if (savedMode !== "server") {
        return;
      }

      void (async () => {
        try {
          if (wasSaved) {
            await unsaveListing(item.id);
          } else {
            await saveListing(item.id);
          }
        } catch (saveError) {
          setSavedIds((current) => {
            const next = new Set(current);
            if (wasSaved) {
              next.add(item.id);
            } else {
              next.delete(item.id);
            }
            return next;
          });
          setError(saveError instanceof Error ? saveError.message : "Failed to update saved listing.");
        }
      })();
    },
    [savedIds, savedMode],
  );

  useEffect(() => {
    const refreshOnReturn = () => {
      refresh();
    };

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
    };
  }, [refresh]);

  useEffect(() => {
    let disposed = false;

    const verifyRealtimeConnection = async () => {
      try {
        const client = initSyncedStateClient({
          endpoint: `/__synced-state/${LISTINGS_REALTIME_ROOM}`,
        });

        if (!client) {
          if (!disposed) {
            setIsRealtimeConnected(false);
          }
          return;
        }

        await client.getState(NEW_LISTING_EVENT_KEY);
        if (!disposed) {
          setIsRealtimeConnected(true);
        }
      } catch (error) {
        console.warn("[realtime:listings] connection check failed", error);
        if (!disposed) {
          setIsRealtimeConnected(false);
        }
      }
    };

    void verifyRealtimeConnection();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }

      highlightTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      highlightTimeoutsRef.current.clear();

      flashTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      flashTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!listingEvent) {
      return;
    }

    console.info("[realtime:listings] received event", listingEvent);

    if (processedEventIdsRef.current.includes(listingEvent.eventId)) {
      return;
    }

    const eventTime = Date.parse(listingEvent.occurredAt);
    const isFreshEvent = Number.isFinite(eventTime) && eventTime >= mountedAtRef.current - 1500;
    const isFirstObservedEvent = processedEventIdsRef.current.length === 0;

    processedEventIdsRef.current.push(listingEvent.eventId);
    if (processedEventIdsRef.current.length > MAX_PROCESSED_EVENT_IDS) {
      processedEventIdsRef.current.shift();
    }

    if (isFirstObservedEvent && !isFreshEvent) {
      return;
    }

    setIsRealtimeConnected(true);
    showNewListingToast();
    highlightListing(listingEvent.listingId);
    refresh();
  }, [highlightListing, listingEvent, refresh, showNewListingToast]);

  const locations = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.location).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [items]);

  const conditions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.condition).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [items]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [items]);

  const nearbyLocations = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.meetupArea || item.location).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const min = minPrice.trim() === "" ? null : Number.parseFloat(minPrice);
    const max = maxPrice.trim() === "" ? null : Number.parseFloat(maxPrice);

    return items
      .filter((item) => {
        const searchable = `${item.title} ${item.description} ${item.category} ${item.condition} ${item.location} ${item.meetupArea} ${item.sellerName}`.toLowerCase();
        const itemPrice = parsePrice(item.price);

        if (normalizedSearch && !searchable.includes(normalizedSearch)) {
          return false;
        }

        if (locationFilter && item.location !== locationFilter && item.meetupArea !== locationFilter) {
          return false;
        }

        if (conditionFilter && item.condition !== conditionFilter) {
          return false;
        }

        if (categoryFilter && item.category !== categoryFilter) {
          return false;
        }

        if (min !== null && Number.isFinite(min) && itemPrice < min) {
          return false;
        }

        if (max !== null && Number.isFinite(max) && itemPrice > max) {
          return false;
        }

        if (hideSold && item.sold) {
          return false;
        }

        if (showSavedOnly && !savedIds.has(item.id)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "price-asc") {
          return parsePrice(a.price) - parsePrice(b.price);
        }

        if (sortOption === "price-desc") {
          return parsePrice(b.price) - parsePrice(a.price);
        }

        return getListingTime(b) - getListingTime(a);
      });
  }, [
    categoryFilter,
    conditionFilter,
    hideSold,
    items,
    locationFilter,
    maxPrice,
    minPrice,
    savedIds,
    searchQuery,
    showSavedOnly,
    sortOption,
  ]);

  const activeListings = items.filter((item) => !item.sold);
  const featuredItems = activeListings.slice(0, 3);
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: "450px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  useEffect(() => {
    if (!isLoading && filteredItems.length === 0 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [filteredItems.length, hasMore, isLoading, isLoadingMore, loadMore]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Browse 505 Market</p>
          <h1>Find local listings fast</h1>
          <p className={styles.subtitle}>Search by item, filter by category or location, and quickly scan the details that matter most.</p>
        </div>
        <div className={styles.headerActions}>
          <span
            className={isRealtimeConnected ? styles.connectionBadgeConnected : styles.connectionBadgePending}
            role="status"
            aria-live="polite"
          >
            {isRealtimeConnected ? "Connected to realtime" : "Connecting to realtime..."}
          </span>
          <a href="/sell" className={styles.actionButton}>
            Sell an item
          </a>
        </div>
      </header>

      {toastMessage ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}

      <section className={styles.marketOverview} aria-label="Marketplace overview">
        <article>
          <span>Live listings</span>
          <strong>{activeListings.length}</strong>
        </article>
        <article>
          <span>Categories</span>
          <strong>{categories.length || "-"}</strong>
        </article>
        <article>
          <span>Saved</span>
          <strong>{savedIds.size}</strong>
        </article>
      </section>

      {featuredItems.length > 0 ? (
        <section className={styles.featuredStrip} aria-labelledby="featured-listings-title">
          <div className={styles.featuredStripHeader}>
            <p className={styles.eyebrow}>Featured now</p>
            <h2 id="featured-listings-title">Recently posted picks</h2>
          </div>
          <div className={styles.featuredMiniGrid}>
            {featuredItems.map((item) => (
              <a href={`/listings/${item.id}`} className={styles.featuredMiniCard} key={item.id}>
                <span>{item.category}</span>
                <strong>{item.title}</strong>
                <em>{item.price}</em>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {error || feedError ? <p className={styles.errorMessage}>{error ?? feedError}</p> : null}

      {categories.length > 0 ? (
        <section className={styles.categoryChipsSection} aria-label="Browse by category">
          <div className={styles.categoryChips}>
            <button
              type="button"
              className={!categoryFilter ? `${styles.categoryChip} ${styles.categoryChipActive}` : styles.categoryChip}
              onClick={() => setCategoryFilter("")}
            >
              For you
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={categoryFilter === category ? `${styles.categoryChip} ${styles.categoryChipActive}` : styles.categoryChip}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {nearbyLocations.length > 0 ? (
        <section className={styles.categoryChipsSection} aria-label="Nearby meetup areas">
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>Nearby areas</p>
              <h2 className={styles.sectionTitle}>Filter by meetup area.</h2>
            </div>
          </div>
          <div className={styles.categoryChips}>
            <button
              type="button"
              className={!locationFilter ? `${styles.categoryChip} ${styles.categoryChipActive}` : styles.categoryChip}
              onClick={() => setLocationFilter("")}
            >
              Anywhere
            </button>
            {nearbyLocations.map((location) => (
              <button
                type="button"
                key={location}
                className={locationFilter === location ? `${styles.categoryChip} ${styles.categoryChipActive}` : styles.categoryChip}
                onClick={() => setLocationFilter(location)}
              >
                {location}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.filters} aria-label="Listing filters">
        <div className={styles.filtersHeader}>
          <div>
            <h2>Find the right item</h2>
            <p>Use simple filters to narrow by category, location, price, and condition. Everything updates as you go.</p>
          </div>
        </div>

        <div className={styles.searchRow}>
          <label className={styles.field}>
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search textbooks, bikes, couches, calculators..."
            />
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={hideSold}
              onChange={(event) => setHideSold(event.target.checked)}
            />
            <span>Hide sold items</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showSavedOnly}
              onChange={(event) => setShowSavedOnly(event.target.checked)}
            />
            <span>Saved only</span>
          </label>
        </div>

        <div className={styles.filterGrid}>
          <label className={styles.field}>
            <span>Location</span>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Condition</span>
            <select value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)}>
              <option value="">All conditions</option>
              {conditions.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Min price</span>
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="0"
            />
          </label>

          <label className={styles.field}>
            <span>Max price</span>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="100"
            />
          </label>

          <label className={styles.field}>
            <span>Sort</span>
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
              <option value="newest">Newest</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
            </select>
          </label>
        </div>
      </section>

      {isLoading ? (
        <div className={styles.grid} aria-label="Loading listings">
          {Array.from({ length: 6 }, (_, index) => (
            <div className={styles.skeletonCard} key={index} aria-hidden="true">
              <span />
              <strong />
              <p />
              <p />
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No listings match those filters</h2>
          <p>Try widening your search or clear a few filters. New listings appear here automatically when sellers post them.</p>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              setSearchQuery("");
              setLocationFilter("");
              setConditionFilter("");
              setCategoryFilter("");
              setMinPrice("");
              setMaxPrice("");
              setHideSold(false);
              setShowSavedOnly(false);
              setSortOption("newest");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredItems.map((item, index) => {
            const saved = savedIds.has(item.id);

            return (
              <ListingCard
                key={item.id}
                listing={item}
                href={`/listings/${item.id}`}
                postedLabel={getPostedLabel(item)}
                highlighted={highlightedIds.has(item.id)}
                featuredLabel={index < 3 && !item.sold ? "Featured" : undefined}
                topAction={
                  <button
                    type="button"
                    className={
                      saved
                        ? `${styles.saveButton} ${styles.saveButtonActive} ${flashSavedIds.has(item.id) ? styles.saveButtonFlash : ""}`
                        : flashSavedIds.has(item.id)
                          ? `${styles.saveButton} ${styles.saveButtonFlash}`
                          : styles.saveButton
                    }
                    aria-pressed={saved}
                    aria-label={saved ? `Unsave ${item.title}` : `Save ${item.title}`}
                    onClick={() => toggleSavedListing(item)}
                  >
                    {saved ? "Saved" : "Save"}
                  </button>
                }
                footerActions={
                  <div className={styles.cardActions}>
                    <a href={`/listings/${item.id}`} className={styles.cardActionLink}>
                      View details
                    </a>
                    <a href={`/listings/${item.id}#contact-seller`} className={styles.cardContactLink}>
                      Contact seller
                    </a>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      <div ref={loadMoreRef} className={styles.feedSentinel} aria-hidden="true" />
      {isLoadingMore ? <p className={styles.feedStatus}>Loading more listings…</p> : null}
    </div>
  );
};
