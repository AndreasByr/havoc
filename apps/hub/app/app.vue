<script setup lang="ts">
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from '@guildora/motion'
import {
  buildThemeHtmlStyle,
  defaultThemeColors,
  normalizeThemeColors,
  resolveThemeName,
  type ThemeColors
} from "../utils/theme-colors";

const themeColors = useState<ThemeColors>("theme-colors", () => ({ ...defaultThemeColors }));
const colorMode = useColorMode();
const { data } = await useFetch<ThemeColors>("/api/theme", {
  key: "initial-theme-colors",
  default: () => ({ ...defaultThemeColors })
});

themeColors.value = normalizeThemeColors(data.value);

const resolvedMode = computed(() => colorMode.value === "dark" ? "dark" : "light");

useHead({
  htmlAttrs: {
    "data-theme": computed(() => resolveThemeName(resolvedMode.value)),
    style: computed(() => buildThemeHtmlStyle(themeColors.value, resolvedMode.value))
  },
  bodyAttrs: {
    style: "margin:0;background-color:var(--color-base-100);color:var(--color-base-content);"
  }
});

const { prefersReduced } = useReducedMotion()

function onBeforeEnter(el: Element) {
  if (prefersReduced.value) return
  gsap.set(el, { opacity: 0, y: 10 })
}

function onEnter(el: Element, done: () => void) {
  if (prefersReduced.value) { done(); return }
  gsap.to(el, {
    opacity: 1,
    y: 0,
    duration: 0.2,
    ease: 'power3.out',
    onComplete: () => {
      ScrollTrigger.refresh()
      done()
    },
  })
}

function onLeave(el: Element, done: () => void) {
  if (prefersReduced.value) { done(); return }
  gsap.to(el, {
    opacity: 0,
    duration: 0.15,
    ease: 'power2.in',
    onComplete: done,
  })
}
</script>

<template>
  <NuxtLayout>
    <NuxtPage
      :transition="{
        css: false,
        mode: 'out-in',
        onBeforeEnter,
        onEnter,
        onLeave,
      }"
    />
  </NuxtLayout>
</template>
