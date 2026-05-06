"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initSyncedStateClient, useSyncedState } from "rwsdk/use-synced-state/client";
import styles from "./listings.module.css";
import { ListingCard } from "@/app/shared/ListingCard";
import { getListings, Listing } from "./listings.data";
import { LISTINGS_REALTIME_ROOM, NEW_LISTING_EVENT_KEY, type NewListingEvent } from "./listings.realtime";

type SortOption = "newest" | "price-asc" | "price-desc";
const PAGE_SIZE = 6;
const SAVED_STORAGE_KEY = "campus-market-saved-listings";
const MAX_PROCESSED_EVENT_IDS = 100;

const dedupeAndSortListings = (listings: Listing[]): Listing[] => {
  const uniqueListings = new Map<string, Listing>();

  for (const listing of listings) {
    const existing = uniqueListings.get(listing.id);
    if (!existing || getListingTime(listing) >= getListingTime(existing)) {
      uniqueListings.set(listing.id, listing);
    }
  }

  return Array.from(uniqueListings.values()).sort((a, b) => {
    const timeDifference = getListingTime(b) - getListingTime(a);
    if (timeDifference !== 0) {
      return timeDifference;
    }

    return b.id.localeCompare(a.id);
  });
};

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
  const [items, setItems] = useState<Listing[]>([]);
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [listingEvent] = useSyncedState<NewListingEvent | null>(null, NEW_LISTING_EVENT_KEY, LISTINGS_REALTIME_ROOM);
  const processedEventIdsRef = useRef<string[]>([]);
  const mountedAtRef = useRef(Date.now());
  const toastTimeoutRef = useRef<number | null>(null);
  const highlightTimeoutsRef = useRef<Map<string, number>>(new Map());

  const loadListings = useCallback(async () => {
    try {
      const listings = await getListings();
      setItems(dedupeAndSortListings(listings));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load listings.");
    }
  }, []);

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
    try {
      const saved = window.localStorage.getItem(SAVED_STORAGE_KEY);
      if (saved) {
        setSavedIds(new Set(JSON.parse(saved) as string[]));
      }
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(Array.from(savedIds)));
    } catch {
      // Local storage is a best-effort browser enhancement.
    }
  }, [savedIds]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!cancelled) {
        await loadListings();
      }
    })();

    const refreshOnReturn = () => {
      void loadListings();
    };

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
    };
  }, [loadListings]);

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
    void loadListings();
  }, [highlightListing, listingEvent, loadListings, showNewListingToast]);

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

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const min = minPrice.trim() === "" ? null : Number.parseFloat(minPrice);
    const max = maxPrice.trim() === "" ? null : Number.parseFloat(maxPrice);

    return items
      .filter((item) => {
        const searchable = `${item.title} ${item.description} ${item.category} ${item.condition} ${item.location} ${item.sellerName}`.toLowerCase();
        const itemPrice = parsePrice(item.price);

        if (normalizedSearch && !searchable.includes(normalizedSearch)) {
          return false;
        }

        if (locationFilter && item.location !== locationFilter) {
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

  const visibleItems = filteredItems.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [categoryFilter, conditionFilter, hideSold, locationFilter, maxPrice, minPrice, searchQuery, showSavedOnly, sortOption]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Campus Listings</h1>
          <p className={styles.subtitle}>Browse student-ready items nearby.</p>
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
            Sell an Item
          </a>
        </div>
      </header>

      {toastMessage ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}

      {error ? <p>{error}</p> : null}

      <section className={styles.filters} aria-label="Listing filters">
        <div className={styles.filtersHeader}>
          <div>
            <h2>Find the right item</h2>
            <p>Search by title, narrow by campus details, then sort the results.</p>
          </div>
        </div>

        <div className={styles.searchRow}>
          <label className={styles.field}>
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title or description"
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

      {filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No listings match your filters</h2>
          <p>Try clearing saved-only mode, widening your price range, or searching a different keyword.</p>
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
      ) : null}

      <div className={styles.grid}>
        {visibleItems.map((item) => {
          const saved = savedIds.has(item.id);

          return (
            <ListingCard
              key={item.id}
              listing={item}
              href={`/listings/${item.id}`}
              postedLabel={getPostedLabel(item)}
              highlighted={highlightedIds.has(item.id)}
              topAction={
                <button
                  type="button"
                  className={saved ? `${styles.saveButton} ${styles.saveButtonActive}` : styles.saveButton}
                  aria-pressed={saved}
                  aria-label={saved ? `Unsave ${item.title}` : `Save ${item.title}`}
                  onClick={() => {
                    setSavedIds((current) => {
                      const next = new Set(current);
                      if (next.has(item.id)) {
                        next.delete(item.id);
                      } else {
                        next.add(item.id);
                      }
                      return next;
                    });
                  }}
                >
                  {saved ? "Saved" : "Save"}
                </button>
              }
            />
          );
        })}
      </div>

      {visibleCount < filteredItems.length ? (
        <div className={styles.loadMoreRow}>
          <button type="button" className={styles.loadMoreButton} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
};
