export const LISTINGS_REALTIME_ROOM = "listings";
export const NEW_LISTING_EVENT_KEY = "new-listing";

export interface NewListingEvent {
  eventId: string;
  listingId: string;
  title: string;
  occurredAt: string;
}
