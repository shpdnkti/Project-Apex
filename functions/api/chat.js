import {
  badRequest,
  getRequiredString,
  isAuthenticated,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  serviceUnavailable,
  unauthorized,
} from "../_shared/http.js";

function buildPrompt(userText, localAnswer, webNotes) {
  const notes = Array.isArray(webNotes)
    ? webNotes.filter((note) => typeof note === "string" && note.trim()).slice(0, 8)
    : [];

  return [
    "User question:",
    userText,
    "",
    "Local answer draft:",
    localAnswer,
    "",
    "Web notes:",
    notes.length ? notes.map((note, index) => `${index + 1}. ${note}`).join("\n\n") : "None",
  ].join("\n");
}

function readAssistantContent(data) {
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

function buildChatCompletionsEndpoint(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
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

  const userText = getRequiredString(body.userText);
  const localAnswer = typeof body.localAnswer === "string" ? body.localAnswer.trim() : "";
  if (!userText) {
    return badRequest("Missing userText");
  }
  if (typeof body.localAnswer !== "string") {
    return badRequest("Missing localAnswer");
  }

  const apiKey = getRequiredString(env.LLM_API_KEY);
  if (!apiKey) {
    return serviceUnavailable("LLM is not configured");
  }

  const baseUrl = getRequiredString(env.LLM_BASE_URL) || "https://api.deepseek.com";
  const model = getRequiredString(env.LLM_MODEL) || "deepseek-chat";
  const endpoint = buildChatCompletionsEndpoint(baseUrl);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "你是 Project Apex 的高考志愿顾问。回答必须清晰、结构化，结论要基于给定本地样本分析和联网摘要；缺少数据时直接说明，不要编造分数、位次、年份或招生政策。",
          },
          {
            role: "user",
            content: buildPrompt(userText, localAnswer, body.webNotes),
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return jsonResponse({ error: "LLM request failed" }, { status: 502 });
    }

    const data = await response.json();
    const content = readAssistantContent(data);
    if (!content) {
      return jsonResponse({ error: "LLM returned an empty response" }, { status: 502 });
    }

    return jsonResponse({ content });
  } catch {
    return jsonResponse({ error: "LLM request failed" }, { status: 502 });
  }
}
