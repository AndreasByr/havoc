import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { MOTION_TOKENS } from '../../../../packages/motion/src/tokens'

const APP_DIR = resolve(__dirname, '..')

function readAppFile(relativePath: string): string {
  return readFileSync(resolve(APP_DIR, relativePath), 'utf-8')
}

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.nuxt', '.output', 'dist', '__tests__'].includes(entry)) continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) results.push(...collectFiles(full, exts))
    else if (exts.some((e) => full.endsWith(e))) results.push(full)
  }
  return results
}

function getAllAppFiles(): { path: string; content: string }[] {
  return collectFiles(APP_DIR, ['.vue', '.ts']).map((f) => ({
    path: f.slice(APP_DIR.length + 1),
    content: readFileSync(f, 'utf-8'),
  }))
}

describe('Hub motion-token compliance', () => {
  it('2.1: dashboard stagger values match hub tokens', () => {
    const content = readAppFile('pages/dashboard/index.vue')
    const hub = MOTION_TOKENS.hub

    // Match with optional whitespace around colon
    expect(content).toMatch(new RegExp(`duration\\s*:\\s*${hub.reveal}\\b`))
    expect(content).toMatch(new RegExp(`stagger\\s*:\\s*${hub.stagger}\\b`))
    expect(content).toMatch(new RegExp(`y\\s*:\\s*${hub.distance}\\b`))
  })

  it('2.2: page transition enter duration <= hub.micro * 1.5', () => {
    const content = readAppFile('app.vue')
    const maxDuration = MOTION_TOKENS.hub.micro * 1.5

    const durationMatch = content.match(/enter[^}]*duration\s*[:=]\s*([\d.]+)/)
      || content.match(/duration\s*[:=]\s*([\d.]+)/)
    expect(durationMatch).not.toBeNull()

    const duration = parseFloat(durationMatch![1])
    expect(duration).toBeLessThanOrEqual(maxDuration)
  })

  it('2.3: page transition y <= hub.distance', () => {
    const content = readAppFile('app.vue')
    const maxDistance = MOTION_TOKENS.hub.distance

    const yMatch = content.match(/y\s*[:=]\s*([\d.]+)/)
    expect(yMatch).not.toBeNull()

    const yValue = parseFloat(yMatch![1])
    expect(yValue).toBeLessThanOrEqual(maxDistance)
  })

  it('2.4: no web-token values in hub GSAP calls', () => {
    const files = getAllAppFiles()
    const violations: string[] = []

    for (const file of files) {
      // Check for web-specific duration values (0.7, 0.25) in gsap contexts
      if (/gsap|animation|motion/i.test(file.content)) {
        if (/duration\s*[:=]\s*0\.7\b/.test(file.content)) {
          violations.push(`${file.path}: contains web duration 0.7`)
        }
        if (/duration\s*[:=]\s*0\.25\b/.test(file.content)) {
          violations.push(`${file.path}: contains web micro duration 0.25`)
        }
        if (/y\s*[:=]\s*40\b/.test(file.content)) {
          violations.push(`${file.path}: contains web distance y=40`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('2.5: no duration >= 0.5s in hub GSAP calls', () => {
    const files = getAllAppFiles()
    const violations: string[] = []

    for (const file of files) {
      if (/gsap|animation|motion/i.test(file.content)) {
        const matches = file.content.matchAll(/duration\s*[:=]\s*([\d.]+)/g)
        for (const match of matches) {
          const val = parseFloat(match[1])
          if (val >= 0.5) {
            violations.push(`${file.path}: duration=${val} (>= 0.5s)`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })
})
