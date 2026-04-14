/**
 * Motion tokens for the Guildora platform.
 * Two-tier system: marketing (web) vs productivity (hub).
 */

export const MOTION_TOKENS = {
  web: {
    micro: 0.25,
    reveal: 0.7,
    hero: 1.0,
    stagger: 0.08,
    distance: 40,
  },
  hub: {
    micro: 0.15,
    reveal: 0.3,
    hero: 0,
    stagger: 0.04,
    distance: 12,
  },
  easing: {
    entrance: 'power3.out',
    interactive: 'power2.out',
    breathing: 'sine.inOut',
  },
} as const

export type MotionPreset = 'web' | 'hub'
