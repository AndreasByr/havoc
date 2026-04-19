export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);

  if (session.csrfToken) {
    return { token: session.csrfToken };
  }

  const token = generateCsrfToken();
  await setUserSession(event, { csrfToken: token });

  return { token };
});
