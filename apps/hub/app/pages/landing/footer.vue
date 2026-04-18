<script setup lang="ts">
definePageMeta({
  middleware: ["landing"],
});

const lastPath = useCookie<string | null>("guildora_landing_last_path", { sameSite: "lax" });
lastPath.value = "/landing/footer";

const { t } = useI18n();
const saving = ref(false);
const saveSuccess = ref("");
const saveError = ref("");
const loading = ref(true);

interface FooterPage {
  id: string;
  slug: string;
  title: Record<string, string>;
  content: Record<string, string>;
  sortOrder: number;
  visible: boolean;
}

const pages = ref<FooterPage[]>([]);
const editingPage = ref<FooterPage | null>(null);
const editLocale = ref("en");
const showDeleteConfirm = ref<{ open: boolean; page: FooterPage | null }>({ open: false, page: null });

// ─── Suggested pages ─────────────────────────────────────────────────────

const TEMPLATE_DISCLAIMER_EN = `<div style="background: rgba(255, 180, 0, 0.08); border: 1px solid rgba(255, 180, 0, 0.25); border-radius: 0.5rem; padding: 1rem; margin-bottom: 2rem; font-size: 0.875rem; line-height: 1.6;"><strong>⚠ Template Notice</strong><br>This is a non-binding template provided as a starting point. It does not constitute legal advice. You are solely responsible for ensuring your legal pages comply with all applicable laws. Consult a qualified attorney before publishing.</div>`;
const TEMPLATE_DISCLAIMER_DE = `<div style="background: rgba(255, 180, 0, 0.08); border: 1px solid rgba(255, 180, 0, 0.25); border-radius: 0.5rem; padding: 1rem; margin-bottom: 2rem; font-size: 0.875rem; line-height: 1.6;"><strong>⚠ Vorlage — Hinweis</strong><br>Dies ist eine unverbindliche Vorlage als Ausgangspunkt. Sie stellt keine Rechtsberatung dar. Sie sind allein dafür verantwortlich, dass Ihre Rechtstexte den geltenden Gesetzen entsprechen. Lassen Sie die Texte vor Veröffentlichung von einem Rechtsanwalt prüfen.</div>`;

