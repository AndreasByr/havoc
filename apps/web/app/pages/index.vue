<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
const { locale } = useI18n();
const { fetchLandingPage } = useLanding();
const { data: landingPage } = await useAsyncData("landing-page", () =>
  fetchLandingPage(locale.value === "de" ? "de" : "en")
);

const isPreview = computed(() => route.query.preview === "true");

interface PreviewSection {
  id: string;
  blockType: string;
  sortOrder: number;
  config: Record<string, unknown>;
  content: Record<string, unknown>;
}

interface LandingColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  border: string;
}

const previewSections = ref<PreviewSection[] | null>(null);
const previewCustomCss = ref<string | null>(null);
const previewColors = ref<LandingColors | null>(null);
const previewTemplateId = ref<string | null>(null);

const activeSections = computed(() =>
  previewSections.value ?? landingPage.value?.sections ?? []
);

const activeCustomCss = computed(() =>
  previewCustomCss.value ?? landingPage.value?.customCss ?? null
);

const activeColors = computed<LandingColors | null>(() =>
  previewColors.value ?? landingPage.value?.colors ?? null
);

const activeTemplateId = computed(() =>
  previewTemplateId.value ?? landingPage.value?.template?.id ?? "default"
);

const landingColorStyle = computed(() => {
  const c = activeColors.value;
  if (!c) return "";
  return [
    `--landing-background:${c.background}`,
    `--landing-surface:${c.surface}`,
    `--landing-text:${c.text}`,
    `--landing-text-muted:${c.textMuted}`,
    `--landing-accent:${c.accent}`,
    `--landing-accent-text:${c.accentText}`,
    `--landing-border:${c.border}`,
  ].join(";");
});

const hubLoginUrl = computed(() => {
  const rawHubUrl = String(config.public.hubUrl || "").trim() || "http://localhost:3003";

  try {
    const endpoint = new URL("/login", rawHubUrl);
    endpoint.searchParams.set("returnTo", "/dashboard");
    return endpoint.toString();
  } catch {
    return "http://localhost:3003/login?returnTo=%2Fdashboard";
  }
});

if (landingPage.value?.meta?.title) {
  useSeoMeta({
    title: landingPage.value.meta.title,
    description: landingPage.value.meta.description
  });
}

onMounted(() => {
  if (!isPreview.value) return;

  const allowedOrigin = String(config.public.hubUrl || "").replace(/\/+$/, "");

  window.addEventListener("message", (event) => {
    if (allowedOrigin && event.origin !== allowedOrigin) return;
    if (!event.data || typeof event.data !== "object") return;
    const msg = event.data as { type?: string; sections?: PreviewSection[]; customCss?: string | null; colors?: LandingColors | null; templateId?: string | null };

    if (msg.type === "landing-preview-update") {
      if (msg.sections) previewSections.value = msg.sections;
      if (msg.customCss !== undefined) previewCustomCss.value = msg.customCss;
      if (msg.colors !== undefined) previewColors.value = msg.colors;
      if (msg.templateId !== undefined) previewTemplateId.value = msg.templateId;
    }
  });
});
</script>

<template>
  <div :class="['space-y-6', isPreview && 'landing-preview-kiosk']" :style="landingColorStyle" :data-template="activeTemplateId">
    <div v-if="activeSections.length === 0 && !isPreview" class="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-8 text-center">
      <span>{{ $t("landing.fallbackText") }}</span>
      <a :href="hubLoginUrl" class="block mt-3 font-semibold text-[var(--color-accent)]">{{ $t("nav.login") }}</a>
    </div>
    <div v-else-if="activeSections.length === 0 && isPreview" class="flex items-center justify-center min-h-[50vh] text-sm opacity-40">
      {{ $t("landing.fallbackText") }}
    </div>
    <template v-else>
      <LandingBlockRenderer
        v-for="section in activeSections"
        :key="section.id"
        :section="section"
      />
    </template>

    <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
    <component v-if="activeCustomCss" :is="'style'" v-text="activeCustomCss" />
  </div>
</template>

<style scoped>
.landing-preview-kiosk {
  pointer-events: none;
  user-select: none;
}

.landing-preview-kiosk :deep(a),
.landing-preview-kiosk :deep(button),
.landing-preview-kiosk :deep(input),
.landing-preview-kiosk :deep(select),
.landing-preview-kiosk :deep(textarea) {
  pointer-events: none !important;
  cursor: default !important;
}
</style>
