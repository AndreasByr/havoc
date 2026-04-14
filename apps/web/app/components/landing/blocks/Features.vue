<script setup lang="ts">
import { useGsapReveal, useGsapStagger } from '@guildora/motion'

const props = defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const titleRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

useGsapReveal(titleRef)
useGsapStagger(gridRef, '.landing-card')

function iconName(icon: unknown): string {
  const name = String(icon || "");
  if (!name) return "";
  if (name.includes(":")) return name;
  return `lucide:${name}`;
}
</script>

<template>
  <section class="py-16 md:py-24">
    <h2 v-if="content.sectionTitle" ref="titleRef" class="landing-section-title mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
      {{ content.sectionTitle }}
    </h2>
    <div ref="gridRef" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
      <div
        v-for="(feature, i) in (content.features as Array<Record<string, unknown>>)"
        :key="i"
        class="landing-card rounded-xl p-6 shadow-md transition-all duration-200 hover:-translate-y-0.5"
      >
        <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg landing-step-indicator">
          <Icon
            v-if="feature.icon"
            :name="iconName(feature.icon)"
            class="h-5 w-5"
          />
          <div v-else class="h-2 w-2 rounded-full bg-[var(--landing-accent)]" />
        </div>
        <h3 class="landing-section-title mb-1.5 text-base font-semibold">{{ feature.title }}</h3>
        <p class="landing-text-muted text-sm leading-relaxed">{{ feature.description }}</p>
      </div>
    </div>
  </section>
</template>
