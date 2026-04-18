<script setup lang="ts">
import { TEMPLATE_COLOR_DEFAULTS, LANDING_COLOR_KEYS, resolveLandingColors, migrateColorOverrides } from "@guildora/shared";
import type { LandingColorPalette, PerTemplateColorOverrides, LandingColorOverrides } from "@guildora/shared";

definePageMeta({
  middleware: ["landing"],
});

const lastPath = useCookie<string | null>("guildora_landing_last_path", { sameSite: "lax" });
lastPath.value = "/landing/settings";

const { t } = useI18n();
const saving = ref(false);
const saveSuccess = ref("");
const saveError = ref("");
const loading = ref(true);

interface LandingTemplate {
  id: string;
  name: string;
  description: string | null;
  previewUrl: string | null;
}

interface PageConfig {
  id?: number;
  activeTemplate: string;
  customCss: string | null;
  enabledLocales: string[];
  colorOverrides: PerTemplateColorOverrides;
}

const pageConfig = ref<PageConfig>({ activeTemplate: "default", customCss: null, enabledLocales: ["en"], colorOverrides: {} });
const templates = ref<LandingTemplate[]>([]);
const removeLocaleConfirm = ref<{ open: boolean; code: string }>({ open: false, code: "" });
const showAddLanguage = ref(false);

// Track the persisted template so we know when there are unsaved changes
const savedTemplate = ref("default");
const savedColorOverrides = ref<PerTemplateColorOverrides>({});

const hasUnsavedTemplateChanges = computed(() =>
  pageConfig.value.activeTemplate !== savedTemplate.value ||
  JSON.stringify(pageConfig.value.colorOverrides) !== JSON.stringify(savedColorOverrides.value)
);

// All supported languages
const availableLocales = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Fran\u00e7ais" },
  { code: "es", label: "Espa\u00f1ol" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Portugu\u00eas" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "ru", label: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
  { code: "ja", label: "\u65e5\u672c\u8a9e" },
  { code: "ko", label: "\ud55c\uad6d\uc5b4" },
  { code: "zh", label: "\u4e2d\u6587" },
  { code: "tr", label: "T\u00fcrk\u00e7e" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
];

const addableLocales = computed(() =>
  availableLocales.filter((l) => !pageConfig.value.enabledLocales.includes(l.code))
);

function localeLabel(code: string): string {
  return availableLocales.find((l) => l.code === code)?.label || code.toUpperCase();
}

// ─── Color overrides (per-template) ──────────────────────────────────────

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
}

function clearColorOverride(key: string) {
  const tid = pageConfig.value.activeTemplate;
  const { [key]: _removed, ...current } = pageConfig.value.colorOverrides[tid] ?? {};
  const { [tid]: _old, ...rest } = pageConfig.value.colorOverrides;
  if (Object.keys(current).length > 0) {
    pageConfig.value.colorOverrides = { ...rest, [tid]: current as typeof _old };
  } else {
    pageConfig.value.colorOverrides = rest;
  }
}

/** True when the active template has any color override that differs from its defaults */
const hasColorOverrides = computed(() => {
  const overrides = activeTemplateOverrides.value;
  const defaults = templateDefaults.value;
  return LANDING_COLOR_KEYS.some((key) => {
    const override = overrides[key];
    return override !== undefined && override.toLowerCase() !== defaults[key].toLowerCase();
  });
});

function restoreDefaultColors() {
  const tid = pageConfig.value.activeTemplate;
  const { [tid]: _removed, ...rest } = pageConfig.value.colorOverrides;
  pageConfig.value.colorOverrides = rest;
}

function selectTemplate(templateId: string) {
  pageConfig.value.activeTemplate = templateId;
}

// ─── Locale drag & drop ───────────────────────────────────────────────────

const draggedLocaleIndex = ref<number | null>(null);

function onLocaleDragStart(index: number) {
  draggedLocaleIndex.value = index;
}

