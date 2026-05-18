export interface MarketplaceProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  bio: string;
  campusAffiliation: string;
  neighborhood: string;
  meetupLocation: string;
  responseTime: string;
  interests: string;
  contactPreference: string;
  hasCustomProfile: boolean;
}

export interface MarketplaceProfilePayload {
  name: string;
  avatarUrl: string;
  bio: string;
  campusAffiliation: string;
  neighborhood: string;
  meetupLocation: string;
  responseTime: string;
  interests: string;
  contactPreference: string;
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    let message = text || "Request failed.";
    try {
      const data = JSON.parse(text) as { error?: string };
      message = data.error || message;
    } catch {
      // Keep raw response text.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const getMyProfile = async (): Promise<MarketplaceProfile> => {
  const response = await fetch("/api/profile", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  return parseResponse<MarketplaceProfile>(response);
};

export const updateMyProfile = async (profile: MarketplaceProfilePayload): Promise<MarketplaceProfile> => {
  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(profile),
  });

  return parseResponse<MarketplaceProfile>(response);
};

export const getPublicProfile = async (id: string): Promise<MarketplaceProfile> => {
  const response = await fetch(`/api/profile/${id}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  return parseResponse<MarketplaceProfile>(response);
};
