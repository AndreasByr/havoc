# Phase 3: Auth- & Session-Härtung - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 03-auth-session-härtung
**Areas discussed:** Scope, deny-by-default Allowlist, Session-Rotation, Cookie/OAuth Härtung

---

## Scope der Phase

| Option | Description | Selected |
|--------|-------------|----------|
| Alles 10 Findings | Phase 3 nimmt alle SEC-05-Findings mit, auch Uploads | |
| F-14/F-15 raus — auf v2 defer | F-14 und F-15 sind Low-Severity, Upload-Flow ist ein eigenes Thema | ✓ |

**User's choice:** F-14 (Upload-Path-Traversal) und F-15 (Avatar-Bucket-Bypass) deferred zu v2.

| Option | Description | Selected |
|--------|-------------|----------|
| F-13 rein — separates Auth-Rate-Limit | Brute-Force-Schutz, simpler Fix | |
| F-13 raus — auf Phase 5 defer | Low-Severity, bestehende globale Limite reichen | ✓ |

**User's choice:** F-13 deferred zu Phase 5.

**Notes:** Phase 3 scope ist 7 Findings: F-02, F-03, F-04, F-07, F-09, F-10, F-17.

---

## deny-by-default Allowlist

| Option | Description | Selected |
|--------|-------------|----------|
| Konstante im Middleware | `PUBLIC_PATHS`-Array in 03-session.ts, explizit eintragen | ✓ |
| Nuxt routeRules in nuxt.config.ts | Framework-integriert, config wird groß | |
| defineRouteRules / Meta pro Route-File | Lokal lesbar, Middleware-Integration nicht trivial | |

**User's choice:** `PUBLIC_PATHS`-Konstante direkt in `03-session.ts`.

| Option | Description | Selected |
|--------|-------------|----------|
| Mit requireSession() absichern | Locale-Context ist intern, public wäre inkonsistent | ✓ |
| In Public-Allowlist | Falls Locale-Context wirklich ohne Session sinnvoll ist | |

**User's choice:** `locale-context.get.ts` mit `requireSession()` absichern.

---

## Session-Rotation (F-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Verifizieren + dokumentieren | Cookie-Before/After-Inspect, Ergebnis in Summary | ✓ |
| Finding als erledigt markieren | Code-Review zeigt strukturelle Lösung durch sealed-cookies | |

**User's choice:** Verifizieren + dokumentieren.

**Notes:** nuxt-auth-utils sealed-cookie-sessions haben keine separate Session-ID. Cookie-Wert = versiegelte Payload, ändert sich bei jedem replaceUserSession()-Call. Session-Fixation strukturell nicht möglich. Phase 3 dokumentiert die Verifikation.

---

## Cookie/OAuth Härtung

| Option | Description | Selected |
|--------|-------------|----------|
| Default true, explicit false in dev | `NODE_ENV !== 'development'` — klar, vorhersagbar | ✓ |
| Default true + Startup-Warn wenn false in non-dev | Wie oben plus Startup-Log — redundant nach NODE_ENV-Bindung | |

**User's choice:** `secure: process.env.NODE_ENV !== 'development'` — URL-Heuristik fällt weg.

| Option | Description | Selected |
|--------|-------------|----------|
| Nur import.meta.dev binden | Early-return 404 wenn nicht im Dev-Build | ✓ |
| Flag und Endpoints bereinigen | enablePerformanceDebug entfernen + Endpoints binden | |

**User's choice:** Dev-Endpoints nur an `import.meta.dev` binden. Flag-Cleanup ist deferred.

---

## Claude's Discretion

- Genaue Form der `PUBLIC_PATHS`-Konstante (Array, RegExp, Präfix-Match)
- Test-Format für Session-Rotation-Verifikation
- Wave-Zuordnung der Findings in Plans

## Deferred Ideas

- F-13 Auth-Rate-Limit → Phase 5
- F-14 Upload-Path-Traversal → v2
- F-15 Avatar-Bucket-Bypass → v2
- enablePerformanceDebug-Flag-Cleanup → Tech-Debt-Sweep
