import { describe, it, expect, vi, beforeEach } from 'vitest'

function createMockMatchMedia(matches: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = []
  return {
    mql: {
      matches,
      addEventListener: vi.fn((event: string, cb: (e: { matches: boolean }) => void) => {
        listeners.push(cb)
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
    fireChange(newMatches: boolean) {
      listeners.forEach((cb) => cb({ matches: newMatches }))
    },
  }
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('1.6: SSR returns false when window is undefined', async () => {
    const originalWindow = globalThis.window
    // @ts-expect-error -- simulating SSR
    delete globalThis.window

    const { useReducedMotion } = await import('../composables/useReducedMotion')
    const { prefersReduced } = useReducedMotion()

    expect(prefersReduced.value).toBe(false)

    globalThis.window = originalWindow
  })

  it('1.7: detects system preference when matches=true', async () => {
    const { mql } = createMockMatchMedia(true)
    vi.stubGlobal('matchMedia', vi.fn(() => mql))

    const { useReducedMotion } = await import('../composables/useReducedMotion')
    const { prefersReduced } = useReducedMotion()

    expect(prefersReduced.value).toBe(true)

    vi.unstubAllGlobals()
  })

  it('1.8: responds to runtime change events', async () => {
    const { mql, fireChange } = createMockMatchMedia(false)
    vi.stubGlobal('matchMedia', vi.fn(() => mql))

    const { useReducedMotion } = await import('../composables/useReducedMotion')
    const { prefersReduced } = useReducedMotion()

    expect(prefersReduced.value).toBe(false)

    fireChange(true)
    expect(prefersReduced.value).toBe(true)

    fireChange(false)
    expect(prefersReduced.value).toBe(false)

    vi.unstubAllGlobals()
  })

  it('1.9: singleton behavior — two calls return same ref identity', async () => {
    const { mql } = createMockMatchMedia(false)
    vi.stubGlobal('matchMedia', vi.fn(() => mql))

    const { useReducedMotion } = await import('../composables/useReducedMotion')
    const result1 = useReducedMotion()
    const result2 = useReducedMotion()

    expect(result1.prefersReduced).toBe(result2.prefersReduced)

    vi.unstubAllGlobals()
  })
})
