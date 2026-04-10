/**
 * Normalizes a returnTo path to prevent open redirect attacks.
 * Only allows relative paths that don't start with "//".
 */
export function normalizeReturnTo(rawValue: string | null | undefined, fallback = "/dashboard"): string {
  if (!rawValue) {
    return fallback;
  }

  let value = rawValue;
  try {
    value = decodeURIComponent(rawValue);
  } catch {
    value = rawValue;
  }

  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
