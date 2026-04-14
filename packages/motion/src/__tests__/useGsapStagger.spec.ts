import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Capture lifecycle callbacks
let onMountedCallback: (() => void) | null = null
let onUnmountedCallback: (() => void) | null = null

const mockRevert = vi.fn()
const mockGsapFrom = vi.fn()
const mockGsapSet = vi.fn()
const mockGsapContext = vi.fn((fn: () => void) => {
  fn()
  return { revert: mockRevert }
})

vi.mock('gsap', () => ({
  default: {
    from: (...args: unknown[]) => mockGsapFrom(...args),
    set: (...args: unknown[]) => mockGsapSet(...args),
    context: (fn: () => void) => mockGsapContext(fn),
  },
}))

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {},
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: vi.fn((cb: () => void) => {
      onMountedCallback = cb
    }),
    onUnmounted: vi.fn((cb: () => void) => {
      onUnmountedCallback = cb
    }),
  }
})

vi.mock('../composables/useReducedMotion', () => {
  const _prefersReduced = ref(false)
  return {
    useReducedMotion: () => ({ prefersReduced: _prefersReduced }),
    _prefersReduced,
  }
})

function createMockContainer(childCount: number) {
  const children = Array.from({ length: childCount }, () => document.createElement('div'))
  const container = document.createElement('div')

  const containerRef = ref(container)
  vi.spyOn(container, 'querySelectorAll').mockReturnValue(children as unknown as NodeListOf<Element>)
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => {},
  })

  return { containerRef, children }
}

describe('useGsapStagger', () => {
  beforeEach(async () => {
    onMountedCallback = null
    onUnmountedCallback = null
    mockGsapFrom.mockClear()
    mockGsapSet.mockClear()
    mockGsapContext.mockClear()
    mockRevert.mockClear()

    // Reset prefersReduced to false
    const mod = await import('../composables/useReducedMotion') as any
    mod._prefersReduced.value = false
  })

  it('1.10: uses hub tokens with preset=hub', async () => {
    const { useGsapStagger } = await import('../composables/useGsapStagger')
    const { containerRef } = createMockContainer(3)

    useGsapStagger(containerRef, '.child', {}, 'hub')
    onMountedCallback!()

    expect(mockGsapFrom).toHaveBeenCalled()
    const callArgs = mockGsapFrom.mock.calls[0][1]
    expect(callArgs.duration).toBe(0.3)
    expect(callArgs.y).toBe(12)
  })

  it('1.11: uses web tokens with preset=web', async () => {
    const { useGsapStagger } = await import('../composables/useGsapStagger')
    const { containerRef } = createMockContainer(3)

    useGsapStagger(containerRef, '.child', {}, 'web')
    onMountedCallback!()

    expect(mockGsapFrom).toHaveBeenCalled()
    const callArgs = mockGsapFrom.mock.calls[0][1]
    expect(callArgs.duration).toBe(0.7)
    expect(callArgs.y).toBe(40)
  })

  it('1.12: caps total stagger at ~0.5s for many children', async () => {
    const { useGsapStagger } = await import('../composables/useGsapStagger')
    const { containerRef } = createMockContainer(100)

    useGsapStagger(containerRef, '.child', {}, 'web')
    onMountedCallback!()

    expect(mockGsapFrom).toHaveBeenCalled()
    const callArgs = mockGsapFrom.mock.calls[0][1]
    expect(callArgs.stagger).toBeLessThanOrEqual(0.5 / 99)
  })

  it('1.13: respects reduced motion — calls gsap.set not gsap.from', async () => {
    const mod = await import('../composables/useReducedMotion') as any
    mod._prefersReduced.value = true

    const { useGsapStagger } = await import('../composables/useGsapStagger')
    const { containerRef } = createMockContainer(3)

    useGsapStagger(containerRef, '.child', {}, 'hub')
    onMountedCallback!()

    expect(mockGsapSet).toHaveBeenCalled()
    const setArgs = mockGsapSet.mock.calls[0][1]
    expect(setArgs.opacity).toBe(1)
    expect(setArgs.y).toBe(0)
    expect(mockGsapFrom).not.toHaveBeenCalled()
  })

  it('1.14: cleans up on unmount — ctx.revert() called', async () => {
    const { useGsapStagger } = await import('../composables/useGsapStagger')
    const { containerRef } = createMockContainer(3)

    useGsapStagger(containerRef, '.child', {}, 'hub')
    onMountedCallback!()
    onUnmountedCallback!()

    expect(mockRevert).toHaveBeenCalled()
  })
})
