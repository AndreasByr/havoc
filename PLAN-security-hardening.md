# Implementierungsplan: Security Hardening (GUILD-23 bis GUILD-26)

## Reihenfolge

```
Task 3 (GUILD-25: Schema Validation) ──┐
Task 4 (GUILD-26: Drizzle Refactor) ────┤── parallel, risikoarm
Task 1 (GUILD-23: Rate Limiting) ───────┤── Middleware-Architektur
Task 2 (GUILD-24: CSRF) ────────────────┘── Breaking Change (Frontend)
```

## Task 3 — GUILD-25: Schema Validation bucket.delete (XS)

**Datei:** `apps/hub/server/api/settings/files/bucket.delete.ts`

- Ersetze `readBody()` durch `readBodyWithSchema()` mit Zod Schema
- Schema: `z.object({ confirmation: z.string() })`
- Kein neues Package, kein Breaking Change

## Task 4 — GUILD-26: Drizzle Refactor tags delete (XS)

**Datei:** `apps/hub/server/api/admin/tags/[id].delete.ts`

- Raw SQL in benannte Hilfsfunktion extrahieren (`removeTagFromProfiles`)
- Optional in `utils/db-helpers.ts` auslagern
- Drizzle hat keine `jsonb_array_elements`-Abstraktion → raw SQL bleibt, aber isoliert und typisiert
- Kein neues Package

## Task 1 — GUILD-23: Rate Limiting (S)

**Neue Dateien:**
- `apps/hub/server/utils/rate-limit.ts` — Kern-Utility (Sliding Window, In-Memory)
- `apps/hub/server/middleware/rate-limit.ts` — Globales Limit (300 req/min)

**Geänderte Dateien (spezifische Limits):**
- `api/auth/discord.get.ts` — 10 req/min
- `api/apply/[flowId]/submit.post.ts` — 5 req/min
- Weitere Auth/Mod Endpoints — 20-30 req/min

**Kein neues Package** für single-instance (In-Memory Map). Für Multi-Instance: `@upstash/ratelimit`.

**Risiken:**
- IP-Detection hinter Reverse Proxy prüfen
- Memory Cleanup via setInterval nötig
- Staging-Test mit echtem Proxy pflichtend

## Task 2 — GUILD-24: CSRF Protection (M) ⚠️ Breaking Change

**Neue Dateien:**
- `apps/hub/server/utils/csrf.ts` — Token Generation + Validation (Double-Submit Cookie)
- `apps/hub/server/api/csrf-token.get.ts` — Token-Endpoint
- `apps/hub/server/middleware/csrf-check.ts` — Prüf-Middleware

**Geänderte Dateien:**
- Frontend: Neuer `useCsrf` Composable, `useApiFetch` mit Auto-Header
- Middleware umbenennen: `01-rate-limit.ts`, `02-csrf-check.ts`, `03-session.ts`

**Exemptions:**
- OAuth-Flow (`/api/auth/discord`)
- Bot-interne Calls (Authorization Bearer Header)

**Risiken:**
- Alle Frontend-`$fetch` Calls brauchen den Header
- Bestehende Tests müssen CSRF-Token mitsenden
- Bot-interne API Calls brauchen Exemption

## Packages

Keine neuen Packages nötig (Zod, crypto bereits vorhanden).
Optional für Production: `@upstash/ratelimit` + `@upstash/redis`.

## Test-Strategie

- Vitest Unit-Tests für alle Tasks
- E2E-Tests für CSRF auf kritischen Mutation-Endpoints
- Staging-Test für Rate Limiting hinter Proxy
