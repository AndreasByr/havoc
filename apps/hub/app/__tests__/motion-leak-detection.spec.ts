import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const APP_DIR = path.resolve(__dirname, '..')

function getAllFiles(dir: string): string[] {
  const results: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      // Skip node_modules, .nuxt, .output, __tests__ directories
      if (!['node_modules', '.nuxt', '.output', 'dist', '__tests__'].includes(entry)) {
        results.push(...getAllFiles(fullPath))
      }
    } else if (/\.(vue|ts)$/.test(entry)) {
      results.push(fullPath)
    }
  }

  return results
}

function scanFiles(pattern: RegExp): { file: string; matches: string[] }[] {
  const files = getAllFiles(APP_DIR)
  const results: { file: string; matches: string[] }[] = []

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const matches = content.match(pattern)
    if (matches) {
      results.push({
        file: path.relative(APP_DIR, file),
        matches: [...matches],
      })
    }
  }

  return results
}

describe('Hub motion leak detection', () => {
  it('9.1: no useGsapReveal import in Hub app code', () => {
    const found = scanFiles(/useGsapReveal/)
    expect(found).toEqual([])
  })

  it('9.2: no useGsapTextReveal import', () => {
    const found = scanFiles(/useGsapTextReveal/)
    expect(found).toEqual([])
  })

  it('9.3: no useGsapParallax import', () => {
    const found = scanFiles(/useGsapParallax/)
    expect(found).toEqual([])
  })

  it('9.4: no useCardTilt import', () => {
    const found = scanFiles(/useCardTilt/)
    expect(found).toEqual([])
  })

  it('9.5: no useCountUp import', () => {
    const found = scanFiles(/useCountUp/)
    expect(found).toEqual([])
  })

  it('9.6: no web preset in Hub composable calls', () => {
    const files = getAllFiles(APP_DIR)
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      // Look for motion composable calls with 'web' as preset argument
      const pattern = /use(?:Gsap|Motion|CardTilt|CountUp)\w*\([^)]*['"]web['"]/g
      const matches = content.match(pattern)
      if (matches) {
        violations.push(`${path.relative(APP_DIR, file)}: ${matches.join(', ')}`)
      }
    }

    expect(violations).toEqual([])
  })

  it('9.7: no animation duration >= 0.5s in GSAP calls', () => {
    const files = getAllFiles(APP_DIR)
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      if (!/gsap/i.test(content)) continue

      const matches = content.matchAll(/duration\s*[:=]\s*([\d.]+)/g)
      for (const match of matches) {
        const val = parseFloat(match[1])
        if (val >= 0.5) {
          violations.push(`${path.relative(APP_DIR, file)}: duration=${val}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('9.8: no y-distance >= 20px in GSAP calls', () => {
    const files = getAllFiles(APP_DIR)
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      if (!/gsap/i.test(content)) continue

      const matches = content.matchAll(/\by\s*[:=]\s*([\d.]+)/g)
      for (const match of matches) {
        const val = parseFloat(match[1])
        if (val >= 20) {
          violations.push(`${path.relative(APP_DIR, file)}: y=${val}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
