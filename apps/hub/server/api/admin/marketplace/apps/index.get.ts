import { requireAdminSession } from "../../../../utils/auth";
import { getMarketplaceBaseUrl, resolveMarketplaceImageUrl } from "../../../../utils/marketplace";

interface MarketplaceListItem {
  thumbnailUrl?: string;
  [key: string]: unknown;
}

interface MarketplaceListResponse {
  items?: MarketplaceListItem[];
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const baseUrl = getMarketplaceBaseUrl();

  try {
    const response = await $fetch<MarketplaceListResponse>(`${baseUrl}/api/marketplace/apps`);

    if (!response || !Array.isArray(response.items)) {
      throw new Error("Malformed marketplace list response");
    }

    const items = response.items.map((item) => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl
        ? resolveMarketplaceImageUrl(baseUrl, item.thumbnailUrl)
        : item.thumbnailUrl
    }));

    return { items };
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Marketplace unavailable"
    });
  }
});
