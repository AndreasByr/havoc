/**
 * Landing page template color definitions.
 *
 * Each template declares a default palette that the public landing page
 * renders through CSS custom-properties.  Admins can override individual
 * keys via `colorOverrides` (stored as JSONB on landing_pages).
 *
 * Only valid 6-digit hex colors (#rrggbb) are accepted.
 */

export interface LandingColorPalette {
  /** Page / body background */
  background: string;
  /** Card / section surface */
  surface: string;
  /** Primary text */
  text: string;
  /** Muted / secondary text */
  textMuted: string;
  /** Primary accent (buttons, links, highlights) */
  accent: string;
  /** Text rendered on top of accent backgrounds */
  accentText: string;
  /** Subtle border / divider color */
  border: string;
}

export const LANDING_COLOR_KEYS: readonly (keyof LandingColorPalette)[] = [
  "background",
  "surface",
  "text",
  "textMuted",
  "accent",
  "accentText",
  "border",
] as const;

export type LandingColorOverrides = Partial<LandingColorPalette>;

/** Style variant options for individual landing blocks */
export const STYLE_VARIANTS = ["normal", "accent", "warning"] as const;
export type StyleVariant = (typeof STYLE_VARIANTS)[number];

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

/**
 * Validate and sanitise a partial color-override object.
 * Only keys present in LandingColorPalette with valid hex values pass through.
 */
export function sanitizeLandingColorOverrides(
  raw: Record<string, unknown> | null | undefined
): LandingColorOverrides {
  if (!raw || typeof raw !== "object") return {};
  const result: LandingColorOverrides = {};
  for (const key of LANDING_COLOR_KEYS) {
    const val = raw[key];
    if (isValidHexColor(val)) {
      result[key] = val.toLowerCase();
    }
  }
  return result;
}

/**
 * Default color palettes keyed by template id.
 * The "default" palette is used as ultimate fallback.
 */
export const TEMPLATE_COLOR_DEFAULTS: Record<string, LandingColorPalette> = {
  default: {
    background: "#0a0a0a",
    surface: "#141414",
    text: "#fafafa",
    textMuted: "#a1a1aa",
    accent: "#7c3aed",
    accentText: "#ffffff",
    border: "#27272a",
  },
  cyberpunk: {
    background: "#06060e",
    surface: "#0e0e22",
    text: "#d8d8ff",
    textMuted: "#6a6a8e",
    accent: "#00f0ff",
    accentText: "#06060e",
    border: "#1a1a3a",
  },
  esports: {
    background: "#0b0e14",
    surface: "#131720",
    text: "#f0f2f5",
    textMuted: "#8a92a0",
    accent: "#e53e3e",
    accentText: "#ffffff",
    border: "#1f2533",
  },
};

/**
 * Resolve the final color palette for a landing page.
 * Merges: template defaults → colorOverrides.
 */
export function resolveLandingColors(
  templateId: string | null | undefined,
  overrides: LandingColorOverrides | null | undefined
): LandingColorPalette {
  const base =
    TEMPLATE_COLOR_DEFAULTS[templateId ?? "default"] ??
    TEMPLATE_COLOR_DEFAULTS.default;

  if (!overrides) return { ...base };

  const merged = { ...base };
  for (const key of LANDING_COLOR_KEYS) {
    const val = overrides[key];
    if (isValidHexColor(val)) {
      merged[key] = val.toLowerCase();
    }
  }
  return merged;
}

/**
 * Convert a resolved palette into CSS custom-property declarations.
 * Keys are prefixed with `--landing-` to avoid collisions with the hub theme.
 */
export function landingColorsToCssVars(palette: LandingColorPalette): Record<string, string> {
  return {
    "--landing-background": palette.background,
    "--landing-surface": palette.surface,
    "--landing-text": palette.text,
    "--landing-text-muted": palette.textMuted,
    "--landing-accent": palette.accent,
    "--landing-accent-text": palette.accentText,
    "--landing-border": palette.border,
  };
}

/**
 * Build an inline style string from a resolved palette (for SSR / postMessage).
 */
export function landingColorsToStyleString(palette: LandingColorPalette): string {
  return Object.entries(landingColorsToCssVars(palette))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
