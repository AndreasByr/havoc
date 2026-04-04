export default defineNuxtPlugin(async () => {
  await initCsrfToken();

  const csrfToken = useState<string>("csrf-token");

  globalThis.$fetch = new Proxy(globalThis.$fetch, {
    apply(target, thisArg, [url, opts = {}]) {
      if (!csrfToken.value) {
        return Reflect.apply(target, thisArg, [url, opts]);
      }
      const updatedOpts = {
        ...opts,
        headers: {
          "x-csrf-token": csrfToken.value,
          ...(opts.headers as Record<string, string> | undefined),
        },
      };
      return Reflect.apply(target, thisArg, [url, updatedOpts]);
    },
  });
});
