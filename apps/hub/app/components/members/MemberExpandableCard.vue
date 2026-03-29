<script setup lang="ts">
interface MemberCardItem {
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

const props = defineProps<{
  member: MemberCardItem;
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  (event: "open-details", memberId: string): void;
  (event: "toggle-select"): void;
}>();

function handleCardClick() {
  if (props.selectable) {
    emit("toggle-select");
  } else {
    emit("open-details", props.member.id);
  }
}

const { t } = useI18n();
const avatarAlt = computed(() => t("members.avatarAlt", { name: props.member.profileName }));
const avatarInitials = computed(() => props.member.profileName?.slice(0, 2).toUpperCase() || "U");

</script>

<template>
  <article class="member-card" :class="{ 'member-card--selected': selected }" @click="handleCardClick">
    <div class="member-card__body">
      <div v-if="selectable" class="member-card__checkbox">
        <input
          type="checkbox"
          :checked="selected"
          class="member-card__checkbox-input"
          @click.stop="emit('toggle-select')"
        >
      </div>
      <div class="member-card__avatar-wrap">
        <img
          v-if="member.avatarUrl"
          :src="member.avatarUrl"
          :alt="avatarAlt"
          class="member-card__avatar"
          loading="lazy"
          decoding="async"
        >
        <span v-else class="member-card__avatar-fallback" aria-hidden="true">{{ avatarInitials }}</span>
      </div>
      <div class="member-card__identity">
        <h2 class="member-card__name">{{ member.profileName }}</h2>
        <span class="badge badge-ghost badge-sm member-card__role-badge">
          {{ member.cardRoleName || $t("members.roleFallback") }}
        </span>
      </div>
      <button
        type="button"
        class="member-card__arrow"
        :aria-label="$t('members.openDetailsAria', { name: member.profileName })"
        @click.stop="emit('open-details', member.id)"
      >
        <Icon name="proicons:arrow-right" class="member-card__arrow-icon" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.member-card {
  border-radius: 0.75rem;
  background-color: var(--color-surface-2);
  box-shadow: var(--shadow-md);
  border: 1px solid transparent;
  transition: border-color 0.2s ease-out, box-shadow 0.2s ease-out;
  cursor: pointer;
}

.member-card:hover {
  border-color: var(--color-accent-border-active);
  box-shadow: var(--shadow-md), 0 0 12px var(--color-accent-glow);
}

.member-card--selected {
  border-color: var(--color-accent-border-active);
  box-shadow: var(--shadow-md), 0 0 12px var(--color-accent-glow);
}

.member-card__body {
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.member-card__checkbox {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.member-card__checkbox-input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.member-card__avatar-wrap {
  display: inline-flex;
  width: 3.25rem;
  height: 3.25rem;
  min-width: 3.25rem;
  border-radius: 9999px;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--color-accent-muted);
}

.member-card__avatar-wrap:has(.member-card__avatar) {
  background: var(--color-surface-3);
}

.member-card__avatar-wrap:has(.member-card__avatar-fallback) {
  background: var(--color-accent-subtle);
}

.member-card__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-card__avatar-fallback {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-accent-light);
}

.member-card__identity {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.member-card__name {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-card__role-badge {
  max-width: fit-content;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-card__arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: transparent;
  color: var(--color-text-tertiary);
  transition: color 0.15s, background-color 0.15s;
  cursor: pointer;
}

.member-card__arrow:hover {
  color: var(--color-accent-light);
  background: var(--color-accent-subtle);
}

.member-card__arrow-icon {
  width: 1.125rem;
  height: 1.125rem;
}
</style>
