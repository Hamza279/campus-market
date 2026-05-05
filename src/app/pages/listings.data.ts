export interface Listing {
  id: string;
  title: string;
  price: string;
  location: string;
  condition: string;
  category: string;
  description: string;
  image: string;
  sold: boolean;
  isSeeded: boolean;
  ownerId: string;
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
}

const API_BASE = "/api/listings";

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
  return !item.isSeeded;
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

export const contactSeller = async (id: string, message: string): Promise<void> => {
  const url = `${API_BASE}/${id}/contact`;
  const response = await fetchWithDebug(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ message }),
  });

  await parseResponse<{ ok: boolean }>(response);
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
