<script setup lang="ts">
import { useGsapStagger } from '@guildora/motion'

defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const gridRef = ref<HTMLElement | null>(null)

useGsapStagger(gridRef, '.landing-card')
</script>

<template>
  <section class="py-16 md:py-24">
    <div
      ref="gridRef"
      :class="[
        'grid gap-4',
        (content.images as Array<unknown>)?.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
      ]"
    >
      <div
        v-for="(item, i) in (content.images as Array<Record<string, unknown>>)"
        :key="i"
        class="landing-card overflow-hidden rounded-xl shadow-md"
      >
        <img
          v-if="item.url || item.image"
          :src="String(item.url || item.image)"
          :alt="String(item.alt || '')"
          class="aspect-video w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
        />
      </div>
    </div>
  </section>
</template>
