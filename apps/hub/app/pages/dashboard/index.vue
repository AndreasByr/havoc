<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import { Line } from "vue-chartjs";

definePageMeta({
  middleware: ["auth"],
});

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface DashboardChartPoint {
  date: string;
  value: number;
  monthlyNew?: number;
}

interface DashboardResponse {
  voiceActivityDaily: DashboardChartPoint[];
  voiceSummary: {
    totalHours: number;
    sessionCount: number;
    activeMembers: number;
  };
  profileTotalsDaily: DashboardChartPoint[];
  profileSummary: {
    newPlayers: number;
    applicants: number;
    members: number;
  };
  voiceLeaderboardTop25: Array<{
    discordId: string;
    discordName: string;
    hours7d: number;
  }>;
  profileChangeLogs: Array<{
    id: string;
    created: string;
    profileName: string;
    previousValue: string | null;
    newValue: string | null;
    isGrowth: boolean;
    isDeparture: boolean;
  }>;
  profileChangeSummary: {
    totalGrowth: number;
    totalDepartures: number;
    netChange: number;
  };
  meta: {
    profileCount: number;
    rangeDays: number;
  };
}

interface DashboardProfileData {
  profileName?: string;
  ingameName?: string;
  rufname?: string | null;
  communityRole?: string | null;
  permissionRoles?: string[];
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, "");
  const match = normalized.match(/.{2}/g);
  if (!match || match.length !== 3) return `rgba(0,0,0,${alpha})`;
  const [r, g, b] = match.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

const colorMode = useColorMode();
const chartColors = computed(() => {
  const _ = colorMode.value;
  const fallbackInfo = { border: "#48beff", bg: "rgba(72,190,255,0.2)" };
  const fallbackSuccess = { border: "#0cf574", bg: "rgba(12,245,116,0.2)" };
  if (import.meta.server || typeof document === "undefined") {
    return { info: fallbackInfo, success: fallbackSuccess };
  }
  const infoHex = getComputedStyle(document.documentElement).getPropertyValue("--color-info").trim() || "#48beff";
  const successHex = getComputedStyle(document.documentElement).getPropertyValue("--color-success").trim() || "#0cf574";
  return {
    info: { border: infoHex, bg: hexToRgba(infoHex, 0.2) },
    success: { border: successHex, bg: hexToRgba(successHex, 0.2) }
  };
});

const { t, locale } = useI18n();
const { user } = useUserSession();
const profileName = computed(() => {
  const current = user.value as { profileName?: string } | null;
  return current?.profileName ?? t("internalNav.defaultMember");
});
const uiLocale = computed(() => locale.value === "de" ? "de-DE" : "en-US");
const { data: profileData } = await useFetch<DashboardProfileData>("/api/profile");
const params = reactive({
  voiceRangeStart: "",
  voiceRangeEnd: ""
});

const { data, pending, error } = await useFetch<DashboardResponse>("/api/dashboard/stats", {
  query: computed(() => ({
    voiceRangeStart: params.voiceRangeStart || undefined,
    voiceRangeEnd: params.voiceRangeEnd || undefined
  }))
});

const daysInRange = computed(() => data.value?.meta?.rangeDays ?? 7);

const voiceChartData = computed(() => {
  const colors = chartColors.value.info;
  return {
    labels: (data.value?.voiceActivityDaily || []).map((item: { date: string }) =>
      new Date(item.date).toLocaleDateString(uiLocale.value, { day: "2-digit", month: "2-digit" })
    ),
    datasets: [
      {
        label: t("dashboard.hoursDataset"),
        data: (data.value?.voiceActivityDaily || []).map((item: { value: number }) => item.value),
        borderColor: colors.border,
        backgroundColor: colors.bg,
        fill: true,
        tension: 0.3
      }
    ]
  };
});

const profileCumulativeData = computed(() => {
  const colors = chartColors.value.success;
  return {
    labels: (data.value?.profileTotalsDaily || []).map((item: { date: string }) =>
      new Date(item.date).toLocaleDateString(uiLocale.value, { month: "short", year: "2-digit" })
    ),
    datasets: [
      {
        label: t("dashboard.cumulativeProfilesDataset"),
        data: (data.value?.profileTotalsDaily || []).map((item: { value: number }) => item.value),
        borderColor: colors.border,
        backgroundColor: colors.bg,
        fill: true,
        tension: 0.3
      }
    ]
  };
});

const voiceChartOptions = computed(() => ({
  plugins: {
    legend: { display: voiceChartData.value.datasets.length > 1 }
  }
}));

