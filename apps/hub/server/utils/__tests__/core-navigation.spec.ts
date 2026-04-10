import { describe, expect, it } from "vitest";
import { getLocalizedCoreNavigation, resolveNavigationLocale } from "../core-navigation";

describe("core navigation localization", () => {
  it("resolves supported locales and falls back to en", () => {
    expect(resolveNavigationLocale("de")).toBe("de");
    expect(resolveNavigationLocale("EN")).toBe("en");
    expect(resolveNavigationLocale("fr")).toBe("en");
    expect(resolveNavigationLocale(undefined)).toBe("en");
  });

  it("returns key-based labels and no docs route", () => {
    const de = getLocalizedCoreNavigation("de");
    const en = getLocalizedCoreNavigation("en");

    expect(de.coreRailItems.find((item) => item.id === "members")?.labelKey).toBe("nav.members");
    expect(en.coreRailItems.find((item) => item.id === "members")?.label).toBe("Members");

    // No docs route exists
    expect(de.coreRailItems.some((item) => item.to === "/docs")).toBe(false);
    expect(en.coreRailItems.some((item) => item.to === "/docs")).toBe(false);
    expect(de.corePanelGroups.some((group) => group.items.some((item) => item.to === "/docs"))).toBe(false);
    expect(en.corePanelGroups.some((group) => group.items.some((item) => item.to === "/docs"))).toBe(false);

    // Settings routes exist under /settings/
    expect(de.corePanelGroups.some((group) => group.items.some((item) => item.to === "/settings/design"))).toBe(true);
    expect(en.corePanelGroups.some((group) => group.items.some((item) => item.to === "/settings/design"))).toBe(true);
    expect(de.corePanelGroups.some((group) => group.items.some((item) => item.to === "/settings/permissions"))).toBe(true);
    expect(en.corePanelGroups.some((group) => group.items.some((item) => item.to === "/settings/permissions"))).toBe(true);
    expect(de.corePanelGroups.some((group) => group.items.some((item) => item.to === "/settings/community"))).toBe(true);
    expect(en.corePanelGroups.some((group) => group.items.some((item) => item.to === "/settings/community"))).toBe(true);
  });

  it("limits landing route to admin when moderator access is disabled", () => {
    const result = getLocalizedCoreNavigation("en", { allowModeratorCmsAccess: false });
    const landingPanelItem = result.corePanelGroups
      .find((group) => group.id === "landing-main")
      ?.items.find((item) => item.id === "landing-editor");

    expect(landingPanelItem?.requiredRoles).toEqual(["admin", "superadmin"]);
  });
});
