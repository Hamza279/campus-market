"use client";

import { useEffect, useState } from "react";
import styles from "./edit.module.css";
import { getImageUrlValidationError, getListingImageSrc, normalizeImageUrlForSave } from "./image-url";
import { getListing, updateListing, Listing } from "./listings.data";

interface EditProps {
  listingId: string;
}

export const Edit = ({ listingId }: EditProps) => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [form, setForm] = useState({
    title: "",
    price: "",
    location: "",
    condition: "",
    category: "",
    description: "",
    image: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const normalizedImageUrl = normalizeImageUrlForSave(form.image);
  const previewImageUrl = getListingImageSrc(form.image);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const item = await getListing(listingId);
        if (!cancelled && item) {
          setListing(item);
          setForm({
            title: item.title,
            price: item.price,
            location: item.location,
            condition: item.condition,
            category: item.category,
            description: item.description,
            image: item.image,
          });
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

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "image") {
      setImageError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listing) return;

    const nextImageError = getImageUrlValidationError(form.image);
    setImageError(nextImageError);
    if (nextImageError) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateListing({
        ...listing,
        title: form.title,
        price: form.price,
        location: form.location,
        condition: form.condition,
        category: form.category,
        description: form.description,
        image: normalizedImageUrl,
      });

      if (updated) {
        window.location.href = "/dashboard";
        return;
      }

      setError("Listing not found.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save listing.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>Loading edit form…</h1>
        </header>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1>Listing not found</h1>
          <p className={styles.subtitle}>{error ?? "We could not find this listing."}</p>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Edit Listing</h1>
        <p className={styles.subtitle}>Update listing details, preview the image, and save changes back to the dashboard.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formRowGroup}>
          <div className={styles.formRowHalf}>
            <label htmlFor="price">Price</label>
            <input
              id="price"
              name="price"
              type="text"
              value={form.price}
              onChange={handleChange}
            />
          </div>
          <div className={styles.formRowHalf}>
            <label htmlFor="location">Location</label>
            <input
              id="location"
              name="location"
              type="text"
              value={form.location}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <label htmlFor="condition">Condition</label>
          <input
            id="condition"
            name="condition"
            type="text"
            value={form.condition}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="category">Category</label>
          <input
            id="category"
            name="category"
            type="text"
            value={form.category}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={5}
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="image">Image placeholder</label>
          <input
            id="image"
            name="image"
            type="text"
            value={form.image}
            onChange={handleChange}
            aria-invalid={imageError ? "true" : "false"}
          />
          {imageError ? <p className={styles.fieldError}>{imageError}</p> : null}
          <div className={styles.imagePlaceholder}>
            <img src={previewImageUrl} alt="Listing preview" className={styles.imagePreview} />
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitButton}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          {listing ? (
            <a href={`/listings/${listing.id}`} className={styles.cancelButton}>
              View listing
            </a>
          ) : null}
          <a href="/dashboard" className={styles.cancelButton}>
            Back to dashboard
          </a>
        </div>
        {error ? <p>{error}</p> : null}
      </form>
    </div>
  );
};
