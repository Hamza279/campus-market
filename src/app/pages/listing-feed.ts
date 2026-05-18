import { useCallback, useEffect, useRef, useState } from "react";
import { getListings, type Listing } from "./listings.data";

export const LISTING_FEED_PAGE_SIZE = 8;

const buildCursor = (listing: Listing) => {
  return `${listing.createdAt || ""}::${listing.id}`;
};

const dedupeListings = (items: Listing[]) => {
  const unique = new Map<string, Listing>();
  for (const item of items) {
    unique.set(item.id, item);
  }
  return Array.from(unique.values()).sort((a, b) => {
    const timeDiff = (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return b.id.localeCompare(a.id);
  });
};

interface UseListingFeedOptions {
  pageSize?: number;
  mine?: boolean;
  enabled?: boolean;
}

export const useListingFeed = ({ pageSize = LISTING_FEED_PAGE_SIZE, mine = false, enabled = true }: UseListingFeedOptions = {}) => {
  const [items, setItems] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | undefined>(undefined);
  const requestIdRef = useRef(0);

  const loadPage = useCallback(
    async (reset = false) => {
      const requestId = ++requestIdRef.current;
      if (reset) {
        cursorRef.current = undefined;
        setItems([]);
        setHasMore(true);
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const page = await getListings({
          mine,
          limit: pageSize,
          cursor: cursorRef.current,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setItems((current) => (reset ? page : dedupeListings([...current, ...page])));
        setHasMore(page.length === pageSize);
        cursorRef.current = page.length > 0 ? buildCursor(page[page.length - 1]) : cursorRef.current;
        setError(null);
      } catch (loadError) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load listings.");
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [mine, pageSize],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void loadPage(true);
  }, [enabled, loadPage]);

  const refresh = useCallback(() => {
    void loadPage(true);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore) {
      return;
    }

    void loadPage(false);
  }, [hasMore, isLoading, isLoadingMore, loadPage]);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    setItems: (next: Listing[]) => setItems(dedupeListings(next)),
  };
};