const suggestedPages = [
  {
    slug: "privacy",
    title: { en: "Privacy Policy", de: "Datenschutzerklärung" },
    content: {
      en: `${TEMPLATE_DISCLAIMER_EN}\n<h2>1. Data Controller</h2>\n<p>[Your Name]<br>[Your Address]<br>[Your Email]</p>\n\n<h2>2. What Data We Collect</h2>\n<p>When you use this community platform, the following data may be processed:</p>\n<ul>\n<li><strong>Discord account data</strong> — Discord user ID, username, avatar, and email (via Discord OAuth)</li>\n<li><strong>Member profiles</strong> — Display name, roles, custom fields as configured by administrators</li>\n<li><strong>Application data</strong> — Responses to application forms, uploaded files</li>\n<li><strong>Session data</strong> — Login timestamps, session cookies</li>\n</ul>\n\n<h2>3. Legal Basis</h2>\n<p>Art. 6(1)(b) GDPR — Performance of a contract<br>Art. 6(1)(a) GDPR — Your consent (where applicable)<br>Art. 6(1)(f) GDPR — Legitimate interest (security)</p>\n\n<h2>4. Your Rights</h2>\n<p>Under the GDPR you have the right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20), and objection (Art. 21). Contact the data controller above.</p>`,
      de: `${TEMPLATE_DISCLAIMER_DE}\n<h2>1. Verantwortlicher</h2>\n<p>[Ihr Name]<br>[Ihre Adresse]<br>[Ihre E-Mail]</p>\n\n<h2>2. Welche Daten wir erheben</h2>\n<p>Bei der Nutzung dieser Community-Plattform können folgende Daten verarbeitet werden:</p>\n<ul>\n<li><strong>Discord-Kontodaten</strong> — Benutzer-ID, Benutzername, Avatar und E-Mail (über Discord OAuth)</li>\n<li><strong>Mitgliederprofile</strong> — Anzeigename, Rollen, benutzerdefinierte Felder</li>\n<li><strong>Bewerbungsdaten</strong> — Antworten auf Formulare, hochgeladene Dateien</li>\n<li><strong>Sitzungsdaten</strong> — Anmeldezeitpunkte, Session-Cookies</li>\n</ul>\n\n<h2>3. Rechtsgrundlage</h2>\n<p>Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung<br>Art. 6 Abs. 1 lit. a DSGVO — Einwilligung<br>Art. 6 Abs. 1 lit. f DSGVO — Berechtigtes Interesse (Sicherheit)</p>\n\n<h2>4. Ihre Rechte</h2>\n<p>Nach der DSGVO haben Sie das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21).</p>`,
    },
  },
  {
    slug: "terms",
    title: { en: "Terms of Service", de: "Nutzungsbedingungen" },
    content: {
      en: `${TEMPLATE_DISCLAIMER_EN}\n<h2>1. Scope</h2>\n<p>These Terms govern your use of this community platform.</p>\n\n<h2>2. Acceptable Use</h2>\n<p>You agree not to violate applicable laws, harass others, share malicious content, or attempt unauthorized access.</p>\n\n<h2>3. Liability</h2>\n<p>This platform is provided "as is" without warranties. The operator is not liable for damages except in cases of intent or gross negligence.</p>\n\n<h2>4. Changes</h2>\n<p>We may update these Terms at any time. Continued use constitutes acceptance.</p>`,
      de: `${TEMPLATE_DISCLAIMER_DE}\n<h2>1. Geltungsbereich</h2>\n<p>Diese Bedingungen regeln die Nutzung dieser Community-Plattform.</p>\n\n<h2>2. Zulässige Nutzung</h2>\n<p>Sie verpflichten sich, keine Gesetze zu verletzen, andere nicht zu belästigen, keine Schadsoftware zu verbreiten und keinen unbefugten Zugriff zu versuchen.</p>\n\n<h2>3. Haftung</h2>\n<p>Die Plattform wird ohne Garantien bereitgestellt. Der Betreiber haftet nicht für Schäden, es sei denn bei Vorsatz oder grober Fahrlässigkeit.</p>\n\n<h2>4. Änderungen</h2>\n<p>Wir können diese Bedingungen jederzeit aktualisieren. Die fortgesetzte Nutzung gilt als Zustimmung.</p>`,
    },
  },
  {
    slug: "imprint",
    title: { en: "Imprint", de: "Impressum" },
    content: {
      en: `${TEMPLATE_DISCLAIMER_EN}\n<h2>Responsible Person</h2>\n<p>[Your Full Name]<br>[Your Address]<br>[Postal Code, City]<br>[Country]</p>\n\n<h2>Contact</h2>\n<p>Email: [your@email.com]</p>\n\n<h2>EU Online Dispute Resolution</h2>\n<p>The European Commission provides a platform for online dispute resolution: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a></p>`,
      de: `${TEMPLATE_DISCLAIMER_DE}\n<h2>Verantwortliche Person</h2>\n<p>[Ihr vollständiger Name]<br>[Ihre Adresse]<br>[PLZ, Stadt]<br>[Land]</p>\n\n<h2>Kontakt</h2>\n<p>E-Mail: [ihre@email.de]</p>\n\n<h2>EU-Streitschlichtung</h2>\n<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a></p>`,
    },
  },
];

const availableSuggestions = computed(() =>
  suggestedPages.filter((s) => !pages.value.some((p) => p.slug === s.slug))
);

// ─── Drag & drop ─────────────────────────────────────────────────────────

const draggedIndex = ref<number | null>(null);

function onDragStart(index: number) {
  draggedIndex.value = index;
}

function onDragOver(event: DragEvent, index: number) {
  event.preventDefault();
  if (draggedIndex.value === null || draggedIndex.value === index) return;
  const arr = [...pages.value];
  const moved = arr.splice(draggedIndex.value, 1)[0];
  arr.splice(index, 0, moved);
  pages.value = arr;
  draggedIndex.value = index;
}

function onDragEnd() {
  draggedIndex.value = null;
  saveOrder();
}

// ─── Data ────────────────────────────────────────────────────────────────

async function loadPages() {
  loading.value = true;
  try {
    const data = await $fetch<{ pages: FooterPage[] }>("/api/admin/landing/footer-pages");
    pages.value = data.pages;
  } catch {
    saveError.value = t("landingFooter.loadError");
  } finally {
    loading.value = false;
  }
}

