<script setup lang="ts">
const props = defineProps<{
  sections: Array<{
    id: string;
    blockType: string;
    sortOrder: number;
    visible: boolean;
    config: Record<string, unknown>;
    content: Record<string, unknown>;
  }>;
  locale: string;
  templateId: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    accentText: string;
    border: string;
  };
  customCss: string | null;
}>();

const localizedSections = computed(() =>
  props.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const content = s.content as Record<string, unknown>;
      const loc = (content[props.locale] ?? content.en ?? content) as Record<string, unknown>;
      return {
        id: s.id,
        blockType: s.blockType,
        sortOrder: s.sortOrder,
        config: s.config,
        content: loc,
      };
    })
);

useHead({
  style: computed(() =>
    props.customCss ? [{ innerHTML: props.customCss }] : []
  )
});

const colorStyle = computed(() => {
  const c = props.colors;
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
</script>

<template>
  <div
    class="landing-preview-container space-y-6"
    :style="colorStyle"
    :data-template="templateId"
  >
    <div v-if="localizedSections.length === 0" class="flex items-center justify-center min-h-[50vh] text-sm opacity-40">
      Keine Blöcke vorhanden
    </div>
    <template v-else>
      <LandingBlockRenderer
        v-for="section in localizedSections"
        :key="section.id"
        :section="section"
      />
    </template>

  </div>
</template>

<style scoped>
.landing-preview-container {
  pointer-events: none;
  user-select: none;
  overflow: hidden;
}

.landing-preview-container :deep(a),
.landing-preview-container :deep(button),
.landing-preview-container :deep(input),
.landing-preview-container :deep(select),
.landing-preview-container :deep(textarea) {
  pointer-events: none !important;
  cursor: default !important;
}
</style>
