import {
  isAuthenticated,
  jsonResponse,
  methodNotAllowed,
} from "../../_shared/http.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  return jsonResponse({ authenticated: await isAuthenticated(request, env) });
}
