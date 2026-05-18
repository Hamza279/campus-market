const IMAGE_URL_PARAMS = ["mediaurl", "imgurl", "image", "url"];
const IMAGE_URL_ERROR = "Enter a valid http or https image URL.";

export const FALLBACK_LISTING_IMAGE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23eff6ff'/%3E%3Cpath d='M96 92h448v236H96z' fill='%23dbeafe' stroke='%2393c5fd' stroke-width='8'/%3E%3Ccircle cx='220' cy='180' r='42' fill='%2360a5fa'/%3E%3Cpath d='M132 302l126-112 84 72 62-50 104 90H132z' fill='%232563eb' opacity='.8'/%3E%3Ctext x='320' y='370' text-anchor='middle' font-family='Arial, sans-serif' font-size='28' font-weight='700' fill='%231e3a8a'%3ECampusMarket%3C/text%3E%3C/svg%3E";

export const getDisplayImageUrl = (image: string): string => {
  const trimmed = image.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    for (const param of IMAGE_URL_PARAMS) {
      const nested = url.searchParams.get(param);
      if (!nested) {
        continue;
      }

      try {
        const nestedUrl = new URL(nested);
        if (nestedUrl.protocol === "http:" || nestedUrl.protocol === "https:") {
          return nestedUrl.toString();
        }
      } catch {
        continue;
      }
    }

    return url.toString();
  } catch {
    return "";
  }
};

export const getListingImageSrc = (image: string): string => {
  return getDisplayImageUrl(image) || FALLBACK_LISTING_IMAGE_URL;
};

export const getImageUrlValidationError = (image: string): string | null => {
  const trimmed = image.trim();
  if (!trimmed) {
    return null;
  }

  return getDisplayImageUrl(trimmed) ? null : IMAGE_URL_ERROR;
};

export const normalizeImageUrlForSave = (image: string): string => {
  return getDisplayImageUrl(image);
};
