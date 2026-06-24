import {
  badRequest,
  getRequiredString,
  isAuthenticated,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  unauthorized,
} from "../_shared/http.js";

function toNote(result) {
  const title = getRequiredString(result?.title);
  const content = getRequiredString(result?.content || result?.snippet);
  const url = getRequiredString(result?.url);
  const parts = [];

  if (title) {
    parts.push(title);
  }
  if (content) {
    parts.push(content);
  }
  if (url) {
    parts.push(url);
  }

  return parts.join("\n");
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  if (!(await isAuthenticated(request, env))) {
    return unauthorized();
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

  const query = getRequiredString(body.query);
  if (!query) {
    return badRequest("Missing query");
  }

  const apiKey = getRequiredString(env.TAVILY_API_KEY);
  if (!apiKey) {
    return jsonResponse({ notes: [] });
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
    });

    if (!response.ok) {
      return jsonResponse({ notes: [] });
    }

    const data = await response.json();
    const notes = Array.isArray(data.results)
      ? data.results.map(toNote).filter(Boolean)
      : [];

    return jsonResponse({ notes });
  } catch {
    return jsonResponse({ notes: [] });
  }
}
