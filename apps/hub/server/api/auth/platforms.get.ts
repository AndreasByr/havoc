/**
 * Public endpoint: returns which auth platforms are available for login.
 * Used by the login page to dynamically show login buttons.
 */
import { getActivePlatforms } from "../../utils/platformConfig";


export default defineEventHandler(async () => {
  try {
    const platforms = await getActivePlatforms();
    const hasDiscord = platforms.some((p) => p.platform === "discord");
    const hasMatrix = platforms.some((p) => p.platform === "matrix");

    // If no platforms are configured at all, default to showing Discord login
    // (backward compat: existing communities work without platform_connections entries)
    const noPlatformsConfigured = !hasDiscord && !hasMatrix;

    return {
      discord: hasDiscord || noPlatformsConfigured,
      matrix: hasMatrix,
    };
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
});
