<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

const route = useRoute();
const localePath = useLocalePath();
const memberId = typeof route.params.id === "string" ? route.params.id : "";

if (!memberId) {
  throw createError({ statusCode: 404, statusMessage: "Member not found" });
}

try {
  await navigateTo(
    localePath({
      path: "/members",
      query: {
        member: memberId
      }
    }),
    {
      redirectCode: 301
    }
  );
} catch {
  throw createError({ statusCode: 404, statusMessage: "Member not found" });
}
</script>
