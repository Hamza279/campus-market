"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./dashboard.module.css";
import { ListingCard } from "@/app/shared/ListingCard";
import { canManageListing, deleteListing, getListings, Listing, updateListing } from "./listings.data";

type StatusFilter = "all" | "active" | "sold";

const parsePrice = (price: string): number => {
  const parsed = Number.parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAveragePrice = (items: Listing[]): string => {
  if (items.length === 0) {
    return "$0.00";
  }

  const total = items.reduce((sum, item) => sum + parsePrice(item.price), 0);
  return `$${(total / items.length).toFixed(2)}`;
};

export const Dashboard = () => {
  const [items, setItems] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<Listing | null>(null);

  const loadListings = useCallback(async () => {
    try {
      const listings = await getListings();
      setItems(listings);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard listings.");
    }
  }, []);

  useEffect(() => {
    void loadListings();

    const refreshInterval = window.setInterval(() => {
      void loadListings();
    }, 5000);

    const refreshOnFocus = () => {
      void loadListings();
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("pageshow", refreshOnFocus);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("pageshow", refreshOnFocus);
    };
  }, [loadListings]);

  const stats = useMemo(() => {
    const soldListings = items.filter((item) => item.sold);
    const activeListings = items.filter((item) => !item.sold);

    return {
      total: items.length,
      active: activeListings.length,
      sold: soldListings.length,
      averagePrice: formatAveragePrice(items),
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (normalizedSearch && !item.title.toLowerCase().includes(normalizedSearch)) {
        return false;
      }

      if (statusFilter === "active" && item.sold) {
        return false;
      }

      if (statusFilter === "sold" && !item.sold) {
        return false;
      }

      return true;
    });
  }, [items, searchQuery, statusFilter]);

  const handleMarkAsSold = async (id: string) => {
    const item = items.find((listing) => listing.id === id);
    if (!item) return;

    setSavingIds((current) => new Set(current).add(id));

    try {
      const updated = await updateListing({ ...item, sold: true });
      if (updated) {
        setItems((current) => current.map((listing) => (listing.id === id ? updated : listing)));
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update listing.");
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    const id = pendingDelete.id;
    setDeletingIds((current) => new Set(current).add(id));

    try {
      const deleted = await deleteListing(id);
      if (deleted) {
        setItems((current) => current.filter((listing) => listing.id !== id));
        setPendingDelete(null);
      } else {
        setError("Listing not found.");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete listing.");
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Seller Dashboard</h1>
          <p className={styles.subtitle}>Manage every posted listing from one control panel.</p>
        </div>
        <a href="/sell" className={styles.headerAction}>
          Add Listing
        </a>
      </header>
      {error ? <p className={styles.errorMessage}>{error}</p> : null}

      <section className={styles.statsGrid} aria-label="Listing summary">
        <article className={styles.statCard}>
          <span>Total listings</span>
          <strong>{stats.total}</strong>
        </article>
        <article className={styles.statCard}>
          <span>Active listings</span>
          <strong>{stats.active}</strong>
        </article>
        <article className={styles.statCard}>
          <span>Sold listings</span>
          <strong>{stats.sold}</strong>
        </article>
        <article className={styles.statCard}>
          <span>Average price</span>
          <strong>{stats.averagePrice}</strong>
        </article>
      </section>

      <section className={styles.toolbar} aria-label="Dashboard filters">
        <label className={styles.searchField}>
          <span>Search by title</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search listings"
          />
        </label>

        <label className={styles.statusField}>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">All listings</option>
            <option value="active">Active only</option>
            <option value="sold">Sold only</option>
          </select>
        </label>
      </section>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No listings yet</h2>
          <p>Create a listing from the Sell page and it will appear here.</p>
          <a href="/sell" className={styles.emptyAction}>
            Add your first listing
          </a>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>No listings match your filters</h2>
          <p>Try another title search or status filter.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredItems.map((item) => {
            const isSaving = savingIds.has(item.id);
            const isDeleting = deletingIds.has(item.id);
            const canManage = canManageListing(item);

            return (
              <ListingCard
                key={item.id}
                listing={item}
                href={`/listings/${item.id}`}
                variant="seller"
                statusLabel={item.sold ? "Sold" : "Active"}
                statusTone={item.sold ? "sold" : "active"}
                footerActions={
                  <div className={styles.actions}>
                    <a href={`/listings/${item.id}`} className={styles.button}>
                      View
                    </a>
                    <a
                      href={canManage ? `/edit/${item.id}` : "#"}
                      className={canManage ? styles.secondaryButton : `${styles.secondaryButton} ${styles.disabledLink}`}
                      aria-disabled={!canManage}
                    >
                      Edit
                    </a>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleMarkAsSold(item.id)}
                      disabled={!canManage || item.sold || isSaving || isDeleting}
                    >
                      {isSaving ? "Saving..." : item.sold ? "Sold" : "Mark as Sold"}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => setPendingDelete(item)}
                      disabled={!canManage || isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {pendingDelete ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete listing?</h2>
            <p>
              This will permanently remove <strong>{pendingDelete.title}</strong> from the dashboard and browse page.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setPendingDelete(null)}
                disabled={deletingIds.has(pendingDelete.id)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={() => void handleConfirmDelete()}
                disabled={deletingIds.has(pendingDelete.id)}
              >
                {deletingIds.has(pendingDelete.id) ? "Deleting..." : "Delete listing"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
