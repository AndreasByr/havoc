import { ref } from "vue";
import type { FlowInputType, FlowInputNodeData, FlowRoleAssignmentNodeData } from "@guildora/shared";

export type GuildRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  editable: boolean;
  color: number;
  unicodeEmoji: string | null;
};

export function useFieldEditor() {
  const { t } = useI18n();

  // ─── Guild Roles ──────────────────────────────────────────────────────

  const guildRoles = ref<GuildRole[]>([]);
  const rolesLoading = ref(true);

  async function fetchGuildRoles() {
    try {
      const result = await $fetch<{ guildRoles: GuildRole[] }>("/api/admin/discord-roles");
      guildRoles.value = result.guildRoles
        .filter((r) => !r.managed)
        .sort((a, b) => b.position - a.position);
    } catch {
      // silently fail – roles dropdown will be empty
    } finally {
      rolesLoading.value = false;
    }
  }

  // ─── Input Type Options ────────────────────────────────────────────────

  const inputTypeOptions = computed<{ value: FlowInputType; label: string }[]>(() => [
    { value: "short_text", label: t("applications.flowBuilder.inputTypes.shortText") },
    { value: "long_text", label: t("applications.flowBuilder.inputTypes.longText") },
    { value: "number", label: t("applications.flowBuilder.inputTypes.number") },
    { value: "email", label: t("applications.flowBuilder.inputTypes.email") },
    { value: "single_select_radio", label: t("applications.flowBuilder.inputTypes.radioSelect") },
    { value: "single_select_dropdown", label: t("applications.flowBuilder.inputTypes.dropdownSelect") },
    { value: "multi_select", label: t("applications.flowBuilder.inputTypes.multiSelectCheckboxes") },
    { value: "yes_no", label: t("applications.flowBuilder.inputTypes.yesNo") },
    { value: "date", label: t("applications.flowBuilder.inputTypes.date") },
    { value: "file_upload", label: t("applications.flowBuilder.inputTypes.fileUpload") },
    { value: "discord_username", label: t("applications.flowBuilder.inputTypes.discordUsername") },
    { value: "discord_role_single", label: t("applications.flowBuilder.inputTypes.discordRoleSingle") },
    { value: "discord_role_multi", label: t("applications.flowBuilder.inputTypes.discordRoleMulti") },
  ]);

  // ─── Option Helpers (for select-type inputs) ──────────────────────────

  function addOption(data: FlowInputNodeData) {
    if (!data.options) data.options = [];
    data.options.push({ id: `opt_${Date.now()}`, label: "" });
  }

  function removeOption(data: FlowInputNodeData, index: number) {
    data.options?.splice(index, 1);
  }

  // ─── Role Assignment Helpers ──────────────────────────────────────────

  function toggleRole(data: FlowRoleAssignmentNodeData, roleId: string) {
    if (!data.roleIds) data.roleIds = [];
    if (!data.roleNameSnapshots) data.roleNameSnapshots = [];

    const idx = data.roleIds.indexOf(roleId);
    if (idx >= 0) {
      data.roleIds.splice(idx, 1);
      data.roleNameSnapshots.splice(idx, 1);
    } else {
      const role = guildRoles.value.find((r) => r.id === roleId);
      data.roleIds.push(roleId);
      data.roleNameSnapshots.push(role?.name ?? roleId);
    }
  }

  function roleName(roleId: string): string {
    return guildRoles.value.find((r) => r.id === roleId)?.name ?? roleId;
  }

  // ─── Discord Role Input Helpers ────────────────────────────────────────

  function toggleDiscordRoleOption(data: FlowInputNodeData, roleId: string) {
    if (!data.discordRoleOptions) data.discordRoleOptions = [];

    const idx = data.discordRoleOptions.findIndex((r) => r.roleId === roleId);
    if (idx >= 0) {
      data.discordRoleOptions.splice(idx, 1);
    } else {
      const role = guildRoles.value.find((r) => r.id === roleId);
      if (role) {
        data.discordRoleOptions.push({
          roleId: role.id,
          name: role.name,
          color: role.color,
          unicodeEmoji: role.unicodeEmoji
        });
      }
    }
  }

  // ─── Utility ────────────────────────────────────────────────────────────

  function roleColorHex(color: number): string {
    return color === 0 ? "#99aab5" : `#${color.toString(16).padStart(6, "0")}`;
  }

  const SELECT_INPUT_TYPES: FlowInputType[] = [
    "single_select_radio",
    "single_select_dropdown",
    "multi_select"
  ];

  const DISCORD_ROLE_INPUT_TYPES: FlowInputType[] = [
    "discord_role_single",
    "discord_role_multi"
  ];

  function hasOptions(inputType: FlowInputType): boolean {
    return SELECT_INPUT_TYPES.includes(inputType);
  }

  function hasDiscordRoleOptions(inputType: FlowInputType): boolean {
    return DISCORD_ROLE_INPUT_TYPES.includes(inputType);
  }

  return {
    guildRoles,
    rolesLoading,
    fetchGuildRoles,
    inputTypeOptions,
    addOption,
    removeOption,
    toggleRole,
    roleName,
    toggleDiscordRoleOption,
    roleColorHex,
    hasOptions,
    hasDiscordRoleOptions
  };
}
