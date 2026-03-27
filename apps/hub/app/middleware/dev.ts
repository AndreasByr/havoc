export default defineNuxtRouteMiddleware(() => {
  const isDev = useRuntimeConfig().public.isDev;

  if (isDev !== true) {
    return navigateTo("/dashboard");
  }
});
