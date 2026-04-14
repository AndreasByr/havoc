import gsap from 'gsap'
import { onMounted, onUnmounted } from 'vue'
import { useReducedMotion } from './useReducedMotion'
import type { ElementRef, CardTiltOptions } from '../types'

export function useCardTilt(
  card: ElementRef,
  options: CardTiltOptions = {}
) {
  const { prefersReduced } = useReducedMotion()
  let isTouch = false

  const {
    maxRotation = 5,
    perspective = 800,
    scale = 1.02,
    speed = 0.4,
  } = options

  function getEl(): HTMLElement | null {
    const raw = card.value
    if (!raw) return null
    if (raw instanceof HTMLElement) return raw
    if ((raw as any)?.$el instanceof HTMLElement) return (raw as any).$el
    return null
  }

  function onPointerMove(e: PointerEvent) {
    const el = getEl()
    if (!el || isTouch) return

    const rect = el.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const normalX = (e.clientX - centerX) / (rect.width / 2)
    const normalY = (e.clientY - centerY) / (rect.height / 2)

    gsap.to(el, {
      rotateY: normalX * maxRotation,
      rotateX: -normalY * maxRotation,
      scale,
      duration: speed,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  function onPointerLeave() {
    const el = getEl()
    if (!el || isTouch) return

    gsap.to(el, {
      rotateY: 0,
      rotateX: 0,
      scale: 1,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: 'auto',
    })
  }

  onMounted(() => {
    const el = getEl()
    if (!el || prefersReduced.value) return

    isTouch = !window.matchMedia('(hover: hover)').matches
    if (isTouch) return

    const parent = el.parentElement
    if (parent) {
      parent.style.perspective = `${perspective}px`
    }
    el.style.transformStyle = 'preserve-3d'
    el.style.willChange = 'transform'

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerleave', onPointerLeave)
  })

  onUnmounted(() => {
    const el = getEl()
    if (!el) return
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerleave', onPointerLeave)
    el.style.willChange = ''
    el.style.transformStyle = ''
  })
}
