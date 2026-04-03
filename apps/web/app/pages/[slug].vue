<script setup lang="ts">
const route = useRoute();
const { locale } = useI18n();
const { fetchFooterPage } = useFooterPages();

const slug = computed(() => String(route.params.slug));
const { data: page } = await useAsyncData(`footer-page-${slug.value}`, () =>
  fetchFooterPage(slug.value, locale.value === "de" ? "de" : "en")
);

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found" });
}

useSeoMeta({
  title: page.value.title
});
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-24">
    <h1 class="text-3xl font-bold">{{ page!.title }}</h1>
    <div
      class="prose prose-invert mt-8 max-w-none text-[var(--color-text-secondary)]"
      v-html="sanitizeHtml(page!.content)"
    />
  </div>
</template>
