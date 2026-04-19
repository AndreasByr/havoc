export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: {
        "data-theme": "guildora-dark"
      }
    }
  },
  modules: ["@nuxtjs/i18n", "@nuxtjs/tailwindcss", "@nuxt/eslint", "@nuxt/icon"],
  components: {
    dirs: [
      { path: "~/components/landing/blocks", prefix: "LandingBlocks", pathPrefix: false, global: true },
      { path: "~/components", pathPrefix: false }
    ]
  },
  devtools: { enabled: false },
  css: ["~/assets/css/main.css", "~/assets/css/landing.css", "~/assets/css/cyberpunk.css", "~/assets/css/esports.css"],
  runtimeConfig: {
    public: {
      appName: "Guildora",
      appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
      hubUrl: process.env.NUXT_PUBLIC_HUB_URL || "http://localhost:3003"
    }
  },
  i18n: {
    strategy: "prefix_except_default",
    defaultLocale: "en",
    locales: [
      { code: "en", language: "en-US", name: "English" },
      { code: "de", language: "de-DE", name: "Deutsch" }
    ],
    lazy: false,
    vueI18n: "./i18n.config.ts",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "guildora_i18n",
      redirectOn: "root"
    },
    experimental: {
      localeDetector: "localeDetector.ts",
      hmr: false
    }
  },
  compatibilityDate: "2025-01-01",
  devServer: {
    host: "0.0.0.0"
  },
  vite: {
    server: {
      allowedHosts: ["guildora-web.myweby.org"],
      ...(process.env.NUXT_PUBLIC_APP_URL?.includes("myweby.org")
        ? {
            hmr: {
              clientPort: 443,
              protocol: "wss",
              host: "guildora-web.myweby.org"
            }
          }
        : {})
    }
  }
});