async function createPage(slug: string, title: Record<string, string>, content?: Record<string, string>) {
  saving.value = true;
  try {
    const nextOrder = pages.value.length;
    const data = await $fetch<{ page: FooterPage }>("/api/admin/landing/footer-pages", {
      method: "POST",
      body: { slug, title, content: content || { en: "", de: "" }, sortOrder: nextOrder }
    });
    pages.value.push(data.page);
    editingPage.value = data.page;
    flashSuccess();
  } catch {
    saveError.value = t("landingFooter.saveError");
  } finally {
    saving.value = false;
  }
}

async function savePage(page: FooterPage) {
  saving.value = true;
  try {
    const data = await $fetch<{ page: FooterPage }>(`/api/admin/landing/footer-pages/${page.id}`, {
      method: "PUT",
      body: { slug: page.slug, title: page.title, content: page.content, visible: page.visible }
    });
    const idx = pages.value.findIndex((p) => p.id === page.id);
    if (idx >= 0) pages.value[idx] = data.page;
    if (editingPage.value?.id === page.id) editingPage.value = data.page;
    flashSuccess();
  } catch {
    saveError.value = t("landingFooter.saveError");
  } finally {
    saving.value = false;
  }
}

async function deletePage(page: FooterPage) {
  saving.value = true;
  try {
    await $fetch(`/api/admin/landing/footer-pages/${page.id}`, { method: "DELETE" });
    pages.value = pages.value.filter((p) => p.id !== page.id);
    if (editingPage.value?.id === page.id) editingPage.value = null;
    showDeleteConfirm.value = { open: false, page: null };
    flashSuccess();
  } catch {
    saveError.value = t("landingFooter.deleteError");
  } finally {
    saving.value = false;
  }
}

async function saveOrder() {
  try {
    await $fetch("/api/admin/landing/footer-pages/reorder", {
      method: "PUT",
      body: { order: pages.value.map((p, i) => ({ id: p.id, sortOrder: i })) }
    });
  } catch {
    saveError.value = t("landingFooter.saveError");
  }
}

async function toggleVisibility(page: FooterPage) {
  page.visible = !page.visible;
  await savePage(page);
}

function addNewPage() {
  const slug = `page-${Date.now()}`;
  createPage(slug, { en: "New Page", de: "Neue Seite" });
}

function flashSuccess() {
  saveSuccess.value = t("landingEditor.saved");
  saveError.value = "";
  setTimeout(() => { saveSuccess.value = ""; }, 3000);
}

// ─── Locale-aware getters / setters for editing page ─────────────────────

function getTitle(): string {
  return editingPage.value?.title[editLocale.value] ?? "";
}

function setTitle(val: string) {
  if (!editingPage.value) return;
  editingPage.value.title = { ...editingPage.value.title, [editLocale.value]: val };
}

function getContent(): string {
  return editingPage.value?.content[editLocale.value] ?? "";
}

function setContent(val: string) {
  if (!editingPage.value) return;
  editingPage.value.content = { ...editingPage.value.content, [editLocale.value]: val };
}

