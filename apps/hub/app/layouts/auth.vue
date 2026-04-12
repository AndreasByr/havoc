<template>
  <div class="flex min-h-screen flex-col">
    <AppNavbar />
    <main class="flex flex-1 items-center justify-center px-4 py-8">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
