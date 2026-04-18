import type { DisplayNameField } from "@guildora/shared";
import type { AppearancePreference } from "../../utils/appearance";
import type { LocalePreference, LocaleResolutionSource  } from "../../utils/locale-preference";

export interface EditableProfile {
  profileName: string;
  ingameName: string;
  rufname: string | null;
  avatarUrl?: string | null;
  avatarSource?: string | null;
  displayNameTemplate?: DisplayNameField[];
  displayNameParts?: Record<string, string>;
  appearancePreference?: AppearancePreference;
  localePreference?: LocalePreference | null;
  effectiveLocale?: LocalePreference;
  localeSource?: LocaleResolutionSource;
  customFields?: Record<string, unknown>;
  communityRole?: string | null;
  permissionRoles?: string[];
  editableDiscordRoles?: Array<{
    discordRoleId: string;
    name: string;
    selected: boolean;
  }>;
  voiceSummary?: {
    minutes7d: number;
    minutes14d: number;
    minutes28d: number;
    hours7d: number;
    label: string;
  };
  discordSync?: {
    nicknameUpdated: boolean;
    nicknameReason: "not_requested" | "missing_permissions" | "member_not_manageable" | "nickname_too_long" | null;
    appliedNickname: string | null;
  } | null;
}

export function useProfile() {
  const profile = useState<EditableProfile | null>("profile", () => null);
  const pending = useState<boolean>("profile-pending", () => false);
  const requestFetch = useRequestFetch();

  const fetchProfile = async () => {
    pending.value = true;
    try {
      const data = await requestFetch<EditableProfile>("/api/profile", {
        credentials: "include"
      });
      profile.value = data;
      return data;
    } finally {
      pending.value = false;
    }
  };

  const updateProfile = async (payload: EditableProfile) => {
    const body: Record<string, unknown> = {
      ingameName: payload.ingameName,
      rufname: payload.rufname ?? null,
      appearancePreference: payload.appearancePreference,
      localePreference: payload.localePreference,
      customFields: payload.customFields ?? {}
    };
    if (payload.displayNameParts) {
      body.displayNameParts = payload.displayNameParts;
    }
    const data = await requestFetch<EditableProfile>("/api/profile", {
      method: "PUT",
      body,
      credentials: "include"
    });
    profile.value = data;
    return data;
  };

  const updateProfileDiscordRoles = async (discordRoleIds: string[]) => {
    const data = await requestFetch<{
      editableDiscordRoles: Array<{ discordRoleId: string; name: string; selected: boolean }>;
      addedRoleIds: string[];
      removedRoleIds: string[];
    }>("/api/profile/discord-roles", {
      method: "PUT",
      body: { discordRoleIds },
      credentials: "include"
    });
    if (profile.value) {
      profile.value = {
        ...profile.value,
        editableDiscordRoles: data.editableDiscordRoles
      };
    }
    return data;
  };

  const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const data = await $fetch<{ avatarUrl: string; avatarSource: string }>("/api/profile/avatar", {
      method: "PUT",
      body: formData
    });
    if (profile.value) {
      profile.value = { ...profile.value, avatarUrl: data.avatarUrl, avatarSource: data.avatarSource };
    }
    return data;
  };

  const removeAvatar = async () => {
    const data = await $fetch<{ avatarUrl: string | null; avatarSource: string }>("/api/profile/avatar", {
      method: "DELETE"
    });
    if (profile.value) {
      profile.value = { ...profile.value, avatarUrl: data.avatarUrl, avatarSource: data.avatarSource };
    }
    return data;
  };

  return {
    profile,
    pending,
    fetchProfile,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    updateLocalePreference: async (localePreference: LocalePreference | null) => {
      const data = await requestFetch<Pick<EditableProfile, "localePreference" | "effectiveLocale" | "localeSource" | "appearancePreference">>(
        "/api/profile/locale",
        {
          method: "PUT",
          body: { localePreference },
          credentials: "include"
        }
      );
      if (profile.value) {
        profile.value = {
          ...profile.value,
          localePreference: data.localePreference,
          effectiveLocale: data.effectiveLocale,
          localeSource: data.localeSource,
          appearancePreference: data.appearancePreference ?? profile.value.appearancePreference
        };
      }
      return data;
    },
    updateProfileDiscordRoles
  };
}
