import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { installAppFromUrl } from "../../../utils/app-sideload";
import { getMarketplaceBaseUrl } from "../../../utils/marketplace";

type MarketplaceAppDetailResponse = {
  repositoryUrl?: unknown;
};

function isFetchTimeoutError(error: unknown): boolean {
  const asObject = error as { name?: string; code?: string; message?: string } | undefined;
  return asObject?.name === "AbortError"
    || asObject?.code === "UND_ERR_ABORTED"
    || (typeof asObject?.message === "string" && asObject.message.toLowerCase().includes("timeout"));
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const body = await readBody<{ appId?: unknown }>(event);
  const appId = typeof body?.appId === "string" ? body.appId.trim() : "";

  if (!appId) {
    throw createError({
      statusCode: 400,
      statusMessage: "appId is required"
    });
  }

  let repositoryUrl: string;

  try {
    const detail = await $fetch<MarketplaceAppDetailResponse>(
      `${getMarketplaceBaseUrl()}/api/marketplace/apps/${encodeURIComponent(appId)}`,
      { timeout: 10_000 }
    );

    if (!detail || typeof detail !== "object") {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid marketplace response"
      });
    }

    repositoryUrl = typeof detail.repositoryUrl === "string" ? detail.repositoryUrl.trim() : "";
    if (!repositoryUrl) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid marketplace response"
      });
    }
  } catch (error: unknown) {
    if ((error as { statusCode?: number })?.statusCode === 400) {
      throw error;
    }

    if (isFetchTimeoutError(error)) {
      throw createError({
        statusCode: 504,
        statusMessage: "Marketplace request timed out"
      });
    }

    throw createError({
      statusCode: 502,
      statusMessage: "Marketplace unavailable"
    });
  }

  try {
    const result = await installAppFromUrl(repositoryUrl, {
      source: "marketplace",
      activate: true
    });

    return {
      ok: true,
      appId: result.appId
    };
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 500;
    const statusMessage = (error as { statusMessage?: string })?.statusMessage ?? "Failed to install app";

    throw createError({
      statusCode,
      statusMessage
    });
  }
});
