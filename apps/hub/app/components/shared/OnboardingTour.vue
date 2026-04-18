<script setup lang="ts">
import type { TourState } from "~/composables/useOnboardingTour";

const props = defineProps<{
  state: TourState;
  skipLabel?: string;
  nextLabel?: string;
  doneLabel?: string;
}>();

const emit = defineEmits<{
  (e: "next" | "skip"): void;
}>();

const TOOLTIP_GAP = 12;
const SPOTLIGHT_PADDING = 8;

const spotlightStyle = computed(() => {
  const r = props.state.targetRect;
  if (!r) return { display: "none" };
  return {
    top: `${r.top - SPOTLIGHT_PADDING}px`,
    left: `${r.left - SPOTLIGHT_PADDING}px`,
    width: `${r.width + SPOTLIGHT_PADDING * 2}px`,
    height: `${r.height + SPOTLIGHT_PADDING * 2}px`
  };
});

const TOOLTIP_W = 288; // 18rem
const VIEWPORT_PAD = 12;

const tooltipStyle = computed(() => {
  const r = props.state.targetRect;
  let placement = props.state.step?.placement ?? "bottom";
  if (!r) return { display: "none" };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const style: Record<string, string> = {};

  // If "right" would overflow, fall back to "bottom"
  if (placement === "right" && r.right + TOOLTIP_GAP + TOOLTIP_W > vw - VIEWPORT_PAD) {
    placement = "bottom";
  }
  // If "left" would overflow, fall back to "bottom"
  if (placement === "left" && r.left - TOOLTIP_GAP - TOOLTIP_W < VIEWPORT_PAD) {
    placement = "bottom";
  }

  let top = 0;
  let left = 0;
  let useBottomAnchor = false;

  if (placement === "bottom") {
    top = r.bottom + TOOLTIP_GAP;
    left = r.left + r.width / 2 - TOOLTIP_W / 2;
  } else if (placement === "top") {
    useBottomAnchor = true;
    left = r.left + r.width / 2 - TOOLTIP_W / 2;
  } else if (placement === "right") {
    top = r.top + r.height / 2;
    left = r.right + TOOLTIP_GAP;
    style.transform = "translateY(-50%)";
  } else if (placement === "left") {
    top = r.top + r.height / 2;
    left = r.left - TOOLTIP_GAP - TOOLTIP_W;
    style.transform = "translateY(-50%)";
  }

  // Clamp horizontal position to viewport
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - TOOLTIP_W - VIEWPORT_PAD));

  // Clamp vertical: if tooltip would go below viewport, flip to top placement
  const TOOLTIP_ESTIMATED_H = 160; // approximate tooltip height
  if (!useBottomAnchor && top + TOOLTIP_ESTIMATED_H > vh - VIEWPORT_PAD) {
    // Flip to above the target
    useBottomAnchor = true;
    style.bottom = `${vh - r.top + TOOLTIP_GAP}px`;
    delete style.transform;
  }

  style.left = `${left}px`;
  if (useBottomAnchor) {
    style.bottom = `${vh - r.top + TOOLTIP_GAP}px`;
  } else {
    style.top = `${top}px`;
  }

  return style;
});

const isLastStep = computed(() =>
  props.state.currentStep >= props.state.totalSteps - 1
);

const resolvedSkipLabel = computed(() => props.skipLabel ?? "Skip");
const resolvedNextLabel = computed(() =>
  isLastStep.value ? (props.doneLabel ?? "Done") : (props.nextLabel ?? "Next")
);
</script>

<template>
  <Teleport to="body">
    <div v-if="state.active" class="tour-overlay">
      <div class="tour-backdrop" @click="state.targetRect ? emit('skip') : undefined" />
      <div class="tour-spotlight" :style="spotlightStyle" />
      <div class="tour-tooltip" :style="tooltipStyle">
        <div class="tour-tooltip__header">
          <span class="tour-tooltip__step-indicator">
            {{ state.currentStep + 1 }} / {{ state.totalSteps }}
          </span>
        </div>
        <h4 class="tour-tooltip__title">{{ state.step?.title }}</h4>
        <p class="tour-tooltip__description">{{ state.step?.description }}</p>
        <div class="tour-tooltip__actions">
          <button class="tour-tooltip__skip" @click="emit('skip')">
            {{ resolvedSkipLabel }}
          </button>
          <button class="tour-tooltip__next" @click="emit('next')">
            {{ resolvedNextLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

.tour-backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  pointer-events: auto;
}

.tour-spotlight {
  position: fixed;
  border-radius: 0.5rem;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 20px 4px rgba(var(--color-accent-rgb, 99, 102, 241), 0.4);
  background: rgba(255, 255, 255, 0.03);
  z-index: 1;
  pointer-events: none;
  transition: all 0.3s ease;
}

.tour-tooltip {
  position: fixed;
  z-index: 2;
  width: 18rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--color-surface-1, #1e1e2e);
  box-shadow: var(--shadow-lg, 0 10px 25px rgba(0,0,0,.25));
  pointer-events: auto;
}

.tour-tooltip__header {
  margin-bottom: 0.375rem;
}

.tour-tooltip__step-indicator {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tour-tooltip__title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.375rem;
  color: var(--color-base-content);
}

.tour-tooltip__description {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-base-content-secondary);
  margin-bottom: 0.75rem;
}

.tour-tooltip__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tour-tooltip__skip {
  font-size: 0.8125rem;
  color: var(--color-base-content-secondary);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: color 0.15s;
}

.tour-tooltip__skip:hover {
  color: var(--color-base-content);
}

.tour-tooltip__next {
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  background: var(--color-accent);
  color: var(--color-accent-content, #fff);
  cursor: pointer;
  transition: opacity 0.15s;
}

.tour-tooltip__next:hover {
  opacity: 0.9;
}
</style>
