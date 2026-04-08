import { defineAsyncComponent, type Component } from "vue";

/**
 * Maps block type slugs (kebab-case) to lazy-loaded Vue components.
 * Nuxt auto-imports only work at compile-time in templates, so dynamic
 * component resolution (e.g. via resolveComponent()) fails at runtime.
 * We use defineAsyncComponent with explicit imports instead.
 */
export const blockComponentMap: Record<string, Component> = {
  "hero": defineAsyncComponent(() => import("./Hero.vue")),
  "features": defineAsyncComponent(() => import("./Features.vue")),
  "how-it-works": defineAsyncComponent(() => import("./HowItWorks.vue")),
  "cta": defineAsyncComponent(() => import("./Cta.vue")),
  "rich-text": defineAsyncComponent(() => import("./RichText.vue")),
  "gallery": defineAsyncComponent(() => import("./Gallery.vue")),
  "youtube": defineAsyncComponent(() => import("./Youtube.vue")),
  "discord-invite": defineAsyncComponent(() => import("./DiscordInvite.vue")),
  "testimonials": defineAsyncComponent(() => import("./Testimonials.vue")),
  "stats": defineAsyncComponent(() => import("./Stats.vue")),
  "faq": defineAsyncComponent(() => import("./Faq.vue")),
  "team": defineAsyncComponent(() => import("./Team.vue")),
  "applications": defineAsyncComponent(() => import("./Applications.vue"))
};

/**
 * Resolves a block type to a Vue component.
 * Returns the component from the static map, or undefined for unknown types.
 */
export function resolveBlockComponent(blockType: string): Component | undefined {
  return blockComponentMap[blockType];
}
