export default defineNuxtPlugin(() => {
  const { loggedIn, clear } = useUserSession();

  globalThis.$fetch = new Proxy(globalThis.$fetch, {
    apply(target, thisArg, args) {
      return Reflect.apply(target, thisArg, args).catch((error: unknown) => {
        if (
          error instanceof Error &&
          "statusCode" in error &&
          (error as { statusCode: number }).statusCode === 401 &&
          loggedIn.value
        ) {
          clear();
          const returnTo = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          if (import.meta.dev) {
            window.location.href = `/api/auth/discord?returnTo=${returnTo}`;
          } else {
            window.location.href = `/login?returnTo=${returnTo}`;
          }
        }
        throw error;
      });
    },
  });
});
