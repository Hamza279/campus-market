export interface ConversationSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: string;
  listingImage: string;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  otherParticipantName: string;
  latestMessage: string;
  latestSenderId: string;
  latestMessageAt: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: MarketplaceMessage[];
  currentUserId: string;
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const responseText = await response.text();
    let message = responseText || "Request failed.";
    try {
      const data = JSON.parse(responseText) as { error?: string };
      message = data.error || message;
    } catch {
      // Keep the raw response text when the body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const getConversations = async (): Promise<ConversationSummary[]> => {
  const response = await fetch("/api/messages", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse<ConversationSummary[]>(response);
};

export const getConversationDetail = async (conversationId: string): Promise<ConversationDetail> => {
  const response = await fetch(`/api/messages/${conversationId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse<ConversationDetail>(response);
};

export const sendConversationMessage = async (
  conversationId: string,
  message: string,
): Promise<MarketplaceMessage> => {
  const response = await fetch(`/api/messages/${conversationId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const data = await parseResponse<{ message: MarketplaceMessage }>(response);
  return data.message;
};
