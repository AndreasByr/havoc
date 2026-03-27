<script setup lang="ts">
definePageMeta({
  middleware: ["settings"],
});

const lastPath = useCookie<string | null>("guildora_settings_last_path", { sameSite: "lax" });
const allowedTargets = new Set([
  "/settings/community",
  "/settings/custom-fields",
  "/settings/permissions",
  "/settings/moderation-rights",
  "/settings/design"
]);
const target = allowedTargets.has(lastPath.value || "") ? lastPath.value || "/settings/community" : "/settings/community";

await navigateTo(target, { redirectCode: 302 });
</script>
