<script setup lang="ts">
definePageMeta({
  middleware: ["moderator"],
});

const lastPath = useCookie<string | null>("guildora_apps_last_path", { sameSite: "lax" });
const allowedTargets = new Set(["/apps/overview", "/apps/sideload", "/apps/marketplace"]);
const target = allowedTargets.has(lastPath.value || "") ? lastPath.value || "/apps/overview" : "/apps/overview";

await navigateTo(target, { redirectCode: 302 });
</script>
