export const AUTH_HEADER_PREFIX = "Authorization: Bearer ";
export const BEARER_PREFIX = "Bearer ";
export const NEAR_EXPIRY_SECONDS = 10 * 60;

export type TokenErrorCode =
  | "empty"
  | "invalid_login_session"
  | "missing_subscription_token"
  | "malformed_jwt"
  | "expired";

export type TokenExtractionResult =
  | {
      ok: true;
      token: string;
    }
  | {
      ok: false;
      code: TokenErrorCode;
      message: string;
    };

export type JwtPayload = {
  exp: number;
  SubscriptionStatus?: string;
  SubscribedProduct?: string;
  [claim: string]: unknown;
};

export type TokenValidationResult =
  | {
      ok: true;
      token: string;
      bearerValue: string;
      authorizationHeader: string;
      expiresAtIso: string;
      expiresInSeconds: number;
      nearExpiry: boolean;
      payload: JwtPayload;
    }
  | {
      ok: false;
      code: TokenErrorCode;
      message: string;
    };

type JsonObject = Record<string, unknown>;

export function buildBearerValue(token: string): string {
  return `${BEARER_PREFIX}${token}`;
}

export function buildAuthorizationHeader(token: string): string {
  return `${AUTH_HEADER_PREFIX}${token}`;
}

export function extractSubscriptionToken(
  rawValue: string,
): TokenExtractionResult {
  const value = rawValue.trim();
  if (!value) {
    return {
      ok: false,
      code: "empty",
      message: "No login session value was found.",
    };
  }

  if (looksLikeJwt(value)) {
    return { ok: true, token: value };
  }

  const decodedValue = decodeCookieValue(value);
  const candidates = uniqueStrings([decodedValue, value]);
  let parsedAnyJson = false;
  let sawJsonLikeValue = false;

  for (const candidate of candidates) {
    if (candidate.startsWith("{")) {
      sawJsonLikeValue = true;
    }
    const parsed = parseJson(candidate);
    if (!parsed.ok) {
      continue;
    }
    parsedAnyJson = true;

    const token = findSubscriptionToken(parsed.value);
    if (token) {
      return { ok: true, token };
    }
  }

  if (sawJsonLikeValue && !parsedAnyJson) {
    return {
      ok: false,
      code: "invalid_login_session",
      message: "The login session could not be decoded.",
    };
  }

  if (parsedAnyJson) {
    return {
      ok: false,
      code: "missing_subscription_token",
      message: "The login session does not contain a subscription token.",
    };
  }

  return {
    ok: false,
    code: "invalid_login_session",
    message: "The login session could not be decoded.",
  };
}

export function validateSubscriptionToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TokenValidationResult {
  let payload: JwtPayload;
  try {
    payload = decodeJwtPayload(token);
  } catch {
    return {
      ok: false,
      code: "malformed_jwt",
      message: "The subscription token is not a valid JWT.",
    };
  }

  if (!Number.isFinite(payload.exp)) {
    return {
      ok: false,
      code: "malformed_jwt",
      message: "The subscription token has no usable expiry.",
    };
  }

  const expiresInSeconds = Math.floor(payload.exp - nowSeconds);
  if (expiresInSeconds <= 0) {
    return {
      ok: false,
      code: "expired",
      message: "The subscription token has expired.",
    };
  }

  return {
    ok: true,
    token,
    bearerValue: buildBearerValue(token),
    authorizationHeader: buildAuthorizationHeader(token),
    expiresAtIso: new Date(payload.exp * 1000).toISOString(),
    expiresInSeconds,
    nearExpiry: expiresInSeconds <= NEAR_EXPIRY_SECONDS,
    payload,
  };
}

export function resolveSubscriptionToken(
  rawValue: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TokenValidationResult {
  const extracted = extractSubscriptionToken(rawValue);
  if (!extracted.ok) {
    return extracted;
  }
  return validateSubscriptionToken(extracted.token, nowSeconds);
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseJson(value: string):
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
    } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
}

function findSubscriptionToken(value: unknown, depth = 0): string | null {
  if (depth > 5 || !isJsonObject(value)) {
    return null;
  }

  const directToken = value.subscriptionToken;
  if (typeof directToken === "string" && directToken.trim()) {
    return directToken.trim();
  }

  const data = value.data;
  if (isJsonObject(data)) {
    const token = data.subscriptionToken;
    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  }

  for (const child of Object.values(value)) {
    const token = findSubscriptionToken(child, depth + 1);
    if (token) {
      return token;
    }
  }

  return null;
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("Malformed JWT");
  }

  const decoded = decodeBase64Url(parts[1]);
  const parsed = JSON.parse(decoded) as unknown;
  if (!isJsonObject(parsed) || typeof parsed.exp !== "number") {
    throw new Error("Malformed JWT payload");
  }

  return parsed as JwtPayload;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const remainder = normalized.length % 4;
  if (remainder === 1) {
    throw new Error("Invalid base64url value");
  }

  const padded = normalized.padEnd(
    normalized.length + ((4 - remainder) % 4),
    "=",
  );
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function looksLikeJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
