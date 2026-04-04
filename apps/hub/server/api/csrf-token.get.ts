export default defineEventHandler((event) => {
  let token = getCookie(event, CSRF_COOKIE);

  if (!token) {
    token = generateCsrfToken();
  }

  setCookie(event, CSRF_COOKIE, token, {
    sameSite: "strict",
    secure: !import.meta.dev,
    httpOnly: false,
    path: "/",
  });

  return { token };
});
