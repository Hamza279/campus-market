"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./listings.module.css";
import { getDisplayImageUrl } from "./image-url";
import { getListings, Listing } from "./listings.data";

type SortOption = "newest" | "price-asc" | "price-desc";
const PAGE_SIZE = 6;
const SAVED_STORAGE_KEY = "campus-market-saved-listings";

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
      try {
        const listings = await getListings();
        if (!cancelled) {
          setItems(listings);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load listings.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
        const searchable = `${item.title} ${item.description}`.toLowerCase();
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
        <a href="/sell" className={styles.actionButton}>
          Sell an Item
        </a>
      </header>

      {error ? <p>{error}</p> : null}

      <section className={styles.filters} aria-label="Listing filters">
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
          <p>Try a different search, price range, location, or condition.</p>
        </div>
      ) : null}

      <div className={styles.grid}>
        {visibleItems.map((item) => {
          const saved = savedIds.has(item.id);
          const imageUrl = getDisplayImageUrl(item.image);

          return (
            <article key={item.id} className={styles.card}>
              <a href={`/listings/${item.id}`} className={styles.cardLink}>
                <div className={styles.imageFrame}>
                  {imageUrl ? (
                    <img src={imageUrl} alt={item.title} className={styles.cardImage} loading="lazy" />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <span>Image</span>
                    </div>
                  )}
                </div>
              </a>
              <div className={styles.cardBody}>
                <div className={styles.cardHeader}>
                  <a href={`/listings/${item.id}`} className={styles.titleLink}>
                    <h2 className={styles.cardTitle}>{item.title}</h2>
                  </a>
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
                </div>

                <div className={styles.detailRow}>
                  <span className={styles.categoryBadge}>{item.category}</span>
                  <span className={styles.conditionBadge}>{item.condition}</span>
                  {item.sold ? <span className={styles.soldBadge}>Sold</span> : null}
                </div>

                <p className={styles.description}>{item.description}</p>

                <div className={styles.cardFooter}>
                  <div className={styles.listingDetails}>
                    <p className={styles.meta}>
                      <strong>Location:</strong> {item.location}
                    </p>
                    <p className={styles.meta}>
                      <strong>Seller:</strong> Campus User
                    </p>
                    <p className={styles.meta}>
                      <strong>Category:</strong> {item.category}
                    </p>
                    <p className={styles.postedDate}>{getPostedLabel(item)}</p>
                  </div>
                  <span className={styles.price}>{item.price}</span>
                </div>
              </div>
            </article>
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
