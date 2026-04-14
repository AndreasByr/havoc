<script setup lang="ts">
import { useGsapReveal } from '@guildora/motion'

const props = defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const videoId = computed(() => {
  const url = String(props.content.videoUrl || "");
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
  return match?.[1] || url;
});
const sectionRef = ref<HTMLElement | null>(null)
useGsapReveal(sectionRef)
</script>

<template>
  <section ref="sectionRef" class="py-16 md:py-24">
    <h2 v-if="content.title" class="landing-section-title mb-6 text-center text-3xl font-bold tracking-tight md:text-4xl">{{ content.title }}</h2>
    <div class="landing-card aspect-video overflow-hidden rounded-xl shadow-md">
      <iframe
        v-if="videoId"
        :src="`https://www.youtube-nocookie.com/embed/${videoId}`"
        class="h-full w-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
    </div>
  </section>
</template>
