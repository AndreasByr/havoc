<script setup lang="ts">
import InternalNavSections from "../components/layout/InternalNavSections.vue";
import MobileNavDrawer from "../components/layout/MobileNavDrawer.vue";
import MobileNavPill from "../components/layout/MobileNavPill.vue";
interface InternalNavItem {
  id: string;
  label: string;
  labelKey?: string;
  to: string;
  iconPath?: string;
  active?: boolean;
}

interface InternalNavGroup {
  id: string;
  title?: string;
  titleKey?: string;
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

const route = useRoute();
const { user, logout } = useAuth();
const { t } = useI18n();
const localePath = useLocalePath();
const { data } = await useSidebarNavigation();
const { data: branding } = await useFetch<{ logoDataUrl: string | null; communityName: string | null; sidebarLogoSizePx: number }>("/api/internal/branding", {
  key: "internal-branding",
  default: () => ({ logoDataUrl: null, communityName: null, sidebarLogoSizePx: 60 })
});

const currentUser = computed(() => {
  return (user.value as { profileName?: string; avatarUrl?: string | null; permissionRoles?: string[]; roles?: string[] } | null) || null;
});

const permissionRoles = computed(() => currentUser.value?.permissionRoles ?? currentUser.value?.roles ?? []);
const navDrawerId = "internal-mobile-nav-drawer";
const isNavOpen = ref(false);
const isDesktopNav = ref(false);
const mobileExpandedIds = ref<string[]>([]);

const iconNames = {
  dashboard: "proicons:home",
  members: "proicons:person-multiple",
  settings: "proicons:settings",
  apps: "proicons:grid",
  cms: "proicons:document",
  dev: "proicons:code"
} as const;

const fallbackRail = computed(() => {
  const roles = permissionRoles.value;
  const hasAnyRole = (...required: string[]) => required.some((role) => roles.includes(role));
  const items: Array<{ id: string; to: string; label: string; labelKey?: string; iconPath: string; visible: boolean }> = [
    { id: "dashboard", to: localePath("/dashboard"), label: t("nav.dashboard"), labelKey: "nav.dashboard", iconPath: iconNames.dashboard, visible: true },
    { id: "profile", to: localePath("/profile/customize"), label: t("nav.profile"), labelKey: "nav.profile", iconPath: "proicons:person", visible: true },
    { id: "members", to: localePath("/members"), label: t("nav.members"), labelKey: "nav.members", iconPath: iconNames.members, visible: true },
    { id: "settings", to: localePath("/settings"), label: t("nav.settings"), labelKey: "nav.settings", iconPath: iconNames.settings, visible: hasAnyRole("moderator", "admin", "superadmin") },
    { id: "apps", to: localePath("/apps"), label: t("nav.apps"), labelKey: "nav.apps", iconPath: iconNames.apps, visible: hasAnyRole("moderator", "admin", "superadmin") },
    { id: "cms", to: localePath("/cms"), label: t("nav.cms"), labelKey: "nav.cms", iconPath: iconNames.cms, visible: hasAnyRole("moderator", "admin", "superadmin") },
    { id: "dev", to: localePath("/dev"), label: t("nav.dev"), labelKey: "nav.dev", iconPath: iconNames.dev, visible: useRuntimeConfig().public.isDev === true }
  ];

  return items.filter((item) => item.visible).map((item, index) => ({
    ...item,
    order: (index + 1) * 10
  }));
});

const resolveNavLabel = (label: string, key?: string) => key ? t(key) : label;

const isRouteMatch = (target: string, path: string) => path === target || path.startsWith(`${target}/`);

const sections = computed<InternalNavSection[]>(() => {
  const rail = (data.value?.rail && data.value.rail.length > 0) ? data.value.rail : fallbackRail.value;
  const panelGroups = data.value?.panelGroups || [];

  return rail.map((entry) => {
    const entryToLocalized = entry.to.startsWith("/") ? localePath(entry.to) : entry.to;
    const entryLabel = resolveNavLabel(entry.label, entry.labelKey);
    const allGroupItemTos = panelGroups
      .filter((group) => group.railItemId === entry.id)
      .flatMap((group) => group.items)
      .map((item) => item.to.startsWith("/") ? localePath(item.to) : item.to);
    const matchingTos = allGroupItemTos.filter((to) => isRouteMatch(to, route.path));
    const activeItemTo = matchingTos.length > 0
      ? matchingTos.reduce((best, to) => to.length > best.length ? to : best)
      : null;

    const groupsForRail = panelGroups
      .filter((group) => group.railItemId === entry.id)
      .sort((a, b) => a.order - b.order)
      .map((group) => ({
        id: group.id,
        title: group.title ? resolveNavLabel(group.title, group.titleKey) : undefined,
        titleKey: group.titleKey,
        items: group.items.map((item) => {
          const itemToLocalized = item.to.startsWith("/") ? localePath(item.to) : item.to;
          return {
            id: item.id,
            label: resolveNavLabel(item.label, item.labelKey),
            labelKey: item.labelKey,
            to: itemToLocalized,
            iconPath: item.iconPath,
            active: itemToLocalized === activeItemTo
          };
        })
      }))
      .filter((group) => group.items.length > 0);

    const fallbackGroup: InternalNavGroup = {
      id: `${entry.id}-default`,
      items: [
        {
          id: `${entry.id}-default-item`,
          label: entryLabel,
          to: entryToLocalized,
          iconPath: entry.iconPath,
          active: isRouteMatch(entryToLocalized, route.path)
        }
      ]
    };

    const normalizedGroups = groupsForRail.length > 0 ? groupsForRail : [fallbackGroup];
    const items = normalizedGroups.flatMap((group) => group.items);
    const uniqueTargets = Array.from(new Set(items.map((item) => item.to)));
    const isDirect = uniqueTargets.length <= 1;
    const sectionTo = isDirect ? uniqueTargets[0] || entryToLocalized : entryToLocalized;
    const isActive = isDirect
      ? isRouteMatch(sectionTo, route.path)
      : items.some((item) => item.active);

    return {
      id: entry.id,
      label: entryLabel,
      to: sectionTo,
      iconPath: entry.iconPath,
      kind: entry.id.startsWith("app:") ? "app" : "core",
      isActive,
      isDirect,
      groups: normalizedGroups
    };
  });
});

const showKindHeaders = computed(() => {
  const hasCore = sections.value.some((section) => section.kind === "core");
  const hasApps = sections.value.some((section) => section.kind === "app");
  return hasCore && hasApps;
});

const activeSectionLabel = computed(() => sections.value.find((section) => section.isActive)?.label || t("internalNav.sectionFallback"));
const internalLogoDataUrl = computed(() => branding.value?.logoDataUrl || null);
const sidebarLogoSizePx = computed(() => {
  const size = branding.value?.sidebarLogoSizePx ?? 60;
  return [40, 48, 60, 72].includes(size) ? size : 60;
});
const mobileLogoSizePx = computed(() => Math.min(sidebarLogoSizePx.value, 48));
const cmsBasePath = computed(() => localePath("/cms"));
const isFlowBuilderRoute = computed(() => {
  return /^(\/[a-z]{2})?\/applications\/flows\/[^/]+$/.test(route.path);
});
const isTinySidebar = computed(() => {
  return isRouteMatch(cmsBasePath.value, route.path) || isFlowBuilderRoute.value;
});
const isEmbedFullContentRoute = computed(() => {
  return isRouteMatch(cmsBasePath.value, route.path) || isFlowBuilderRoute.value;
});

const desktopExpandedIds = computed(() => {
  const activeSection = sections.value.find((section) => section.isActive && !section.isDirect);
  return activeSection ? [activeSection.id] : [];
});

const setActiveMobileExpansion = () => {
  const activeSection = sections.value.find((section) => section.isActive && !section.isDirect);
  mobileExpandedIds.value = activeSection ? [activeSection.id] : [];
};

const toggleMobileSection = (sectionId: string) => {
  const section = sections.value.find((entry) => entry.id === sectionId && !entry.isDirect);
  if (!section) {
    return;
  }

  if (mobileExpandedIds.value.includes(sectionId)) {
    mobileExpandedIds.value = mobileExpandedIds.value.filter((entry) => entry !== sectionId);
    return;
  }

  mobileExpandedIds.value = [...mobileExpandedIds.value, sectionId];
};

const closeNav = () => {
  isNavOpen.value = false;
};

const toggleNav = () => {
  if (isDesktopNav.value) {
    return;
  }

  isNavOpen.value = !isNavOpen.value;
};

let desktopMediaQuery: MediaQueryList | null = null;

const handleDesktopChange = (event: MediaQueryListEvent) => {
  isDesktopNav.value = event.matches;
};

onMounted(() => {
  if (!import.meta.client) {
    return;
  }

  desktopMediaQuery = window.matchMedia("(min-width: 1024px)");
  isDesktopNav.value = desktopMediaQuery.matches;

  if (typeof desktopMediaQuery.addEventListener === "function") {
    desktopMediaQuery.addEventListener("change", handleDesktopChange);
    return;
  }

  desktopMediaQuery.addListener(handleDesktopChange);
});

onBeforeUnmount(() => {
  if (!desktopMediaQuery) {
    return;
  }

  if (typeof desktopMediaQuery.removeEventListener === "function") {
    desktopMediaQuery.removeEventListener("change", handleDesktopChange);
    return;
  }

  desktopMediaQuery.removeListener(handleDesktopChange);
});

watch(sections, () => {
  if (!isNavOpen.value) {
    setActiveMobileExpansion();
  }
}, { immediate: true });

watch(() => isNavOpen.value, (open) => {
  if (open) {
    setActiveMobileExpansion();
  }
});

watch(isDesktopNav, (desktop) => {
  if (desktop) {
    closeNav();
  }
}, { immediate: true });

watch(() => route.path, () => {
  closeNav();
});
</script>

<template>
  <div
    class="min-h-screen bg-base-100"
    :class="[
      isTinySidebar ? 'lg:pl-14' : 'lg:pl-80',
      isEmbedFullContentRoute ? 'h-screen overflow-hidden' : ''
    ]"
  >
    <aside
      class="fixed z-30 hidden bg-base-100/95 lg:flex lg:flex-col"
      :class="isTinySidebar
        ? 'inset-y-0 left-0 w-14 rounded-none shadow-none'
        : 'inset-y-3 left-3 w-[19.25rem] rounded-3xl shadow-md'"
    >
      <template v-if="isTinySidebar">
        <nav class="min-h-0 flex-1 overflow-y-auto px-2 py-4" :aria-label="$t('internalNav.ariaLabel')">
          <div class="flex flex-col items-center gap-1">
            <NuxtLink
              v-for="section in sections.filter(s => s.kind === 'core')"
              :key="section.id"
              :to="section.to"
              class="sidebar-rail-item"
              :class="{ 'sidebar-rail-item-active': section.isActive }"
              :title="section.label"
              :aria-label="section.label"
            >
              <Icon v-if="section.iconPath?.includes(':')" :name="section.iconPath" class="h-4 w-4" aria-hidden="true" />
              <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path :d="section.iconPath" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </NuxtLink>
            <template v-if="sections.some(s => s.kind === 'app')">
              <div class="my-1 h-px w-6 bg-base-content/10" />
              <NuxtLink
                v-for="section in sections.filter(s => s.kind === 'app')"
                :key="section.id"
                :to="section.to"
                class="sidebar-rail-item"
                :class="{ 'sidebar-rail-item-active': section.isActive }"
                :title="section.label"
                :aria-label="section.label"
              >
                <Icon v-if="section.iconPath?.includes(':')" :name="section.iconPath" class="h-4 w-4" aria-hidden="true" />
                <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path :d="section.iconPath" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </NuxtLink>
            </template>
          </div>
        </nav>

      </template>

      <template v-else>
        <div class="flex items-center gap-3 px-4 py-2">
          <NuxtLink
            :to="localePath('/dashboard')"
            class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent text-sm font-bold text-white"
            :class="internalLogoDataUrl ? '!bg-transparent' : ''"
            :style="{ width: `${sidebarLogoSizePx}px`, height: `${sidebarLogoSizePx}px`, minWidth: `${sidebarLogoSizePx}px`, minHeight: `${sidebarLogoSizePx}px` }"
          >
            <img
              v-if="internalLogoDataUrl"
              :src="internalLogoDataUrl"
              alt="Guildora"
              class="absolute inset-0 h-full w-full object-cover"
            >
            <span v-else class="relative z-10">NG+</span>
          </NuxtLink>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">{{ branding?.communityName || $t("internalNav.communityHub") }}</p>
            <p class="truncate text-xs text-base-content/60">{{ activeSectionLabel }}</p>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <InternalNavSections
            :sections="sections"
            :expanded-ids="desktopExpandedIds"
            :show-kind-headers="showKindHeaders"
          />
        </div>

        <div class="px-4 py-4">
          <NuxtLink :to="localePath('/profile/customize')" class="mb-3 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-base-content/5">
            <div class="size-9 shrink-0 overflow-hidden rounded-full bg-base-300">
              <img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" alt="" class="size-full object-cover" />
              <span v-else class="flex size-full items-center justify-center text-xs font-semibold uppercase text-base-content/50">{{ (currentUser?.profileName || "?").slice(0, 2) }}</span>
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ currentUser?.profileName || $t("internalNav.defaultMember") }}</p>
              <p class="truncate text-xs opacity-65">{{ permissionRoles.join(", ") || $t("internalNav.defaultPermissionRole") }}</p>
            </div>
          </NuxtLink>
          <NuxtLink :to="localePath('/marketplace')" class="btn btn-ghost w-full">{{ $t("nav.marketplace") }}</NuxtLink>
        </div>
      </template>
    </aside>

    <div :class="isEmbedFullContentRoute ? 'flex h-full min-h-0 flex-col' : 'flex min-h-screen flex-col'">
      <main
        :class="isEmbedFullContentRoute
          ? 'flex-1 h-full min-h-0 overflow-hidden p-0'
          : 'flex-1 pt-3 px-4 pb-28 sm:pb-32 lg:pt-3 lg:px-6 lg:pb-6'"
      >
        <div
          v-if="!isEmbedFullContentRoute"
          class="mx-auto max-w-[1700px] rounded-2xl bg-base-100 p-4 shadow-md lg:p-6"
        >
          <slot />
        </div>
        <slot v-else />
      </main>
    </div>

    <MobileNavDrawer
      :open="isNavOpen"
      :panel-id="navDrawerId"
      :sections="sections"
      :expanded-ids="mobileExpandedIds"
      :show-kind-headers="showKindHeaders"
      :current-user="currentUser"
      :permission-roles="permissionRoles"
      :community-name="branding?.communityName || $t('internalNav.communityHub')"
      :active-section-label="activeSectionLabel"
      :logo-data-url="internalLogoDataUrl"
      :logo-size-px="mobileLogoSizePx"
      @toggle-section="toggleMobileSection"
      @close="closeNav"
    />

    <MobileNavPill
      :open="isNavOpen"
      :controls-id="navDrawerId"
      @toggle="toggleNav"
    />
  </div>
</template>
