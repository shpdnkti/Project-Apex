const SESSION_COOKIE = "apex_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const textEncoder = new TextEncoder();

export function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function methodNotAllowed(allowed) {
  return jsonResponse(
    { error: "Method not allowed" },
    {
      status: 405,
      headers: { Allow: allowed.join(", ") },
    },
  );
}

export function badRequest(message = "Invalid request") {
  return jsonResponse({ error: message }, { status: 400 });
}

export function unauthorized() {
  return jsonResponse({ error: "Unauthorized" }, { status: 401 });
}

export function serviceUnavailable(message = "Service unavailable") {
  return jsonResponse({ error: message }, { status: 503 });
}

export async function readJsonBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Expected application/json");
  }

  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export function getRequiredString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlEncodeText(value) {
  return base64UrlEncode(textEncoder.encode(value));
}

function base64UrlDecodeText(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload, secret) {
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function timingSafeEqualText(left, right) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(left)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }

  return mismatch === 0;
}

export async function createSessionToken(secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncodeText(JSON.stringify({
    iat: now,
    exp: now + SESSION_MAX_AGE,
  }));
  const signature = await signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !secret) {
    return false;
  }

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) {
    return false;
  }

  const expectedSignature = await signPayload(payload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const session = JSON.parse(base64UrlDecodeText(payload));
    const now = Math.floor(Date.now() / 1000);
    return typeof session.exp === "number" && session.exp > now;
  } catch {
    return false;
  }
}

export function readCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

export function buildSessionCookie(request, token) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
  ];

  if (new URL(request.url).protocol === "https:") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function buildClearSessionCookie(request) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];

  if (new URL(request.url).protocol === "https:") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export async function isAuthenticated(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  return verifySessionToken(token, env.SESSION_SECRET);
}
