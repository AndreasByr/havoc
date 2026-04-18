<script setup lang="ts">
import type { ApplicationFlowGraph } from "@guildora/shared";
import { linearizeFlowGraph } from "@guildora/shared";

const props = defineProps<{
  flowJson: ApplicationFlowGraph;
  token: string;
  flowId: string;
  discordUsername: string;
}>();

const emit = defineEmits<{
  (e: "submitted", result: { applicationId: string; message: string }): void;
}>();

const { t } = useI18n();
const answers = ref<Record<string, unknown>>({});
const currentStepIndex = ref(0);
const submitting = ref(false);
const submitError = ref("");
const fileUploadIds = ref<string[]>([]);

// Dynamically re-linearize when answers change
const linearized = computed(() => {
  return linearizeFlowGraph(props.flowJson, answers.value);
});

const steps = computed(() => linearized.value.steps);
const totalSteps = computed(() => steps.value.length);
const currentStep = computed(() => steps.value[currentStepIndex.value] || null);
const isLastStep = computed(() => currentStepIndex.value >= totalSteps.value - 1);
const isFirstStep = computed(() => currentStepIndex.value === 0);
const currentIsAbort = computed(() => currentStep.value?.type === "abort");

function goNext() {
  if (currentIsAbort.value) return;
  if (currentStepIndex.value < totalSteps.value - 1) {
    currentStepIndex.value++;
  }
}

function goBack() {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
  }
}

function onFieldUpdate(nodeId: string, value: unknown, isFileUpload = false) {
  answers.value[nodeId] = value;
  if (isFileUpload && typeof value === "string" && !fileUploadIds.value.includes(value)) {
    fileUploadIds.value.push(value);
  }
}

async function submit() {
  submitting.value = true;
  submitError.value = "";

  try {
    const result = await $fetch<{ success: boolean; applicationId: string; message: string }>(
      `/api/apply/${props.flowId}/submit`,
      {
        method: "POST",
        body: {
          ...(props.token ? { token: props.token } : {}),
          answers: answers.value,
          fileUploadIds: fileUploadIds.value
        }
      }
    );
    emit("submitted", { applicationId: result.applicationId, message: result.message });
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; statusMessage?: string };
    submitError.value = e?.data?.message || e?.statusMessage || t("applications.form.submissionFailed");
  } finally {
    submitting.value = false;
  }
}

// Progress percentage
const progressPercent = computed(() => {
  if (totalSteps.value <= 1) return 100;
  return Math.round(((currentStepIndex.value + 1) / totalSteps.value) * 100);
});
</script>

<template>
  <div class="application-form">
    <!-- Progress bar -->
    <div class="application-form__progress">
      <div
        class="application-form__progress-bar"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
    <p class="application-form__step-count">
      {{ t("applications.form.stepOf", { current: currentStepIndex + 1, total: steps.length }) }}
    </p>

    <div v-if="currentStep" class="application-form__step">
      <template v-if="(currentStep.type === 'input' || currentStep.type === 'input_group') && currentStep.fields?.length">
        <ApplicationsFormField
          v-for="field in currentStep.fields"
          :key="field.nodeId"
          :field="field"
          :model-value="answers[field.nodeId]"
          :token="token"
          :flow-id="flowId"
          :discord-username="discordUsername"
          @update:model-value="onFieldUpdate(field.nodeId, $event, field.inputType === 'file_upload')"
        />
      </template>

      <template v-if="currentStep.type === 'info' && currentStep.infoData">
        <ApplicationsFormInfoBlock :data="currentStep.infoData" />
      </template>

      <template v-if="currentStep.type === 'abort'">
        <div class="application-form__abort">
          <Icon name="proicons:lock" class="text-3xl" style="color: var(--color-error)" />
          <p class="mt-3 text-lg font-medium">{{ currentStep.abortMessage }}</p>
        </div>
      </template>
    </div>

    <!-- Error -->
    <div v-if="submitError" class="alert alert-error mt-4">{{ submitError }}</div>

    <!-- Navigation -->
    <div class="application-form__nav">
      <button
        v-if="!isFirstStep"
        class="btn btn-outline"
        :disabled="submitting"
        @click="goBack"
      >
        {{ t("applications.form.back") }}
      </button>
      <div v-else />

      <!-- Next button (hidden on abort steps) -->
      <button
        v-if="!currentIsAbort && !isLastStep"
        class="btn btn-primary"
        @click="goNext"
      >
        {{ t("applications.form.next") }}
      </button>

      <!-- Submit button (only on last step, hidden on abort) -->
      <button
        v-if="!currentIsAbort && isLastStep"
        class="btn btn-primary"
        :disabled="submitting"
        @click="submit"
      >
        {{ submitting ? t("applications.form.submitting") : t("applications.form.submit") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.application-form {
  padding: 1.5rem;
}

.application-form__progress {
  height: 4px;
  border-radius: 2px;
  background: var(--color-surface-3);
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.application-form__progress-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.application-form__step-count {
  font-size: 0.75rem;
  color: var(--color-base-content-secondary);
  margin-bottom: 1.5rem;
}

.application-form__step {
  min-height: 8rem;
}

.application-form__abort {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-base-content);
}

.application-form__nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-line);
}
</style>
