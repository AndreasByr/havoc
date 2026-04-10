import { describe, expect, it } from "vitest";
import { buildThemeCssVariables, normalizeThemeColors } from "../theme-colors";

describe("theme-colors", () => {
  it("falls back to defaults for invalid content tones", () => {
    const normalized = normalizeThemeColors({
      colorAccentContentTone: "invalid" as never,
      colorWarningContentTone: "also-invalid" as never
    });

    expect(normalized.colorAccentContentTone).toBe("light");
    expect(normalized.colorWarningContentTone).toBe("dark");
  });

  it("maps content tone to readable status content variables", () => {
    const variables = buildThemeCssVariables({
      colorAccentContentTone: "dark",
      colorInfoContentTone: "light",
      colorSuccessContentTone: "dark",
      colorWarningContentTone: "light",
      colorErrorContentTone: "dark"
    });

    expect(variables["--color-accent-content"]).toBe("#001429");
    expect(variables["--color-info-content"]).toBe("#ffffff");
    expect(variables["--color-success-content"]).toBe("#001429");
    expect(variables["--color-warning-content"]).toBe("#ffffff");
    expect(variables["--color-error-content"]).toBe("#001429");
  });
});
