export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return;
  if (to.path.includes("/profile/customize") || to.path.includes("/login") || to.path.includes("/apply/")) return;

  const { user } = useAuth();
  if (!user.value) return;

  const checked = useState<boolean>("mandatory-fields-checked", () => false);
  if (checked.value) return;
  checked.value = true;

  try {
    const data = await $fetch<{ fields: Array<{ key: string; required: boolean; canEdit: boolean; value: unknown }> }>("/api/profile/custom-fields");
    const missing = data.fields.filter((f) => f.required && f.canEdit && (f.value == null || f.value === ""));
    if (missing.length > 0) {
      return navigateTo("/profile/customize");
    }
  } catch {
    // Silently fail — don't block navigation
  }
});
