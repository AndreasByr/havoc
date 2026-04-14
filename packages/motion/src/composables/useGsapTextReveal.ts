import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted } from 'vue'
import { useReducedMotion } from './useReducedMotion'
import { MOTION_TOKENS } from '../tokens'
import type { ElementRef, GsapTextRevealOptions } from '../types'

function splitIntoLines(element: HTMLElement): HTMLSpanElement[] {
  const text = element.textContent || ''
  if (!text.trim()) return []

  const words = text.split(/\s+/).filter(Boolean)
  element.innerHTML = words
    .map((word) => `<span class="gsap-word" style="display:inline-block">${word}</span>`)
    .join(' ')

  const wordSpans = Array.from(element.querySelectorAll<HTMLSpanElement>('.gsap-word'))
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentTop = -1

  for (const span of wordSpans) {
    if (currentTop === -1) {
      currentTop = span.offsetTop
    }

    if (span.offsetTop !== currentTop) {
      lines.push(currentLine)
      currentLine = []
      currentTop = span.offsetTop
    }
    currentLine.push(span.textContent || '')
  }
  if (currentLine.length) lines.push(currentLine)

  element.innerHTML = ''
  const lineSpans: HTMLSpanElement[] = []

  for (const line of lines) {
    const lineWrapper = document.createElement('span')
    lineWrapper.className = 'gsap-line-outer'
    lineWrapper.style.display = 'block'
    lineWrapper.style.overflow = 'hidden'

    const lineInner = document.createElement('span')
    lineInner.className = 'gsap-line-inner'
    lineInner.style.display = 'block'
    lineInner.textContent = line.join(' ')

    lineWrapper.appendChild(lineInner)
    element.appendChild(lineWrapper)
    lineSpans.push(lineInner)
  }

  return lineSpans
}

function splitIntoWords(element: HTMLElement): HTMLSpanElement[] {
  const text = element.textContent || ''
  if (!text.trim()) return []

  const words = text.split(/\s+/).filter(Boolean)
  element.innerHTML = ''
  const spans: HTMLSpanElement[] = []

  for (let i = 0; i < words.length; i++) {
    const outer = document.createElement('span')
    outer.style.display = 'inline-block'
    outer.style.overflow = 'hidden'

    const inner = document.createElement('span')
    inner.className = 'gsap-word-inner'
    inner.style.display = 'inline-block'
    inner.textContent = words[i] ?? null

    outer.appendChild(inner)
    element.appendChild(outer)

    if (i < words.length - 1) {
      element.appendChild(document.createTextNode(' '))
    }

    spans.push(inner)
  }

  return spans
}

export function useGsapTextReveal(
  el: ElementRef,
  options: GsapTextRevealOptions = {}
) {
  const { prefersReduced } = useReducedMotion()
  let ctx: gsap.Context | null = null

  onMounted(() => {
    if (!el.value) return

    if (prefersReduced.value) {
      gsap.set(el.value, { opacity: 1 })
      return
    }

    // On mobile, simplify to whole-element fade-up instead of per-line split
    const isMobile = window.innerWidth < 768

    if (isMobile) {
      ctx = gsap.context(() => {
        gsap.from(el.value!, {
          opacity: 0,
          y: 30,
          duration: MOTION_TOKENS.web.reveal,
          ease: MOTION_TOKENS.easing.entrance,
        })
      })
      return
    }

    const {
      splitBy = 'lines',
      stagger = 0.08,
      duration = 0.8,
      delay = 0,
      threshold = 0.2,
    } = options

    const targets =
      splitBy === 'lines'
        ? splitIntoLines(el.value)
        : splitIntoWords(el.value)

    if (!targets.length) return

    ctx = gsap.context(() => {
      const rect = el.value!.getBoundingClientRect()
      const alreadyVisible = rect.top < window.innerHeight * (1 - threshold + 0.1)

      const animVars: gsap.TweenVars = {
        yPercent: 110,
        opacity: 0,
        duration,
        stagger,
        ease: MOTION_TOKENS.easing.entrance,
        delay: delay / 1000,
      }

      if (alreadyVisible) {
        gsap.from(targets, animVars)
      } else {
        gsap.from(targets, {
          ...animVars,
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
