<script setup lang="ts">
defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();
</script>

<template>
  <section class="mx-auto max-w-3xl py-16 md:py-24">
    <h2 v-if="content.sectionTitle" class="landing-section-title mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
      {{ content.sectionTitle }}
    </h2>
    <div class="space-y-3">
      <div
        v-for="(item, i) in (content.items as Array<Record<string, unknown>>)"
        :key="i"
        class="landing-card collapse collapse-arrow rounded-xl shadow-sm"
      >
        <input type="radio" :name="'faq-accordion'" >
        <div class="collapse-title font-semibold landing-section-title">{{ item.question }}</div>
        <div class="collapse-content text-sm leading-relaxed landing-text-muted">
          <p>{{ item.answer }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
