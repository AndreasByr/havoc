import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted } from 'vue'
import { useReducedMotion } from './useReducedMotion'
import { MOTION_TOKENS } from '../tokens'
import type { ElementRef, GsapRevealOptions } from '../types'
import type { MotionPreset } from '../tokens'

export function useGsapReveal(
  el: ElementRef,
  options: GsapRevealOptions = {},
  preset: MotionPreset = 'web'
) {
  const { prefersReduced } = useReducedMotion()
  let ctx: gsap.Context | null = null

  onMounted(() => {
    if (!el.value) return

    if (prefersReduced.value) {
      gsap.set(el.value, { opacity: 1, x: 0, y: 0 })
      return
    }

    const tokens = MOTION_TOKENS[preset]
    const {
      direction = 'up',
      delay = 0,
      distance = tokens.distance,
      duration = tokens.reveal,
      threshold = 0.2,
    } = options

    const fromVars: gsap.TweenVars = {
      opacity: 0,
      duration,
      delay: delay / 1000,
      ease: MOTION_TOKENS.easing.entrance,
    }

    if (direction === 'up') fromVars.y = distance
    else if (direction === 'left') fromVars.x = -distance
    else if (direction === 'right') fromVars.x = distance

    ctx = gsap.context(() => {
      const rect = el.value!.getBoundingClientRect()
      const alreadyVisible = rect.top < window.innerHeight * (1 - threshold + 0.1)

      if (alreadyVisible) {
        gsap.from(el.value!, { ...fromVars })
      } else {
        gsap.from(el.value!, {
          ...fromVars,
          scrollTrigger: {
            trigger: el.value!,
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
