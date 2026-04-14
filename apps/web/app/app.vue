<script setup lang="ts">
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from '@guildora/motion'

const { prefersReduced } = useReducedMotion()

function onBeforeEnter(el: Element) {
  if (prefersReduced.value) return
  gsap.set(el, { opacity: 0, y: 15 })
}

function onEnter(el: Element, done: () => void) {
  if (prefersReduced.value) { done(); return }
  gsap.to(el, {
    opacity: 1,
    y: 0,
    duration: 0.3,
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
    y: -15,
    duration: 0.2,
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
