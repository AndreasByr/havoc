<template>
  <div v-if="loading" class="flex min-h-32 items-center justify-center text-[var(--color-text-muted)]">Loading…</div>
  <div v-else-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
  <component :is="appComponent" v-else-if="appComponent" />
  <div v-else class="flex min-h-32 items-center justify-center text-[var(--color-text-muted)]">No component available for this page.</div>
</template>

<script setup lang="ts">
import { parse as parseSfc } from "vue/compiler-sfc";
import { createAppFirstTranslator, normalizeAppMessages } from "../../../utils/app-i18n";

definePageMeta({ ssr: false });

const route = useRoute();
const nuxtApp = useNuxtApp();
const { locale: currentLocale } = useI18n();

const appId = route.params.appId as string;
const pagePath = computed(() => {
  const slug = Array.isArray(route.params.slug)
    ? (route.params.slug as string[]).join("/")
    : ((route.params.slug as string) ?? "");
  return slug ? `/apps/${appId}/${slug}` : `/apps/${appId}`;
});

const loading = ref(true);
const errorMsg = ref<string | null>(null);
const appComponent = shallowRef<object | null>(null);

/** vue3-sfc-loader has no Nuxt auto-import; inject named imports from @guildora/hub when the script uses them unqualified. */
const HUB_AUTO_IMPORT_NAMES = ["useI18n", "useAuth", "useFetch", "$fetch", "useRouter", "useRoute"] as const;

/** Replace Nuxt-specific template components with their vue-router equivalents. */
function replaceNuxtComponents(sfcSource: string): string {
  return sfcSource
    .replace(/<NuxtLink\b/g, "<RouterLink")
    .replace(/<\/NuxtLink>/g, "</RouterLink>");
}

function injectGuildoraHubAutoImports(sfcSource: string): string {
  const { descriptor, errors } = parseSfc(sfcSource, { filename: "guildora-app-page.vue" });
  if (errors.length > 0) {
    return sfcSource;
  }
  const block = descriptor.scriptSetup;
  if (!block?.content || !block.loc) {
    return sfcSource;
  }
  const body = block.content;
  const needed: string[] = [];
  for (const name of HUB_AUTO_IMPORT_NAMES) {
    const esc = name.startsWith("$") ? `\\${name}` : name;
    if (!new RegExp(`\\b${esc}\\s*\\(`).test(body)) {
      continue;
    }
    const hasNamed = new RegExp(`import\\s*\\{[^}]*\\b${esc}\\b`, "m").test(body);
    const hasNs = new RegExp(`import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]@guildora/hub['"]`, "m").test(body);
    if (!hasNamed && !hasNs) {
      needed.push(name);
    }
  }
  if (needed.length === 0) {
    return sfcSource;
  }
  const importLine = `import { ${needed.join(", ")} } from '@guildora/hub';\n`;
  const { start, end } = block.loc;
  return sfcSource.slice(0, start.offset) + importLine + body + sfcSource.slice(end.offset);
}

async function fetchAppMessages(locale: "de" | "en") {
  try {
    const response = await $fetch(`/api/apps/${appId}/_messages`, {
      query: { locale }
    });
    return normalizeAppMessages(response);
  } catch {
    return {};
  }
}

/** Normalize a path by collapsing `.` and `..` segments. */
function normalizePath(path: string): string {
  const parts = path.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      result.pop();
    } else {
      result.push(part);
    }
  }
  return "/" + result.join("/");
}

/** Process a Vue SFC source: replace Nuxt components and inject auto-imports. */
function processVueSfc(raw: string): string {
  return injectGuildoraHubAutoImports(replaceNuxtComponents(raw));
}

