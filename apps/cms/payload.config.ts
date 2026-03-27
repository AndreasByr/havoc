import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { buildConfig } from "payload";
import { Media } from "./src/collections/Media";
import { Pages } from "./src/collections/Pages";
import { Users } from "./src/collections/Users";
import { cmsSsoEndpoint } from "./src/endpoints/cms-sso";
import { SiteSettings } from "./src/globals/SiteSettings";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
dotenv.config({ path: path.resolve(dirname, "../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set for Payload CMS.");
}

const payloadSecret = process.env.PAYLOAD_SECRET;
if (!payloadSecret) {
  throw new Error("PAYLOAD_SECRET must be set.");
}

const corsOrigins = Array.from(new Set([
  process.env.NUXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  process.env.NUXT_PUBLIC_HUB_URL ?? "http://localhost:3003"
].filter(Boolean)));

const bucketEnabled = !!(
  process.env.BUCKET_PROVIDER &&
  process.env.BUCKET_ENDPOINT &&
  process.env.BUCKET_NAME &&
  process.env.BUCKET_ACCESS_KEY_ID &&
  process.env.BUCKET_SECRET_ACCESS_KEY
);

const bucketPrefix = process.env.BUCKET_PATH_PREFIX
  ? `${process.env.BUCKET_PATH_PREFIX.replace(/\/+$/, "")}/cms/`
  : "cms/";

export default buildConfig({
  editor: lexicalEditor({}),
  // Only set when explicitly provided; else Payload uses relative URLs and route matching works.
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || undefined,
  secret: payloadSecret,
  routes: {
    admin: "/admin",
    api: "/api"
  },
  localization: {
    locales: ["en", "de"],
    defaultLocale: "en",
    fallback: true
  },
  collections: [Users, Pages, Media],
  globals: [SiteSettings],
  endpoints: [cmsSsoEndpoint],
  admin: {
    user: "users",
    components: {
      beforeDashboard: ["./src/components/SeedHint#SeedHint"]
    }
  },
  db: postgresAdapter({
    pool: {
      connectionString
    },
    schemaName: "payload"
  }),
  typescript: {
    outputFile: path.resolve(dirname, "src/payload-types.ts")
  },
  plugins: [
    ...(bucketEnabled
      ? [
          (() => {
            const prov = process.env.BUCKET_PROVIDER?.toLowerCase();
            const usePathStyle = prov === "minio" || prov === "r2";
            return s3Storage({
              collections: { media: true },
              bucket: process.env.BUCKET_NAME!,
              config: {
                endpoint: process.env.BUCKET_ENDPOINT,
                region: process.env.BUCKET_REGION || "auto",
                credentials: {
                  accessKeyId: process.env.BUCKET_ACCESS_KEY_ID!,
                  secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY!
                },
                forcePathStyle: usePathStyle,
                ...(usePathStyle ? {
                  requestChecksumCalculation: "WHEN_REQUIRED" as const,
                  responseChecksumValidation: "WHEN_REQUIRED" as const
                } : {})
              },
              prefix: bucketPrefix
            });
          })()
        ]
      : [])
  ],
  cors: corsOrigins
});
