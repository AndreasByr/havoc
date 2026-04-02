<script setup lang="ts">
import type { TourStep } from "~/composables/useOnboardingTour";

definePageMeta({
  middleware: ["settings"],
});

const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/landing";

const { t } = useI18n();
const { user } = useAuth();
const runtimeConfig = useRuntimeConfig();
const isDev = runtimeConfig.public.isDev;
const landingUrl = String(runtimeConfig.public.landingUrl || runtimeConfig.public.appUrl || "http://localhost:3000").replace(/\/+$/, "");

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
  metaTitle: string | null;
  metaDescription: string | null;
}

const loading = ref(true);
const saving = ref(false);
const saveSuccess = ref("");
const saveError = ref("");

const sections = ref<LandingSection[]>([]);
const blockTypes = ref<BlockType[]>([]);
const templates = ref<LandingTemplate[]>([]);
const pageConfig = ref<PageConfig>({ activeTemplate: "default", customCss: null, metaTitle: null, metaDescription: null });

const showBlockCatalog = ref(false);
const showCssEditor = ref(false);
const showSeoSettings = ref(false);
const showTemplatePicker = ref(false);
const showHistory = ref(false);
const versions = ref<LandingVersion[]>([]);
const editingSection = ref<LandingSection | null>(null);
const editLocale = ref<"en" | "de">("en");

const draggedIndex = ref<number | null>(null);
const showPreview = ref(false);
const previewIframe = ref<HTMLIFrameElement | null>(null);

function sendPreviewUpdate() {
  if (!previewIframe.value?.contentWindow) return;
  const localizedSections = sections.value.map((s) => {
    const content = s.content as Record<string, unknown>;
    const loc = (content[editLocale.value] ?? content.en ?? content) as Record<string, unknown>;
    return { id: s.id, blockType: s.blockType, sortOrder: s.sortOrder, config: s.config, content: loc };
  });
  previewIframe.value.contentWindow.postMessage({
    type: "landing-preview-update",
    sections: localizedSections,
    customCss: pageConfig.value.customCss
  }, "*");
}

// ─── Onboarding Tour ──────────────────────────────────────────────────────

const tourSteps = computed<TourStep[]>(() => [
  { target: ".landing-block-list", title: t("landingEditor.tour.sectionsTitle"), description: t("landingEditor.tour.sectionsDesc"), placement: "bottom" },
  { target: ".landing-block-item", title: t("landingEditor.tour.blockItemTitle"), description: t("landingEditor.tour.blockItemDesc"), placement: "right" },
  { target: ".landing-add-block", title: t("landingEditor.tour.addBlockTitle"), description: t("landingEditor.tour.addBlockDesc"), placement: "bottom" },
  { target: ".landing-locale-switcher", title: t("landingEditor.tour.localeTitle"), description: t("landingEditor.tour.localeDesc"), placement: "bottom" },
  { target: ".landing-template-switch", title: t("landingEditor.tour.templateTitle"), description: t("landingEditor.tour.templateDesc"), placement: "bottom" },
  { target: ".landing-seo-settings", title: t("landingEditor.tour.seoTitle"), description: t("landingEditor.tour.seoDesc"), placement: "bottom" },
  { target: ".landing-custom-css", title: t("landingEditor.tour.cssTitle"), description: t("landingEditor.tour.cssDesc"), placement: "bottom" },
  { target: ".landing-reset", title: t("landingEditor.tour.resetTitle"), description: t("landingEditor.tour.resetDesc"), placement: "bottom" }
]);

const tour = useOnboardingTour("landing_editor", tourSteps.value, user.value?.id);

function resetTour() {
  tour.reset();
  tour.start();
}

// ─── Data Loading ──────────────────────────────────────────────────────────

async function loadData() {
  loading.value = true;
  try {
    const [pageData, blocksData] = await Promise.all([
      $fetch<{ page: PageConfig | null; templates: LandingTemplate[]; sections: LandingSection[] }>("/api/admin/landing/page"),
      $fetch<{ blocks: BlockType[] }>("/api/admin/landing/blocks")
    ]);
    sections.value = pageData.sections;
    templates.value = pageData.templates;
    blockTypes.value = blocksData.blocks;
    if (pageData.page) {
      pageConfig.value = pageData.page;
    }
  } catch {
    saveError.value = "Failed to load landing page data.";
  } finally {
    loading.value = false;
  }
}

