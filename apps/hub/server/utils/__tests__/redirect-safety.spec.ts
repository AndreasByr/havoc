import { describe, expect, it } from "vitest";
import { normalizeReturnTo } from "../redirect-safety";

describe("normalizeReturnTo", () => {
  it("returns fallback /dashboard for null", () => {
    expect(normalizeReturnTo(null)).toBe("/dashboard");
  });

  it("returns fallback /dashboard for undefined", () => {
    expect(normalizeReturnTo(undefined)).toBe("/dashboard");
  });

  it("returns fallback /dashboard for empty string", () => {
    expect(normalizeReturnTo("")).toBe("/dashboard");
  });

  it("allows valid relative path /settings", () => {
    expect(normalizeReturnTo("/settings")).toBe("/settings");
  });

  it("blocks double-slash attack //evil.com", () => {
    expect(normalizeReturnTo("//evil.com")).toBe("/dashboard");
  });

  it("blocks absolute URL https://evil.com", () => {
    expect(normalizeReturnTo("https://evil.com")).toBe("/dashboard");
  });

  it("preserves query parameters on valid paths", () => {
    expect(normalizeReturnTo("/valid?query=1")).toBe("/valid?query=1");
  });

  it("blocks URL-encoded double-slash %2F%2Fevil.com", () => {
    expect(normalizeReturnTo("%2F%2Fevil.com")).toBe("/dashboard");
  });

  it("supports custom fallback parameter", () => {
    expect(normalizeReturnTo(null, "/home")).toBe("/home");
    expect(normalizeReturnTo("https://evil.com", "/home")).toBe("/home");
  });

  it("blocks javascript: protocol", () => {
    expect(normalizeReturnTo("javascript:alert(1)")).toBe("/dashboard");
  });

  it("blocks data: protocol", () => {
    expect(normalizeReturnTo("data:text/html,<h1>hi</h1>")).toBe("/dashboard");
  });

  it("handles malformed percent-encoding gracefully", () => {
    expect(normalizeReturnTo("%zz/test")).toBe("/dashboard");
  });
});
