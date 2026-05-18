import type { Listing } from "./listings.data";

const STORAGE_KEY = "505-market-recently-viewed";
const MAX_ITEMS = 8;

type RecentlyViewedEntry = {
  id: string;
  title: string;
  imageUrl: string;
  price: string;
  location: string;
  category: string;
  viewedAt: string;
};

const readStorage = (): RecentlyViewedEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const candidate = item as Partial<RecentlyViewedEntry>;
        if (!candidate.id || !candidate.title) {
          return null;
        }

        return {
          id: candidate.id,
          title: candidate.title,
          imageUrl: candidate.imageUrl || "",
          price: candidate.price || "",
          location: candidate.location || "",
          category: candidate.category || "",
          viewedAt: candidate.viewedAt || new Date().toISOString(),
        };
      })
      .filter((item): item is RecentlyViewedEntry => Boolean(item));
  } catch {
    return [];
  }
};

const writeStorage = (entries: RecentlyViewedEntry[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
  } catch {
    // Best-effort browser enhancement.
  }
};

export const recordRecentlyViewedListing = (listing: Listing) => {
  const entries = readStorage().filter((item) => item.id !== listing.id);
  entries.unshift({
    id: listing.id,
    title: listing.title,
    imageUrl: listing.thumbnailUrl || listing.imageUrl || listing.image,
    price: listing.price,
    location: listing.meetupArea || listing.location,
    category: listing.category,
    viewedAt: new Date().toISOString(),
  });

  writeStorage(entries);
};

export const getRecentlyViewedListingIds = (): string[] => {
  return readStorage().map((entry) => entry.id);
};

export const getRecentlyViewedListings = (listings: Listing[], limit = MAX_ITEMS): Listing[] => {
  const ids = getRecentlyViewedListingIds();
  const lookup = new Map(listings.map((listing) => [listing.id, listing]));
  return ids.map((id) => lookup.get(id)).filter((listing): listing is Listing => Boolean(listing)).slice(0, limit);
};

