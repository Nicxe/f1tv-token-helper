export type PairingConfig = {
  callbackUrl: string;
  sessionId: string;
  nonce: string;
  expiresAtIso: string;
};

export type PairingParseResult =
  | {
      ok: true;
      config: PairingConfig;
    }
  | {
      ok: false;
      message: string;
    };

export function parsePairingUrl(value: string): PairingParseResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: "Enter the Home Assistant pairing link." };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: "The pairing link is not a valid URL." };
  }

  const callbackUrl = url.searchParams.get("callback_url")?.trim() ?? "";
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  const nonce = url.searchParams.get("nonce")?.trim() ?? "";
  const expiresAtIso = url.searchParams.get("expires_at")?.trim() ?? "";

  if (!callbackUrl || !sessionId || !nonce || !expiresAtIso) {
    return {
      ok: false,
      message: "The pairing link is missing required connection details.",
    };
  }

  try {
    const callback = new URL(callbackUrl);
    if (callback.protocol !== "http:" && callback.protocol !== "https:") {
      return {
        ok: false,
        message: "The Home Assistant callback must use HTTP or HTTPS.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "The Home Assistant callback URL is invalid.",
    };
  }

  if (Number.isNaN(new Date(expiresAtIso).getTime())) {
    return { ok: false, message: "The pairing expiry is invalid." };
  }

  return {
    ok: true,
    config: { callbackUrl, sessionId, nonce, expiresAtIso },
  };
}

export function isPairingExpired(
  config: PairingConfig,
  nowMs = Date.now(),
): boolean {
  return new Date(config.expiresAtIso).getTime() <= nowMs;
}

export function callbackOriginPattern(callbackUrl: string): string {
  const url = new URL(callbackUrl);
  return `${url.origin}/*`;
}
