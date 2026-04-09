<script setup lang="ts">
defineProps<{
  templateId: string;
}>();
</script>

<template>
  <!-- Default: clean, minimal, subtle accent glow -->
  <div
    v-if="templateId === 'default'"
    class="template-preview"
    style="background: linear-gradient(to bottom right, rgba(124,58,237,0.08), #111, #111)"
  >
    <!-- Hero -->
    <div class="tp-hero">
      <div class="tp-badge" style="border-color: rgba(124,58,237,0.4); background: rgba(124,58,237,0.1); border-radius: 8px" />
      <div class="tp-heading" />
      <div class="tp-subheading" />
      <div class="tp-btn" style="background: var(--color-accent, #7C3AED); border-radius: 4px" />
    </div>
    <!-- Features -->
    <div class="tp-cards">
      <div class="tp-card" style="background: #1a1a2e; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3)" />
      <div class="tp-card" style="background: #1a1a2e; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3)" />
      <div class="tp-card" style="background: #1a1a2e; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3)" />
    </div>
    <!-- CTA -->
    <div class="tp-cta">
      <div class="tp-cta-line" />
      <div class="tp-btn" style="background: var(--color-accent, #7C3AED); border-radius: 4px" />
    </div>
  </div>

  <!-- Gaming / Retro Futurism: neon glow, grid, angular, scanlines -->
  <div
    v-else-if="templateId === 'cyberpunk'"
    class="template-preview tp-cyberpunk"
    style="background: linear-gradient(to bottom right, rgba(0,240,255,0.12), #0a0a12 40%, rgba(255,0,128,0.08))"
  >
    <!-- Scanlines overlay -->
    <div class="tp-scanlines" />
    <!-- Grid overlay -->
    <div class="tp-grid" />
    <!-- Hero -->
    <div class="tp-hero" style="position: relative; z-index: 1">
      <div
        class="tp-badge"
        style="border-color: rgba(0,240,255,0.6); background: rgba(0,240,255,0.15); box-shadow: 0 0 8px rgba(0,240,255,0.4); clip-path: polygon(4px 0, calc(100% - 4px) 0, 100% 50%, calc(100% - 4px) 100%, 4px 100%, 0 50%)"
      />
      <div class="tp-heading" style="text-shadow: 0 0 6px rgba(0,240,255,0.5)" />
      <div class="tp-subheading" />
      <div
        class="tp-btn"
        style="background: linear-gradient(to right, #00f0ff, #ff0080); box-shadow: 0 0 10px rgba(0,240,255,0.4); clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))"
      />
    </div>
    <!-- Features: angular cards with glow -->
    <div class="tp-cards" style="position: relative; z-index: 1">
      <div class="tp-card tp-card-cyber" />
      <div class="tp-card tp-card-cyber" />
      <div class="tp-card tp-card-cyber" />
    </div>
    <!-- CTA -->
    <div class="tp-cta" style="position: relative; z-index: 1">
      <div class="tp-cta-line" style="background: linear-gradient(to right, transparent, #00f0ff, #ff0080, #00f0ff, transparent); box-shadow: 0 0 6px rgba(0,240,255,0.3)" />
      <div
        class="tp-btn"
        style="background: linear-gradient(to right, #00f0ff, #ff0080); box-shadow: 0 0 8px rgba(0,240,255,0.3); clip-path: polygon(0 0, calc(100% - 3px) 0, 100% 3px, 100% 100%, 3px 100%, 0 calc(100% - 3px))"
      />
    </div>
  </div>

  <!-- eSports: bold, aggressive, red/gold, diagonal accents, sharp -->
  <div
    v-else-if="templateId === 'esports'"
    class="template-preview tp-esports"
    style="background: linear-gradient(135deg, #0b0e14, #131720, #0b0e14)"
  >
    <!-- Diagonal stripe -->
    <div class="tp-diagonal-stripe" />
    <!-- Hero -->
    <div class="tp-hero" style="position: relative; z-index: 1; border-bottom: 2px solid rgba(229,62,62,0.2)">
      <div
        class="tp-badge"
        style="border: 2px solid rgba(229,62,62,0.5); background: rgba(229,62,62,0.12); border-radius: 3px; font-style: italic"
      />
      <div class="tp-heading tp-heading--wide" style="background: linear-gradient(135deg, rgba(255,255,255,0.8) 60%, rgba(229,62,62,0.8))" />
      <div class="tp-subheading" />
      <div
        class="tp-btn"
        style="background: linear-gradient(135deg, #e53e3e, #c53030); box-shadow: 0 3px 10px rgba(229,62,62,0.3); border-radius: 3px"
      />
    </div>
    <!-- Features: sharp cards with red top bar -->
    <div class="tp-cards" style="position: relative; z-index: 1">
      <div class="tp-card tp-card-esports" />
      <div class="tp-card tp-card-esports" />
      <div class="tp-card tp-card-esports" />
    </div>
    <!-- CTA -->
    <div class="tp-cta" style="position: relative; z-index: 1">
      <div class="tp-cta-line" style="background: linear-gradient(to right, transparent, #e53e3e, #d69e2e, #e53e3e, transparent)" />
      <div
        class="tp-btn"
        style="background: linear-gradient(135deg, #e53e3e, #c53030); box-shadow: 0 3px 8px rgba(229,62,62,0.3); border-radius: 3px"
      />
    </div>
  </div>

  <!-- Fallback for unknown templates -->
  <div v-else class="template-preview" style="background: var(--color-surface-4)">
    <div class="flex items-center justify-center h-full">
      <Icon name="proicons:layout" class="h-8 w-8 opacity-20" />
    </div>
  </div>
</template>

<style scoped>
.template-preview {
  width: 100%;
  aspect-ratio: 16 / 10;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  position: relative;
}

.tp-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0 8px;
}

.tp-badge {
  width: 36px;
  height: 6px;
  border-radius: 3px;
  border: 1px solid;
}

.tp-heading {
  width: 60%;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.7);
}

.tp-heading--wide {
  width: 70%;
  height: 9px;
}

.tp-subheading {
  width: 40%;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
}

.tp-btn {
  width: 32px;
  height: 7px;
  border-radius: 3px;
  margin-top: 2px;
}

.tp-cards {
  display: flex;
  gap: 4px;
  padding: 0 4px;
  flex: 1;
}

.tp-card {
  flex: 1;
  min-height: 20px;
}

.tp-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}

.tp-cta-line {
  width: 45%;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.3);
}

/* --- Cyberpunk-specific thumbnail styles --- */
.tp-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 4px
  );
  z-index: 2;
}

.tp-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(0, 240, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 240, 255, 0.06) 1px, transparent 1px);
  background-size: 16px 16px;
  z-index: 0;
}

.tp-card-cyber {
  background: rgba(0, 240, 255, 0.04);
  border: 1px solid rgba(0, 240, 255, 0.25);
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.1);
  clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px));
}

/* --- eSports-specific thumbnail styles --- */
.tp-diagonal-stripe {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    135deg,
    transparent 45%,
    rgba(229, 62, 62, 0.06) 45%,
    rgba(229, 62, 62, 0.06) 55%,
    transparent 55%
  );
  z-index: 0;
}

.tp-card-esports {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(229, 62, 62, 0.04));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.tp-card-esports::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #e53e3e, #d69e2e, #e53e3e);
  opacity: 0.8;
}
</style>
