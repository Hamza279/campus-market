"use server";

import { requestInfo } from "rwsdk/worker";
import type { Listing } from "./listings.data";

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

export const createListing = async (listing: ListingPayload): Promise<Listing> => {
  const apiUrl = new URL("/api/listings", requestInfo.request.url);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: requestInfo.request.headers.get("Cookie") ?? "",
    },
    body: JSON.stringify(listing),
  });

  return parseResponse<Listing>(response);
};
