<script setup lang="ts">
const { data: branding } = await useCommunityName();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppNavbar
      :community-name="branding?.communityName ?? undefined"
      :discord-invite-code="branding?.discordInviteCode ?? undefined"
    />
    <main class="flex-1 container mx-auto px-4 py-8">
      <slot />
    </main>
    <AppFooter />
    <CookieConsentBanner />
  </div>
</template>
