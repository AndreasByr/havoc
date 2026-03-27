export default defineNuxtRouteMiddleware(async () => {
  const { user, hasRole } = useAuth();

  if (!user.value) {
    return navigateTo("/login");
  }

  if (hasRole("admin")) {
    return;
  }

  if (hasRole("moderator")) {
    const moderationRights = (user.value as Record<string, unknown>)?.moderationRights as Record<string, boolean> | undefined;
    const hasAnyRight = moderationRights ? Object.values(moderationRights).some(Boolean) : false;
    if (hasAnyRight) {
      return;
    }
  }

  return navigateTo("/dashboard");
});
