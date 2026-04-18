<script setup lang="ts">
defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();
</script>

<template>
  <section class="py-16 md:py-24">
    <h2 v-if="content.sectionTitle" class="landing-section-title mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
      {{ content.sectionTitle }}
    </h2>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
      <div
        v-for="(stat, i) in (content.stats as Array<Record<string, unknown>>)"
        :key="i"
        class="landing-card rounded-xl p-6 text-center shadow-md"
      >
        <span class="landing-stat-value block text-4xl font-extrabold md:text-5xl">{{ stat.value }}</span>
        <p class="landing-text-muted mt-2 text-sm font-medium">{{ stat.label }}</p>
      </div>
    </div>
  </section>
</template>
