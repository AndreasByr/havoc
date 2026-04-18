import { describe, expect, it } from "vitest";
import { isPlaceholderToken, PLACEHOLDER_PREFIXES } from "../utils/startup-checks.js";

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
    expect(isPlaceholderToken("replace_with_secret")).toBe(true);
  });

  it("returns true for changeme prefix", () => {
    expect(isPlaceholderToken("changeme")).toBe(true);
  });

  it("returns true for your_token_here prefix", () => {
    expect(isPlaceholderToken("your_token_here")).toBe(true);
  });

  it("returns true for dev- prefix", () => {
    expect(isPlaceholderToken("dev-local")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isPlaceholderToken("REPLACE_WITH_TOKEN")).toBe(true);
  });

  it("returns false for a valid token", () => {
    expect(isPlaceholderToken("abc123securetoken")).toBe(false);
  });
});
