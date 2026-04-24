const PRODUCTION_MARKETPLACE_BASE_URL = "https://guildora.app";
const DEVELOPMENT_MARKETPLACE_BASE_URL = "http://localhost:3004";

export function getMarketplaceBaseUrl(): string {
  return process.env.NODE_ENV === "development"
    ? DEVELOPMENT_MARKETPLACE_BASE_URL
    : PRODUCTION_MARKETPLACE_BASE_URL;
}

export function resolveMarketplaceImageUrl(baseUrl: string, imagePath: string): string {
  if (!imagePath) {
    return imagePath;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  if (imagePath.startsWith("/")) {
    return `${baseUrl}${imagePath}`;
  }

  return imagePath;
}