onMounted(() => loadPages());
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">{{ t("landingFooter.title") }}</h1>
      <p class="text-sm opacity-60 mt-1">{{ t("landingFooter.description") }}</p>
    </div>

    <div v-if="saveSuccess" class="rounded-lg px-4 py-3 text-sm" style="background: rgba(34, 197, 94, 0.1); color: var(--color-success)">{{ saveSuccess }}</div>
    <div v-if="saveError" class="rounded-lg px-4 py-3 text-sm" style="background: rgba(239, 68, 68, 0.1); color: var(--color-error)">{{ saveError }}</div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
    </div>

    <template v-else>
      <!-- Suggested pages -->
      <div v-if="availableSuggestions.length > 0" class="rounded-xl p-5 space-y-3" style="background: var(--color-surface-2)">
        <h3 class="text-sm font-semibold">{{ t("landingFooter.suggestedPages") }}</h3>
        <div class="flex flex-wrap gap-2">
          <UiButton
            v-for="suggestion in availableSuggestions"
            :key="suggestion.slug"
            variant="outline"
            size="sm"
            @click="createPage(suggestion.slug, suggestion.title, suggestion.content)"
          >
            <Icon name="proicons:add" class="h-4 w-4 mr-1" />
            {{ suggestion.title[editLocale] || suggestion.title.en }}
          </UiButton>
        </div>
      </div>

      <!-- Pages list -->
      <div class="rounded-xl p-5 space-y-4" style="background: var(--color-surface-2)">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ t("landingFooter.pagesTitle") }}</h3>
          <UiButton variant="primary" size="sm" @click="addNewPage">
            <Icon name="proicons:add" class="h-4 w-4 mr-1" />
            {{ t("landingFooter.addPage") }}
          </UiButton>
        </div>

        <div v-if="pages.length === 0" class="text-sm opacity-50 py-4 text-center">
          {{ t("landingFooter.noPages") }}
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(page, index) in pages"
            :key="page.id"
            :class="['rounded-xl overflow-hidden transition-all', editingPage?.id === page.id && 'ring-2 ring-[var(--color-accent)]']"
            style="background: var(--color-surface-3)"
          >
            <!-- Page header row -->
            <div
              class="flex items-center justify-between px-4 py-3 cursor-grab"
              draggable="true"
              @dragstart="onDragStart(index)"
              @dragover="(e) => onDragOver(e, index)"
              @dragend="onDragEnd"
            >
              <div class="flex items-center gap-3">
                <div class="opacity-40 hover:opacity-70 select-none">
                  <Icon name="proicons:grid-dots" class="h-4 w-4" />
                </div>
                <span class="text-sm font-medium">{{ page.title.en || page.title.de || page.slug }}</span>
                <span class="text-xs opacity-40">/{{ page.slug }}</span>
                <span v-if="!page.visible" class="text-xs px-2 py-0.5 rounded opacity-50" style="background: var(--color-surface-4)">
                  {{ t("landingFooter.hidden") }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <UiButton variant="ghost" size="xs" @click="toggleVisibility(page)">
                  <Icon :name="page.visible ? 'proicons:eye' : 'proicons:eye-off'" class="h-4 w-4" />
                </UiButton>
                <UiButton variant="ghost" size="xs" @click="editingPage = editingPage?.id === page.id ? null : page">
                  <Icon name="proicons:pencil" class="h-4 w-4" />
                </UiButton>
                <UiButton variant="ghost" size="xs" class="text-red-400" @click="showDeleteConfirm = { open: true, page }">
                  <Icon name="proicons:delete" class="h-4 w-4" />
                </UiButton>
              </div>
            </div>

            <!-- Expanded editor -->
            <div v-if="editingPage?.id === page.id" class="px-4 pb-4 space-y-4" style="border-top: 1px solid var(--color-line)">
              <!-- Locale switcher -->
              <div class="flex gap-2 pt-4">
                <button
                  v-for="loc in ['en', 'de']"
                  :key="loc"
                  :class="['px-3 py-1 text-xs font-bold uppercase rounded-lg transition-colors', editLocale === loc ? 'text-white' : 'opacity-50 hover:opacity-80']"
                  :style="editLocale === loc ? 'background: var(--color-accent)' : 'background: var(--color-surface-4)'"
                  @click="editLocale = loc"
                >
                  {{ loc }}
                </button>
              </div>

              <UiInput
                :label="t('landingFooter.slugLabel')"
                :model-value="editingPage.slug"
                @update:model-value="(v: string) => { if (editingPage) editingPage.slug = v; }"
              />

              <UiInput
                :label="t('landingFooter.titleLabel')"
                :model-value="getTitle()"
                @update:model-value="(v: string) => setTitle(v)"
              />

              <UiTextarea
                :label="t('landingFooter.contentLabel')"
                :model-value="getContent()"
                :rows="12"
                @update:model-value="(v: string) => setContent(v)"
              />

              <div class="flex justify-end">
                <UiButton variant="primary" size="sm" :disabled="saving" @click="savePage(editingPage!)">
                  {{ saving ? t("landingEditor.saving") : t("common.save") }}
                </UiButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Delete confirmation modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteConfirm.open }" :open="showDeleteConfirm.open">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-bold">{{ t("landingFooter.deleteConfirmTitle") }}</h3>
        <p class="mt-2 opacity-80">{{ t("landingFooter.deleteConfirmText") }}</p>
        <p v-if="showDeleteConfirm.page" class="mt-1 text-sm font-medium">
          {{ showDeleteConfirm.page.title.en || showDeleteConfirm.page.slug }}
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <UiButton variant="ghost" @click="showDeleteConfirm = { open: false, page: null }">
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton variant="error" @click="deletePage(showDeleteConfirm.page!)">
            {{ t("common.delete") }}
          </UiButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showDeleteConfirm = { open: false, page: null }">close</button>
      </form>
    </dialog>
  </div>
</template>
