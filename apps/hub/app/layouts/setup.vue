<script setup lang="ts">
const { locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const route = useRoute();

const localeCookie = useCookie<"en" | "de">("guildora_i18n", {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax"
});

async function onLocaleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as "en" | "de";
  if (value === locale.value) return;
  localeCookie.value = value;
  const target = switchLocalePath(value);
  if (target && target !== route.fullPath) {
    await navigateTo(target);
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-base-100">
    <!-- Language switcher -->
    <div class="flex justify-end px-6 pt-4">
      <select
        class="select select-sm w-32 bg-base-200"
        :value="locale"
        @change="onLocaleChange"
      >
        <option value="en">English</option>
        <option value="de">Deutsch</option>
      </select>
    </div>

    <main class="flex flex-1 items-center justify-center px-4 pb-12">
      <slot />
    </main>
  </div>
</template>
