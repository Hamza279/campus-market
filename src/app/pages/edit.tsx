"use client";

import { useEffect, useState } from "react";
import styles from "./edit.module.css";
import { getListingImageSrc } from "./image-url";
import { createImageThumbnail, getImageFileValidationError, IMAGE_UPLOAD_ACCEPT } from "./image-upload";
import { getListing, updateListing, Listing, uploadListingImage } from "./listings.data";

interface EditProps {
  listingId: string;
}

type EditFormErrors = Partial<Record<"title" | "price" | "category", string>>;

export const Edit = ({ listingId }: EditProps) => {
  const [listing, setListing] = useState<Listing | null>(null);
  const [form, setForm] = useState({
    title: "",
    price: "",
    location: "",
    condition: "",
    category: "",
    description: "",
    imageUrl: "",
    imageKey: "",
    thumbnailUrl: "",
    thumbnailKey: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EditFormErrors>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const previewImageUrl = getListingImageSrc(form.thumbnailUrl || form.imageUrl);

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
            imageUrl: item.imageUrl,
            imageKey: item.imageKey,
            thumbnailUrl: item.thumbnailUrl,
            thumbnailKey: item.thumbnailKey,
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
    setFieldErrors((current) => {
      const key = name as keyof EditFormErrors;
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleImageUpload = async (file: File) => {
    const validationError = getImageFileValidationError(file);
    if (validationError) {
      setImageError(validationError);
      setError("Please fix the highlighted fields.");
      return;
    }

    setUploadingImage(true);
    setUploadProgress(0);
    setImageError(null);
    setError(null);

    try {
      const thumbnail = await createImageThumbnail(file);
      const uploaded = await uploadListingImage({ file, thumbnail, onProgress: setUploadProgress });
      setForm((current) => ({
        ...current,
        imageUrl: uploaded.imageUrl,
        imageKey: uploaded.imageKey,
        thumbnailUrl: uploaded.thumbnailUrl,
        thumbnailKey: uploaded.thumbnailKey,
      }));
      setUploadProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listing) return;

    const numericPrice = Number.parseFloat(form.price.replace(/[^0-9.]/g, ""));
    const nextFieldErrors: EditFormErrors = {};
    if (!form.title.trim()) {
      nextFieldErrors.title = "Title is required.";
    }
    if (!form.price.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
      nextFieldErrors.price = "Enter a valid price.";
    }
    if (!form.category.trim()) {
      nextFieldErrors.category = "Category is required.";
    }

    const nextImageError = !form.imageUrl || !form.imageKey || !form.thumbnailUrl || !form.thumbnailKey ? "Upload an item image." : null;
    setFieldErrors(nextFieldErrors);
    setImageError(nextImageError);
    if (nextImageError || Object.keys(nextFieldErrors).length > 0) {
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
        image: form.imageUrl,
        imageUrl: form.imageUrl,
        imageKey: form.imageKey,
        thumbnailUrl: form.thumbnailUrl,
        thumbnailKey: form.thumbnailKey,
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
            aria-invalid={fieldErrors.title ? "true" : "false"}
          />
          {fieldErrors.title ? <p className={styles.fieldError}>{fieldErrors.title}</p> : null}
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
              aria-invalid={fieldErrors.price ? "true" : "false"}
            />
            {fieldErrors.price ? <p className={styles.fieldError}>{fieldErrors.price}</p> : null}
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
            aria-invalid={fieldErrors.category ? "true" : "false"}
          />
          {fieldErrors.category ? <p className={styles.fieldError}>{fieldErrors.category}</p> : null}
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
          <label htmlFor="imageUpload">Item image</label>
          <input
            id="imageUpload"
            name="imageUpload"
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImageUpload(file);
              }
            }}
            aria-invalid={imageError ? "true" : "false"}
          />
          {imageError ? <p className={styles.fieldError}>{imageError}</p> : null}
          {uploadingImage || uploadProgress > 0 ? <p>{uploadingImage ? `Uploading image ${uploadProgress}%` : "Image uploaded."}</p> : null}
          <div className={styles.imagePlaceholder}>
            <img src={previewImageUrl} alt="Listing preview" className={styles.imagePreview} />
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitButton} disabled={saving || uploadingImage}>
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
