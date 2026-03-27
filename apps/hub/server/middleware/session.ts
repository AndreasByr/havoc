export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event);
    event.context.userSession = session;
  } catch (error) {
    console.warn("[Auth] Session validation failed:", error instanceof Error ? error.message : String(error));
    event.context.userSession = null;
  }
});
