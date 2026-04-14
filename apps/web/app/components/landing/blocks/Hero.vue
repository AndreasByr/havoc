<script setup lang="ts">
import { useGsapTextReveal, useGsapReveal } from '@guildora/motion'

const props = defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const variant = computed(() => String(props.config.layoutVariant || "default"));

const headingRef = ref<HTMLElement | null>(null)
const subheadingRef = ref<HTMLElement | null>(null)
const ctaRef = ref<HTMLElement | null>(null)

useGsapTextReveal(headingRef, { splitBy: 'lines', stagger: 0.08, duration: 0.9 })
useGsapReveal(subheadingRef, { delay: 300, duration: 0.7 })
useGsapReveal(ctaRef, { delay: 500, duration: 0.7 })
</script>

<template>
  <section class="landing-card relative overflow-hidden rounded-2xl">
    <img
      v-if="content.backgroundImage"
      :src="String(content.backgroundImage)"
      alt=""
      class="absolute inset-0 h-full w-full object-cover opacity-20"
    />
    <div class="absolute inset-0 pointer-events-none bg-gradient-to-br from-[var(--landing-accent)]/15 via-transparent to-transparent" />
    <div class="relative flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center md:py-32">
      <span
        v-if="content.eyebrowLabel"
        class="landing-eyebrow mb-6 inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
      >
        {{ content.eyebrowLabel }}
      </span>
      <h1
        ref="headingRef"
        :class="[
          'landing-section-title mb-5 font-extrabold leading-[1.08] tracking-tight',
          variant === 'esports' ? 'text-4xl md:text-6xl lg:text-7xl uppercase' :
          'text-4xl md:text-6xl lg:text-7xl'
        ]"
      >
        {{ content.heading }}
      </h1>
      <p ref="subheadingRef" class="landing-text-muted mb-10 max-w-2xl text-base leading-relaxed md:text-lg">{{ content.subheading }}</p>
      <div ref="ctaRef" class="flex flex-wrap items-center justify-center gap-4">
        <a
          v-if="content.ctaLink"
          :href="safeLandingHref(content.ctaLink)"
          class="landing-btn-primary rounded-lg px-7 py-3.5 text-sm font-semibold"
        >
          {{ content.ctaText || $t("landing.cta") }}
        </a>
        <a
          v-if="content.ctaExploreLabel"
          href="#about"
          class="landing-btn-outline rounded-lg px-7 py-3.5 text-sm font-semibold"
        >
          {{ content.ctaExploreLabel }}
        </a>
      </div>
    </div>
  </section>
</template>
