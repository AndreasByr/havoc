<script setup lang="ts">
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

const props = withDefaults(defineProps<{
  sections: InternalNavSection[];
  expandedIds?: string[];
  showKindHeaders?: boolean;
  nonDirectBehavior?: "expand" | "navigate";
}>(), {
  expandedIds: () => [],
  showKindHeaders: true,
  nonDirectBehavior: "navigate"
});

defineEmits<{
  (event: "toggle-section", sectionId: string): void;
  (event: "navigate"): void;
}>();

const buckets = computed<Array<{ id: string; label: string; sections: InternalNavSection[] }>>(() => {
  const core = props.sections.filter((section: InternalNavSection) => section.kind === "core");
  const apps = props.sections.filter((section: InternalNavSection) => section.kind === "app");
  return [
    { id: "core", label: t("internalNav.core"), sections: core },
    { id: "app", label: t("internalNav.apps"), sections: apps }
  ].filter((bucket) => bucket.sections.length > 0);
});

const isExpanded = (sectionId: string) => props.expandedIds.includes(sectionId);

const hasMultipleVisibleGroups = (section: InternalNavSection) =>
  section.groups.filter((group) => group.items.length > 0).length > 1;
</script>

<template>
  <nav class="space-y-4" :aria-label="$t('internalNav.ariaLabel')">
    <section v-for="bucket in buckets" :key="bucket.id" class="space-y-0.5">
      <div class="space-y-0.5">
        <article v-for="section in bucket.sections" :key="section.id">
          <NuxtLink
            v-if="section.isDirect || nonDirectBehavior === 'navigate'"
            :to="section.to"
            class="sidebar-item"
            :class="{ 'sidebar-item-active': section.isActive }"
            :data-tour="`sidebar-${section.id}`"
            @click="$emit('navigate')"
          >
            <Icon v-if="section.iconPath?.includes(':')" :name="section.iconPath" class="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
            <svg v-else class="h-4 w-4 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path :d="section.iconPath" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="min-w-0 flex-1 truncate">{{ section.label }}</span>
          </NuxtLink>

          <button
            v-else
            type="button"
            class="sidebar-item w-full text-left"
            :class="{ 'sidebar-item-active': section.isActive || isExpanded(section.id) }"
            :data-tour="`sidebar-${section.id}`"
            :aria-expanded="isExpanded(section.id)"
            @click="$emit('toggle-section', section.id)"
          >
            <Icon v-if="section.iconPath?.includes(':')" :name="section.iconPath" class="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
            <svg v-else class="h-4 w-4 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path :d="section.iconPath" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="min-w-0 flex-1 truncate">{{ section.label }}</span>
            <svg
              class="h-4 w-4 shrink-0 opacity-40 transition-transform"
              :class="isExpanded(section.id) ? 'rotate-180' : ''"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <div
            v-if="!section.isDirect && isExpanded(section.id)"
            class="space-y-1 pl-3 pb-1 pt-0.5"
          >
            <section v-for="group in section.groups" :key="group.id" class="space-y-0.5">
              <h3
                v-if="group.title && hasMultipleVisibleGroups(section)"
                class="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-base-content/45"
              >
                {{ group.title }}
              </h3>
              <div class="space-y-0.5">
                <NuxtLink
                  v-for="item in group.items"
                  :key="item.id"
                  :to="item.to"
                  class="sidebar-item text-[0.8125rem]"
                  :class="{ 'sidebar-item-active': item.active }"
                  @click="$emit('navigate')"
                >
                  <Icon v-if="item.iconPath?.includes(':')" :name="item.iconPath" class="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  <svg v-else-if="item.iconPath" class="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path :d="item.iconPath" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span class="min-w-0 truncate">{{ item.label }}</span>
                </NuxtLink>
              </div>
            </section>
          </div>
        </article>
      </div>
    </section>
  </nav>
</template>
