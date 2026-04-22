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
const CURRENT_USER_ID = "campus-user";
const CURRENT_USER_ROLE = "admin";

const authHeaders = {
  "X-Campus-User-Id": CURRENT_USER_ID,
  "X-Campus-User-Role": CURRENT_USER_ROLE,
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = "Request failed";

    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      message = `${response.status} ${response.statusText}`.trim() || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const isSessionListing = (item: Listing): boolean => {
  return !item.isSeeded;
};

export const getListings = async (): Promise<Listing[]> => {
  const response = await fetch(API_BASE, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse<Listing[]>(response);
};

export const getListing = async (id: string): Promise<Listing | undefined> => {
  const response = await fetch(`${API_BASE}/${id}`, {
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
  const response = await fetch(`${API_BASE}/${listing.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(listing),
  });

  if (response.status === 404) {
    return undefined;
  }

  return parseResponse<Listing>(response);
};

export const canManageListing = (item: Listing): boolean => {
  return CURRENT_USER_ROLE === "admin" || item.ownerId === CURRENT_USER_ID;
};

export const deleteListing = async (id: string): Promise<boolean> => {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...authHeaders,
    },
  });

  if (response.status === 404) {
    return false;
  }

  await parseResponse<{ ok: boolean }>(response);
  return true;
};

export const addListing = async (listing: ListingPayload): Promise<Listing> => {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(listing),
  });

  return parseResponse<Listing>(response);
};

export const contactSeller = async (id: string, message: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/${id}/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ message }),
  });

  await parseResponse<{ ok: boolean }>(response);
};

export const reportListing = async (id: string, reason: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/${id}/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ reason }),
  });

  await parseResponse<{ ok: boolean }>(response);
};
