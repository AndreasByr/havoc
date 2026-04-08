<script setup lang="ts">
import { resolveBlockComponent } from "./blocks";

const props = defineProps<{
  section: {
    id: string;
    blockType: string;
    sortOrder: number;
    config: Record<string, unknown>;
    content: Record<string, unknown>;
  };
}>();

const resolved = computed(() => resolveBlockComponent(props.section.blockType));
const styleVariant = computed(() => {
  const v = props.section.config?.styleVariant;
  return typeof v === "string" ? v : "normal";
});
</script>

<template>
  <component
    v-if="resolved"
    :is="resolved"
    :content="section.content"
    :config="section.config"
    :data-style-variant="styleVariant"
  />
  <section v-else class="landing-card rounded-xl p-6 text-center text-sm opacity-60">
    <p>{{ $t("landingBlocks.unsupported", { type: section.blockType }) }}</p>
  </section>
</template>
