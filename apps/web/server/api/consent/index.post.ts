/**
 * Web-side proxy for POST /api/consent — forwards to Hub API.
 * The browser cannot reach the Hub directly (different origin/container),
 * so the Web app proxies consent recording through this server route.
 */
import { readBody, createError } from "h3";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const hubUrl = (config.public?.hubUrl as string)?.trim() || "http://localhost:3003";

  const body = await readBody(event);

  if (!body?.policyVersion || typeof body.policyVersion !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "policyVersion is required"
    });
  }

  try {
    const result = await $fetch<{ success: boolean; id?: string; acceptedAt?: string; alreadyConsented?: boolean }>(
      `${hubUrl}/api/consent`,
      {
        method: "POST",
        body: { policyVersion: body.policyVersion }
      }
    );

    console.log(`[web-consent-proxy] Forwarded consent to hub: policyVersion=${body.policyVersion}, success=${result.success}`);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[web-consent-proxy] Failed to forward consent to hub:", message);
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to record consent via hub API"
    });
  }
});
