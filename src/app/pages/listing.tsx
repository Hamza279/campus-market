"use client";

import { useEffect, useState } from "react";
import styles from "./listing.module.css";
import { getDisplayImageUrl } from "./image-url";
import { contactSeller, getListing, getListings, Listing, reportListing } from "./listings.data";

interface ListingDetailProps {
  listingId: string;
}

const getPostedLabel = (listing: Listing): string => {
  const timestamp = listing.createdAt ? Date.parse(listing.createdAt) : 0;
  if (!Number.isFinite(timestamp) || timestamp === 0) {
    return "Posted recently";
  }

  const elapsedDays = Math.floor((Date.now() - timestamp) / 86400000);
  if (elapsedDays <= 0) {
    return "Posted today";
  }
  if (elapsedDays === 1) {
    return "Posted 1 day ago";
  }
  if (elapsedDays < 14) {
    return `Posted ${elapsedDays} days ago`;
  }

  return `Posted ${new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
};

export const ListingDetail = ({ listingId }: ListingDetailProps) => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactMessage, setContactMessage] = useState("Hi, is this still available?");
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [item, listings] = await Promise.all([getListing(listingId), getListings()]);
        if (!cancelled) {
          setListing(item ?? null);
          setAllListings(listings);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load listing.");
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (!loaded) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>Loading listing…</h1>
        </header>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className={styles.page}>
        <a href="/listings" className={styles.backButton}>
          Back to listings
        </a>
        <header className={styles.header}>
          <h1>Listing not found</h1>
          <p className={styles.subtitle}>
            {error ?? "We could not find that listing. It may have been removed or the link may be incorrect."}
          </p>
        </header>
      </div>
    );
  }

  const imageUrl = getDisplayImageUrl(listing.image);
  const recentListings = allListings.filter((item) => item.id !== listing.id).slice(0, 3);
  const similarListings = allListings
    .filter((item) => item.id !== listing.id && item.category === listing.category)
    .slice(0, 3);

  const handleContactSeller = async () => {
    try {
      await contactSeller(listing.id, contactMessage);
      setContactStatus("Message sent to seller placeholder.");
    } catch (contactError) {
      setContactStatus(contactError instanceof Error ? contactError.message : "Failed to send message.");
    }
  };

  const handleReportListing = async () => {
    try {
      await reportListing(listing.id, "Reported from listing details page.");
      setReportStatus("Report submitted for review.");
    } catch (reportError) {
      setReportStatus(reportError instanceof Error ? reportError.message : "Failed to report listing.");
    }
  };

  return (
    <div className={styles.page}>
      <a href="/listings" className={styles.backButton}>
        Back to listings
      </a>

      <header className={styles.header}>
        <h1>{listing.title}</h1>
        <p className={styles.subtitle}>
          {getPostedLabel(listing)} by {listing.sellerName}
        </p>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.imageFrame}>
          {imageUrl ? (
            <img src={imageUrl} alt={listing.title} className={styles.listingImage} />
          ) : (
            <div className={styles.imagePlaceholderLarge}>
              <span>Image</span>
            </div>
          )}
        </div>

        <div className={styles.detailBody}>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>{listing.location}</span>
            <span className={styles.badge}>{listing.category}</span>
            <span className={styles.badge}>{listing.condition}</span>
            {listing.sold ? <span className={styles.soldBadge}>Sold</span> : null}
          </div>

          <div className={styles.priceRow}>
            <span className={styles.price}>{listing.price}</span>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Description</h2>
            <p className={styles.description}>{listing.description}</p>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Details</h2>
            <ul className={styles.metaList}>
              <li>
                <strong>Location</strong>
                <span>{listing.location}</span>
              </li>
              <li>
                <strong>Category</strong>
                <span>{listing.category}</span>
              </li>
              <li>
                <strong>Condition</strong>
                <span>{listing.condition}</span>
              </li>
              <li>
                <strong>Price</strong>
                <span>{listing.price}</span>
              </li>
              <li>
                <strong>Posted</strong>
                <span>{getPostedLabel(listing)}</span>
              </li>
            </ul>
          </div>

          <div className={styles.sellerSection}>
            <div>
              <h2 className={styles.sectionTitle}>Seller</h2>
              <p className={styles.sellerName}>{listing.sellerName}</p>
              <p className={styles.sellerMeta}>Student seller placeholder</p>
              <a href={`/seller/${listing.ownerId}`} className={styles.sellerLink}>
                View seller profile
              </a>
            </div>
            <div className={styles.contactPanel}>
              <textarea
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                rows={3}
                aria-label="Message seller"
              />
              <button type="button" className={styles.contactButton} onClick={() => void handleContactSeller()}>
                Contact Seller
              </button>
              {contactStatus ? <p className={styles.actionStatus}>{contactStatus}</p> : null}
            </div>
          </div>

          <button type="button" className={styles.reportButton} onClick={() => void handleReportListing()}>
            Report Listing
          </button>
          {reportStatus ? <p className={styles.actionStatus}>{reportStatus}</p> : null}
        </div>
      </div>

      <section className={styles.relatedSection}>
        <h2>Similar listings</h2>
        <div className={styles.relatedGrid}>
          {(similarListings.length > 0 ? similarListings : recentListings).map((item) => (
            <a key={item.id} href={`/listings/${item.id}`} className={styles.relatedCard}>
              <strong>{item.title}</strong>
              <span>{item.price}</span>
              <small>{item.category}</small>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.relatedSection}>
        <h2>Recent listings</h2>
        <div className={styles.relatedGrid}>
          {recentListings.map((item) => (
            <a key={item.id} href={`/listings/${item.id}`} className={styles.relatedCard}>
              <strong>{item.title}</strong>
              <span>{item.price}</span>
              <small>{getPostedLabel(item)}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
