import { describe, expect, it } from "vitest";
import { isPlaceholderToken, PLACEHOLDER_PREFIXES } from "../startup-checks";

describe("PLACEHOLDER_PREFIXES", () => {
  it("contains the four canonical prefixes", () => {
    expect(PLACEHOLDER_PREFIXES).toContain("replace_with_");
    expect(PLACEHOLDER_PREFIXES).toContain("changeme");
    expect(PLACEHOLDER_PREFIXES).toContain("your_token_here");
    expect(PLACEHOLDER_PREFIXES).toContain("dev-");
  });
});

describe("isPlaceholderToken", () => {
  it("returns true for empty string", () => {
    expect(isPlaceholderToken("")).toBe(true);
  });

  it("returns true for replace_with_ prefix", () => {
    expect(isPlaceholderToken("replace_with_strong_secret")).toBe(true);
  });

  it("returns true for changeme prefix", () => {
    expect(isPlaceholderToken("changeme")).toBe(true);
  });

  it("returns true for your_token_here prefix", () => {
    expect(isPlaceholderToken("your_token_here_something")).toBe(true);
  });

  it("returns true for dev- prefix", () => {
    expect(isPlaceholderToken("dev-local")).toBe(true);
  });

  it("is case-insensitive (REPLACE_WITH_ uppercase)", () => {
    expect(isPlaceholderToken("REPLACE_WITH_TOKEN")).toBe(true);
  });

  it("is case-insensitive (DEV- uppercase)", () => {
    expect(isPlaceholderToken("DEV-LOCAL")).toBe(true);
  });

  it("returns false for a valid-looking token", () => {
    expect(isPlaceholderToken("abc123securetoken")).toBe(false);
  });

  it("returns false for a hex string", () => {
    expect(isPlaceholderToken("a1b2c3d4e5f6g7h8i9j0")).toBe(false);
  });
});
