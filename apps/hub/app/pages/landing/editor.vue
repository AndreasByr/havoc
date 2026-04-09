<script setup lang="ts">
import type { TourStep } from "~/composables/useOnboardingTour";
import { TEMPLATE_COLOR_DEFAULTS, LANDING_COLOR_KEYS, resolveLandingColors, isValidHexColor, migrateColorOverrides } from "@guildora/shared";
import type { LandingColorPalette, PerTemplateColorOverrides, LandingColorOverrides } from "@guildora/shared";

definePageMeta({
  middleware: ["landing"],
});

const lastPath = useCookie<string | null>("guildora_landing_last_path", { sameSite: "lax" });
lastPath.value = "/landing/editor";

const { t } = useI18n();
const { user } = useAuth();
const runtimeConfig = useRuntimeConfig();
const isDev = runtimeConfig.public.isDev;
const landingUrl = String(runtimeConfig.public.landingUrl || runtimeConfig.public.appUrl || "http://localhost:3000").replace(/\/+$/, ""); // kept for "View Live" link

interface LandingSection {
  id: string;
  blockType: string;
  sortOrder: number;
  visible: boolean;
  status: "draft" | "published";
  config: Record<string, unknown>;
  content: Record<string, unknown>;
}

interface LandingVersion {
  id: string;
  label: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface BlockType {
  type: string;
  name: { en: string; de: string };
  description: { en: string; de: string };
  icon: string;
}

interface LandingTemplate {
  id: string;
  name: string;
  description: string | null;
}

interface PageConfig {
  id?: number;
  activeTemplate: string;
  customCss: string | null;
  colorOverrides: PerTemplateColorOverrides;
  metaTitle: string | null;
  metaDescription: string | null;
  enabledLocales: string[];
  publishedAt: string | null;
}

const loading = ref(true);
const saving = ref(false);
const saveSuccess = ref("");
const saveError = ref("");

const sections = ref<LandingSection[]>([]);
const blockTypes = ref<BlockType[]>([]);
const templates = ref<LandingTemplate[]>([]);
const pageConfig = ref<PageConfig>({ activeTemplate: "default", customCss: null, colorOverrides: {}, metaTitle: null, metaDescription: null, enabledLocales: ["en"], publishedAt: null });
// Color editor moved to settings page — color state kept for preview

const showBlockCatalog = ref(false);
const editingSection = ref<LandingSection | null>(null);
const editLocale = ref<string>("en");

// Application flows for the applications block config
interface AppFlow { id: string; name: string; status: string }
const applicationFlows = ref<AppFlow[]>([]);

const draggedIndex = ref<number | null>(null);
const showPreview = ref(false);
const landingPreviewOpen = useState<boolean>("landing-preview-open", () => false);
const previewWidth = ref(400);
const isResizingPreview = ref(false);

watch(showPreview, (val) => { landingPreviewOpen.value = val; });
onBeforeUnmount(() => { landingPreviewOpen.value = false; });

function onResizeStart(e: PointerEvent) {
  e.preventDefault();
  isResizingPreview.value = true;
  const startX = e.clientX;
  const startWidth = previewWidth.value;

  function onMove(ev: PointerEvent) {
    const delta = startX - ev.clientX;
    previewWidth.value = Math.max(280, Math.min(startWidth + delta, window.innerWidth * 0.65));
  }

  function onUp() {
    isResizingPreview.value = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// History
const showHistory = ref(false);
const versions = ref<LandingVersion[]>([]);

// Dirty tracking
const hasUnsavedChanges = ref(false);
const initialSeoState = ref<{ metaTitle: string | null; metaDescription: string | null }>({ metaTitle: null, metaDescription: null });

const seoIsDirty = computed(() =>
  pageConfig.value.metaTitle !== initialSeoState.value.metaTitle ||
  pageConfig.value.metaDescription !== initialSeoState.value.metaDescription
);

function markDirty() {
  hasUnsavedChanges.value = true;
}

// Computed
const enabledLocales = computed(() => pageConfig.value.enabledLocales || ["en"]);
const isMultiLang = computed(() => enabledLocales.value.length > 1);


// ─── Onboarding Tour ──────────────────────────────────────────────────────

const tourSteps = computed<TourStep[]>(() => {
  const steps: TourStep[] = [
    { target: ".landing-block-list", title: t("landingEditor.tour.sectionsTitle"), description: t("landingEditor.tour.sectionsDesc"), placement: "bottom" },
    { target: ".landing-block-item", title: t("landingEditor.tour.blockItemTitle"), description: t("landingEditor.tour.blockItemDesc"), placement: "right" },
    { target: ".landing-add-block", title: t("landingEditor.tour.addBlockTitle"), description: t("landingEditor.tour.addBlockDesc"), placement: "bottom" },
    { target: ".landing-publish-toolbar", title: t("landingEditor.tour.publishTitle"), description: t("landingEditor.tour.publishDesc"), placement: "bottom" },
    { target: ".landing-seo-section", title: t("landingEditor.tour.seoTitle"), description: t("landingEditor.tour.seoDesc"), placement: "top" },
    { target: "a[href='/landing/settings']", title: t("landingEditor.tour.settingsTitle"), description: t("landingEditor.tour.settingsDesc"), placement: "right" },
  ];
  if (isMultiLang.value) {
    steps.push({ target: ".landing-locale-switcher", title: t("landingEditor.tour.localeTitle"), description: t("landingEditor.tour.localeDesc"), placement: "bottom" });
  }
  return steps;
});

const tour = useOnboardingTour("landing_editor", tourSteps.value, user.value?.id);

function resetTour() {
  tour.reset();
  tour.start();
}

// ─── Data Loading ──────────────────────────────────────────────────────────

async function loadData() {
  loading.value = true;
  try {
    const [pageData, blocksData, flowsData] = await Promise.all([
      $fetch<{ page: PageConfig | null; templates: LandingTemplate[]; sections: LandingSection[] }>("/api/admin/landing/page"),
      $fetch<{ blocks: BlockType[] }>("/api/admin/landing/blocks"),
      $fetch<{ flows: AppFlow[] }>("/api/applications/flows").catch(() => ({ flows: [] as AppFlow[] }))
    ]);
    sections.value = pageData.sections;
    templates.value = pageData.templates;
    blockTypes.value = blocksData.blocks;
    applicationFlows.value = flowsData.flows.filter((f) => f.status === "active");
    if (pageData.page) {
      const rawOverrides = (pageData.page as Record<string, unknown>).colorOverrides as Record<string, unknown> ?? {};
      pageConfig.value = {
        ...pageData.page,
        colorOverrides: migrateColorOverrides(rawOverrides, pageData.page.activeTemplate),
        enabledLocales: pageData.page.enabledLocales || ["en"]
      };
    }
    // Set edit locale to first enabled locale
    if (!enabledLocales.value.includes(editLocale.value)) {
      editLocale.value = enabledLocales.value[0] || "en";
    }
    // Snapshot SEO state for dirty tracking
    initialSeoState.value = { metaTitle: pageConfig.value.metaTitle, metaDescription: pageConfig.value.metaDescription };
    hasUnsavedChanges.value = false;
  } catch {
    saveError.value = "Failed to load landing page data.";
  } finally {
    loading.value = false;
  }
}

async function addBlock(blockType: string) {
  saving.value = true;
  try {
    // Initialize content for all enabled locales
    const defaultContent: Record<string, Record<string, unknown>> = {};
    for (const loc of enabledLocales.value) {
      defaultContent[loc] = {};
    }
    const { section } = await $fetch<{ section: LandingSection }>("/api/admin/landing/sections", {
      method: "POST",
      body: {
        blockType,
        sortOrder: sections.value.length,
        content: defaultContent
      }
    });
    sections.value.push(section);
    showBlockCatalog.value = false;
    flashSuccess();
  } catch {
    saveError.value = "Failed to add block.";
  } finally {
    saving.value = false;
  }
}

async function removeSection(id: string) {
  if (!confirm(t("landingEditor.removeBlockConfirm"))) return;
  saving.value = true;
  try {
    await $fetch(`/api/admin/landing/sections/${id}`, { method: "DELETE" });
    sections.value = sections.value.filter((s) => s.id !== id);
    if (editingSection.value?.id === id) editingSection.value = null;
    flashSuccess();
  } catch {
    saveError.value = "Failed to remove block.";
  } finally {
    saving.value = false;
  }
}

async function toggleVisibility(section: LandingSection) {
  saving.value = true;
  try {
    await $fetch(`/api/admin/landing/sections/${section.id}`, {
      method: "PUT",
      body: { visible: !section.visible }
    });
    section.visible = !section.visible;
  } catch {
    saveError.value = "Failed to toggle visibility.";
  } finally {
    saving.value = false;
  }
}

async function saveSortOrder() {
  saving.value = true;
  try {
    const order = sections.value.map((s, i) => ({ id: s.id, sortOrder: i }));
    await $fetch("/api/admin/landing/sections/reorder", {
      method: "PUT",
      body: { order }
    });
    sections.value.forEach((s, i) => { s.sortOrder = i; });
  } catch {
    saveError.value = "Failed to reorder blocks.";
  } finally {
    saving.value = false;
  }
}

const showResetConfirm = ref(false);

async function resetToTemplate() {
  showResetConfirm.value = false;
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/reset", { method: "POST" });
    await loadData();
    editingSection.value = null;
    flashSuccess();
  } catch {
    saveError.value = "Failed to reset.";
  } finally {
    saving.value = false;
  }
}

const hasDrafts = computed(() => sections.value.some((s) => s.status === "draft"));
const draftCount = computed(() => sections.value.filter((s) => s.status === "draft").length);
const isPagePublished = computed(() => !!pageConfig.value.publishedAt);
const showPublishConfirm = ref(false);
const showUnpublishConfirm = ref(false);

async function saveAll() {
  saving.value = true;
  try {
    // Save all sections that are being edited (have content)
    const sectionSaves = sections.value.map((s) =>
      $fetch<{ section: LandingSection }>(`/api/admin/landing/sections/${s.id}`, {
        method: "PUT",
        body: { content: s.content, config: s.config }
      }).then(({ section: updated }) => { s.status = updated.status; })
    );

    // Save page-level settings (SEO + colors)
    const seoSave = seoIsDirty.value || hasUnsavedChanges.value
      ? $fetch("/api/admin/landing/page", {
          method: "PUT",
          body: {
            metaTitle: pageConfig.value.metaTitle,
            metaDescription: pageConfig.value.metaDescription,
            colorOverrides: pageConfig.value.colorOverrides
          }
        })
      : Promise.resolve();

    await Promise.all([...sectionSaves, seoSave]);
    initialSeoState.value = { metaTitle: pageConfig.value.metaTitle, metaDescription: pageConfig.value.metaDescription };
    hasUnsavedChanges.value = false;
    flashSuccess();
  } catch {
    saveError.value = "Failed to save.";
  } finally {
    saving.value = false;
  }
}

async function publishAll() {
  saving.value = true;
  try {
    // Save everything first, then publish
    await saveAll();
    await $fetch("/api/admin/landing/publish", { method: "POST" });
    sections.value.forEach((s) => { s.status = "published"; });
    pageConfig.value.publishedAt = new Date().toISOString();
    showPublishConfirm.value = false;
    flashSuccess();
  } catch {
    saveError.value = "Failed to publish.";
  } finally {
    saving.value = false;
  }
}

async function unpublish() {
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/unpublish", { method: "POST" });
    sections.value.forEach((s) => { s.status = "draft"; });
    pageConfig.value.publishedAt = null;
    showUnpublishConfirm.value = false;
    flashSuccess();
  } catch {
    saveError.value = "Failed to unpublish.";
  } finally {
    saving.value = false;
  }
}

// ─── History ──────────────────────────────────────────────────────────────

async function loadVersions() {
  try {
    const data = await $fetch<{ versions: LandingVersion[] }>("/api/admin/landing/versions");
    versions.value = data.versions;
  } catch {
    saveError.value = "Failed to load version history.";
  }
}

async function restoreVersion(versionId: string) {
  if (!confirm(t("landingEditor.restoreConfirm"))) return;
  saving.value = true;
  try {
    await $fetch(`/api/admin/landing/versions/${versionId}/restore`, { method: "POST" });
    await loadData();
    showHistory.value = false;
    editingSection.value = null;
    flashSuccess();
  } catch {
    saveError.value = "Failed to restore version.";
  } finally {
    saving.value = false;
  }
}

function toggleHistory() {
  showHistory.value = !showHistory.value;
  if (showHistory.value) loadVersions();
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function flashSuccess() {
  saveSuccess.value = t("landingEditor.saved");
  saveError.value = "";
  setTimeout(() => { saveSuccess.value = ""; }, 3000);
}

function blockName(type: string): string {
  const block = blockTypes.value.find((b) => b.type === type);
  if (!block) return type;
  return editLocale.value === "de" ? block.name.de : block.name.en;
}

function localeLabel(code: string): string {
  const labels: Record<string, string> = { en: "English", de: "Deutsch", fr: "Fran\u00e7ais", es: "Espa\u00f1ol", it: "Italiano", pt: "Portugu\u00eas", nl: "Nederlands", pl: "Polski", ru: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439", ja: "\u65e5\u672c\u8a9e", ko: "\ud55c\uad6d\uc5b4", zh: "\u4e2d\u6587", tr: "T\u00fcrk\u00e7e", ar: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" };
  return labels[code] || code.toUpperCase();
}

function onDragStart(index: number) {
  draggedIndex.value = index;
}

function onDragOver(event: DragEvent, index: number) {
  event.preventDefault();
  if (draggedIndex.value === null || draggedIndex.value === index) return;
  const moved = sections.value.splice(draggedIndex.value, 1)[0];
  sections.value.splice(index, 0, moved);
  draggedIndex.value = index;
}

function onDragEnd() {
  draggedIndex.value = null;
  saveSortOrder();
}

function setLocaleContent(section: LandingSection, key: string, value: unknown) {
  const c = section.content as Record<string, Record<string, unknown>>;
  if (!c[editLocale.value]) c[editLocale.value] = {};
  c[editLocale.value][key] = value;
  markDirty();
}

function setConfigValue(section: LandingSection, key: string, value: unknown) {
  const cfg = section.config as Record<string, unknown>;
  cfg[key] = value;
  markDirty();
}

// ─── Landing Color Overrides ─────���────────────────────────────────────────

const activeTemplateOverrides = computed<LandingColorOverrides>(() =>
  pageConfig.value.colorOverrides[pageConfig.value.activeTemplate] ?? {}
);

const templateDefaults = computed<LandingColorPalette>(() =>
  TEMPLATE_COLOR_DEFAULTS[pageConfig.value.activeTemplate] ?? TEMPLATE_COLOR_DEFAULTS.default
);

const resolvedColors = computed<LandingColorPalette>(() =>
  resolveLandingColors(pageConfig.value.activeTemplate, activeTemplateOverrides.value)
);

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

function setColorOverride(key: string, value: string) {
  if (!hexColorRegex.test(value)) return;
  const tid = pageConfig.value.activeTemplate;
  const current = pageConfig.value.colorOverrides[tid] ?? {};
  pageConfig.value.colorOverrides = {
    ...pageConfig.value.colorOverrides,
    [tid]: { ...current, [key]: value.toLowerCase() }
  };
  markDirty();
}

function clearColorOverride(key: string) {
  const tid = pageConfig.value.activeTemplate;
  const current = { ...(pageConfig.value.colorOverrides[tid] ?? {}) };
  delete current[key as keyof typeof current];
  const next = { ...pageConfig.value.colorOverrides };
  if (Object.keys(current).length > 0) {
    next[tid] = current;
  } else {
    delete next[tid];
  }
  pageConfig.value.colorOverrides = next;
  markDirty();
}

onMounted(async () => {
  await loadData();
  if (sections.value.length > 0) {
    nextTick(() => tour.startIfNotSeen(300));
  }
});
</script>

<template>
  <div
    :class="['space-y-6', showPreview ? 'landing-editor-split' : '']"
    :style="showPreview ? `--preview-width: ${previewWidth}px` : undefined"
  >
    <!-- Editor column -->
    <div class="space-y-6 min-w-0">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">{{ t("landingEditor.title") }}</h1>
        <p class="text-sm opacity-60">{{ t("landingEditor.description") }}</p>
      </div>
      <div class="landing-locale-switcher flex items-center gap-2">
        <button
          v-if="isDev"
          class="rounded px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-white/5 transition-colors"
          title="Reset Tutorial (Dev)"
          @click="resetTour"
        >
          Reset Tour
        </button>
        <button
          class="rounded px-2 py-1 text-xs font-medium hover:bg-white/5 transition-colors"
          :title="t('landingEditor.tour.help')"
          @click="tour.start()"
        >
          ?
        </button>
        <!-- Locale switcher: only show when multiple languages are enabled -->
        <div v-if="isMultiLang" class="inline-flex rounded-lg overflow-hidden" style="background: var(--color-surface-3)">
          <button
            v-for="loc in enabledLocales"
            :key="loc"
            :class="['px-3 py-1.5 text-sm font-medium transition-colors', editLocale === loc ? 'bg-white/10' : 'hover:bg-white/5']"
            @click="editLocale = loc"
          >
            {{ loc.toUpperCase() }}
          </button>
        </div>
      </div>
    </div>

    <!-- Status messages -->
    <div v-if="saveSuccess" class="rounded-lg px-4 py-3 text-sm" style="background: rgba(34, 197, 94, 0.1); color: var(--color-success)">{{ saveSuccess }}</div>
    <div v-if="saveError" class="rounded-lg px-4 py-3 text-sm" style="background: rgba(239, 68, 68, 0.1); color: var(--color-error)">{{ saveError }}</div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
    </div>

    <template v-else>
      <!-- ─── Sticky toolbar ─────────────────────────────────────────── -->
      <div class="landing-publish-toolbar sticky top-0 z-20 rounded-xl p-3 flex flex-wrap items-center gap-2" style="background: var(--color-surface-2); box-shadow: var(--shadow-md)">
        <!-- Status badge -->
        <div class="flex items-center gap-2 mr-auto">
          <span v-if="isPagePublished" class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg" style="background: rgba(34, 197, 94, 0.15); color: var(--color-success)">
            <span class="w-1.5 h-1.5 rounded-full" style="background: var(--color-success)" />
            {{ t("landingEditor.published") }}
          </span>
          <span v-else class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg" style="background: rgba(245, 158, 11, 0.15); color: var(--color-warning)">
            <span class="w-1.5 h-1.5 rounded-full" style="background: var(--color-warning)" />
            {{ t("landingEditor.draft") }}
          </span>
          <span v-if="hasUnsavedChanges || seoIsDirty" class="text-xs opacity-50">*</span>
        </div>

        <!-- Actions -->
        <UiButton variant="outline" size="sm" :disabled="saving || (!hasUnsavedChanges && !seoIsDirty)" @click="saveAll">
          {{ saving ? t("landingEditor.saving") : t("common.save") }}
        </UiButton>
        <UiButton v-if="isPagePublished" variant="warning" size="sm" :disabled="saving" @click="showUnpublishConfirm = true">
          {{ t("landingEditor.unpublish") }}
        </UiButton>
        <UiButton variant="success" size="sm" :disabled="saving" @click="showPublishConfirm = true">
          {{ t("landingEditor.publishAll") }}
        </UiButton>
      </div>

      <!-- ─── Action bar ─────────────────────────────────────────────── -->
      <div class="flex flex-wrap gap-2">
        <UiButton class="landing-add-block" variant="primary" size="sm" @click="showBlockCatalog = true">{{ t("landingEditor.addBlock") }}</UiButton>
        <UiButton variant="outline" size="sm" @click="toggleHistory">
          <Icon name="proicons:clock" class="h-4 w-4 mr-1" />{{ t("landingEditor.history") }}
        </UiButton>
        <UiButton variant="outline" size="sm" class="hidden lg:inline-flex" @click="showPreview = !showPreview">
          {{ showPreview ? 'Hide Preview' : 'Preview' }}
        </UiButton>
        <UiButton variant="errorOutline" size="sm" class="ml-auto" @click="showResetConfirm = true">{{ t("landingEditor.resetToTemplate") }}</UiButton>
      </div>

      <!-- Version history (collapsible) -->
      <div v-if="showHistory" class="rounded-xl p-5 space-y-3" style="background: var(--color-surface-2)">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ t("landingEditor.versionHistory") }}</h3>
          <UiButton variant="ghost" size="xs" icon-only @click="showHistory = false">
            <Icon name="proicons:cancel" class="h-4 w-4" />
          </UiButton>
        </div>
        <div v-if="versions.length === 0" class="text-sm opacity-60">{{ t("landingEditor.noVersions") }}</div>
        <div v-for="version in versions" :key="version.id" class="flex items-center justify-between rounded-xl px-4 py-3" style="background: var(--color-surface-3)">
          <div>
            <span class="text-sm font-medium">{{ version.label || t("landingEditor.versionLabel", { date: new Date(version.createdAt).toLocaleString() }) }}</span>
            <span class="ml-2 text-xs opacity-50">{{ new Date(version.createdAt).toLocaleString() }}</span>
          </div>
          <UiButton variant="outline" size="xs" :disabled="saving" @click="restoreVersion(version.id)">
            {{ t("landingEditor.restore") }}
          </UiButton>
        </div>
      </div>

      <!-- Block catalog -->
      <div v-if="showBlockCatalog" class="landing-block-catalog rounded-xl p-5" style="background: var(--color-surface-2)">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">{{ t("landingEditor.blockCatalog") }}</h3>
          <UiButton variant="ghost" size="xs" icon-only @click="showBlockCatalog = false"><Icon name="proicons:cancel" class="h-4 w-4" /></UiButton>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="block in blockTypes"
            :key="block.type"
            class="rounded-xl p-4 text-left cursor-pointer hover:ring-1 hover:ring-[var(--color-accent)] transition-all"
            style="background: var(--color-surface-3)"
            @click="addBlock(block.type)"
          >
            <h4 class="font-bold text-sm">{{ editLocale === 'de' ? block.name.de : block.name.en }}</h4>
            <p class="text-xs opacity-60 mt-1">{{ editLocale === 'de' ? block.description.de : block.description.en }}</p>
          </button>
        </div>
      </div>

      <!-- Section list -->
      <div v-if="sections.length === 0" class="rounded-lg px-4 py-8 text-center text-sm opacity-60" style="background: var(--color-surface-2)">
        {{ t("landingEditor.noSections") }}
      </div>

      <div class="landing-block-list space-y-3">
        <div
          v-for="(section, index) in sections"
          :key="section.id"
          :class="['landing-block-item rounded-xl transition-all', !section.visible && 'opacity-50', draggedIndex === index && 'ring-2 ring-[var(--color-accent)]']"
          :style="[
            'background: var(--color-surface-2)',
            section.status === 'draft' ? 'border-left: 4px solid var(--color-warning)' : ''
          ]"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover="(e) => onDragOver(e, index)"
          @dragend="onDragEnd"
        >
          <div class="p-4">
            <div class="flex items-center gap-3">
              <!-- Drag handle -->
              <div class="cursor-grab opacity-40 hover:opacity-70 select-none"><Icon name="proicons:re-order" class="h-4 w-4" /></div>

              <!-- Block info -->
              <div class="flex-1 min-w-0">
                <span class="font-bold text-sm">{{ blockName(section.blockType) }}</span>
                <span v-if="section.status === 'draft'" class="ml-1.5 inline-block rounded px-2 py-0.5 text-xs font-medium" style="background: rgba(245, 158, 11, 0.2); color: var(--color-warning)">{{ t("landingEditor.draft") }}</span>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1">
                <UiButton
                  variant="ghost"
                  size="xs"
                  icon-only
                  :class="section.visible ? 'opacity-70' : 'opacity-40'"
                  :title="section.visible ? 'Hide' : 'Show'"
                  @click="toggleVisibility(section)"
                >
                  <Icon :name="section.visible ? 'proicons:eye' : 'proicons:eye-off'" class="h-4 w-4" />
                </UiButton>
                <UiButton
                  variant="ghost"
                  size="xs"
                  icon-only
                  @click="editingSection = editingSection?.id === section.id ? null : section"
                >
                  <Icon name="proicons:pencil" class="h-4 w-4" />
                </UiButton>
                <UiButton variant="ghost" size="xs" icon-only class="text-red-400" @click="removeSection(section.id)">
                  <Icon name="proicons:delete" class="h-4 w-4" />
                </UiButton>
              </div>
            </div>

            <!-- Structured block editor -->
            <div v-if="editingSection?.id === section.id" class="mt-4 space-y-3 pt-4" style="border-top: 1px solid var(--color-line)">
              <LandingBlockEditor
                :block-type="section.blockType"
                :content="section.content"
                :locale="editLocale"
                @update="(key, value) => setLocaleContent(section, key, value)"
              />

              <!-- Style variant selector (all blocks) -->
              <div class="pt-3 space-y-1" style="border-top: 1px solid var(--color-line)">
                <UiSelect
                  :label="t('landingBlocks.common.styleVariant')"
                  :model-value="String((section.config as Record<string, unknown>).styleVariant || 'normal')"
                  @update:model-value="(v: string) => setConfigValue(section, 'styleVariant', v)"
                >
                  <option value="normal">{{ t("landingBlocks.common.styleVariantNormal") }}</option>
                  <option value="accent">{{ t("landingBlocks.common.styleVariantAccent") }}</option>
                  <option value="warning">{{ t("landingBlocks.common.styleVariantWarning") }}</option>
                </UiSelect>
              </div>

              <!-- Applications block config (mode + flow selection) -->
              <template v-if="section.blockType === 'applications'">
                <div class="pt-3 space-y-3" style="border-top: 1px solid var(--color-line)">
                  <UiSelect
                    :label="t('landingBlocks.applications.mode')"
                    :model-value="String((section.config as Record<string, unknown>).mode || 'flow')"
                    @update:model-value="(v: string) => setConfigValue(section, 'mode', v)"
                  >
                    <option value="flow">{{ t("landingBlocks.applications.modeFlow") }}</option>
                    <option value="link">{{ t("landingBlocks.applications.modeLink") }}</option>
                  </UiSelect>

                  <UiSelect
                    v-if="(section.config as Record<string, unknown>).mode !== 'link'"
                    :label="t('landingBlocks.applications.flowId')"
                    :model-value="String((section.config as Record<string, unknown>).flowId || '')"
                    @update:model-value="(v: string) => setConfigValue(section, 'flowId', v)"
                  >
                    <option value="" disabled>{{ t("landingBlocks.applications.selectFlow") }}</option>
                    <option v-for="flow in applicationFlows" :key="flow.id" :value="flow.id">
                      {{ flow.name }}
                    </option>
                  </UiSelect>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- SEO Settings (bottom of editor) -->
      <div class="landing-seo-section rounded-xl p-5 space-y-4" style="background: var(--color-surface-2)">
        <h3 class="text-lg font-semibold">{{ t("landingEditor.seoSettings") }}</h3>
        <p class="text-sm opacity-60">{{ t("landingEditor.tour.seoDesc") }}</p>
        <UiInput
          v-model="pageConfig.metaTitle"
          :label="t('landingEditor.metaTitle')"
          :placeholder="t('landingEditor.metaTitle')"
        />
        <UiTextarea
          v-model="pageConfig.metaDescription"
          :label="t('landingEditor.metaDescription')"
          :placeholder="t('landingEditor.metaDescription')"
          :rows="3"
        />
      </div>
    </template>

    </div><!-- /editor column -->

    <!-- Resize handle -->
    <div
      v-if="showPreview"
      class="hidden lg:flex items-center justify-center cursor-col-resize select-none"
      style="width: 8px; margin: 0 -4px; z-index: 10;"
      @pointerdown="onResizeStart"
    >
      <div class="w-1 h-10 rounded-full transition-colors" :style="isResizingPreview ? 'background: var(--color-accent)' : 'background: var(--color-surface-4)'" />
    </div>

    <!-- Inline preview column -->
    <div v-if="showPreview" class="hidden lg:block sticky top-4 self-start" :style="{ width: previewWidth + 'px', minWidth: previewWidth + 'px' }">
      <div
        class="rounded-xl overflow-hidden overflow-y-auto"
        :style="`box-shadow: var(--shadow-lg); height: calc(100vh - 8rem);${isResizingPreview ? ' pointer-events: none;' : ''}`"
      >
        <LandingPreview
          :sections="sections"
          :locale="editLocale"
          :template-id="pageConfig.activeTemplate"
          :colors="resolvedColors"
          :custom-css="pageConfig.customCss"
        />
      </div>
    </div>

    <!-- Reset to template confirmation modal -->
    <dialog class="modal" :class="{ 'modal-open': showResetConfirm }" :open="showResetConfirm">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">{{ t("landingEditor.resetToTemplate") }}</h3>
        <p class="mt-2 opacity-80">{{ t("landingEditor.resetConfirm") }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton variant="ghost" @click="showResetConfirm = false">{{ t("common.cancel") }}</UiButton>
          <UiButton variant="error" :disabled="saving" @click="resetToTemplate">{{ t("landingEditor.resetToTemplate") }}</UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showResetConfirm = false">close</button>
      </form>
    </dialog>

    <!-- Unpublish confirmation modal -->
    <dialog class="modal" :class="{ 'modal-open': showUnpublishConfirm }" :open="showUnpublishConfirm">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">{{ t("landingEditor.unpublish") }}</h3>
        <p class="mt-2 opacity-80">{{ t("landingEditor.unpublishConfirm") }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton variant="ghost" @click="showUnpublishConfirm = false">{{ t("common.cancel") }}</UiButton>
          <UiButton variant="warning" :disabled="saving" @click="unpublish">{{ t("landingEditor.unpublish") }}</UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showUnpublishConfirm = false">close</button>
      </form>
    </dialog>

    <!-- Publish confirmation modal -->
    <dialog class="modal" :class="{ 'modal-open': showPublishConfirm }" :open="showPublishConfirm">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">{{ t("landingEditor.publishAll") }}</h3>
        <p class="mt-2 opacity-80">{{ t("landingEditor.publishConfirm") }}</p>
        <div v-if="hasUnsavedChanges || seoIsDirty" class="mt-2 text-xs opacity-60">
          {{ t("landingEditor.saved") }} — unsaved changes will be saved automatically.
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton variant="ghost" @click="showPublishConfirm = false">{{ t("common.cancel") }}</UiButton>
          <UiButton variant="success" :disabled="saving" @click="publishAll">{{ t("landingEditor.publishAll") }}</UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showPublishConfirm = false">close</button>
      </form>
    </dialog>

    <!-- Tour overlay -->
    <SharedOnboardingTour
      :state="tour.state.value"
      :skip-label="t('landingEditor.tour.skip')"
      :next-label="t('landingEditor.tour.next')"
      :done-label="t('landingEditor.tour.done')"
      @next="tour.next()"
      @skip="tour.skip()"
    />
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  .landing-editor-split {
    display: flex;
    gap: 0;
  }

  .landing-editor-split > :first-child {
    flex: 1;
    min-width: 0;
  }
}
</style>
