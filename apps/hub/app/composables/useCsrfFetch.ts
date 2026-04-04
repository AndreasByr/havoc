const csrfToken = useState<string>("csrf-token", () => "");

export async function initCsrfToken(): Promise<string> {
  if (!csrfToken.value) {
    const { token } = await $fetch<{ token: string }>("/api/csrf-token");
    csrfToken.value = token;
  }
  return csrfToken.value;
}

export function useApiFetch<T>(
  url: string | (() => string),
  opts?: Parameters<typeof useFetch<T>>[1],
) {
  return useFetch<T>(url, {
    ...opts,
    headers: computed(() => ({
      "x-csrf-token": csrfToken.value,
      ...(opts?.headers as Record<string, string> | undefined),
    })),
  });
}
