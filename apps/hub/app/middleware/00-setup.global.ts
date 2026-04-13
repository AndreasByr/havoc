/**
 * Global setup guard middleware.
 * Redirects to /setup when the platform needs initial setup,
 * and blocks access to /setup when setup is already complete.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Only run on client side to avoid double-fetch on SSR
  if (!import.meta.client) return;

  // Don't intercept API routes or auth callbacks
  if (to.path.startsWith("/api/")) return;

  const setupStatus = useState<{ needsSetup: boolean; hasPlatforms: boolean } | null>("setup-status", () => null);

  if (!setupStatus.value) {
    try {
      setupStatus.value = await $fetch<{ needsSetup: boolean; hasPlatforms: boolean }>("/api/setup/status");
    } catch {
      return; // Can't determine setup status — don't block navigation
    }
  }

  if (setupStatus.value.needsSetup) {
    // Redirect to /setup if not already there
    if (!to.path.startsWith("/setup")) {
      return navigateTo("/setup");
    }
  } else {
    // Setup done — block access to /setup
    if (to.path.startsWith("/setup")) {
      return navigateTo("/dashboard");
    }
  }
});
