import {
  badRequest,
  buildSessionCookie,
  createSessionToken,
  getRequiredString,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  serviceUnavailable,
  timingSafeEqualText,
} from "../../_shared/http.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const appPassword = getRequiredString(env.APP_PASSWORD);
  const sessionSecret = getRequiredString(env.SESSION_SECRET);
  if (!appPassword || !sessionSecret) {
    return serviceUnavailable("Authentication is not configured");
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return badRequest(error.message);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Invalid request body");
  }

  if (typeof body.password !== "string") {
    return badRequest("Missing password");
  }

  if (!(await timingSafeEqualText(body.password, appPassword))) {
    return jsonResponse({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken(sessionSecret);
  return jsonResponse(
    { authenticated: true },
    { headers: { "Set-Cookie": buildSessionCookie(request, token) } },
  );
}
