<script setup lang="ts">
import { useGsapReveal, useGsapStagger } from '@guildora/motion'

defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const titleRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

useGsapReveal(titleRef)
useGsapStagger(gridRef, ':scope > div')
</script>

<template>
  <section class="py-16 md:py-24">
    <h2 v-if="content.sectionTitle" ref="titleRef" class="landing-section-title mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
      {{ content.sectionTitle }}
    </h2>
    <div ref="gridRef" class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="(member, i) in (content.members as Array<Record<string, unknown>>)"
        :key="i"
        class="flex flex-col items-center text-center"
      >
        <div class="mb-4 h-24 w-24 overflow-hidden rounded-full shadow-md">
          <img v-if="member.avatarUrl" :src="String(member.avatarUrl)" :alt="String(member.name || '')" class="h-full w-full object-cover" />
          <div v-else class="flex h-full w-full items-center justify-center text-2xl font-bold landing-text-muted" style="background-color: var(--landing-surface)">
            {{ String(member.name || '?')[0] }}
          </div>
        </div>
        <p class="landing-section-title text-base font-semibold">{{ member.name }}</p>
        <p v-if="member.role" class="landing-text-muted mt-0.5 text-sm">{{ member.role }}</p>
      </div>
    </div>
  </section>
</template>
