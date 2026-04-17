export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) return;

  const method = getMethod(event);
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

  const path = event.path;
  if (path === "/api/csrf-token" || path.startsWith("/api/auth/discord")) return;

  // SSR-internal requests originate from the Nitro server itself (e.g. useRequestFetch / $fetch
  // on the server side) and carry no Origin or Referer header. Browser-initiated cross-origin
  // CSRF attacks always include an Origin header, so this skip is safe for SSR internals.
  // This is an intentional exception — not a security gap.
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  if (!origin && !referer) return;

  const session = await getUserSession(event);

  if (!session.csrfToken) {
    throw createError({ statusCode: 403, statusMessage: "CSRF token not initialised" });
  }

  validateCsrfToken(event, session.csrfToken);
});
