<script setup lang="ts">
import type { FlowInfoNodeData } from "@guildora/shared";

defineProps<{
  data: FlowInfoNodeData;
}>();
</script>

<template>
  <div class="info-block">
    <div class="info-block__content">{{ data.markdown }}</div>
    <div v-if="data.ctaLabel && data.ctaUrl" class="info-block__cta">
      <a
        :href="data.ctaUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-primary btn-sm"
      >
        {{ data.ctaLabel }}
      </a>
    </div>
    <div v-if="data.ctaLinkText && data.ctaLinkUrl" class="mt-3">
      <a
        :href="data.ctaLinkUrl"
        target="_blank"
        rel="noopener noreferrer"
        style="color: var(--color-accent)"
        class="text-sm hover:underline"
      >
        {{ data.ctaLinkText }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.info-block {
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: var(--color-surface-2);
  box-shadow: var(--shadow-sm);
}

.info-block__content {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--color-base-content);
}

.info-block__cta {
  margin-top: 1rem;
}
</style>
