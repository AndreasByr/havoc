import { describe, expect, it } from "vitest";
import { bundleEntrypoint, discoverLocalIncludableFiles } from "../app-sideload";
import type { AppManifest } from "@guildora/shared";
import { join } from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("bundleEntrypoint", () => {
  it("bundles a TypeScript entrypoint with relative imports into CJS", async () => {
    const files: Record<string, string> = {
      "src/api/overview.get.ts": `
        import { loadTempVoiceConfig } from "../bot/configLoader"
        export default defineEventHandler(() => {
          const config = loadTempVoiceConfig({})
          return { enabled: config.enabled }
        })
      `,
      "src/bot/configLoader.ts": `
        export function loadTempVoiceConfig() {
          return { enabled: true }
        }
      `
    };

    const code = await bundleEntrypoint("src/api/overview.get.ts", async (filePath) => files[filePath] ?? null);

    expect(code).toContain("module.exports");
    expect(code).not.toContain("require(\"../bot/configLoader\")");
  });

  it("throws a readable error when an import cannot be resolved", async () => {
    const files: Record<string, string> = {
      "src/api/overview.get.ts": `
        import { missing } from "./missing"
        export default defineEventHandler(() => ({ missing }))
      `
    };

    await expect(bundleEntrypoint("src/api/overview.get.ts", async (filePath) => files[filePath] ?? null)).rejects.toThrow(
      "Failed to bundle entrypoint 'src/api/overview.get.ts'"
    );
  });
});

describe("discoverLocalIncludableFiles", () => {
  let tempDir: string;

  const baseManifest: AppManifest = {
    id: "test-app",
    name: "Test App",
    version: "1.0.0",
    author: "Test",
    description: "Test app",
    permissions: [],
    navigation: { rail: [], panelGroups: [], panelEntries: [] },
    pages: [],
    apiRoutes: [],
    botHooks: [],
    botCommands: [],
    configFields: [],
    includes: [],
    requiredEnv: [],
    migrations: [],
    compatibility: { core: { minVersion: "0.1.0" } }
  };

  async function createTempApp(files: Record<string, string>) {
    tempDir = await mkdtemp(join(tmpdir(), "guildora-test-"));
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(tempDir, filePath);
      await mkdir(join(fullPath, ".."), { recursive: true });
      await writeFile(fullPath, content);
    }
  }

  it("discovers .vue files under src/components/", async () => {
    await createTempApp({
      "src/components/MultiSelect.vue": "<template><div /></template>",
      "src/components/nested/Card.vue": "<template><div /></template>",
      "src/pages/index.vue": "<template><div /></template>"
    });

    const result = await discoverLocalIncludableFiles(tempDir, baseManifest, new Set());
    expect(result).toContain("src/components/MultiSelect.vue");
    expect(result).toContain("src/components/nested/Card.vue");
    // pages/ is not an includable directory
    expect(result).not.toContain("src/pages/index.vue");
    await rm(tempDir, { recursive: true });
  });

  it("discovers .ts files under src/composables/ and src/utils/", async () => {
    await createTempApp({
      "src/composables/useCounter.ts": "export function useCounter() {}",
      "src/utils/helpers.ts": "export function format() {}",
      "src/utils/data.json": "{}"
    });

    const result = await discoverLocalIncludableFiles(tempDir, baseManifest, new Set());
    expect(result).toContain("src/composables/useCounter.ts");
    expect(result).toContain("src/utils/helpers.ts");
    expect(result).toContain("src/utils/data.json");
    await rm(tempDir, { recursive: true });
  });

  it("excludes already-collected files", async () => {
    await createTempApp({
      "src/components/MultiSelect.vue": "<template><div /></template>"
    });

    const already = new Set(["src/components/MultiSelect.vue"]);
    const result = await discoverLocalIncludableFiles(tempDir, baseManifest, already);
    expect(result).not.toContain("src/components/MultiSelect.vue");
    await rm(tempDir, { recursive: true });
  });

  it("merges manifest.includes with auto-discovered files", async () => {
    await createTempApp({
      "src/components/Card.vue": "<template><div /></template>",
      "src/lib/custom.ts": "export const x = 1;"
    });

    const manifest = { ...baseManifest, includes: ["src/lib/custom.ts"] };
    const result = await discoverLocalIncludableFiles(tempDir, manifest, new Set());
    expect(result).toContain("src/components/Card.vue");
    expect(result).toContain("src/lib/custom.ts");
    await rm(tempDir, { recursive: true });
  });

  it("caps at 50 files", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 60; i++) {
      files[`src/components/C${i}.vue`] = "<template><div /></template>";
    }
    await createTempApp(files);

    const result = await discoverLocalIncludableFiles(tempDir, baseManifest, new Set());
    expect(result.length).toBeLessThanOrEqual(50);
    await rm(tempDir, { recursive: true });
  });

  it("returns empty array when src/ does not exist", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "guildora-test-"));
    const result = await discoverLocalIncludableFiles(tempDir, baseManifest, new Set());
    expect(result).toEqual([]);
    await rm(tempDir, { recursive: true });
  });
});
