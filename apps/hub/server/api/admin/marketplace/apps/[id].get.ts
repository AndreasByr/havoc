import { FetchError } from "ofetch";
import { requireAdminSession } from "../../../../utils/auth";
import { getMarketplaceBaseUrl, resolveMarketplaceImageUrl } from "../../../../utils/marketplace";

interface MarketplaceDetailImage {
  src: string;
  [key: string]: unknown;
}

interface MarketplaceDetailResponse {
  images?: MarketplaceDetailImage[];
  [key: string]: unknown;
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing app id"
    });
  }

  const baseUrl = getMarketplaceBaseUrl();

  try {
    const response = await $fetch<MarketplaceDetailResponse>(`${baseUrl}/api/marketplace/apps/${encodeURIComponent(id)}`);

    if (!response || (response.images != null && !Array.isArray(response.images))) {
      throw new Error("Malformed marketplace detail response");
    }

    const images = response.images?.map((image) => ({
      ...image,
      src: resolveMarketplaceImageUrl(baseUrl, image.src)
    }));

    return {
      ...response,
      ...(images ? { images } : {})
    };
  } catch (error) {
    if (error instanceof FetchError && error.response?.status === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: "Marketplace app not found"
      });
    }

    throw createError({
      statusCode: 502,
      statusMessage: "Marketplace unavailable"
    });
  }
});
