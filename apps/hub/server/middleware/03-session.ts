// PUBLIC_PATHS: Routes accessible without a user session.
// Every new /api/ route that does NOT require authentication MUST be listed here.
// Anything not listed is auth-required (deny-by-default).
const PUBLIC_PATHS = [
  "/api/public/",    // branding, footer-pages, landing (public community data)
  "/api/auth/",      // OAuth callbacks, logout, platform list, dev-login
  "/api/csrf-token", // CSRF token initialisation (before login)
  "/api/setup/",     // Setup wizard (runs before first auth is configured)
  "/api/theme.get",  // Public theming data
  "/api/apply/",     // Application-flow uploads (own token auth via verifyAndLoadToken)
  "/api/internal/",  // MCP internal endpoints (requireInternalToken as their own auth)
];

export default defineEventHandler(async (event) => {
  // Only apply to API routes
  if (!event.path.startsWith("/api/")) return;

  // Let explicitly public routes through
  if (PUBLIC_PATHS.some((p) => event.path.startsWith(p))) return;

  // Attach session (graceful on parse error)
  try {
    const session = await getUserSession(event);
    event.context.userSession = session;
  } catch (error) {
    console.warn("[Auth] Session validation failed:", error instanceof Error ? error.message : String(error));
    event.context.userSession = null;
  }

  // deny-by-default: no valid session → 401
  if (!event.context.userSession?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: "Authentication required." });
  }
});
