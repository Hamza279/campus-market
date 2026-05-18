"use client";

import { getListingImageSrc } from "@/app/pages/image-url";
import type { Listing } from "@/app/pages/listings.data";
import styles from "./ListingCard.module.css";

interface ListingCardProps {
  listing: Listing;
  href: string;
  topAction?: React.ReactNode;
  footerActions?: React.ReactNode;
  postedLabel?: string;
  statusLabel?: string;
  statusTone?: "active" | "sold";
  variant?: "buyer" | "seller";
  highlighted?: boolean;
  featuredLabel?: string;
}

export const ListingCard = ({
  listing,
  href,
  topAction,
  footerActions,
  postedLabel,
  statusLabel,
  statusTone,
  variant = "buyer",
  highlighted = false,
  featuredLabel,
}: ListingCardProps) => {
  const imageUrl = getListingImageSrc(listing.thumbnailUrl || listing.imageUrl || listing.image);
  const resolvedStatusLabel = statusLabel ?? (listing.sold ? "Sold" : undefined);
  const resolvedStatusTone = statusTone ?? (listing.sold ? "sold" : "active");
  const sellerHref = listing.ownerId ? `/seller/${listing.ownerId}` : undefined;
  const cardClassName = [
    styles.card,
    variant === "seller" ? styles.sellerCard : "",
    highlighted ? styles.cardHighlighted : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName}>
      <a href={href} className={styles.imageLink} aria-label={`View ${listing.title}`}>
        <img src={imageUrl} alt={listing.title} className={styles.image} loading="lazy" />
        <span className={styles.imageOverlay} />
        <span className={styles.pricePill}>{listing.price}</span>
        {featuredLabel ? <span className={styles.featuredPill}>{featuredLabel}</span> : null}
      </a>

      <div className={styles.body}>
        <div className={styles.header}>
          <a href={href} className={styles.titleLink}>
            <h2 className={styles.title}>{listing.title}</h2>
          </a>
          {topAction ? <div className={styles.topAction}>{topAction}</div> : null}
        </div>

        <div className={styles.priceRow}>
          <span className={styles.price}>{listing.price}</span>
          {resolvedStatusLabel ? (
            <span className={resolvedStatusTone === "sold" ? styles.soldBadge : styles.activeBadge}>
              {resolvedStatusLabel}
            </span>
          ) : null}
        </div>

        <p className={styles.description}>{listing.description}</p>

        <div className={styles.badgeRow}>
          <span className={styles.categoryBadge}>{listing.category}</span>
          <span className={styles.conditionBadge}>{listing.condition}</span>
        </div>

        <dl className={styles.metaGrid}>
          <div>
            <dt>Pickup</dt>
            <dd>{listing.location}</dd>
          </div>
          <div>
            <dt>Seller</dt>
            <dd>
              {sellerHref ? (
                <a href={sellerHref} className={styles.sellerLink}>
                  {listing.sellerName}
                </a>
              ) : (
                listing.sellerName
              )}
            </dd>
          </div>
          {postedLabel ? (
            <div>
              <dt>Posted</dt>
              <dd>{postedLabel}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {footerActions ? <div className={styles.footer}>{footerActions}</div> : null}
    </article>
  );
};
