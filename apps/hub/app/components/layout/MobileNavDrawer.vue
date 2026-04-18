<script setup lang="ts">
import InternalNavSections from "./InternalNavSections.vue";

interface InternalNavItem {
  id: string;
  label: string;
  to: string;
  iconPath?: string;
  active?: boolean;
}

interface InternalNavGroup {
  id: string;
  title?: string;
  items: InternalNavItem[];
}

interface InternalNavSection {
  id: string;
  label: string;
  to: string;
  iconPath: string;
  kind: "core" | "app";
  isActive: boolean;
  isDirect: boolean;
  groups: InternalNavGroup[];
}

const { t } = useI18n();
const localePath = useLocalePath();

const props = withDefaults(defineProps<{
  open: boolean;
  panelId: string;
  sections: InternalNavSection[];
  expandedIds: string[];
  showKindHeaders?: boolean;
  currentUser: { profileName?: string; avatarUrl?: string | null } | null;
  permissionRoles: string[];
  communityName: string;
  activeSectionLabel: string;
  logoDataUrl: string | null;
  logoSizePx: number;
}>(), {
  showKindHeaders: true
});

const emit = defineEmits<{
  (event: "close"): void;
  (event: "toggle-section", sectionId: string): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
const lastFocusedElement = ref<HTMLElement | null>(null);
const previousBodyOverflow = ref<string | null>(null);

const mobileLogoSizePx = computed(() => {
  const size = props.logoSizePx ?? 48;
  return Math.max(40, Math.min(size, 48));
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("close");
  }
}

function onPanelMouseLeave() {
  emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (!import.meta.client) {
      return;
    }

    if (open) {
      previousBodyOverflow.value = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      lastFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      nextTick(() => {
        panelRef.value?.focus();
      });
      return;
    }

    document.body.style.overflow = previousBodyOverflow.value ?? "";
    previousBodyOverflow.value = null;
    lastFocusedElement.value?.focus();
  }
);

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return;
  }

  document.body.style.overflow = previousBodyOverflow.value ?? "";
});
</script>

<template>
  <Teleport to="body">
    <Transition name="mobile-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] lg:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('internalNav.ariaLabel')"
        @keydown.escape="emit('close')"
      >
        <div
          class="mobile-drawer-overlay absolute inset-0"
          aria-hidden="true"
          @click="emit('close')"
        />

        <div
          :id="panelId"
          ref="panelRef"
          tabindex="-1"
          class="mobile-drawer-panel absolute inset-y-0 left-0 w-full max-w-[340px] overflow-y-auto rounded-r-3xl bg-base-100 safe-top safe-bottom outline-none shadow-lg"
          @keydown="onKeydown"
          @mouseleave="onPanelMouseLeave"
        >
          <div class="sticky top-0 z-10 flex items-center justify-between gap-3 bg-base-100/95 px-4 py-3 backdrop-blur-sm">
            <div class="flex min-w-0 items-center gap-3">
              <NuxtLink
                :to="localePath('/dashboard')"
                class="btn btn-primary btn-sm relative flex shrink-0 items-center justify-center overflow-hidden rounded-full !p-0 text-sm font-bold"
                :class="logoDataUrl ? '!border-0 !bg-transparent !shadow-none' : ''"
                :style="{ width: `${mobileLogoSizePx}px`, height: `${mobileLogoSizePx}px`, minWidth: `${mobileLogoSizePx}px`, minHeight: `${mobileLogoSizePx}px` }"
                @click="emit('close')"
              >
                <img
                  v-if="logoDataUrl"
                  :src="logoDataUrl"
                  alt="Guildora"
                  class="absolute inset-0 h-full w-full object-cover"
                >
                <span v-else class="relative z-10">NG+</span>
              </NuxtLink>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">{{ communityName }}</p>
                <p class="truncate text-xs text-base-content/60">{{ activeSectionLabel }}</p>
              </div>
            </div>

            <button
              type="button"
              class="btn btn-secondary btn-sm btn-circle h-9 min-h-0 w-9 p-0"
              :aria-label="$t('internalNav.closeMenu')"
              @click="$emit('close')"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="px-4 py-4">
            <InternalNavSections
              :sections="sections"
              :expanded-ids="expandedIds"
              :show-kind-headers="showKindHeaders"
              non-direct-behavior="expand"
              @toggle-section="$emit('toggle-section', $event)"
              @navigate="$emit('close')"
            />
          </div>

          <div class="px-4 py-4">
            <div class="mb-3 flex items-center gap-3">
              <div class="size-9 shrink-0 overflow-hidden rounded-full bg-base-300">
                <img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" alt="" class="size-full object-cover" >
                <span v-else class="flex size-full items-center justify-center text-xs font-semibold uppercase text-base-content/50">{{ (currentUser?.profileName || "?").slice(0, 2) }}</span>
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ currentUser?.profileName ?? t("internalNav.defaultMember") }}</p>
                <p class="truncate text-xs opacity-65">{{ permissionRoles.join(", ") || t("internalNav.defaultPermissionRole") }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mobile-drawer-enter-active,
.mobile-drawer-leave-active {
  transition: opacity 0.26s ease;
}

.mobile-drawer-enter-from,
.mobile-drawer-leave-to {
  opacity: 0;
}

.mobile-drawer-overlay {
  background: rgb(0 0 0 / 0.62);
  backdrop-filter: blur(3px);
  opacity: 1;
  transition: opacity 0.26s ease;
}

.mobile-drawer-panel {
  transform: translateX(0);
  transition: transform 0.5s ease-in-out;
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.08));
}

.mobile-drawer-enter-from .mobile-drawer-overlay,
.mobile-drawer-leave-to .mobile-drawer-overlay {
  opacity: 0;
}

.mobile-drawer-enter-from .mobile-drawer-panel,
.mobile-drawer-leave-to .mobile-drawer-panel {
  transform: translateX(-100%);
}
</style>
