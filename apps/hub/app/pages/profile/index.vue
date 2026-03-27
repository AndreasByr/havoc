<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

await navigateTo("/profile/customize", { redirectCode: 302 });
</script>
