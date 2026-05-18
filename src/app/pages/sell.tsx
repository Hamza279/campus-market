"use client";

import { useState } from "react";
import styles from "./sell.module.css";
import { getListingImageSrc } from "./image-url";
import { createImageThumbnail, getImageFileValidationError, IMAGE_UPLOAD_ACCEPT } from "./image-upload";
import { addListing, uploadListingImage, type UploadedListingImage } from "./listings.data";

interface SellForm {
  title: string;
  price: string;
  location: string;
  condition: string;
  category: string;
  description: string;
  imageUrl: string;
  imageKey: string;
  thumbnailUrl: string;
  thumbnailKey: string;
}

type SellFormErrors = Partial<Record<keyof SellForm, string>>;

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Used"] as const;
const CATEGORY_OPTIONS = ["Books", "Electronics", "Furniture", "Clothing", "Transportation", "Supplies", "Other"] as const;
const DESCRIPTION_LIMIT = 500;

export const Sell = () => {
  const [form, setForm] = useState<SellForm>({
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
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SellFormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const previewImageUrl = getListingImageSrc(form.thumbnailUrl || form.imageUrl);
  const descriptionCount = form.description.length;

  const validateForm = (): SellFormErrors => {
    const errors: SellFormErrors = {};
    const numericPrice = Number.parseFloat(form.price);

    if (!form.title.trim()) {
      errors.title = "Title is required.";
    }

    if (!form.price.trim()) {
      errors.price = "Price is required.";
    } else if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      errors.price = "Enter a valid price.";
    }

    if (!form.location.trim()) {
      errors.location = "Location is required.";
    }

    if (!form.condition) {
      errors.condition = "Choose a condition.";
    }

    if (!form.category) {
      errors.category = "Choose a category.";
    }

    if (!form.description.trim()) {
      errors.description = "Description is required.";
    } else if (form.description.length > DESCRIPTION_LIMIT) {
      errors.description = `Description must be ${DESCRIPTION_LIMIT} characters or fewer.`;
    }

    if (!form.imageUrl || !form.imageKey || !form.thumbnailUrl || !form.thumbnailKey) {
      errors.imageUrl = "Upload an item image.";
    }

    return errors;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;

    if (name === "price" && value !== "" && !/^\d*\.?\d{0,2}$/.test(value)) {
      return;
    }

    if (name === "description" && value.length > DESCRIPTION_LIMIT) {
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
    setSuccessMessage(null);
    setCreatedListingId(null);
    setFieldErrors((current) => {
      if (!current[name as keyof SellForm]) {
        return current;
      }

      const next = { ...current };
      delete next[name as keyof SellForm];
      return next;
    });
  };

  const handleImageUpload = async (file: File) => {
    const validationError = getImageFileValidationError(file);
    if (validationError) {
      setFieldErrors((current) => ({ ...current, imageUrl: validationError }));
      setError("Please fix the highlighted fields.");
      return;
    }

    setUploadingImage(true);
    setUploadProgress(0);
    setError(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.imageUrl;
      return next;
    });

    try {
      const thumbnail = await createImageThumbnail(file);
      const uploaded: UploadedListingImage = await uploadListingImage({
        file,
        thumbnail,
        onProgress: setUploadProgress,
      });

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
      setIsDraggingImage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateForm();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setCreatedListingId(null);

    try {
      const newListing = await addListing({
        title: form.title.trim(),
        price: `$${Number.parseFloat(form.price).toFixed(2)}`,
        location: form.location.trim(),
        condition: form.condition,
        category: form.category,
        description: form.description.trim(),
        image: form.imageUrl,
        imageUrl: form.imageUrl,
        imageKey: form.imageKey,
        thumbnailUrl: form.thumbnailUrl,
        thumbnailKey: form.thumbnailKey,
        status: "active",
      });

      setSuccessMessage("Listing created successfully.");
      setCreatedListingId(newListing.id);
      setForm({
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
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create listing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>List an item for sale</h1>
        <p className={styles.subtitle}>Fill out a few simple details and your item will appear on Browse, Home, and your selling hub.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {successMessage ? (
          <div className={styles.successMessage}>
            <span>{successMessage}</span>
            {createdListingId ? <a href={`/listings/${createdListingId}`}>View listing</a> : null}
            <a href="/dashboard">Open your selling hub</a>
            <a href="/listings">See it on Browse</a>
          </div>
        ) : null}

        <div className={styles.formRow}>
          <label htmlFor="title">Title</label>
          <p className={styles.helperText}>Use the words a buyer would search for first.</p>
          <input
            id="title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Graphing calculator"
            aria-invalid={fieldErrors.title ? "true" : "false"}
          />
          {fieldErrors.title ? <p className={styles.fieldError}>{fieldErrors.title}</p> : null}
        </div>

        <div className={styles.formRowGroup}>
          <div className={styles.formRowHalf}>
            <label htmlFor="price">Price</label>
            <p className={styles.helperText}>Numbers only. We will format it as a dollar amount.</p>
            <input
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={handleChange}
              placeholder="45.00"
              aria-invalid={fieldErrors.price ? "true" : "false"}
            />
            {fieldErrors.price ? <p className={styles.fieldError}>{fieldErrors.price}</p> : null}
          </div>
          <div className={styles.formRowHalf}>
            <label htmlFor="location">Location</label>
            <p className={styles.helperText}>Share a clear meetup area buyers will recognize.</p>
            <input
              id="location"
              name="location"
              type="text"
              value={form.location}
              onChange={handleChange}
              placeholder="Student Center"
              aria-invalid={fieldErrors.location ? "true" : "false"}
            />
            {fieldErrors.location ? <p className={styles.fieldError}>{fieldErrors.location}</p> : null}
          </div>
        </div>

        <div className={styles.formRowGroup}>
          <div className={styles.formRowHalf}>
            <label htmlFor="condition">Condition</label>
            <p className={styles.helperText}>Be honest so buyers know what to expect.</p>
            <select
              id="condition"
              name="condition"
              value={form.condition}
              onChange={handleChange}
              aria-invalid={fieldErrors.condition ? "true" : "false"}
            >
              <option value="">Select condition</option>
              {CONDITION_OPTIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
            {fieldErrors.condition ? <p className={styles.fieldError}>{fieldErrors.condition}</p> : null}
          </div>

          <div className={styles.formRowHalf}>
            <label htmlFor="category">Category</label>
            <p className={styles.helperText}>Choose the closest match to help Browse filters work well.</p>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              aria-invalid={fieldErrors.category ? "true" : "false"}
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {fieldErrors.category ? <p className={styles.fieldError}>{fieldErrors.category}</p> : null}
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.labelRow}>
            <label htmlFor="description">Description</label>
            <span className={styles.characterCount}>
              {descriptionCount}/{DESCRIPTION_LIMIT}
            </span>
          </div>
          <p className={styles.helperText}>Mention brand, size, wear, included accessories, and where you prefer to meet.</p>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Add details about the item and pickup instructions."
            rows={5}
            aria-invalid={fieldErrors.description ? "true" : "false"}
          />
          {fieldErrors.description ? <p className={styles.fieldError}>{fieldErrors.description}</p> : null}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="imageUpload">Item image</label>
          <p className={styles.helperText}>Upload a clear photo. Buyers are more likely to message when they can see the item.</p>
          <div
            className={isDraggingImage ? `${styles.dropZone} ${styles.dropZoneActive}` : styles.dropZone}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingImage(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDraggingImage(false)}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files.item(0);
              if (file) {
                void handleImageUpload(file);
              }
            }}
          >
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
              aria-invalid={fieldErrors.imageUrl ? "true" : "false"}
            />
            <strong>{uploadingImage ? "Uploading image..." : "Drop an image here or tap to choose"}</strong>
            <span>JPG, PNG, or WebP up to 8 MB. A thumbnail is generated before upload.</span>
            {uploadingImage || uploadProgress > 0 ? (
              <div className={styles.progressTrack} aria-label="Image upload progress">
                <span style={{ width: `${uploadProgress}%` }} />
              </div>
            ) : null}
          </div>
          {fieldErrors.imageUrl ? <p className={styles.fieldError}>{fieldErrors.imageUrl}</p> : null}
          <div className={styles.imagePlaceholder}>
            <img src={previewImageUrl} alt="Listing preview" className={styles.imagePreview} />
          </div>
        </div>

        <button type="submit" className={styles.submitButton} disabled={submitting || uploadingImage}>
          {submitting ? "Creating..." : "Create listing"}
        </button>
        {error ? <p className={styles.formError}>{error}</p> : null}
      </form>
    </div>
  );
};
