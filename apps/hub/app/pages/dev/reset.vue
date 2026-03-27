<script setup lang="ts">
definePageMeta({
  middleware: ["dev"],
});

const lastPath = useCookie<string | null>("guildora_dev_last_path", { sameSite: "lax" });
lastPath.value = "/dev/reset";

const { t } = useI18n();

const devResetToken = ref("");
const resettingDev = ref(false);
const devResetError = ref("");
const devResetSuccess = ref("");

const runDevReset = async () => {
  if (devResetToken.value !== "RESET") {
    devResetError.value = t("adminPermissions.errors.requireResetToken");
    return;
  }

  devResetError.value = "";
  devResetSuccess.value = "";
  resettingDev.value = true;
  try {
    await $fetch("/api/admin/dev/reset-mirror", { method: "POST" });
    devResetToken.value = "";
    devResetSuccess.value = t("adminPermissions.messages.devResetDone");
  } catch (err) {
    console.error(err);
    devResetError.value = t("adminPermissions.errors.devReset");
  } finally {
    resettingDev.value = false;
  }
};
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold md:text-3xl">{{ t("adminPermissions.dev.title") }}</h1>
      <p class="text-sm text-base-content/70">{{ t("adminPermissions.dev.description") }}</p>
    </header>

    <div class="card border border-error/40 bg-base-200">
      <div class="card-body space-y-4">
        <div v-if="devResetError" class="alert alert-error text-sm">{{ devResetError }}</div>
        <div v-if="devResetSuccess" class="alert alert-success text-sm">{{ devResetSuccess }}</div>
        <div class="grid gap-3 md:grid-cols-2">
          <UiInput
            v-model="devResetToken"
            :label="t('adminPermissions.dev.confirmPlaceholder')"
            type="text"
            :placeholder="t('adminPermissions.dev.confirmPlaceholder')"
          />
          <UiButton variant="error" :disabled="resettingDev" @click="runDevReset">
            {{ resettingDev ? t("adminPermissions.dev.running") : t("adminPermissions.dev.run") }}
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>