function onLocaleDragOver(event: DragEvent, index: number) {
  event.preventDefault();
  if (draggedLocaleIndex.value === null || draggedLocaleIndex.value === index) return;
  const arr = [...pageConfig.value.enabledLocales];
  const moved = arr.splice(draggedLocaleIndex.value, 1)[0];
  arr.splice(index, 0, moved);
  pageConfig.value.enabledLocales = arr;
  draggedLocaleIndex.value = index;
}

function onLocaleDragEnd() {
  draggedLocaleIndex.value = null;
  saveLocales();
}

// ─── Data Loading ─────────────────────────────────────────────────────────

async function loadData() {
  loading.value = true;
  try {
    const { page, templates: tmpl } = await $fetch<{ page: PageConfig | null; templates: LandingTemplate[] }>("/api/admin/landing/page");
    templates.value = tmpl;
    if (page) {
      const rawOverrides = (page as Record<string, unknown>).colorOverrides as Record<string, unknown> ?? {};
      const perTemplate = migrateColorOverrides(rawOverrides, page.activeTemplate);
      pageConfig.value = {
        ...page,
        enabledLocales: page.enabledLocales || ["en"],
        colorOverrides: perTemplate
      };
      savedTemplate.value = page.activeTemplate;
      savedColorOverrides.value = JSON.parse(JSON.stringify(perTemplate));
    }
  } catch {
    saveError.value = "Failed to load settings.";
  } finally {
    loading.value = false;
  }
}

async function saveCss() {
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/page", {
      method: "PUT",
      body: { customCss: pageConfig.value.customCss }
    });
    flashSuccess();
  } catch {
    saveError.value = "Failed to save custom CSS.";
  } finally {
    saving.value = false;
  }
}

async function saveTemplateAndColors() {
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/page", {
      method: "PUT",
      body: {
        activeTemplate: pageConfig.value.activeTemplate,
        colorOverrides: pageConfig.value.colorOverrides
      }
    });
    savedTemplate.value = pageConfig.value.activeTemplate;
    savedColorOverrides.value = JSON.parse(JSON.stringify(pageConfig.value.colorOverrides));
    flashSuccess();
  } catch {
    saveError.value = "Failed to save template and colors.";
  } finally {
    saving.value = false;
  }
}

async function saveLocales() {
  saving.value = true;
  try {
    await $fetch("/api/admin/landing/page", {
      method: "PUT",
      body: { enabledLocales: pageConfig.value.enabledLocales }
    });
    flashSuccess();
  } catch {
    saveError.value = "Failed to save language settings.";
  } finally {
    saving.value = false;
  }
}

function addLocale(code: string) {
  if (!pageConfig.value.enabledLocales.includes(code)) {
    pageConfig.value.enabledLocales.push(code);
    saveLocales();
  }
}

function openRemoveLocaleConfirm(code: string) {
  if (pageConfig.value.enabledLocales.length <= 1) return;
  removeLocaleConfirm.value = { open: true, code };
}

function closeRemoveLocaleConfirm() {
  removeLocaleConfirm.value = { open: false, code: "" };
}

function confirmRemoveLocale() {
  const code = removeLocaleConfirm.value.code;
  pageConfig.value.enabledLocales = pageConfig.value.enabledLocales.filter((l) => l !== code);
  closeRemoveLocaleConfirm();
  saveLocales();
}

function flashSuccess() {
  saveSuccess.value = t("landingEditor.saved");
  saveError.value = "";
  setTimeout(() => { saveSuccess.value = ""; }, 3000);
}

