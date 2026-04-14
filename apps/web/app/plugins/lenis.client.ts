import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

declare module '#app' {
  interface NuxtApp {
    $lenis: Lenis | null
  }
}

export default defineNuxtPlugin(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    touchMultiplier: 2,
    infinite: false,
    autoResize: true,
    prevent: (node: Element) => {
      return node.closest('[data-lenis-prevent]') !== null
    },
  })

  if (prefersReduced) {
    lenis.destroy()
    return { provide: { lenis: null as Lenis | null } }
  }

  lenis.on('scroll', ScrollTrigger.update)

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000)
  })

  gsap.ticker.lagSmoothing(0)

  return {
    provide: {
      lenis: lenis as Lenis | null,
    },
  }
})
