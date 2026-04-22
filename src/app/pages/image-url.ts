const IMAGE_URL_PARAMS = ["mediaurl", "imgurl", "image", "url"];

export const getDisplayImageUrl = (image: string): string => {
  const trimmed = image.trim();
  if (!trimmed) {
    return "";
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

      const nestedUrl = new URL(nested);
      if (nestedUrl.protocol === "http:" || nestedUrl.protocol === "https:") {
        return nestedUrl.toString();
      }
    }

    return url.toString();
  } catch {
    return "";
  }
};
