<script setup lang="ts">
import { useGsapReveal } from '@guildora/motion'

const props = defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const variant = computed(() => String(props.config.variant || props.content.variant || "default"));

const sectionRef = ref<HTMLElement | null>(null)
useGsapReveal(sectionRef)
</script>

<template>
  <section
    ref="sectionRef"
    :class="[
      'rounded-2xl px-6 py-14 text-center md:px-8 md:py-20',
      variant === 'accent'
        ? 'landing-accent-bg'
        : 'landing-card shadow-md'
    ]"
  >
    <h2
      :class="[
        'mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-4xl',
        variant !== 'accent' && 'landing-section-title'
      ]"
    >{{ content.heading }}</h2>
    <p :class="['mx-auto mt-4 max-w-xl text-base leading-relaxed', variant === 'accent' ? 'opacity-85' : 'landing-text-muted']">
      {{ content.description }}
    </p>
    <div class="mt-8">
      <a
        :href="safeLandingHref(content.buttonLink)"
        :class="[
          'inline-flex items-center rounded-lg px-8 py-3.5 text-base font-semibold transition-all duration-200',
          variant === 'accent'
            ? 'bg-[var(--landing-accent-text)] text-[var(--landing-accent)] hover:opacity-90'
            : 'landing-btn-primary'
        ]"
      >
        {{ content.buttonText }}
      </a>
    </div>
  </section>
</template>
