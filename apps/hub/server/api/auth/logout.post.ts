import { createError } from "h3";

export default defineEventHandler(async (event) => {
  try {
    await clearUserSession(event);
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
  return { ok: true };
});