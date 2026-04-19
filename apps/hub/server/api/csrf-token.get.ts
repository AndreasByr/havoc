

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event);

    if (session.csrfToken) {
      return { token: session.csrfToken };
    }

    const token = generateCsrfToken();
    await setUserSession(event, { csrfToken: token });

    return { token };
  } catch (error) {
    if (error && (error as any).statusCode) throw error;
    throw createError({ statusCode: 500, statusMessage: "INTERNAL_ERROR" });
  }
});