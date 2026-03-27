<script setup lang="ts">
import { buildThemeHtmlStyle, defaultThemeColors, type ThemeColors, type ThemeContentTone } from "../../../utils/theme-colors";

definePageMeta({
  middleware: ["settings"],
});

const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
lastPath.value = "/settings/design";

const { t } = useI18n();
const { setThemeColors } = useThemeColors();

type ThemeLogoPayload = {
  dataUrl: string;
  mimeType: string;
  fileName?: string;
};

type AdminThemeResponse = {
  colorDominant: string;
  colorSecondary: string;
  colorAccent: string;
  colorAccentContentTone: ThemeContentTone;
  colorInfo: string;
  colorInfoContentTone: ThemeContentTone;
  colorSuccess: string;
  colorSuccessContentTone: ThemeContentTone;
  colorWarning: string;
  colorWarningContentTone: ThemeContentTone;
  colorError: string;
  colorErrorContentTone: ThemeContentTone;
  logo: ThemeLogoPayload | null;
  sidebarLogoSizePx: number;
};

const SIDEBAR_LOGO_SIZES = [40, 48, 60, 72] as const;

const maxLogoBytes = 1024 * 1024;
const allowedLogoMimeTypes = new Set(["image/png", "image/webp", "image/svg+xml", "image/jpeg"]);

const form = reactive<ThemeColors>({ ...defaultThemeColors });

const loading = ref(true);
const saving = ref(false);
const paletteSaveSuccess = ref("");
const paletteSaveError = ref("");
const logoSaveSuccess = ref("");
const logoSaveError = ref("");
const logoError = ref("");

const savedLogo = ref<ThemeLogoPayload | null>(null);
const uploadedLogo = ref<ThemeLogoPayload | null>(null);
const removeLogo = ref(false);
const logoInputResetKey = ref(0);
const sidebarLogoSizePx = ref<number>(60);

const logoPreview = computed(() => {
  if (uploadedLogo.value) {
    return uploadedLogo.value;
  }
  if (removeLogo.value) {
    return null;
  }
  return savedLogo.value;
});
const darkPreviewStyle = computed(() => buildThemeHtmlStyle(form, "dark"));
const lightPreviewStyle = computed(() => buildThemeHtmlStyle(form, "light"));

const applyFormTheme = () => {
  setThemeColors(form);
};

const restoreDefaults = () => {
  assignThemeToForm(defaultThemeColors);
  applyFormTheme();
  paletteSaveSuccess.value = "";
  paletteSaveError.value = "";
};

const assignThemeToForm = (data: ThemeColors) => {
  form.colorDominant = data.colorDominant;
  form.colorSecondary = data.colorSecondary;
  form.colorAccent = data.colorAccent;
  form.colorAccentContentTone = data.colorAccentContentTone;
  form.colorInfo = data.colorInfo;
  form.colorInfoContentTone = data.colorInfoContentTone;
  form.colorSuccess = data.colorSuccess;
  form.colorSuccessContentTone = data.colorSuccessContentTone;
  form.colorWarning = data.colorWarning;
  form.colorWarningContentTone = data.colorWarningContentTone;
  form.colorError = data.colorError;
  form.colorErrorContentTone = data.colorErrorContentTone;
};

const resetLogoSelection = () => {
  uploadedLogo.value = null;
  removeLogo.value = false;
  logoError.value = "";
  logoSaveError.value = "";
  logoInputResetKey.value += 1;
};

const readFileAsDataUrl = async (file: File) => {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
};

