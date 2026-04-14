import { describe, it, expect } from 'vitest'
import { MOTION_TOKENS } from '../tokens'

describe('MOTION_TOKENS', () => {
  it('1.1: hub tokens match expected values', () => {
    expect(MOTION_TOKENS.hub).toEqual({
      micro: 0.15,
      reveal: 0.3,
      hero: 0,
      stagger: 0.04,
      distance: 12,
    })
  })

  it('1.2: web tokens match expected values', () => {
    expect(MOTION_TOKENS.web).toEqual({
      micro: 0.25,
      reveal: 0.7,
      hero: 1.0,
      stagger: 0.08,
      distance: 40,
    })
  })

  it('1.3: hub hero is explicitly zero', () => {
    expect(MOTION_TOKENS.hub.hero).toBe(0)
    expect(MOTION_TOKENS.hub.hero === 0).toBe(true)
  })

  it('1.4: hub is always <= web for every numeric field', () => {
    const hubTokens = MOTION_TOKENS.hub
    const webTokens = MOTION_TOKENS.web

    for (const key of Object.keys(hubTokens) as Array<keyof typeof hubTokens>) {
      expect(hubTokens[key]).toBeLessThanOrEqual(webTokens[key])
    }
  })

  it('1.5: easing strings are valid GSAP format', () => {
    const validEasingPattern = /^(power[1-4]\.(out|in|inOut)|sine\.(out|in|inOut))$/

    for (const [, value] of Object.entries(MOTION_TOKENS.easing)) {
      expect(value).toMatch(validEasingPattern)
    }
  })
})
