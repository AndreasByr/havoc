# Animation System

## Overview

The Guildora Platform uses GSAP (GreenSock Animation Platform) for scroll-triggered reveals, route transitions, and entrance animations. The animation system lives in `packages/motion` and is shared between `apps/web` (marketing) and `apps/hub` (productivity dashboard).

## Architecture

```
packages/motion/          Shared composables + tokens
  src/
    tokens.ts             Duration/easing/distance presets per surface
    types.ts              TypeScript interfaces
    composables/
      useReducedMotion    OS-level prefers-reduced-motion detection
      useGsapReveal       Scroll-triggered fade-up reveal
      useGsapStagger      Staggered child entrance
      useGsapTextReveal   Per-line/per-word text reveal
      useGsapParallax     Scroll-scrubbed parallax
      useCardTilt         Pointer-tracking 3D card tilt
      useCountUp          Number count-up animation

apps/web/app/plugins/
  gsap.client.ts          GSAP + ScrollTrigger + ScrollToPlugin registration
  lenis.client.ts         Smooth scroll (Web only)

apps/hub/app/plugins/
  gsap.client.ts          GSAP + ScrollTrigger + ScrollToPlugin registration

apps/web/app/composables/
  useTemplateMotion.ts    Template-aware motion defaults (default/cyberpunk/esports)
```

## Two-Tier Duration System

| Context | Micro | Reveal | Hero | Stagger | Distance |
|---------|-------|--------|------|---------|----------|
| **Web** (marketing) | 0.25s | 0.7s | 1.0s | 0.08s | 40px |
| **Hub** (productivity) | 0.15s | 0.3s | - | 0.04s | 12px |

Defined in `packages/motion/src/tokens.ts` as `MOTION_TOKENS`.

## Easing Tokens

- `power3.out` - Entrance (scroll reveals, page enters)
- `power2.out` - Interactive (hovers, tilt, micro-interactions)
- `sine.inOut` - Breathing/looping animations

## Motion Hierarchy

1. **Structural** (route transitions) - GSAP, brief directional
2. **Scroll-driven** (content reveals) - GSAP, one-shot (`once: true`)
3. **Interaction feedback** (hover, click) - CSS only, no GSAP

## Composable Usage

### useGsapReveal

```vue
<script setup>
import { useGsapReveal } from '@guildora/motion'

const el = ref(null)
useGsapReveal(el, { direction: 'up', duration: 0.7 })
</script>

<template>
  <div ref="el">Content fades up on scroll</div>
</template>
```

Options: `direction` (up/left/right), `delay` (ms), `distance` (px), `duration` (s), `threshold` (0-1).

Third parameter: `preset` ('web' | 'hub') - uses matching token defaults.

### useGsapStagger

```vue
<script setup>
import { useGsapStagger } from '@guildora/motion'

const grid = ref(null)
useGsapStagger(grid, '.card', { stagger: 0.08 })
</script>

<template>
  <div ref="grid">
    <div class="card" v-for="i in 6" :key="i">{{ i }}</div>
  </div>
</template>
```

Stagger total is capped at ~0.5s automatically.

### useGsapTextReveal

```vue
<script setup>
import { useGsapTextReveal } from '@guildora/motion'

const heading = ref(null)
useGsapTextReveal(heading, { splitBy: 'lines', stagger: 0.08 })
</script>

<template>
  <h1 ref="heading">Large heading text</h1>
</template>
```

On mobile (<768px), simplifies to whole-element fade-up.

### useCountUp

```vue
<script setup>
import { useCountUp } from '@guildora/motion'

const el = ref(null)
useCountUp(el, 1500, { duration: 1.0, separator: ',', suffix: '+' })
</script>

<template>
  <span ref="el">0</span>
</template>
```

## Accessibility

- Every composable checks `useReducedMotion()` and falls back to `gsap.set()` (instant)
- Route transitions call `done()` immediately when reduced motion is preferred
- Lenis destroys itself and falls back to native scroll
- CSS template animations already wrap in `@media (prefers-reduced-motion: no-preference)`

## Mobile Behavior (<768px)

- **Parallax:** disabled (janky on mobile)
- **Text reveal:** simplified to whole-element fade-up
- **Card tilt:** disabled on touch devices
- **Stagger:** capped at 0.5s total (single column = long delay otherwise)

## Performance

- Only `transform` and `opacity` are animated (compositor thread)
- `willChange` applied during animation only, removed in cleanup
- `gsap.context()` cleanup in `onUnmounted()`
- All plugins are `.client.ts` (SSR safe)
- GSAP total: ~38KB gzipped (core + ScrollTrigger + ScrollToPlugin)

## Guardrails

1. No GSAP for CSS-class jobs (hovers, focus rings, toggles)
2. No animation on reactive data changes (websocket, polling)
3. `once: true` on all ScrollTrigger reveals (no replay on back-nav)
4. No blocking animations in Hub (users can always interact)
5. All GSAP behind `onMounted()` or in `.client.ts` plugins
6. No permanent `willChange`
7. No layout-triggering properties (no width/height/margin animation)
8. No Lenis in Hub (conflicts with Vue Flow, vuedraggable, iframes)
9. No GSAP injection into sideloaded apps
10. Cap stagger total at ~0.5s
11. Consistent easings from `MOTION_TOKENS`

## Template-Specific Motion (Web)

`useTemplateMotion()` in `apps/web/app/composables/` reads the `data-template` attribute:

| Template | Ease | Duration | Distance |
|----------|------|----------|----------|
| default | power3.out | 0.7s | 40px |
| cyberpunk | power3.out | 0.8s | 60px |
| esports | power2.out | 0.5s | 30px |

## Landing Block Animation Map

| Block | Animation |
|-------|-----------|
| Hero | Text reveal heading + staggered CTAs |
| Features | Title reveal + staggered cards |
| Stats | Staggered cards |
| Testimonials | Staggered cards |
| HowItWorks | Section reveal + sequential steps |
| Gallery | Staggered images |
| CTA | Fade-up reveal |
| FAQ | Section fade-up |
| DiscordInvite | Fade-up reveal |
| Team | Title + staggered avatars |
| Youtube | Fade-up reveal |
| RichText | Fade-up reveal |
| Applications | Fade-up reveal |

## Hub Animation Map

| Surface | Animation |
|---------|-----------|
| Route transitions | Short opacity+y (0.15s leave, 0.2s enter) |
| Dashboard stat cards | Staggered entrance on first load |
| Member card grid | Staggered entrance on first load |
