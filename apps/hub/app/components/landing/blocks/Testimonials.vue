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
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
      <div
        v-for="(item, i) in (content.testimonials as Array<Record<string, unknown>>)"
        :key="i"
        class="landing-card rounded-xl p-6 shadow-md"
      >
        <p class="landing-text-muted text-sm leading-relaxed md:text-base">"{{ item.quote }}"</p>
        <div class="mt-5 flex items-center gap-3">
          <div v-if="item.avatarUrl" class="h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <img :src="String(item.avatarUrl)" :alt="String(item.name || '')" class="h-full w-full object-cover" >
          </div>
          <div>
            <p class="landing-section-title text-sm font-semibold">{{ item.name }}</p>
            <p v-if="item.role" class="landing-text-muted text-xs">{{ item.role }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
