export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  if (!loggedIn.value) {
    const returnTo = encodeURIComponent(to.fullPath || "/dashboard");
    return navigateTo(`/login?returnTo=${returnTo}`);
  }
});
