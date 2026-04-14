import { ref, readonly } from 'vue'

const prefersReduced = ref(false)
let initialized = false

export function useReducedMotion() {
  if (typeof window === 'undefined') return { prefersReduced: readonly(ref(false)) }

  if (!initialized) {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReduced.value = mql.matches

    mql.addEventListener('change', (e) => {
      prefersReduced.value = e.matches
    })

    initialized = true
  }

  return { prefersReduced: readonly(prefersReduced) }
}
