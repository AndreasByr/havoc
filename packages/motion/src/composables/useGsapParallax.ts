import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted } from 'vue'
import { useReducedMotion } from './useReducedMotion'
import type { ElementRef } from '../types'

export function useGsapParallax(
  el: ElementRef,
  speed: number = 0.3
) {
  const { prefersReduced } = useReducedMotion()
  let trigger: ScrollTrigger | null = null

  onMounted(() => {
    if (!el.value || prefersReduced.value) return

    // Disable on mobile — janky scroll feel
    if (window.innerWidth < 768) return

    const distance = speed * 100

    trigger = ScrollTrigger.create({
      trigger: el.value,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        const yOffset = (self.progress - 0.5) * distance
        gsap.set(el.value!, { y: yOffset, force3D: true })
      },
    })

    el.value.style.willChange = 'transform'
  })

  onUnmounted(() => {
    trigger?.kill()
    if (el.value) {
      el.value.style.willChange = ''
    }
  })
}