async function loadPage(currentPagePath: string) {
  loading.value = true;
  errorMsg.value = null;
  appComponent.value = null;

  const sfcLoader = nuxtApp.$sfcLoader as { loadModule: (path: string, opts: Record<string, unknown>) => Promise<unknown> } | undefined;
  if (!sfcLoader) {
    errorMsg.value = "SFC loader not available.";
    loading.value = false;
    return;
  }

  // Fetch SFC source and component path from page-source endpoint
  let source: string | null = null;
  let componentPath: string | null = null;
  try {
    const res = await fetch(`/api/apps/${appId}/_page-source?path=${encodeURIComponent(currentPagePath)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json() as { source: string; component: string };
    source = json.source;
    componentPath = json.component;
  } catch (e: unknown) {
    errorMsg.value = `Failed to load page source: ${(e as Error).message}`;
    loading.value = false;
    return;
  }

  if (!source || !componentPath) {
    errorMsg.value = "Page source is empty.";
    loading.value = false;
    return;
  }

  // Build a module cache with Vue and hub-provided composables
  const vue = await import("vue");
  const vueI18n = await import("vue-i18n");
  const vueRouter = await import("vue-router");
  const appMessages = await fetchAppMessages(currentLocale.value === "de" ? "de" : "en");

  const sdkMock = {
    useAppFetch: (path: string, opts?: RequestInit) => {
      const data = vue.ref<unknown>(null);
      const pending = vue.ref(true);
      const error = vue.ref<unknown>(null);
      fetch(`/api/apps/${appId}/${path.replace(/^\//, "")}`, opts)
        .then((r) => r.json())
        .then((d: unknown) => { data.value = d; })
        .catch((e: unknown) => { error.value = e; })
        .finally(() => { pending.value = false; });
      return { data, pending, error };
    }
  };

  const hubModule = {
    useI18n(...args: unknown[]) {
      if (args.length > 0) {
        return vueI18n.useI18n(args[0] as never);
      }

      const globalComposer = vueI18n.useI18n({ useScope: "global" });
      const activeLocale = globalComposer.locale.value === "de" ? "de" : "en";
      const appComposer = vueI18n.useI18n({
        useScope: "local",
        inheritLocale: true,
        messages: {
          [activeLocale]: appMessages
        }
      });

      const t = createAppFirstTranslator({
        appT: appComposer.t as (key: string, ...params: unknown[]) => string,
        appTe: appComposer.te as (key: string) => boolean,
        globalT: globalComposer.t as (key: string, ...params: unknown[]) => string
      });

      return { ...globalComposer, t };
    },
    useAuth,
    useRouter: vueRouter.useRouter,
    useRoute: vueRouter.useRoute,
    $fetch,
    async useFetch(url: string, opts?: Parameters<typeof $fetch>[1]) {
      const data = vue.ref<unknown>(null);
      const pending = vue.ref(true);
      const error = vue.ref<unknown>(null);
      async function refresh() {
        pending.value = true;
        error.value = null;
        try {
          data.value = await $fetch(url, opts);
        } catch (e: unknown) {
          error.value = e;
        } finally {
          pending.value = false;
        }
      }
      await refresh();
      return { data, pending, error, refresh };
    }
  };

  // Use repo-relative path as the SFC URL so relative imports resolve correctly
  const prefix = `/app-sfc/${appId}/`;
  const sfcUrl = `${prefix}${componentPath}`;
  const sfcSource = processVueSfc(source);

  const options = {
    moduleCache: {
      vue,
      "vue-i18n": vueI18n,
      "vue-router": vueRouter,
      "@guildora/app-sdk": sdkMock,
      "@guildora/hub": hubModule
    },
    pathResolve({ refPath, relPath }: { refPath: string; relPath: string }) {
      // Bare module specifiers (e.g. "vue", "@guildora/hub") — return as-is for moduleCache lookup
      if (!relPath.startsWith(".") && !relPath.startsWith("/")) {
        return relPath;
      }
      // Resolve relative to the importing file
      if (refPath) {
        const refDir = refPath.substring(0, refPath.lastIndexOf("/"));
        return normalizePath(refDir + "/" + relPath);
      }
      return relPath;
    },
    async getFile(url: string) {
      const urlStr = typeof url === "string" ? url : String(url);

      // Extract repo-relative path from the synthetic URL
      const repoPath = urlStr.startsWith(prefix)
        ? urlStr.slice(prefix.length)
        : urlStr;

      // Main page component — return pre-processed source
      if (repoPath === componentPath) {
        const ext = repoPath.substring(repoPath.lastIndexOf("."));
        return { getContentData: () => sfcSource, type: ext || ".vue" };
      }

      // Fetch sub-component / dependency from the _source endpoint
      const res = await fetch(`/api/apps/${appId}/_source?file=${encodeURIComponent(repoPath)}`);
      if (!res.ok) {
        throw new Error(`Failed to load '${repoPath}': ${res.status} ${res.statusText}`);
      }
      const content = await res.text();

      const ext = repoPath.substring(repoPath.lastIndexOf("."));
      // Apply auto-imports and NuxtLink replacement to sub-component .vue files too
      const processed = ext === ".vue" ? processVueSfc(content) : content;

      return { getContentData: () => processed, type: ext || ".js" };
    },
    async handleModule(type: string, getContentData: (asBinary: boolean) => string | Promise<string>) {
      if (type === ".json") {
        const content = await getContentData(false);
        return JSON.parse(content as string);
      }
      return undefined;
    },
    additionalBabelParserPlugins: ["typescript"],
    addStyle(textContent: string) {
      const style = document.createElement("style");
      style.textContent = textContent;
      document.head.appendChild(style);
    }
  };

  try {
    const Component = await sfcLoader.loadModule(sfcUrl, options);
    appComponent.value = defineAsyncComponent(() => Promise.resolve(Component as Parameters<typeof defineAsyncComponent>[0] extends () => Promise<infer T> ? T : never));
  } catch (e: unknown) {
    errorMsg.value = `Failed to render component: ${(e as Error).message}`;
  } finally {
    loading.value = false;
  }
}

onMounted(() => loadPage(pagePath.value));
watch(pagePath, (newPath) => loadPage(newPath));
</script>
