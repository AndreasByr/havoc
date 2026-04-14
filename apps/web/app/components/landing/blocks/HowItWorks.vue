<script setup lang="ts">
import { useGsapReveal, useGsapStagger } from '@guildora/motion'

defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const sectionRef = ref<HTMLElement | null>(null)
const stepsRef = ref<HTMLElement | null>(null)

useGsapReveal(sectionRef)
useGsapStagger(stepsRef, '.relative')
</script>

<template>
  <section ref="sectionRef" class="landing-card rounded-2xl px-6 py-14 shadow-md md:px-10 md:py-20">
    <h2 v-if="content.sectionTitle" class="landing-section-title mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
      {{ content.sectionTitle }}
    </h2>
    <div ref="stepsRef" class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="(step, i) in (content.steps as Array<Record<string, unknown>>)"
        :key="i"
        class="relative flex flex-col items-start gap-4"
      >
        <div
          v-if="i < ((content.steps as Array<unknown>)?.length ?? 0) - 1"
          class="landing-divider absolute left-[1.125rem] top-[1.125rem] hidden h-px w-[calc(100%+2rem-2.25rem)] translate-x-[2.25rem] lg:block"
        />
        <div class="landing-step-indicator flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
          {{ i + 1 }}
        </div>
        <div>
          <p class="landing-section-title font-semibold">{{ step.title }}</p>
          <p class="landing-text-muted mt-1 text-sm leading-relaxed">{{ step.description }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
