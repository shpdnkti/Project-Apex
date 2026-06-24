import {
  buildClearSessionCookie,
  jsonResponse,
  methodNotAllowed,
} from "../../_shared/http.js";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  return jsonResponse(
    { authenticated: false },
    { headers: { "Set-Cookie": buildClearSessionCookie(request) } },
  );
}
