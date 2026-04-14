import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ref, onMounted, onUnmounted } from 'vue'
import { useReducedMotion } from './useReducedMotion'
import { MOTION_TOKENS } from '../tokens'
import type { ElementRef } from '../types'

export interface CountUpOptions {
  duration?: number
  delay?: number
  threshold?: number
  separator?: string
  prefix?: string
  suffix?: string
}

export function useCountUp(
  el: ElementRef,
  endValue: number,
  options: CountUpOptions = {}
) {
  const { prefersReduced } = useReducedMotion()
  const displayValue = ref(0)
  let ctx: gsap.Context | null = null

  onMounted(() => {
    if (!el.value) return

    if (prefersReduced.value) {
      displayValue.value = endValue
      updateDisplay(el.value, endValue, options)
      return
    }

    const {
      duration = MOTION_TOKENS.web.hero,
      delay = 0,
      threshold = 0.2,
    } = options

    ctx = gsap.context(() => {
      const proxy = { value: 0 }
      const rect = el.value!.getBoundingClientRect()
      const alreadyVisible = rect.top < window.innerHeight * (1 - threshold + 0.1)

      const tweenVars: gsap.TweenVars = {
        value: endValue,
        duration,
        delay: delay / 1000,
        ease: MOTION_TOKENS.easing.entrance,
        snap: { value: 1 },
        onUpdate: () => {
          displayValue.value = Math.round(proxy.value)
          updateDisplay(el.value!, proxy.value, options)
        },
      }

      if (alreadyVisible) {
        gsap.to(proxy, tweenVars)
      } else {
        gsap.to(proxy, {
          ...tweenVars,
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

  return { displayValue }
}

function updateDisplay(el: HTMLElement, value: number, options: CountUpOptions) {
  const { separator = '', prefix = '', suffix = '' } = options
  let formatted = Math.round(value).toString()
  if (separator) {
    formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  }
  el.textContent = `${prefix}${formatted}${suffix}`
}