const profileChartOptions = computed(() => ({
  plugins: {
    legend: { display: profileCumulativeData.value.datasets.length > 1 }
  }
}));

const visibleLeaderboard = ref(10);
const visibleChanges = ref(5);
const profileSectionExpanded = ref(false);
const leaderboardExpanded = ref(false);

// ─── Onboarding Tour ──────────────────────────────────────────────────

const setupJustCompleted = useState<boolean>("setup-just-completed", () => false);

const tourSteps = computed(() => [
  {
    target: '[data-tour="sidebar-dashboard"]',
    title: t("tour.dashboard.title"),
    description: t("tour.dashboard.description"),
    placement: "right" as const
  },
  {
    target: '[data-tour="sidebar-members"]',
    title: t("tour.members.title"),
    description: t("tour.members.description"),
    placement: "right" as const
  },
  {
    target: '[data-tour="sidebar-settings"]',
    title: t("tour.settings.title"),
    description: t("tour.settings.description"),
    placement: "right" as const
  },
  {
    target: '[data-tour="sidebar-profile"]',
    title: t("tour.profile.title"),
    description: t("tour.profile.description"),
    placement: "right" as const
  },
  {
    target: '[data-tour="sidebar-user"]',
    title: t("tour.userMenu.title"),
    description: t("tour.userMenu.description"),
    placement: "top" as const
  }
]);

const { state: tourState, start: startTour, next: nextTour, skip: skipTour } = useOnboardingTour(
  "dashboard-setup",
  tourSteps.value,
  user.value?.id as string | undefined
);

onMounted(() => {
  if (setupJustCompleted.value) {
    setupJustCompleted.value = false;
    // Small delay to let the sidebar render
    setTimeout(() => startTour(), 800);
  }
});
</script>

