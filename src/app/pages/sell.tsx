"use client";

import { useState } from "react";
import styles from "./sell.module.css";
import { getDisplayImageUrl } from "./image-url";
import { addListing } from "./listings.data";

interface SellForm {
  title: string;
  price: string;
  location: string;
  condition: string;
  category: string;
  description: string;
  image: string;
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
    image: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SellFormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const previewImageUrl = getDisplayImageUrl(form.image);
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

    if (form.image.trim() && !previewImageUrl) {
      errors.image = "Enter a valid http or https image URL.";
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
        image: previewImageUrl,
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
        image: "",
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
        <h1>Sell an Item</h1>
        <p className={styles.subtitle}>Create a new listing for campus buyers.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        {successMessage ? (
          <div className={styles.successMessage}>
            <span>{successMessage}</span>
            {createdListingId ? <a href={`/listings/${createdListingId}`}>View listing</a> : null}
          </div>
        ) : null}

        <div className={styles.formRow}>
          <label htmlFor="title">Title</label>
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
          <label htmlFor="image">Image URL</label>
          <input
            id="image"
            name="image"
            type="text"
            value={form.image}
            onChange={handleChange}
            placeholder="Image URL or mock placeholder"
            aria-invalid={fieldErrors.image ? "true" : "false"}
          />
          {fieldErrors.image ? <p className={styles.fieldError}>{fieldErrors.image}</p> : null}
          <div className={styles.imagePlaceholder}>
            {previewImageUrl ? (
              <img src={previewImageUrl} alt="Listing preview" className={styles.imagePreview} />
            ) : (
              <span>Image preview</span>
            )}
          </div>
        </div>

        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? "Creating..." : "Create listing"}
        </button>
        {error ? <p className={styles.formError}>{error}</p> : null}
      </form>
    </div>
  );
};
