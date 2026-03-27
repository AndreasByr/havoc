<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

onMounted(() => {
  if (props.error?.statusCode === 401) {
    const returnTo = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    if (import.meta.dev) {
      window.location.href = `/api/auth/discord?returnTo=${returnTo}`;
    } else {
      window.location.href = `/login?returnTo=${returnTo}`;
    }
  }
});

const handleError = () => clearError({ redirect: "/dashboard" });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold">
        {{ error?.statusCode || 500 }}
      </h1>
      <p class="mt-2 text-lg opacity-70">
        {{ error?.statusMessage || "An unexpected error occurred." }}
      </p>
      <button
        class="mt-6 rounded-lg bg-primary px-6 py-2 text-white"
        @click="handleError"
      >
        Back to Dashboard
      </button>
    </div>
  </div>
</template>
