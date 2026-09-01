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

const HOME_ASSISTANT_CALLBACK_PATH = "/api/f1_sensor/auth/f1tv/callback";

function isLocalCallbackHostname(hostname: string): boolean {
  const normalized = hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".local")) {
    return true;
  }

  const octets = normalized.split(".").map(Number);
  if (
    octets.length === 4 &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    )
  ) {
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  return (
    normalized === "::1" ||
    /^f[cd][0-9a-f]{2}:/i.test(normalized) ||
    /^fe[89ab][0-9a-f]:/i.test(normalized)
  );
}

function isSafeCallbackUrl(callback: URL): boolean {
  if (
    callback.pathname !== HOME_ASSISTANT_CALLBACK_PATH ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash
  ) {
    return false;
  }
  if (callback.protocol === "https:") {
    return true;
  }
  return (
    callback.protocol === "http:" && isLocalCallbackHostname(callback.hostname)
  );
}

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
    if (!isSafeCallbackUrl(callback)) {
      return {
        ok: false,
        message:
          "The Home Assistant callback must use HTTPS, or HTTP on a local network, and match the F1 Sensor pairing path.",
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
