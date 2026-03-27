<script setup lang="ts">
definePageMeta({
  middleware: ["dev"],
});

const lastPath = useCookie<string | null>("guildora_dev_last_path", { sameSite: "lax" });
const allowedTargets = new Set([
  "/dev/role-switcher",
  "/dev/sideload",
  "/dev/reset"
]);
const target = allowedTargets.has(lastPath.value || "") ? lastPath.value || "/dev/role-switcher" : "/dev/role-switcher";

await navigateTo(target, { redirectCode: 302 });
</script>
