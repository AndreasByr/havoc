export const PLACEHOLDER_PREFIXES = [
  "replace_with_",
  "changeme",
  "your_token_here",
  "dev-"
];

/**
 * Returns true if the token value is empty or starts with a known placeholder prefix.
 * Case-insensitive comparison.
 */
export function isPlaceholderToken(value: string): boolean {
  if (!value || value.length === 0) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}
