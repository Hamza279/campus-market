export interface Listing {
  id: string;
  title: string;
  price: string;
  location: string;
  condition: string;
  category: string;
  description: string;
  image: string;
  imageUrl: string;
  imageKey: string;
  thumbnailUrl: string;
  thumbnailKey: string;
  sold: boolean;
  status: "active" | "sold" | "draft";
  isSeeded: boolean;
  ownerId: string;
  sellerId: string;
  sellerEmail: string;
  sellerName: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ListingPayload {
  title: string;
  price: string;
  location: string;
  condition: string;
  category?: string;
  description: string;
  image: string;
  imageUrl?: string;
  imageKey?: string;
  thumbnailUrl?: string;
  thumbnailKey?: string;
  status?: "active" | "sold" | "draft";
}

const API_BASE = "/api/listings";
const SAVED_API_BASE = "/api/saved-listings";

const logFetchRequest = (method: string, url: string) => {
  console.info("[listings.data] fetch", { method, url });
};

const fetchWithDebug = async (url: string, init: RequestInit): Promise<Response> => {
  const method = init.method ?? "GET";
  logFetchRequest(method, url);

  try {
    return await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch failure";
    throw new Error(`Network error during ${method} ${url}: ${message}`);
  }
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = "Request failed";
    const responseText = await response.text();

    console.error("[listings.data] fetch failed", {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    });

    try {
      const data = JSON.parse(responseText) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      message = responseText || `${response.status} ${response.statusText}`.trim() || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const fetchLatestRealtimeDebugEvent = async (): Promise<{
  event: import("./listings.realtime").NewListingEvent | null;
}> => {
  const url = "/api/dev/realtime-event";
  const response = await fetchWithDebug(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse<{ event: import("./listings.realtime").NewListingEvent | null }>(response);
};

export const isSessionListing = (item: Listing): boolean => {
  return !item.isSeeded;
};

export const getListings = async (options: { mine?: boolean } = {}): Promise<Listing[]> => {
  const url = options.mine ? `${API_BASE}?mine=1` : API_BASE;
  const response = await fetchWithDebug(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse<Listing[]>(response);
};

export const getListing = async (id: string): Promise<Listing | undefined> => {
  const url = `${API_BASE}/${id}`;
  const response = await fetchWithDebug(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return undefined;
  }

  return parseResponse<Listing>(response);
};

export const updateListing = async (listing: Listing): Promise<Listing | undefined> => {
  const url = `${API_BASE}/${listing.id}`;
  const response = await fetchWithDebug(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(listing),
  });

  if (response.status === 404) {
    return undefined;
  }

  return parseResponse<Listing>(response);
};

export const canManageListing = (item: Listing): boolean => {
  return Boolean(item.ownerId || item.sellerId || item.sellerEmail);
};

export const deleteListing = async (id: string): Promise<boolean> => {
  const url = `${API_BASE}/${id}`;
  const response = await fetchWithDebug(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return false;
  }

  await parseResponse<{ ok: boolean }>(response);
  return true;
};

export const addListing = async (listing: ListingPayload): Promise<Listing> => {
  const response = await fetchWithDebug(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(listing),
  });

  return parseResponse<Listing>(response);
};

export const getSavedListingIds = async (): Promise<string[]> => {
  const response = await fetchWithDebug(SAVED_API_BASE, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse<string[]>(response);
};

export const getSavedListings = async (): Promise<Listing[]> => {
  const response = await fetchWithDebug(`${SAVED_API_BASE}?includeListings=1`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse<Listing[]>(response);
};

export const saveListing = async (id: string): Promise<void> => {
  const response = await fetchWithDebug(SAVED_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ listingId: id }),
  });

  await parseResponse<{ ok: boolean }>(response);
};

export const unsaveListing = async (id: string): Promise<void> => {
  const response = await fetchWithDebug(`${SAVED_API_BASE}/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  await parseResponse<{ ok: boolean }>(response);
};

export const contactSeller = async (id: string, message: string): Promise<{ conversationId: string }> => {
  const url = `${API_BASE}/${id}/contact`;
  const response = await fetchWithDebug(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return parseResponse<{ conversationId: string }>(response);
};

export const reportListing = async (id: string, reason: string): Promise<void> => {
  const url = `${API_BASE}/${id}/report`;
  const response = await fetchWithDebug(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  await parseResponse<{ ok: boolean }>(response);
};

export interface UploadedListingImage {
  imageUrl: string;
  imageKey: string;
  thumbnailUrl: string;
  thumbnailKey: string;
}

export interface UploadListingImageOptions {
  file: File;
  thumbnail: Blob;
  onProgress?: (progress: number) => void;
}

export const uploadListingImage = ({ file, thumbnail, onProgress }: UploadListingImageOptions): Promise<UploadedListingImage> => {
  const formData = new FormData();
  formData.set("image", file);
  formData.set("thumbnail", thumbnail, "thumbnail.webp");

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/uploads/listing-image");
    request.setRequestHeader("Accept", "application/json");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onerror = () => reject(new Error("Image upload failed."));
    request.onload = () => {
      const responseText = request.responseText || "{}";
      if (request.status < 200 || request.status >= 300) {
        try {
          const data = JSON.parse(responseText) as { error?: string };
          reject(new Error(data.error || "Image upload failed."));
        } catch {
          reject(new Error(responseText || "Image upload failed."));
        }
        return;
      }

      try {
        resolve(JSON.parse(responseText) as UploadedListingImage);
      } catch {
        reject(new Error("Invalid upload response."));
      }
    };

    request.send(formData);
  });
};
