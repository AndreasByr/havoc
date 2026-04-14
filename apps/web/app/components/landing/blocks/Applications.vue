<script setup lang="ts">
import { useGsapReveal } from '@guildora/motion'

const props = defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const sectionRef = ref<HTMLElement | null>(null)
useGsapReveal(sectionRef)

const runtimeConfig = useRuntimeConfig();
const hubUrl = computed(() => String(runtimeConfig.public.hubUrl || "http://localhost:3003").replace(/\/+$/, ""));

const applyUrl = computed(() => {
  if (props.config.mode === "link") {
    return safeLandingHref(props.content.customLink);
  }
  const flowId = String(props.config.flowId || "");
  return flowId ? `${hubUrl.value}/apply/${flowId}` : "#";
});

const buttonText = computed(() => String(props.content.buttonText || props.content.heading || "Apply"));
</script>

<template>
  <section ref="sectionRef" class="landing-card rounded-2xl px-6 py-14 text-center shadow-md md:px-8 md:py-20">
    <h2 class="landing-section-title mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
      {{ content.heading }}
    </h2>
    <p v-if="content.description" class="landing-text-muted mx-auto mt-4 max-w-xl text-base leading-relaxed">
      {{ content.description }}
    </p>
    <div class="mt-8">
      <a
        :href="applyUrl"
        class="landing-btn-primary rounded-lg px-8 py-3.5 text-base font-semibold"
      >
        {{ buttonText }}
      </a>
    </div>
  </section>
</template>
