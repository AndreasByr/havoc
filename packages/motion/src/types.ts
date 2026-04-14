import type { Ref } from 'vue'

export type ElementRef = Ref<HTMLElement | null>

export interface GsapRevealOptions {
  direction?: 'up' | 'left' | 'right'
  delay?: number
  distance?: number
  duration?: number
  threshold?: number
}

export interface GsapStaggerOptions {
  stagger?: number
  y?: number
  x?: number
  duration?: number
  ease?: string
  threshold?: number
  delay?: number
}

export interface GsapTextRevealOptions {
  splitBy?: 'lines' | 'words'
  stagger?: number
  duration?: number
  delay?: number
  threshold?: number
}

export interface CardTiltOptions {
  maxRotation?: number
  perspective?: number
  scale?: number
  speed?: number
}