<template>
  <section class="space-y-6">
    <div class="min-w-0">
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("dashboard.title") }}</h1>
      <p class="text-sm opacity-80 md:text-base">{{ $t("dashboard.welcome", { name: profileName }) }}</p>
    </div>

    <div class="card bg-base-200">
      <div class="card-body space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="card-title text-lg md:text-xl">{{ $t("dashboard.profileCardTitle") }}</h2>
            <p class="text-xs opacity-70 md:text-sm">{{ $t("dashboard.profileCardSubtitle") }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-1">
          <div class="stat rounded-xl bg-base-100 p-4 shadow-sm">
            <div class="stat-title text-xs md:text-sm">{{ $t("dashboard.roleTitle") }}</div>
            <div class="stat-value text-lg md:text-xl">{{ profileData?.communityRole || "-" }}</div>
            <div class="stat-desc text-xs">{{ $t("dashboard.permissionsLabel") }}: {{ (profileData?.permissionRoles || []).join(", ") || "-" }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pending" class="loading loading-spinner loading-md" />
    <div v-else-if="error" class="alert alert-error">{{ $t("dashboard.loadError") }}</div>
    <template v-else>
      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="card-title">{{ $t("dashboard.voiceTitle") }}</h2>
              <p class="text-sm opacity-70">{{ $t("dashboard.rangeLabel", { days: daysInRange }) }}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="stat rounded-xl bg-base-100 p-4 shadow-sm">
              <div class="stat-title text-xs md:text-sm">{{ $t("dashboard.totalHours") }}</div>
              <div class="stat-value text-lg text-primary md:text-xl">{{ data?.voiceSummary?.totalHours || 0 }}</div>
            </div>
            <div class="stat rounded-xl bg-base-100 p-4 shadow-sm">
              <div class="stat-title text-xs md:text-sm">{{ $t("dashboard.sessions") }}</div>
              <div class="stat-value text-lg text-primary md:text-xl">{{ data?.voiceSummary?.sessionCount || 0 }}</div>
            </div>
            <div class="stat rounded-xl bg-base-100 p-4 shadow-sm">
              <div class="stat-title text-xs md:text-sm">{{ $t("dashboard.activeMembers") }}</div>
              <div class="stat-value text-lg text-primary md:text-xl">{{ data?.voiceSummary?.activeMembers || 0 }}</div>
            </div>
          </div>

          <div v-if="(data?.voiceActivityDaily || []).length === 0" class="alert alert-info">
            {{ $t("dashboard.noVoiceData") }}
          </div>
          <ClientOnly v-else>
            <Line :data="voiceChartData" :options="voiceChartOptions" />
          </ClientOnly>
        </div>
      </div>

      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <h2 class="card-title">{{ $t("dashboard.profileEvolutionTitle") }}</h2>
          <p class="text-sm opacity-70">{{ $t("dashboard.activeProfiles", { count: data?.meta?.profileCount || 0 }) }}</p>

          <div class="grid grid-cols-3 gap-3">
            <div class="stat rounded-xl bg-base-100 p-4 shadow-sm">
              <div class="stat-title text-xs md:text-sm">{{ $t("dashboard.newPlayers") }}</div>
              <div class="stat-value text-lg text-secondary md:text-xl">{{ data?.profileSummary?.newPlayers || 0 }}</div>
            </div>
            <div class="stat rounded-xl bg-base-100 p-4 shadow-sm">
              <div class="stat-title text-xs md:text-sm">{{ $t("dashboard.applicants") }}</div>
              <div class="stat-value text-lg text-secondary md:text-xl">{{ data?.profileSummary?.applicants || 0 }}</div>
            </div>
            <div class="stat rounded-xl bg-base-100 p-4 shadow-sm">
              <div class="stat-title text-xs md:text-sm">{{ $t("dashboard.members") }}</div>
              <div class="stat-value text-lg text-secondary md:text-xl">{{ data?.profileSummary?.members || 0 }}</div>
            </div>
          </div>

          <ClientOnly>
            <Line :data="profileCumulativeData" :options="profileChartOptions" />
          </ClientOnly>

          <div v-if="profileSectionExpanded" class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>{{ $t("dashboard.tableDate") }}</th>
                  <th>{{ $t("dashboard.tableProfile") }}</th>
                  <th>{{ $t("dashboard.tableChange") }}</th>
                  <th>{{ $t("dashboard.tableEffect") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in (data?.profileChangeLogs || []).slice(0, visibleChanges)" :key="log.id">
                  <td>{{ new Date(log.created).toLocaleString(uiLocale) }}</td>
                  <td>{{ log.profileName }}</td>
                  <td>{{ log.previousValue || "-" }} -> {{ log.newValue || "-" }}</td>
                  <td>
                    <span v-if="log.isGrowth" class="badge badge-success">{{ $t("dashboard.growth") }}</span>
                    <span v-else-if="log.isDeparture" class="badge badge-error">{{ $t("dashboard.departure") }}</span>
                    <span v-else class="badge badge-ghost">{{ $t("dashboard.neutral") }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex justify-end gap-2">
            <template v-if="profileSectionExpanded">
              <UiButton
                v-if="(data?.profileChangeLogs || []).length > 5"
                variant="ghost"
                size="sm"
                @click="visibleChanges = visibleChanges === 5 ? 50 : 5"
              >
                {{ visibleChanges === 5 ? $t("dashboard.showMore") : $t("dashboard.showLess") }}
              </UiButton>
            </template>
            <UiButton variant="ghost" size="sm" @click="profileSectionExpanded = !profileSectionExpanded">
              {{ profileSectionExpanded ? $t("dashboard.collapseChanges") : $t("dashboard.expandChanges") }}
            </UiButton>
          </div>
        </div>
      </div>

      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="card-title">{{ $t("dashboard.leaderboardTitle") }}</h2>
              <p class="text-sm opacity-70">{{ $t("dashboard.leaderboardSubtitle") }}</p>
            </div>
            <UiButton variant="ghost" size="sm" @click="leaderboardExpanded = !leaderboardExpanded">
              {{ leaderboardExpanded ? $t("dashboard.collapse") : $t("dashboard.expand") }}
            </UiButton>
          </div>
          <div v-if="leaderboardExpanded" class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>{{ $t("dashboard.rank") }}</th>
                  <th>{{ $t("dashboard.discordName") }}</th>
                  <th>{{ $t("dashboard.hours") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in (data?.voiceLeaderboardTop25 || []).slice(0, visibleLeaderboard)" :key="item.discordId">
                  <td>{{ Number(index) + 1 }}</td>
                  <td>{{ item.discordName }}</td>
                  <td>{{ item.hours7d }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="leaderboardExpanded" class="flex justify-end">
            <UiButton
              v-if="(data?.voiceLeaderboardTop25 || []).length > 10"
              variant="ghost"
              size="sm"
              @click="visibleLeaderboard = visibleLeaderboard === 10 ? 25 : 10"
            >
              {{ visibleLeaderboard === 10 ? $t("dashboard.showMore") : $t("dashboard.showLess") }}
            </UiButton>
          </div>
        </div>
      </div>
    </template>

    <!-- Onboarding Tour -->
    <SharedOnboardingTour
      :state="tourState"
      :skip-label="$t('setup.back')"
      @next="nextTour"
      @skip="skipTour"
    />
  </section>
</template>