const inferMimeType = (file: File) => {
  if (file.type) {
    return file.type.toLowerCase();
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return "";
};

const onLogoChange = async (file: File | null) => {
  logoError.value = "";
  if (!file) {
    return;
  }

  const mimeType = inferMimeType(file);
  if (!allowedLogoMimeTypes.has(mimeType)) {
    logoError.value = t("adminTheme.logoUnsupportedType");
    logoInputResetKey.value += 1;
    return;
  }

  if (file.size > maxLogoBytes) {
    logoError.value = t("adminTheme.logoTooLarge");
    logoInputResetKey.value += 1;
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (!dataUrl.startsWith("data:")) {
      throw new Error("Invalid data URL.");
    }

    uploadedLogo.value = {
      dataUrl,
      mimeType,
      fileName: file.name
    };
    removeLogo.value = false;
  } catch {
    logoError.value = t("adminTheme.logoReadError");
  }
};

const onRemoveLogo = () => {
  uploadedLogo.value = null;
  removeLogo.value = true;
  logoError.value = "";
  logoInputResetKey.value += 1;
};

const loadTheme = async () => {
  loading.value = true;
  paletteSaveError.value = "";
  logoSaveError.value = "";
  try {
    const data = await $fetch<AdminThemeResponse>("/api/admin/theme");
    assignThemeToForm(data);
    savedLogo.value = data.logo;
    sidebarLogoSizePx.value = [40, 48, 60, 72].includes(data.sidebarLogoSizePx) ? data.sidebarLogoSizePx : 60;
    resetLogoSelection();
    applyFormTheme();
  } catch {
    paletteSaveError.value = t("adminTheme.loadError");
    savedLogo.value = null;
    sidebarLogoSizePx.value = 60;
    resetLogoSelection();
    restoreDefaults();
  } finally {
    loading.value = false;
  }
};

const buildBasePayload = () => ({
  colorDominant: form.colorDominant,
  colorSecondary: form.colorSecondary,
  colorAccent: form.colorAccent,
  colorAccentContentTone: form.colorAccentContentTone,
  colorInfo: form.colorInfo,
  colorInfoContentTone: form.colorInfoContentTone,
  colorSuccess: form.colorSuccess,
  colorSuccessContentTone: form.colorSuccessContentTone,
  colorWarning: form.colorWarning,
  colorWarningContentTone: form.colorWarningContentTone,
  colorError: form.colorError,
  colorErrorContentTone: form.colorErrorContentTone
});

const savePalette = async () => {
  paletteSaveSuccess.value = "";
  paletteSaveError.value = "";
  saving.value = true;
  try {
    const payload = buildBasePayload();
    const data = await $fetch<AdminThemeResponse>("/api/admin/theme", {
      method: "PUT",
      body: payload
    });
    assignThemeToForm(data);
    applyFormTheme();
    paletteSaveSuccess.value = t("adminTheme.paletteSaveSuccess");
  } catch (error) {
    paletteSaveError.value = (error as { statusMessage?: string })?.statusMessage || t("adminTheme.paletteSaveError");
  } finally {
    saving.value = false;
  }
};

const saveLogo = async () => {
  logoSaveSuccess.value = "";
  logoSaveError.value = "";
  saving.value = true;
  try {
    const payload: Record<string, unknown> = {
      ...buildBasePayload()
    };
    if (uploadedLogo.value) {
      payload.logoDataUrl = uploadedLogo.value.dataUrl;
      payload.logoMimeType = uploadedLogo.value.mimeType;
      payload.logoFileName = uploadedLogo.value.fileName;
    } else if (removeLogo.value) {
      payload.removeLogo = true;
    }
    payload.sidebarLogoSizePx = sidebarLogoSizePx.value;
    const data = await $fetch<AdminThemeResponse>("/api/admin/theme", {
      method: "PUT",
      body: payload
    });
    assignThemeToForm(data);
    savedLogo.value = data.logo;
    sidebarLogoSizePx.value = [40, 48, 60, 72].includes(data.sidebarLogoSizePx) ? data.sidebarLogoSizePx : 60;
    resetLogoSelection();
    applyFormTheme();
    logoSaveSuccess.value = t("adminTheme.logoSaveSuccess");
  } catch (error) {
    logoSaveError.value = (error as { statusMessage?: string })?.statusMessage || t("adminTheme.logoSaveError");
  } finally {
    saving.value = false;
  }
};

watch(
  () => [
    form.colorDominant,
    form.colorSecondary,
    form.colorAccent,
    form.colorAccentContentTone,
    form.colorInfo,
    form.colorInfoContentTone,
    form.colorSuccess,
    form.colorSuccessContentTone,
    form.colorWarning,
    form.colorWarningContentTone,
    form.colorError,
    form.colorErrorContentTone
  ],
  () => {
    applyFormTheme();
  }
);

onMounted(async () => {
  await loadTheme();
});
</script>

<template>
  <section class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("adminTheme.title") }}</h1>
    </header>

    <div v-if="loading" class="loading loading-spinner loading-md" />

    <template v-else>
      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <h2 class="card-title">{{ $t("adminTheme.logoTitle") }}</h2>
          <p class="text-sm opacity-80">{{ $t("adminTheme.logoRecommendations") }}</p>

          <UiSelect
            v-model.number="sidebarLogoSizePx"
            class="w-full max-w-sm"
            :label="$t('adminTheme.sidebarLogoSizeLabel')"
           
          >
            <option v-for="size in SIDEBAR_LOGO_SIZES" :key="size" :value="size">
              {{ size }} px
            </option>
          </UiSelect>

          <div class="flex items-center gap-4 rounded-2xl bg-base-100 p-4 shadow-neu-inset">
            <div
              class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-base-200 text-sm font-semibold"
            >
              <img
                v-if="logoPreview"
                :src="logoPreview.dataUrl"
                alt="Guildora"
                class="h-full w-full object-cover"
              >
              <span v-else>NG</span>
            </div>
            <div class="min-w-0">
              <p v-if="logoPreview?.fileName" class="truncate text-sm font-medium">
                {{ logoPreview.fileName }}
              </p>
              <p class="truncate text-xs opacity-70">
                {{ logoPreview?.mimeType || $t("adminTheme.logoNoFile") }}
              </p>
            </div>
          </div>

          <UiFileInput
            :key="logoInputResetKey"
            :label="$t('adminTheme.logoUploadLabel')"
            accept=".svg,image/png,image/webp,image/jpeg"
           
            @change="onLogoChange"
          />

          <div class="flex flex-wrap justify-end gap-2">
            <UiButton
              variant="ghost"
              type="button"
              :disabled="!logoPreview"
              @click="onRemoveLogo"
            >
              {{ $t("adminTheme.logoRemove") }}
            </UiButton>
            <UiButton class="" type="button" :disabled="saving" @click="saveLogo">
              {{ saving ? $t("common.loading") : $t("common.save") }}
            </UiButton>
          </div>

          <div v-if="logoSaveSuccess" class="alert alert-success">
            <span>{{ logoSaveSuccess }}</span>
          </div>
          <div v-if="logoSaveError" class="alert alert-error">
            <span>{{ logoSaveError }}</span>
          </div>
          <div v-if="logoError" class="alert alert-error">
            <span>{{ logoError }}</span>
          </div>
        </div>
      </div>

      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <h2 class="card-title">{{ $t("adminTheme.paletteTitle") }}</h2>

          <UiColorInput v-model="form.colorDominant" :label="$t('adminTheme.dominantLabel')" />

          <UiColorInput v-model="form.colorSecondary" :label="$t('adminTheme.secondaryLabel')" />

          <label class="form-control">
            <UiColorInput v-model="form.colorAccent" :label="$t('adminTheme.accentLabel')" />
            <div class="mt-2 rounded-xl border border-base-content/10 bg-base-300/30 p-3">
              <div class="flex flex-col gap-2">
                <span class="label-text block">{{ $t("adminTheme.textToneLabel") }}</span>
                <UiSelect v-model="form.colorAccentContentTone" class="w-full max-w-sm" :label="$t('adminTheme.textToneLabel')">
                  <option value="light">{{ $t("adminTheme.textToneLight") }}</option>
                  <option value="dark">{{ $t("adminTheme.textToneDark") }}</option>
                </UiSelect>
              </div>
            </div>
          </label>

          <label class="form-control">
            <UiColorInput v-model="form.colorInfo" :label="$t('adminTheme.infoLabel')" />
            <div class="mt-2 rounded-xl border border-base-content/10 bg-base-300/30 p-3">
              <div class="flex flex-col gap-2">
                <span class="label-text block">{{ $t("adminTheme.textToneLabel") }}</span>
                <UiSelect v-model="form.colorInfoContentTone" class="w-full max-w-sm" :label="$t('adminTheme.textToneLabel')">
                  <option value="light">{{ $t("adminTheme.textToneLight") }}</option>
                  <option value="dark">{{ $t("adminTheme.textToneDark") }}</option>
                </UiSelect>
              </div>
            </div>
          </label>

          <label class="form-control">
            <UiColorInput v-model="form.colorSuccess" :label="$t('adminTheme.successLabel')" />
            <div class="mt-2 rounded-xl border border-base-content/10 bg-base-300/30 p-3">
              <div class="flex flex-col gap-2">
                <span class="label-text block">{{ $t("adminTheme.textToneLabel") }}</span>
                <UiSelect v-model="form.colorSuccessContentTone" class="w-full max-w-sm" :label="$t('adminTheme.textToneLabel')">
                  <option value="light">{{ $t("adminTheme.textToneLight") }}</option>
                  <option value="dark">{{ $t("adminTheme.textToneDark") }}</option>
                </UiSelect>
              </div>
            </div>
          </label>

          <label class="form-control">
            <UiColorInput v-model="form.colorWarning" :label="$t('adminTheme.warningLabel')" />
            <div class="mt-2 rounded-xl border border-base-content/10 bg-base-300/30 p-3">
              <div class="flex flex-col gap-2">
                <span class="label-text block">{{ $t("adminTheme.textToneLabel") }}</span>
                <UiSelect v-model="form.colorWarningContentTone" class="w-full max-w-sm" :label="$t('adminTheme.textToneLabel')">
                  <option value="light">{{ $t("adminTheme.textToneLight") }}</option>
                  <option value="dark">{{ $t("adminTheme.textToneDark") }}</option>
                </UiSelect>
              </div>
            </div>
          </label>

          <label class="form-control">
            <UiColorInput v-model="form.colorError" :label="$t('adminTheme.errorLabel')" />
            <div class="mt-2 rounded-xl border border-base-content/10 bg-base-300/30 p-3">
              <div class="flex flex-col gap-2">
                <span class="label-text block">{{ $t("adminTheme.textToneLabel") }}</span>
                <UiSelect v-model="form.colorErrorContentTone" class="w-full max-w-sm" :label="$t('adminTheme.textToneLabel')">
                  <option value="light">{{ $t("adminTheme.textToneLight") }}</option>
                  <option value="dark">{{ $t("adminTheme.textToneDark") }}</option>
                </UiSelect>
              </div>
            </div>
          </label>

          <div class="flex flex-wrap justify-end gap-2">
            <UiButton variant="ghost" type="button" @click="restoreDefaults">{{ $t("adminTheme.reset") }}</UiButton>
            <UiButton class="" type="button" :disabled="saving" @click="savePalette">
              {{ saving ? $t("common.loading") : $t("common.save") }}
            </UiButton>
          </div>

          <div v-if="paletteSaveSuccess" class="alert alert-success">
            <span>{{ paletteSaveSuccess }}</span>
          </div>
          <div v-if="paletteSaveError" class="alert alert-error">
            <span>{{ paletteSaveError }}</span>
          </div>
        </div>
      </div>

      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <h2 class="card-title">{{ $t("adminTheme.previewTitle") }}</h2>

          <div class="overflow-hidden rounded-xl shadow-neu-inset">
            <div class="flex h-10">
              <div class="h-full" :style="{ width: '60%', backgroundColor: form.colorDominant }" />
              <div class="h-full" :style="{ width: '30%', backgroundColor: form.colorSecondary }" />
              <div class="h-full" :style="{ width: '10%', backgroundColor: form.colorAccent }" />
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <article class="rounded-2xl bg-base-100 p-4 shadow-sm" :style="darkPreviewStyle" data-theme="guildora-dark">
              <h3 class="text-lg font-semibold">{{ $t("adminTheme.previewDark") }}</h3>
              <p class="mt-1 text-sm opacity-80">{{ $t("adminTheme.previewCardTitle") }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <UiButton class="" size="sm" type="button">{{ $t("adminTheme.previewPrimary") }}</UiButton>
                <UiButton variant="secondary" size="sm" type="button">{{ $t("adminTheme.previewSecondary") }}</UiButton>
                <UiButton variant="ghost" size="sm" type="button">{{ $t("adminTheme.previewGhost") }}</UiButton>
                <UiButton variant="outline" size="sm" type="button">{{ $t("adminTheme.previewOutline") }}</UiButton>
                <UiButton variant="success" size="sm" type="button">{{ $t("adminTheme.statusSuccess") }}</UiButton>
                <UiButton variant="warning" size="sm" type="button">{{ $t("adminTheme.statusWarning") }}</UiButton>
                <UiButton variant="error" size="sm" type="button">{{ $t("adminTheme.statusError") }}</UiButton>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <span class="badge badge-info">{{ $t("adminTheme.statusInfo") }}</span>
                <span class="badge badge-success">{{ $t("adminTheme.statusSuccess") }}</span>
                <span class="badge badge-warning">{{ $t("adminTheme.statusWarning") }}</span>
                <span class="badge badge-error">{{ $t("adminTheme.statusError") }}</span>
              </div>
            </article>

            <article class="rounded-2xl bg-base-100 p-4 shadow-sm" :style="lightPreviewStyle" data-theme="guildora-light">
              <h3 class="text-lg font-semibold">{{ $t("adminTheme.previewLight") }}</h3>
              <p class="mt-1 text-sm opacity-80">{{ $t("adminTheme.previewCardTitle") }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <UiButton class="" size="sm" type="button">{{ $t("adminTheme.previewPrimary") }}</UiButton>
                <UiButton variant="secondary" size="sm" type="button">{{ $t("adminTheme.previewSecondary") }}</UiButton>
                <UiButton variant="ghost" size="sm" type="button">{{ $t("adminTheme.previewGhost") }}</UiButton>
                <UiButton variant="outline" size="sm" type="button">{{ $t("adminTheme.previewOutline") }}</UiButton>
                <UiButton variant="success" size="sm" type="button">{{ $t("adminTheme.statusSuccess") }}</UiButton>
                <UiButton variant="warning" size="sm" type="button">{{ $t("adminTheme.statusWarning") }}</UiButton>
                <UiButton variant="error" size="sm" type="button">{{ $t("adminTheme.statusError") }}</UiButton>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <span class="badge badge-info">{{ $t("adminTheme.statusInfo") }}</span>
                <span class="badge badge-success">{{ $t("adminTheme.statusSuccess") }}</span>
                <span class="badge badge-warning">{{ $t("adminTheme.statusWarning") }}</span>
                <span class="badge badge-error">{{ $t("adminTheme.statusError") }}</span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
