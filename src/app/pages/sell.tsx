"use client";

import { useState } from "react";
import styles from "./sell.module.css";
import { getImageUrlValidationError, getListingImageSrc } from "./image-url";
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
}

type SellFormErrors = Partial<Record<keyof SellForm, string>> & {
  imageUpload?: string;
};

const CONDITION_OPTIONS = ["New", "Like New", "Good", "Fair", "Used"] as const;
const CATEGORY_OPTIONS = ["Books", "Electronics", "Furniture", "Clothing", "Transportation", "Supplies", "Other"] as const;
const DESCRIPTION_LIMIT = 500;
const SELL_STEPS = [
  {
    number: "1",
    title: "Add the basics",
    text: "Start with a clear title, fair price, and a meetup area buyers already know.",
  },
  {
    number: "2",
    title: "Show the item clearly",
    text: "Upload one strong photo and describe condition, accessories, and pickup details.",
  },
  {
    number: "3",
    title: "Post and share",
    text: "Your listing will appear on Browse, Home, and your selling hub after you submit.",
  },
] as const;

export const Sell = () => {
  const [form, setForm] = useState<SellForm>({
    title: "",
    price: "",
    location: "",
    condition: "",
    category: "",
    description: "",
    imageUrl: "",
  });
  const [gallery, setGallery] = useState<UploadedListingImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SellFormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const previewImageUrl = getListingImageSrc(gallery[0]?.thumbnailUrl || gallery[0]?.imageUrl || form.imageUrl);
  const descriptionCount = form.description.length;
  const previewTitle = form.title.trim() || "Your listing preview";
  const previewPrice = form.price.trim() ? `$${Number.parseFloat(form.price || "0").toFixed(2)}` : "$0.00";
  const previewCategory = form.category || "Category";
  const previewCondition = form.condition || "Condition";
  const previewLocation = form.location.trim() || "Meetup location";
  const galleryCount = gallery.length;
  const previewDescription =
    form.description.trim() || "Add a few lines describing what buyers will get, the condition, and how pickup works.";

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

    if (form.imageUrl && getImageUrlValidationError(form.imageUrl)) {
      errors.imageUrl = "Enter a valid http or https image URL.";
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
        if (!current.imageUpload) {
          return current;
        }

        const next = { ...current };
        delete next.imageUpload;
        return next;
      }

      const next = { ...current };
      delete next[name as keyof SellForm];
      delete next.imageUpload;
      delete next.imageUrl;
      return next;
    });
  };

  const handleImageUpload = async (files: File[]) => {
    const validationError = files.map(getImageFileValidationError).find(Boolean);
    if (validationError) {
      setFieldErrors((current) => ({ ...current, imageUpload: validationError || "Please fix the highlighted fields." }));
      setError(validationError || "Please fix the highlighted fields.");
      return;
    }

    setUploadingImage(true);
    setUploadProgress(0);
    setError(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.imageUpload;
      return next;
    });

    try {
      const uploaded: UploadedListingImage[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const thumbnail = await createImageThumbnail(file);
        const result: UploadedListingImage = await uploadListingImage({
          file,
          thumbnail,
          onProgress: (progress) => {
            const base = (index / Math.max(files.length, 1)) * 100;
            const step = progress / Math.max(files.length, 1);
            setUploadProgress(Math.min(100, Math.round(base + step)));
          },
        });
        uploaded.push(result);
      }

      setGallery((current) => [...current, ...uploaded]);
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
        meetupArea: form.location.trim(),
        condition: form.condition,
        category: form.category,
        description: form.description.trim(),
        image: gallery[0]?.imageUrl ?? form.imageUrl.trim(),
        imageUrl: gallery[0]?.imageUrl ?? form.imageUrl.trim(),
        imageKey: gallery[0]?.imageKey ?? "",
        thumbnailUrl: gallery[0]?.thumbnailUrl ?? "",
        thumbnailKey: gallery[0]?.thumbnailKey ?? "",
        galleryUrls: gallery.length > 0 ? gallery.map((item) => item.imageUrl) : form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
        galleryThumbnailUrls: gallery.map((item) => item.thumbnailUrl),
        galleryKeys: gallery.map((item) => item.imageKey),
        galleryThumbnailKeys: gallery.map((item) => item.thumbnailKey),
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
      });
      setGallery([]);
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

      <section className={styles.stepsPanel} aria-label="How listing works">
        {SELL_STEPS.map((step) => (
          <article key={step.number} className={styles.stepCard}>
            <span className={styles.stepNumber}>{step.number}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </div>
          </article>
        ))}
      </section>

      <form className={styles.form} onSubmit={handleSubmit}>
        {successMessage ? (
          <div className={styles.successMessage}>
            <span>Your item is live. It now appears on Browse, Home, and your selling hub.</span>
            {createdListingId ? <a href={`/listings/${createdListingId}`}>View listing</a> : null}
            <a href="/dashboard">Open your selling hub</a>
            <a href="/listings">See it on Browse</a>
          </div>
        ) : null}

        <section className={styles.formSection} aria-labelledby="sell-step-basics">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>Step 1</p>
            <h2 id="sell-step-basics">Add the basics buyers need first</h2>
            <p>Keep it simple: what it is, how much it costs, and where you can meet.</p>
          </div>

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
        </section>

        <section className={styles.formSection} aria-labelledby="sell-step-details">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>Step 2</p>
            <h2 id="sell-step-details">Add details that build buyer trust</h2>
            <p>Condition, category, and a clear description make the item easier to scan on Browse.</p>
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
        </section>

        <section className={styles.formSection} aria-labelledby="sell-step-photo">
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>Step 3</p>
            <h2 id="sell-step-photo">Add a photo and preview your card</h2>
            <p>Preview how buyers will see your listing before you post it.</p>
          </div>

          <div className={styles.formRow}>
            <label htmlFor="imageUpload">Item images</label>
            <p className={styles.helperText}>Upload one or more clear photos, or paste an image URL as a fallback.</p>
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
                const files = Array.from(event.dataTransfer.files);
                if (files.length > 0) {
                  void handleImageUpload(files);
                }
              }}
            >
              <input
                id="imageUpload"
                name="imageUpload"
                type="file"
                multiple
                accept={IMAGE_UPLOAD_ACCEPT}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > 0) {
                    void handleImageUpload(files);
                  }
                }}
                aria-invalid={fieldErrors.imageUpload ? "true" : "false"}
              />
              <strong>{uploadingImage ? "Uploading image..." : "Drop images here or tap to choose"}</strong>
              <span>Attach photo from your device. JPG, PNG, or WebP up to 8 MB each.</span>
              <span className={styles.attachButton}>Attach photo</span>
              {uploadingImage || uploadProgress > 0 ? (
                <div className={styles.progressTrack} aria-label="Image upload progress">
                  <span style={{ width: `${uploadProgress}%` }} />
                </div>
              ) : null}
              {galleryCount > 0 ? <small>{galleryCount} image{galleryCount === 1 ? "" : "s"} ready for your listing.</small> : null}
            </div>
            {fieldErrors.imageUpload ? <p className={styles.fieldError}>{fieldErrors.imageUpload}</p> : null}
            {fieldErrors.imageUrl ? <p className={styles.fieldError}>{fieldErrors.imageUrl}</p> : null}
            <div className={styles.urlFallbackRow}>
              <label htmlFor="imageUrl">Or paste an image URL</label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="url"
                value={form.imageUrl}
                onChange={handleChange}
                placeholder="https://example.com/item-photo.jpg"
                aria-invalid={fieldErrors.imageUrl ? "true" : "false"}
              />
            </div>
          </div>

          <div className={styles.previewCard}>
            <div className={styles.previewImageFrame}>
              <img src={previewImageUrl} alt="Listing preview" className={styles.imagePreview} />
            </div>
            <div className={styles.previewCopy}>
              <p className={styles.previewEyebrow}>Buyer preview</p>
              <div className={styles.previewTopline}>
                <strong>{previewTitle}</strong>
                <span>{previewPrice}</span>
              </div>
              <div className={styles.previewPills}>
                <span>{previewCategory}</span>
                <span>{previewCondition}</span>
                <span>{previewLocation}</span>
                <span>
                  {galleryCount > 0
                    ? `${galleryCount} photo${galleryCount === 1 ? "" : "s"}`
                    : form.imageUrl.trim()
                      ? "URL photo"
                      : "No photos yet"}
                </span>
              </div>
              <p>{previewDescription}</p>
            </div>
          </div>
        </section>

        <button type="submit" className={styles.submitButton} disabled={submitting || uploadingImage}>
          {submitting ? "Posting your listing..." : "Post listing"}
        </button>
        {error ? <p className={styles.formError}>{error}</p> : null}
      </form>
    </div>
  );
};
