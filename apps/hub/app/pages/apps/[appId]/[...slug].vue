<template>
  <div v-if="loading" class="flex min-h-32 items-center justify-center text-[var(--color-text-muted)]">Loading…</div>
  <div v-else-if="errorMsg" class="rounded-lg border border-red-400 bg-red-50 p-4 text-red-700">{{ errorMsg }}</div>
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

  // Fetch SFC source from page-source endpoint
  let source: string | null = null;
  try {
    const res = await fetch(`/api/apps/${appId}/_page-source?path=${encodeURIComponent(currentPagePath)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    source = await res.text();
  } catch (e: unknown) {
    errorMsg.value = `Failed to load page source: ${(e as Error).message}`;
    loading.value = false;
    return;
  }

  if (!source) {
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

  const sfcSource = injectGuildoraHubAutoImports(replaceNuxtComponents(source));
  const options = {
    moduleCache: {
      vue,
      "vue-i18n": vueI18n,
      "vue-router": vueRouter,
      "@guildora/app-sdk": sdkMock,
      "@guildora/hub": hubModule
    },
    async getFile() {
      return sfcSource;
    },
    addStyle(textContent: string) {
      const style = document.createElement("style");
      style.textContent = textContent;
      document.head.appendChild(style);
    }
  };

  try {
    const Component = await sfcLoader.loadModule(`/app-sfc/${appId}${currentPagePath}.vue`, options);
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
