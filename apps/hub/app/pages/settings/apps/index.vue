<script setup lang="ts">
definePageMeta({
  middleware: ["settings"],
});

await navigateTo("/apps", { redirectCode: 301 });
</script>
