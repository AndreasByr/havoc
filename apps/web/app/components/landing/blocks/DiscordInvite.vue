<script setup lang="ts">
import { useGsapReveal } from '@guildora/motion'

const props = defineProps<{
  content: Record<string, unknown>;
  config: Record<string, unknown>;
}>();

const { data: branding } = await useCommunityName();
const communityName = computed(() => branding.value?.communityName ?? undefined);
const inviteCode = computed(() => String(branding.value?.discordInviteCode || props.content.inviteCode || ""));

const sectionRef = ref<HTMLElement | null>(null)
useGsapReveal(sectionRef)
</script>

<template>
  <div v-if="inviteCode" ref="sectionRef" class="py-16 md:py-24">
    <DiscordInviteWidget
      :invite-code="inviteCode"
      :fallback-heading="String(content.heading || '')"
      :fallback-description="String(content.description || '')"
      :community-name="communityName"
    />
  </div>
</template>
