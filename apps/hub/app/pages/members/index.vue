<script setup lang="ts">
import MemberExpandableCard from "~/components/members/MemberExpandableCard.vue";
import MemberDetailsModal from "~/components/members/MemberDetailsModal.vue";

definePageMeta({
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

interface MemberItem {
  id: string;
  profileName: string;
  ingameName: string;
  rufname: string | null;
  communityRole: string | null;
  avatarUrl: string | null;
  cardRoleName: string | null;
  voice: {
    label: string;
    minutes: number;
    hours: number;
  };
}

interface MembersResponse {
  days: number;
  items: MemberItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface MemberProfileResponse {
  id: string;
  profileName: string;
  ingameName: string;
  rufname: string | null;
  permissionRoles: string[];
  communityRole: string | null;
  voiceSummary?: {
    minutes7d: number;
    minutes14d: number;
    minutes28d: number;
    hours7d: number;
    label: string;
  };
}

const search = ref("");
const communityRole = ref("");
const sort = ref("name");
const page = ref(1);

watch([search, communityRole, sort], () => {
  page.value = 1;
});

const { data, pending, error } = await useFetch<MembersResponse>("/api/members", {
  query: computed(() => ({
    search: search.value || undefined,
    communityRole: communityRole.value || undefined,
    voiceActivityDays: 7,
    sort: sort.value,
    page: page.value,
    limit: 50
  }))
});

const roleOptions = computed(() => {
  const values = new Set<string>();
  for (const item of data.value?.items || []) {
    if (item.communityRole) {
      values.add(item.communityRole);
    }
  }
  return Array.from(values).sort();
});

const selectedMemberId = ref<string | null>(null);
const selectedProfile = ref<MemberProfileResponse | null>(null);
const selectedProfilePending = ref(false);
const selectedProfileError = ref<string | null>(null);

async function updateMemberQuery(memberId: string | null) {
  if (!import.meta.client) return;

  const nextQuery = { ...route.query } as Record<string, unknown>;
  if (memberId) {
    nextQuery.member = memberId;
  } else {
    delete nextQuery.member;
  }

  await router.replace({ query: nextQuery });
}

async function loadSelectedProfile(memberId: string) {
  selectedProfilePending.value = true;
  selectedProfileError.value = null;
  try {
    selectedProfile.value = await $fetch<MemberProfileResponse>("/api/profile", {
      query: { id: memberId }
    });
  } catch {
    selectedProfile.value = null;
    selectedProfileError.value = t("common.error");
  } finally {
    selectedProfilePending.value = false;
  }
}

async function openMemberDetails(memberId: string) {
  selectedMemberId.value = memberId;
  await loadSelectedProfile(memberId);
  await updateMemberQuery(memberId);
}

async function closeMemberDetails() {
  selectedMemberId.value = null;
  selectedProfile.value = null;
  selectedProfileError.value = null;
  await updateMemberQuery(null);
}

watch(
  () => route.query.member,
  async (queryMember) => {
    const memberId = typeof queryMember === "string" && queryMember.trim().length > 0 ? queryMember : null;
    if (!memberId) {
      selectedMemberId.value = null;
      selectedProfile.value = null;
      selectedProfileError.value = null;
      return;
    }

    if (selectedMemberId.value === memberId && (selectedProfile.value || selectedProfilePending.value)) {
      return;
    }

    selectedMemberId.value = memberId;
    await loadSelectedProfile(memberId);
  },
  { immediate: true }
);
</script>

<template>
  <section class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold md:text-3xl">{{ $t("members.title") }}</h1>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <UiInput
        v-model="search"
        :label="$t('members.searchPlaceholder')"
        :placeholder="$t('members.searchPlaceholder')"
       
      />
      <UiSelect v-model="communityRole" :label="$t('members.allRoles')">
        <option value="">{{ $t("members.allRoles") }}</option>
        <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
      </UiSelect>
      <UiSelect v-model="sort" :label="$t('members.sortLabel')">
        <option value="name">{{ $t("members.sortName") }}</option>
        <option value="joined">{{ $t("members.sortJoined") }}</option>
        <option value="role">{{ $t("members.sortRole") }}</option>
        <option value="voice">{{ $t("members.sortVoice") }}</option>
      </UiSelect>
    </div>

    <div v-if="pending" class="loading loading-spinner loading-md" />
    <div v-else-if="error" class="alert alert-error">{{ $t("common.error") }}</div>
    <template v-else>
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <MemberExpandableCard
          v-for="item in data?.items || []"
          :key="item.id"
          :member="item"
          @open-details="openMemberDetails"
        />
      </div>

      <div v-if="data?.pagination && data.pagination.totalPages > 1" class="flex items-center justify-center gap-3 pt-4">
        <button
          class="btn btn-ghost btn-sm"
          :disabled="page <= 1"
          @click="page--"
        >
          &larr; {{ $t("common.previous") }}
        </button>
        <span class="text-sm text-base-content/70">
          {{ page }} / {{ data.pagination.totalPages }}
          <span class="ml-2 text-xs">({{ data.pagination.total }})</span>
        </span>
        <button
          class="btn btn-ghost btn-sm"
          :disabled="page >= data.pagination.totalPages"
          @click="page++"
        >
          {{ $t("common.next") }} &rarr;
        </button>
      </div>
    </template>

    <MemberDetailsModal
      :open="Boolean(selectedMemberId)"
      :pending="selectedProfilePending"
      :error="selectedProfileError"
      :member-id="selectedMemberId"
      :profile="selectedProfile"
      @close="closeMemberDetails"
      @saved="() => { loadSelectedProfile(selectedMemberId!); }"
    />
  </section>
</template>
