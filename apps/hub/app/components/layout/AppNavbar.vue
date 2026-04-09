<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const { loggedIn, user, logout, hasRole } = useAuth();

const mobileMenuOpen = ref(false);

const navItems = computed(() => {
  const items = [
    { to: "/settings/landing", label: t("nav.landing"), visible: hasRole("moderator") || hasRole("admin") || hasRole("superadmin") },
    { to: "/dashboard", label: t("nav.dashboard"), visible: loggedIn.value },
    { to: "/members", label: t("nav.members"), visible: loggedIn.value },
    { to: "/profile", label: t("nav.profile"), visible: loggedIn.value },
    {
      to: "/mod",
      label: t("nav.moderation"),
      visible: hasRole("moderator") || hasRole("admin") || hasRole("superadmin")
    },
    { to: "/admin", label: t("nav.admin"), visible: hasRole("admin") || hasRole("superadmin") }
  ];

  return items.filter((item) => item.visible);
});

watch(() => route.path, () => {
  mobileMenuOpen.value = false;
});

const isRouteActive = (target: string) => route.path === target || route.path.startsWith(`${target}/`);
</script>

<template>
  <div class="bg-base-100 px-3 py-3 md:px-5">
    <div class="navbar mx-auto max-w-[1400px] rounded-2xl bg-base-100/95 px-3 shadow-sm md:px-4">
    <div class="navbar-start">
      <!-- Mobile hamburger -->
      <button
        class="btn btn-ghost btn-sm btn-circle md:hidden mr-1"
        type="button"
        :aria-label="mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            v-if="!mobileMenuOpen"
            d="M4 6h16M4 12h16M4 18h16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            v-else
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <NuxtLink :to="localePath('/dashboard')" class="btn btn-ghost text-lg font-semibold tracking-wide">{{ $t("app.name") }}</NuxtLink>
    </div>

    <!-- Desktop nav -->
    <div class="navbar-center hidden md:flex">
      <ul class="menu menu-horizontal w-full gap-1 px-1">
        <li v-for="item in navItems" :key="item.to">
          <NuxtLink
            :to="localePath(item.to)"
            :class="isRouteActive(localePath(item.to))
              ? 'menu-active rounded-full bg-base-200'
              : 'rounded-full text-base-content/80 hover:bg-base-200 hover:text-base-content'"
          >
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </div>

    <div class="navbar-end gap-2">
      <button v-if="loggedIn" class="btn btn-sm btn-outline" type="button" @click="logout">
        {{ $t("nav.logout") }}
      </button>
      <template v-else>
        <a
          v-if="useRuntimeConfig().public.authDevBypass"
          :href="`/api/auth/dev-login?returnTo=${encodeURIComponent($route.fullPath || '/dashboard')}`"
          class="btn btn-sm btn-warning btn-outline"
        >
          {{ $t("auth.devMode.loginButton") }}
        </a>
        <NuxtLink class="btn btn-sm btn-primary" :to="localePath('/login')">
          {{ $t("nav.login") }}
        </NuxtLink>
      </template>
    </div>
  </div>
  </div>

  <!-- Mobile dropdown menu -->
  <Transition name="nav-slide">
    <div v-if="mobileMenuOpen" class="mx-3 mt-2 rounded-2xl bg-base-100 p-3 shadow-sm md:hidden">
      <ul class="menu w-full gap-1">
        <li v-for="item in navItems" :key="item.to">
          <NuxtLink
            :to="localePath(item.to)"
            class="rounded-full"
            :class="isRouteActive(localePath(item.to))
              ? 'menu-active bg-base-200'
              : 'text-base-content/80 hover:bg-base-200 hover:text-base-content'"
            @click="mobileMenuOpen = false"
          >
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </Transition>
</template>

<style scoped>
.nav-slide-enter-active,
.nav-slide-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}

.nav-slide-enter-from,
.nav-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.nav-slide-enter-to,
.nav-slide-leave-from {
  max-height: 24rem;
  opacity: 1;
}
</style>
