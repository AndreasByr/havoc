<template>
  <div class="flex min-h-screen flex-col">
    <AppNavbar />
    <main class="container mx-auto flex-1 px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <div class="mb-4">
          <DevLoginBanner />
        </div>
        <slot />
      </div>
    </main>
    <AppFooter />
  </div>
</template>