async function addBlock(blockType: string) {
  saving.value = true;
  try {
    const defaultContent = { en: {}, de: {} };
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

async function saveSection(section: LandingSection) {
  saving.value = true;
  try {
    await $fetch(`/api/admin/landing/sections/${section.id}`, {
      method: "PUT",
      body: { content: section.content, config: section.config }
    });
    flashSuccess();
  } catch {
    saveError.value = "Failed to save section.";
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

async function switchTemplate(templateId: string) {
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/template", {
      method: "PUT",
      body: { templateId }
    });
    pageConfig.value.activeTemplate = templateId;
    showTemplatePicker.value = false;
    flashSuccess();
  } catch {
    saveError.value = "Failed to switch template.";
  } finally {
    saving.value = false;
  }
}

async function savePageConfig() {
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/page", {
      method: "PUT",
      body: {
        customCss: pageConfig.value.customCss,
        metaTitle: pageConfig.value.metaTitle,
        metaDescription: pageConfig.value.metaDescription
      }
    });
    flashSuccess();
  } catch {
    saveError.value = "Failed to save page settings.";
  } finally {
    saving.value = false;
  }
}

async function resetToTemplate() {
  if (!confirm(t("landingEditor.resetConfirm"))) return;
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

async function publishAll() {
  if (!confirm(t("landingEditor.publishConfirm"))) return;
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/publish", { method: "POST" });
    sections.value.forEach((s) => { s.status = "published"; });
    flashSuccess();
  } catch {
    saveError.value = "Failed to publish.";
  } finally {
    saving.value = false;
  }
}

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

function flashSuccess() {
  saveSuccess.value = t("landingEditor.saved");
  saveError.value = "";
  setTimeout(() => { saveSuccess.value = ""; }, 3000);
  nextTick(() => sendPreviewUpdate());
}

