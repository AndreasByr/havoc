<script setup lang="ts">
const props = defineProps<{
  inviteCode: string;
  fallbackHeading?: string;
  fallbackDescription?: string;
  communityName?: string;
}>();

interface DiscordInvite {
  guild?: {
    id: string;
    name: string;
    icon: string | null;
    description: string | null;
  };
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

const { data, status } = useFetch<DiscordInvite>(
  `https://discord.com/api/v9/invites/${props.inviteCode}?with_counts=true`,
  { server: false, lazy: true }
);

const inviteUrl = computed(() => `https://discord.gg/${props.inviteCode}`);

const iconUrl = computed(() => {
  const g = data.value?.guild;
  if (!g?.icon || !g?.id) return null;
  return `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`;
});

const serverName = computed(() => data.value?.guild?.name ?? props.fallbackHeading ?? "Discord");
const serverDescription = computed(() => data.value?.guild?.description ?? props.fallbackDescription ?? null);
const memberCount = computed(() => data.value?.approximate_member_count ?? null);
const onlineCount = computed(() => data.value?.approximate_presence_count ?? null);

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
</script>

<template>
  <section class="landing-card overflow-hidden rounded-2xl shadow-md">
    <!-- Header row: icon + name + join button -->
    <div class="flex items-center justify-between gap-4 px-6 py-6">
      <div class="flex items-center gap-4">
        <!-- Server icon or fallback -->
        <div class="relative h-14 w-14 shrink-0">
          <img
            v-if="iconUrl"
            :src="iconUrl"
            :alt="serverName"
            class="h-full w-full rounded-2xl object-cover shadow-sm"
          >
          <div
            v-else
            class="flex h-full w-full items-center justify-center rounded-2xl bg-[#5865F2]/20 text-2xl shadow-sm"
          >
            💬
          </div>
        </div>

        <!-- Name + description -->
        <div>
          <p class="landing-text-muted mb-0.5 text-xs font-semibold uppercase tracking-widest">{{ props.communityName || $t("community.fallbackName") }}</p>
          <h3 class="landing-section-title text-xl font-extrabold leading-tight">{{ serverName }}</h3>
          <p v-if="serverDescription" class="landing-text-muted mt-0.5 max-w-xs text-sm">{{ serverDescription }}</p>
        </div>
      </div>

      <!-- Join button -->
      <a
        :href="inviteUrl"
        target="_blank"
        rel="noreferrer"
        class="landing-btn-primary shrink-0 gap-2 rounded-lg px-5 py-2.5 text-sm"
      >
        Join Discord
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 17L17 7M17 7H7M17 7v10"/>
        </svg>
      </a>
    </div>

    <!-- Stats row — only shown if Discord data loaded -->
    <div v-if="status === 'success' && (onlineCount !== null || memberCount !== null)" class="grid grid-cols-2 divide-x divide-[var(--landing-border)] border-t border-[var(--landing-border)]">
      <!-- Online -->
      <div class="flex items-center gap-4 px-6 py-5">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15">
          <span class="relative flex h-3 w-3">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60"/>
            <span class="relative inline-flex h-3 w-3 rounded-full bg-success"/>
          </span>
        </div>
        <div>
          <p class="landing-text-muted text-xs font-semibold uppercase tracking-widest">Online</p>
          <p class="landing-section-title text-2xl font-extrabold leading-tight">{{ onlineCount !== null ? formatCount(onlineCount) : "—" }}</p>
          <p class="landing-text-muted text-xs">currently active</p>
        </div>
      </div>

      <!-- Members -->
      <div class="flex items-center gap-4 px-6 py-5">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style="background-color: color-mix(in srgb, var(--landing-accent) 15%, transparent)">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" style="color: var(--landing-accent)" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <p class="landing-text-muted text-xs font-semibold uppercase tracking-widest">Members</p>
          <p class="landing-section-title text-2xl font-extrabold leading-tight">{{ memberCount !== null ? formatCount(memberCount) : "—" }}</p>
          <p class="landing-text-muted text-xs">total</p>
        </div>
      </div>
    </div>

    <!-- Loading skeleton for stats -->
    <div v-else-if="status === 'pending'" class="grid grid-cols-2 divide-x divide-[var(--landing-border)] border-t border-[var(--landing-border)]">
      <div v-for="n in 2" :key="n" class="flex items-center gap-4 px-6 py-5">
        <div class="h-10 w-10 animate-pulse rounded-xl" style="background-color: var(--landing-border)" />
        <div class="space-y-2">
          <div class="h-2 w-12 animate-pulse rounded" style="background-color: var(--landing-border)" />
          <div class="h-6 w-16 animate-pulse rounded" style="background-color: var(--landing-border)" />
          <div class="h-2 w-20 animate-pulse rounded" style="background-color: var(--landing-border)" />
        </div>
      </div>
    </div>
  </section>
</template>
