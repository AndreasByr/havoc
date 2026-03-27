export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: {
        "data-theme": "guildora-light"
      }
    }
  },
  modules: ["@nuxtjs/color-mode", "@nuxtjs/i18n", "@nuxtjs/tailwindcss", "nuxt-auth-utils", "@nuxt/icon", "@nuxt/eslint"],
  icon: {
    serverBundle: {
      collections: ["proicons"]
    }
  },
  colorMode: {
    preference: "system",
    fallback: "light",
    storage: "localStorage",
    storageKey: "guildora_appearance",
    classPrefix: "",
    classSuffix: "-mode"
  },
  auth: {
    session: {
      maxAge: 60 * 60 * 24 * 7
    }
  },
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    discordClientId: process.env.NUXT_OAUTH_DISCORD_CLIENT_ID,
    discordClientSecret: process.env.NUXT_OAUTH_DISCORD_CLIENT_SECRET,
    discordRedirectUri: process.env.NUXT_OAUTH_DISCORD_REDIRECT_URI,
    databaseUrl: process.env.DATABASE_URL,
    superadminDiscordId: process.env.SUPERADMIN_DISCORD_ID || "",
    botInternalUrl: process.env.BOT_INTERNAL_URL || "http://bot:3050",
    botInternalToken: process.env.BOT_INTERNAL_TOKEN || "",
    authDevBypass: process.env.NUXT_AUTH_DEV_BYPASS === "true",
    cmsSsoSecret: process.env.CMS_SSO_SECRET || "",
    payloadInternalUrl: process.env.PAYLOAD_INTERNAL_URL || "http://cms:3002",
    linearApiKey: process.env.NUXT_LINEAR_API_KEY || "",
    public: {
      isDev: process.env.NODE_ENV === "development",
      appName: "Guildora",
      hubUrl: process.env.NUXT_PUBLIC_HUB_URL || "http://localhost:3003",
      landingUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
      cmsUrl: process.env.NUXT_PUBLIC_CMS_URL || "http://localhost:3002",
      marketplaceEmbedUrl: process.env.NUXT_PUBLIC_MARKETPLACE_EMBED_URL || "",
      defaultTheme: process.env.NUXT_PUBLIC_DEFAULT_THEME || "guildora-dark",
      enablePerformanceDebug: process.env.NUXT_PUBLIC_ENABLE_PERFORMANCE_DEBUG === "true"
    }
  },
  routeRules: {
    "/dashboard/**": { ssr: true },
    "/settings/**": { ssr: true },
    "/apps/**": { ssr: false },
    "/dev/**": { ssr: false }
  },
  i18n: {
    strategy: "prefix_except_default",
    defaultLocale: "en",
    locales: [
      { code: "en", language: "en-US", file: "en.json", name: "English" },
      { code: "de", language: "de-DE", file: "de.json", name: "Deutsch" }
    ],
    lazy: true,
    langDir: "locales",
    vueI18n: "./i18n.config.ts",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "guildora_i18n",
      redirectOn: "root"
    }
  },
  compatibilityDate: "2025-01-01"
});
