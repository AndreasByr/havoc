import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted } from 'vue'
import { useReducedMotion } from './useReducedMotion'
import { MOTION_TOKENS } from '../tokens'
import type { ElementRef, GsapStaggerOptions } from '../types'
import type { MotionPreset } from '../tokens'

export function useGsapStagger(
  container: ElementRef,
  childSelector: string,
  options: GsapStaggerOptions = {},
  preset: MotionPreset = 'web'
) {
  const { prefersReduced } = useReducedMotion()
  let ctx: gsap.Context | null = null

  onMounted(() => {
    if (!container.value) return

    const children = container.value.querySelectorAll(childSelector)
    if (!children.length) return

    if (prefersReduced.value) {
      gsap.set(children, { opacity: 1, y: 0, x: 0 })
      return
    }

    const tokens = MOTION_TOKENS[preset]
    const {
      stagger = tokens.stagger,
      y = tokens.distance,
      x = 0,
      duration = tokens.reveal,
      ease = MOTION_TOKENS.easing.entrance,
      threshold = 0.15,
      delay = 0,
    } = options

    // Cap stagger total at ~0.5s
    const maxTotalStagger = 0.5
    const cappedStagger = Math.min(stagger, maxTotalStagger / Math.max(children.length - 1, 1))

    ctx = gsap.context(() => {
      const rect = container.value!.getBoundingClientRect()
      const alreadyVisible = rect.top < window.innerHeight * (1 - threshold + 0.1)

      const animVars: gsap.TweenVars = {
        opacity: 0,
        y,
        x,
        duration,
        stagger: cappedStagger,
        ease,
        delay: delay / 1000,
      }

      if (alreadyVisible) {
        gsap.from(children, animVars)
      } else {
        gsap.from(children, {
          ...animVars,
          scrollTrigger: {
            trigger: container.value!,
            start: `top ${100 - threshold * 100}%`,
            toggleActions: 'play none none none',
            once: true,
          },
        })
      }
    })
  })

  onUnmounted(() => {
    ctx?.revert()
  })
}
