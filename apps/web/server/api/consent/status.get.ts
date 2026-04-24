/**
 * Web-side proxy for GET /api/consent/status — forwards to Hub API.
 * Checks whether the current user has already consented.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const hubUrl = (config.public?.hubUrl as string)?.trim() || "http://localhost:3003";

  try {
    // Forward any cookies from the original request so hub can resolve the session
    const cookieHeader = getHeader(event, "cookie") || "";

    const result = await $fetch<{ hasConsented: boolean }>(
      `${hubUrl}/api/consent/status`,
      {
        headers: cookieHeader ? { cookie: cookieHeader } : {}
      }
    );

    return result;
  } catch (err: unknown) {
    // If hub is unreachable, default to no consent — banner will show
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[web-consent-proxy] Failed to check consent status via hub:", message);
    return { hasConsented: false };
  }
});
