"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import { getListingImageSrc } from "@/app/pages/image-url";
import styles from "./ListingMediaCarousel.module.css";

interface ListingMediaCarouselProps {
  href?: string;
  images: string[];
  alt: string;
  className?: string;
  imageClassName?: string;
  overlayClassName?: string;
  controlsClassName?: string;
  dotsClassName?: string;
  linkLabel?: string;
  showLink?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
}

export const ListingMediaCarousel = ({
  href,
  images,
  alt,
  className,
  imageClassName,
  overlayClassName,
  controlsClassName,
  dotsClassName,
  linkLabel,
  showLink = Boolean(href),
  showControls = true,
  showIndicators = true,
}: ListingMediaCarouselProps) => {
  const imageSignature = images.join("|");
  const resolvedImages = useMemo(() => {
    const items = images.map((image) => getListingImageSrc(image)).filter(Boolean);
    return items.length > 0 ? items : [getListingImageSrc("")];
  }, [imageSignature]);

  const [index, setIndex] = useState(0);
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [imageSignature]);

  const slideCount = resolvedImages.length;
  const currentImage = resolvedImages[index] ?? resolvedImages[0];

  const goPrev = () => {
    if (slideCount <= 1) {
      return;
    }
    setIndex((current) => (current - 1 + slideCount) % slideCount);
  };

  const goNext = () => {
    if (slideCount <= 1) {
      return;
    }
    setIndex((current) => (current + 1) % slideCount);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startX = touchStartRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartRef.current = null;

    if (startX === null || endX === null || slideCount <= 1) {
      return;
    }

    const delta = endX - startX;
    if (Math.abs(delta) < 40) {
      return;
    }

    if (delta < 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  return (
    <div className={className ? `${styles.frame} ${className}` : styles.frame} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <img src={currentImage} alt={alt} className={imageClassName ? `${styles.image} ${imageClassName}` : styles.image} loading="lazy" />
      {overlayClassName ? <span className={overlayClassName} /> : <span className={styles.overlay} />}
      {showLink && href ? (
        <a href={href} className={styles.linkOverlay} aria-label={linkLabel ?? `View ${alt}`} />
      ) : null}
      {showControls && slideCount > 1 ? (
        <div className={controlsClassName ? `${styles.controls} ${controlsClassName}` : styles.controls}>
          <button type="button" className={styles.controlButton} onClick={goPrev} aria-label="Previous image">
            ‹
          </button>
          <button type="button" className={styles.controlButton} onClick={goNext} aria-label="Next image">
            ›
          </button>
        </div>
      ) : null}
      {showIndicators && slideCount > 1 ? (
        <div className={dotsClassName ? `${styles.dots} ${dotsClassName}` : styles.dots} aria-label="Image gallery indicators">
          {resolvedImages.map((image, slideIndex) => (
            <button
              key={`${image}-${slideIndex}`}
              type="button"
              className={index === slideIndex ? `${styles.dot} ${styles.dotActive}` : styles.dot}
              onClick={() => setIndex(slideIndex)}
              aria-label={`Show image ${slideIndex + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
