const hubUrl = process.env.NUXT_PUBLIC_HUB_URL || "";
const hubHostname = (() => {
  try { return hubUrl ? new URL(hubUrl).hostname : ""; }
  catch { return ""; }
})();
const needsTunnelHmr = hubUrl.startsWith("https://") && hubHostname && hubHostname !== "localhost";

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
  auth: {},
  devtools: { enabled: false },
  css: ["~/assets/css/main.css", "~/assets/css/landing.css", "~/assets/css/cyberpunk.css", "~/assets/css/esports.css"],
  runtimeConfig: {
    session: {
      maxAge: 60 * 60 * 24 * 7,
      cookie: {
        path: "/",
        sameSite: "lax" as const,
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        domain: undefined as string | undefined,
      },
    },
    discordClientId: process.env.NUXT_OAUTH_DISCORD_CLIENT_ID,
    discordClientSecret: process.env.NUXT_OAUTH_DISCORD_CLIENT_SECRET,
    discordRedirectUri: process.env.NUXT_OAUTH_DISCORD_REDIRECT_URI,
    databaseUrl: process.env.DATABASE_URL,
    superadminDiscordId: process.env.SUPERADMIN_DISCORD_ID || "",
    botInternalUrl: process.env.BOT_INTERNAL_URL || "http://bot:3050",
    botInternalToken: process.env.BOT_INTERNAL_TOKEN || "",
    authDevBypass: process.env.NUXT_AUTH_DEV_BYPASS === "true",
    mcpInternalToken: process.env.MCP_INTERNAL_TOKEN || "",
    enableSideloading: process.env.NUXT_ENABLE_SIDELOADING === "true",
    public: {
      isDev: process.env.NODE_ENV === "development",
      authDevBypass: process.env.NODE_ENV === "development" && process.env.NUXT_AUTH_DEV_BYPASS === "true",
      appName: "Guildora",
      hubUrl: process.env.NUXT_PUBLIC_HUB_URL || "http://localhost:3003",
      landingUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
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
      { code: "en", language: "en-US", name: "English" },
      { code: "de", language: "de-DE", name: "Deutsch" }
    ],
    lazy: false,
    vueI18n: "./i18n.config.ts",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "guildora_i18n",
      redirectOn: "root"
    }
  },
  compatibilityDate: "2025-01-01",
  devServer: {
    host: "0.0.0.0"
  },
  vite: {
    server: {
      ...(hubHostname ? { allowedHosts: [hubHostname] } : {}),
      ...(needsTunnelHmr
        ? {
            hmr: {
              clientPort: 443,
              protocol: "wss",
              host: hubHostname
            }
          }
        : {})
    }
  }
});
