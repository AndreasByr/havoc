<script setup lang="ts">
import type { TourState } from "~/composables/useOnboardingTour";

const { t } = useI18n();

defineProps<{
  state: TourState;
}>();

defineEmits<{
  (e: "next" | "skip"): void;
}>();
</script>

<template>
  <SharedOnboardingTour
    :state="state"
    :skip-label="t('applications.flowBuilder.tour.skip')"
    :next-label="t('applications.flowBuilder.tour.next')"
    :done-label="t('applications.flowBuilder.tour.done')"
    @next="$emit('next')"
    @skip="$emit('skip')"
  />
</template>
