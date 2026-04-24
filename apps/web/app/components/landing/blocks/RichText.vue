<script setup lang="ts">
import { useGsapReveal } from '@guildora/motion'

defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const sectionRef = ref<HTMLElement | null>(null)
useGsapReveal(sectionRef)
</script>

<template>
  <section id="about" ref="sectionRef" class="mx-auto max-w-3xl py-16 md:py-24">
    <h2 v-if="content.title" class="landing-section-title mb-5 text-3xl font-bold tracking-tight md:text-4xl">{{ content.title }}</h2>
    <p v-if="content.body" class="landing-text-muted text-base leading-relaxed md:text-lg">{{ content.body }}</p>
  </section>
</template>
