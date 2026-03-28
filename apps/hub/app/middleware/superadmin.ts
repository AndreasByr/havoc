export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession();
  if (!loggedIn.value) {
    const returnTo = encodeURIComponent(to.fullPath || "/dashboard");
    if (import.meta.dev) {
      return navigateTo(`/api/auth/discord?returnTo=${returnTo}`, { external: true });
    }
    return navigateTo(`/login?returnTo=${returnTo}`);
  }

  const currentUser = (user.value as { permissionRoles?: string[]; roles?: string[] } | null) || null;
  const roles = (currentUser?.permissionRoles ?? currentUser?.roles ?? []) as string[];
  if (!roles.includes("superadmin")) {
    return navigateTo("/dashboard");
  }
});
