import { MOTION_TOKENS } from '@guildora/motion'
import type { GsapRevealOptions } from '@guildora/motion'

interface TemplateMotionDefaults {
  ease: string
  duration: number
  distance: number
  /** Extra GSAP vars merged into reveal animations (e.g. boxShadow for cyberpunk) */
  extraVars?: Record<string, unknown>
}

const templateDefaults: Record<string, TemplateMotionDefaults> = {
  default: {
    ease: MOTION_TOKENS.easing.entrance,
    duration: 0.7,
    distance: 40,
  },
  cyberpunk: {
    ease: MOTION_TOKENS.easing.entrance,
    duration: 0.8,
    distance: 60,
  },
  esports: {
    ease: MOTION_TOKENS.easing.interactive,
    duration: 0.5,
    distance: 30,
  },
}

export function useTemplateMotion() {
  const route = useRoute()

  const templateId = computed(() => {
    // Read from the page's data-template attribute or route query
    if (import.meta.server) return 'default'
    const el = document.querySelector('[data-template]')
    return (el?.getAttribute('data-template') || 'default') as string
  })

  const defaults = computed((): TemplateMotionDefaults => templateDefaults[templateId.value] ?? templateDefaults.default!)

  function getRevealOptions(overrides: GsapRevealOptions = {}): GsapRevealOptions {
    return {
      distance: defaults.value!.distance,
      duration: defaults.value!.duration,
      ...overrides,
    }
  }

  return {
    templateId,
    defaults,
    getRevealOptions,
  }
}