onMounted(() => loadData());
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t("nav.landingSettings") }}</h1>
    </div>

    <div v-if="saveSuccess" class="rounded-lg px-4 py-3 text-sm" style="background: rgba(34, 197, 94, 0.1); color: var(--color-success)">{{ saveSuccess }}</div>
    <div v-if="saveError" class="rounded-lg px-4 py-3 text-sm" style="background: rgba(239, 68, 68, 0.1); color: var(--color-error)">{{ saveError }}</div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
    </div>

    <template v-else>
      <!-- Languages -->
      <div class="rounded-xl p-5 space-y-4" style="background: var(--color-surface-2)">
        <div>
          <h3 class="text-lg font-semibold">{{ t("landingEditor.languages.title") }}</h3>
          <p class="text-sm opacity-60 mt-1">{{ t("landingEditor.languages.description") }}</p>
        </div>

        <p class="text-xs opacity-50">{{ t("landingEditor.languages.defaultNote") }}</p>

        <!-- Enabled locales (drag & drop) -->
        <div class="space-y-2">
          <div
            v-for="(loc, index) in pageConfig.enabledLocales"
            :key="loc"
            :class="['flex items-center justify-between rounded-xl px-4 py-3 transition-all cursor-grab', draggedLocaleIndex === index && 'ring-2 ring-[var(--color-accent)]']"
            :style="index === 0
              ? 'background: var(--color-surface-3); box-shadow: inset 0 0 0 2px var(--color-accent)'
              : 'background: var(--color-surface-3)'"
            draggable="true"
            @dragstart="onLocaleDragStart(index)"
            @dragover="(e) => onLocaleDragOver(e, index)"
            @dragend="onLocaleDragEnd"
          >
            <div class="flex items-center gap-3">
              <div class="opacity-40 hover:opacity-70 select-none">
                <Icon name="proicons:grid-dots" class="h-4 w-4" />
              </div>
              <span class="text-sm font-bold uppercase" style="min-width: 2rem">{{ loc }}</span>
              <span class="text-sm">{{ localeLabel(loc) }}</span>
              <span v-if="index === 0" class="text-xs px-2 py-0.5 rounded" style="background: var(--color-accent-subtle); color: var(--color-accent-light)">Default</span>
            </div>
            <UiButton
              v-if="pageConfig.enabledLocales.length > 1"
              variant="ghost"
              size="xs"
              class="text-red-400"
              @click.stop="openRemoveLocaleConfirm(loc)"
            >
              {{ t("landingEditor.languages.removeLanguage") }}
            </UiButton>
          </div>
        </div>

        <!-- Add language -->
        <div v-if="addableLocales.length > 0">
          <UiButton variant="outline" size="sm" @click="showAddLanguage = true">
            {{ t("landingEditor.languages.addLanguage") }}
          </UiButton>
        </div>
        <p v-else class="text-sm opacity-50">{{ t("landingEditor.languages.noOtherLanguages") }}</p>
      </div>

      <!-- Template + Colors -->
      <div class="rounded-xl p-5 space-y-4" style="background: var(--color-surface-2)">
        <h3 class="text-lg font-semibold">{{ t("landingEditor.templateSwitch") }}</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="tmpl in templates"
            :key="tmpl.id"
            class="rounded-xl overflow-hidden text-left cursor-pointer transition-all"
            :style="pageConfig.activeTemplate === tmpl.id
              ? 'background: var(--color-surface-3); box-shadow: 0 0 0 2px var(--color-accent)'
              : 'background: var(--color-surface-3)'"
            @click="selectTemplate(tmpl.id)"
          >
            <!-- Schematic preview thumbnail -->
            <LandingTemplatePreview :template-id="tmpl.id" />
            <!-- Info -->
            <div class="p-4">
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-sm">{{ tmpl.name }}</h4>
                <span
                  v-if="savedTemplate === tmpl.id"
                  class="text-xs px-2 py-0.5 rounded"
                  style="background: var(--color-accent-subtle); color: var(--color-accent-light)"
                >
                  {{ t("landingEditor.published") }}
                </span>
              </div>
              <p v-if="tmpl.description" class="text-xs opacity-60 mt-1">{{ tmpl.description }}</p>
            </div>
          </button>
        </div>

        <!-- Color overrides -->
        <div class="pt-4 space-y-3" style="border-top: 1px solid var(--color-line)">
          <div>
            <h4 class="text-base font-semibold">{{ t("landingEditor.colors.title") }}</h4>
            <p class="text-sm opacity-60 mt-1">{{ t("landingEditor.colors.description") }}</p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div v-for="colorKey in (['background', 'surface', 'text', 'textMuted', 'accent', 'accentText', 'border'] as const)" :key="colorKey" class="space-y-1">
              <label class="text-xs font-medium opacity-70">{{ t(`landingEditor.colors.${colorKey}`) }}</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  :value="resolvedColors[colorKey]"
                  class="h-8 w-10 rounded border-0 cursor-pointer"
                  style="background: var(--color-surface-3)"
                  @input="(e) => setColorOverride(colorKey, (e.target as HTMLInputElement).value)"
                >
                <span class="text-xs font-mono opacity-50">{{ resolvedColors[colorKey] }}</span>
                <button
                  v-if="activeTemplateOverrides[colorKey]"
                  class="text-xs opacity-40 hover:opacity-70 transition-opacity"
                  :title="t('landingEditor.colors.reset')"
                  @click="clearColorOverride(colorKey)"
                >
                  <Icon name="proicons:cancel" class="h-3 w-3" />
                </button>
              </div>
              <span v-if="activeTemplateOverrides[colorKey]" class="text-[10px] opacity-40">
                {{ t("landingEditor.colors.default") }}: {{ templateDefaults[colorKey] }}
              </span>
            </div>
          </div>
        </div>

        <!-- Save button for template + colors -->
        <div class="flex items-center justify-end gap-3 pt-2">
          <UiButton
            v-if="hasColorOverrides"
            variant="outline"
            size="sm"
            @click="restoreDefaultColors"
          >
            {{ t("landingEditor.colors.restoreDefaults") }}
          </UiButton>
          <span v-if="hasUnsavedTemplateChanges" class="text-xs opacity-50">*</span>
          <UiButton variant="primary" size="sm" :disabled="saving || !hasUnsavedTemplateChanges" @click="saveTemplateAndColors">
            {{ saving ? t("landingEditor.saving") : t("common.save") }}
          </UiButton>
        </div>
      </div>

      <!-- Custom CSS -->
      <div class="rounded-xl p-5 space-y-4" style="background: var(--color-surface-2)">
        <div>
          <h3 class="text-lg font-semibold">{{ t("landingEditor.customCss") }}</h3>
          <p class="text-sm opacity-60 mt-1">{{ t("landingEditor.tour.cssDesc") }}</p>
        </div>
        <UiTextarea
          v-model="pageConfig.customCss"
          :label="t('landingEditor.customCss')"
          placeholder="/* Custom CSS for your landing page */"
          :rows="12"
          class="font-mono"
        />
        <div class="flex justify-end">
          <UiButton variant="primary" size="sm" :disabled="saving" @click="saveCss">
            {{ saving ? t("landingEditor.saving") : t("common.save") }}
          </UiButton>
        </div>
      </div>
    </template>

    <!-- Add language modal -->
    <dialog class="modal" :class="{ 'modal-open': showAddLanguage }" :open="showAddLanguage">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">{{ t("landingEditor.languages.addLanguage") }}</h3>
        <div class="mt-4 space-y-1">
          <button
            v-for="loc in addableLocales"
            :key="loc.code"
            class="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/5"
            style="background: var(--color-surface-3)"
            @click="addLocale(loc.code); showAddLanguage = false"
          >
            <span class="text-sm font-bold uppercase" style="min-width: 2rem">{{ loc.code }}</span>
            <span class="text-sm">{{ loc.label }}</span>
          </button>
        </div>
        <div class="mt-4 flex justify-end">
          <UiButton variant="ghost" @click="showAddLanguage = false">
            {{ t("common.cancel") }}
          </UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showAddLanguage = false">close</button>
      </form>
    </dialog>

    <!-- Remove language confirmation modal -->
    <dialog class="modal" :class="{ 'modal-open': removeLocaleConfirm.open }" :open="removeLocaleConfirm.open">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">{{ t("landingEditor.languages.removeLanguage") }}</h3>
        <p class="mt-2 opacity-80">{{ t("landingEditor.languages.removeConfirm") }}</p>
        <p class="mt-1 text-sm font-medium">
          {{ removeLocaleConfirm.code.toUpperCase() }} — {{ localeLabel(removeLocaleConfirm.code) }}
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton variant="ghost" @click="closeRemoveLocaleConfirm">
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton variant="error" @click="confirmRemoveLocale">
            {{ t("landingEditor.languages.removeLanguage") }}
          </UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeRemoveLocaleConfirm">close</button>
      </form>
    </dialog>
  </div>
</template>