function blockName(type: string): string {
  const block = blockTypes.value.find((b) => b.type === type);
  if (!block) return type;
  return editLocale.value === "de" ? block.name.de : block.name.en;
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

function getLocaleContent(section: LandingSection): Record<string, unknown> {
  const c = section.content as Record<string, Record<string, unknown>>;
  return c[editLocale.value] || c.en || {};
}

function setLocaleContent(section: LandingSection, key: string, value: unknown) {
  const c = section.content as Record<string, Record<string, unknown>>;
  if (!c[editLocale.value]) c[editLocale.value] = {};
  c[editLocale.value][key] = value;
}

onMounted(() => {
  loadData();
  nextTick(() => tour.startIfNotSeen(800));
});
</script>

<template>
  <div :class="['space-y-6', showPreview ? 'grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6' : '']">
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
        <div class="inline-flex rounded-lg border border-white/10 overflow-hidden">
          <button :class="['px-3 py-1.5 text-sm font-medium transition-colors', editLocale === 'en' ? 'bg-white/10' : 'hover:bg-white/5']" @click="editLocale = 'en'">EN</button>
          <button :class="['px-3 py-1.5 text-sm font-medium transition-colors', editLocale === 'de' ? 'bg-white/10' : 'hover:bg-white/5']" @click="editLocale = 'de'">DE</button>
        </div>
      </div>
    </div>

    <!-- Status messages -->
    <div v-if="saveSuccess" class="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">{{ saveSuccess }}</div>
    <div v-if="saveError" class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{{ saveError }}</div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
    </div>

    <template v-else>
      <!-- Action bar -->
      <div class="flex flex-wrap gap-2">
        <button class="landing-add-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity" @click="showBlockCatalog = true">{{ t("landingEditor.addBlock") }}</button>
        <button v-if="hasDrafts" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors" :disabled="saving" @click="publishAll">{{ t("landingEditor.publishAll") }}</button>
        <button class="landing-template-switch rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors" @click="showTemplatePicker = !showTemplatePicker">{{ t("landingEditor.templateSwitch") }}</button>
        <button class="landing-seo-settings rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors" @click="showSeoSettings = !showSeoSettings">{{ t("landingEditor.seoSettings") }}</button>
        <button class="landing-custom-css rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors" @click="showCssEditor = !showCssEditor">{{ t("landingEditor.customCss") }}</button>
        <button class="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors" @click="toggleHistory">{{ t("landingEditor.history") }}</button>
        <button class="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors hidden lg:inline-flex" @click="showPreview = !showPreview">
          {{ showPreview ? 'Hide Preview' : 'Preview' }}
        </button>
        <button class="landing-reset ml-auto rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors" @click="resetToTemplate">{{ t("landingEditor.resetToTemplate") }}</button>
      </div>

      <!-- Template picker -->
      <div v-if="showTemplatePicker" class="rounded-xl bg-white/5 p-5">
        <h3 class="text-lg font-semibold mb-4">{{ t("landingEditor.templateSwitch") }}</h3>
        <div class="grid gap-3 sm:grid-cols-3">
          <button
            v-for="tmpl in templates"
            :key="tmpl.id"
            :class="['rounded-xl bg-white/5 p-4 text-left cursor-pointer transition-all', pageConfig.activeTemplate === tmpl.id ? 'ring-2 ring-[var(--color-accent)]' : 'hover:ring-1 hover:ring-white/20']"
            @click="switchTemplate(tmpl.id)"
          >
            <h4 class="font-bold">{{ tmpl.name }}</h4>
            <p v-if="tmpl.description" class="text-xs opacity-60 mt-1">{{ tmpl.description }}</p>
          </button>
        </div>
      </div>

      <!-- SEO settings -->
      <div v-if="showSeoSettings" class="rounded-xl bg-white/5 p-5 space-y-4">
        <h3 class="text-lg font-semibold">{{ t("landingEditor.seoSettings") }}</h3>
        <div>
          <label class="block text-sm font-medium mb-1.5 opacity-70">{{ t("landingEditor.metaTitle") }}</label>
          <input v-model="pageConfig.metaTitle" type="text" class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] transition-colors" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1.5 opacity-70">{{ t("landingEditor.metaDescription") }}</label>
          <textarea v-model="pageConfig.metaDescription" class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] transition-colors" rows="3" />
        </div>
        <div class="flex justify-end">
          <button class="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50" :disabled="saving" @click="savePageConfig">
            {{ saving ? t("landingEditor.saving") : t("landingEditor.seoSettings") }}
          </button>
        </div>
      </div>

      <!-- Custom CSS -->
      <div v-if="showCssEditor" class="rounded-xl bg-white/5 p-5 space-y-4">
        <h3 class="text-lg font-semibold">{{ t("landingEditor.customCss") }}</h3>
        <textarea
          v-model="pageConfig.customCss"
          class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
          rows="10"
          placeholder="/* Custom CSS for your landing page */"
        />
        <div class="flex justify-end">
          <button class="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50" :disabled="saving" @click="savePageConfig">
            {{ saving ? t("landingEditor.saving") : t("landingEditor.customCss") }}
          </button>
        </div>
      </div>

      <!-- Block catalog -->
      <div v-if="showBlockCatalog" class="landing-block-catalog rounded-xl bg-white/5 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">{{ t("landingEditor.blockCatalog") }}</h3>
          <button class="rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-white/10 transition-colors" @click="showBlockCatalog = false">&times;</button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="block in blockTypes"
            :key="block.type"
            class="rounded-xl bg-white/5 p-4 text-left cursor-pointer hover:ring-1 hover:ring-[var(--color-accent)] transition-all"
            @click="addBlock(block.type)"
          >
            <h4 class="font-bold text-sm">{{ editLocale === 'de' ? block.name.de : block.name.en }}</h4>
            <p class="text-xs opacity-60 mt-1">{{ editLocale === 'de' ? block.description.de : block.description.en }}</p>
          </button>
        </div>
      </div>

      <!-- Version history -->
      <div v-if="showHistory" class="rounded-xl bg-white/5 p-5 space-y-3">
        <h3 class="text-lg font-semibold">{{ t("landingEditor.versionHistory") }}</h3>
        <div v-if="versions.length === 0" class="text-sm opacity-60">{{ t("landingEditor.noVersions") }}</div>
        <div v-for="version in versions" :key="version.id" class="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
          <div>
            <span class="text-sm font-medium">{{ version.label || t("landingEditor.versionLabel", { date: new Date(version.createdAt).toLocaleString() }) }}</span>
            <span class="ml-2 text-xs opacity-50">{{ new Date(version.createdAt).toLocaleString() }}</span>
          </div>
          <button
            class="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors"
            :disabled="saving"
            @click="restoreVersion(version.id)"
          >
            {{ t("landingEditor.restore") }}
          </button>
        </div>
      </div>

      <!-- Section list -->
      <div v-if="sections.length === 0" class="rounded-lg bg-white/5 border border-white/10 px-4 py-8 text-center text-sm opacity-60">
        {{ t("landingEditor.noSections") }}
      </div>

      <div class="landing-block-list space-y-3">
        <div
          v-for="(section, index) in sections"
          :key="section.id"
          :class="['landing-block-item rounded-xl bg-white/5 transition-all', !section.visible && 'opacity-50', draggedIndex === index && 'ring-2 ring-[var(--color-accent)]', section.status === 'draft' && 'border border-dashed border-amber-500/30']"
          draggable="true"
          @dragstart="onDragStart(index)"
          @dragover="(e) => onDragOver(e, index)"
          @dragend="onDragEnd"
        >
          <div class="p-4">
            <div class="flex items-center gap-3">
              <!-- Drag handle -->
              <div class="cursor-grab text-lg opacity-40 hover:opacity-70 select-none">&#x2630;</div>

              <!-- Block info -->
              <div class="flex-1 min-w-0">
                <span class="font-bold text-sm">{{ blockName(section.blockType) }}</span>
                <span class="ml-2 inline-block rounded bg-white/10 px-2 py-0.5 text-xs">{{ section.blockType }}</span>
                <span v-if="section.status === 'draft'" class="ml-1.5 inline-block rounded bg-amber-500/20 text-amber-400 px-2 py-0.5 text-xs font-medium">{{ t("landingEditor.draft") }}</span>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1">
                <button
                  :class="['rounded p-1.5 hover:bg-white/10 transition-colors text-sm', section.visible ? 'opacity-70' : 'opacity-40']"
                  :title="section.visible ? 'Hide' : 'Show'"
                  @click="toggleVisibility(section)"
                >
                  {{ section.visible ? '&#x1F441;' : '&#x1F576;' }}
                </button>
                <button
                  class="rounded p-1.5 hover:bg-white/10 transition-colors text-sm"
                  @click="editingSection = editingSection?.id === section.id ? null : section"
                >
                  &#x270E;
                </button>
                <button class="rounded p-1.5 hover:bg-red-500/20 transition-colors text-sm text-red-400" @click="removeSection(section.id)">
                  &#x2716;
                </button>
              </div>
            </div>

            <!-- Inline editor -->
            <div v-if="editingSection?.id === section.id" class="mt-4 space-y-3 border-t border-white/10 pt-4">
              <div v-for="(value, key) in getLocaleContent(section)" :key="String(key)">
                <label class="block text-xs font-medium mb-1 opacity-60">{{ key }}</label>
                <textarea
                  v-if="typeof value === 'string' && value.length > 80"
                  :value="String(value)"
                  class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  rows="3"
                  @input="(e) => setLocaleContent(section, String(key), (e.target as HTMLTextAreaElement).value)"
                />
                <input
                  v-else-if="typeof value === 'string'"
                  :value="String(value)"
                  type="text"
                  class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  @input="(e) => setLocaleContent(section, String(key), (e.target as HTMLInputElement).value)"
                />
                <pre v-else class="rounded-lg bg-white/5 p-3 text-xs overflow-auto max-h-40">{{ JSON.stringify(value, null, 2) }}</pre>
              </div>
              <div class="flex justify-end">
                <button class="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50" :disabled="saving" @click="saveSection(section)">
                  {{ saving ? t("landingEditor.saving") : "Save" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    </div><!-- /editor column -->

    <!-- Preview iframe column -->
    <div v-if="showPreview" class="hidden lg:block sticky top-4 self-start">
      <div class="rounded-xl border border-white/10 overflow-hidden bg-black" style="height: calc(100vh - 8rem);">
        <iframe
          ref="previewIframe"
          :src="`${landingUrl}?preview=true`"
          class="w-full h-full border-0"
          title="Landing page preview"
          @load="sendPreviewUpdate()"
        />
      </div>
    </div>

    <!-- Tour overlay -->
    <OnboardingTour
      :state="tour.state.value"
      :skip-label="t('landingEditor.tour.skip')"
      :next-label="t('landingEditor.tour.next')"
      :done-label="t('landingEditor.tour.done')"
      @next="tour.next()"
      @skip="tour.skip()"
    />
  </div>
</template>
