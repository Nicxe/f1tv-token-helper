import { describe, expect, it } from "vitest";

import {
  buildAuthorizationHeader,
  buildBearerValue,
  extractSubscriptionToken,
  resolveSubscriptionToken,
  validateSubscriptionToken,
} from "../src/token";
import {
  callbackOriginPattern,
  isPairingExpired,
  parsePairingUrl,
} from "../src/pairing";

const NOW = 1_800_000_000;

describe("token extraction", () => {
  it("extracts a subscription token from a URL-encoded login session", () => {
    const token = makeJwt({ exp: NOW + 3600 });
    const session = encodeURIComponent(
      JSON.stringify({ data: { subscriptionToken: token } }),
    );

    expect(extractSubscriptionToken(session)).toEqual({
      ok: true,
      token,
    });
  });

  it("reports a missing subscription token", () => {
    const session = encodeURIComponent(JSON.stringify({ data: {} }));

    expect(extractSubscriptionToken(session)).toMatchObject({
      ok: false,
      code: "missing_subscription_token",
    });
  });

  it("reports a malformed login session", () => {
    expect(extractSubscriptionToken("%7Bnot-json")).toMatchObject({
      ok: false,
      code: "invalid_login_session",
    });
  });
});

describe("token validation", () => {
  it("builds the HA value and full Authorization header for a valid token", () => {
    const token = makeJwt({
      exp: NOW + 3600,
      SubscriptionStatus: "ACTIVE",
      SubscribedProduct: "F1TV Pro",
    });

    const result = validateSubscriptionToken(token, NOW);

    expect(result).toMatchObject({
      ok: true,
      token,
      bearerValue: buildBearerValue(token),
      authorizationHeader: buildAuthorizationHeader(token),
      nearExpiry: false,
    });
  });

  it("rejects malformed JWT values", () => {
    expect(validateSubscriptionToken("not.a.jwt", NOW)).toMatchObject({
      ok: false,
      code: "malformed_jwt",
    });
  });

  it("rejects expired JWT values", () => {
    const token = makeJwt({ exp: NOW - 1 });

    expect(validateSubscriptionToken(token, NOW)).toMatchObject({
      ok: false,
      code: "expired",
    });
  });

  it("marks near-expiry JWT values without rejecting them", () => {
    const token = makeJwt({ exp: NOW + 300 });

    expect(validateSubscriptionToken(token, NOW)).toMatchObject({
      ok: true,
      nearExpiry: true,
      expiresInSeconds: 300,
    });
  });

  it("resolves an encoded login session into exportable header values", () => {
    const token = makeJwt({ exp: NOW + 3600 });
    const session = encodeURIComponent(
      JSON.stringify({ data: { subscriptionToken: token } }),
    );

    expect(resolveSubscriptionToken(session, NOW)).toMatchObject({
      ok: true,
      bearerValue: `Bearer ${token}`,
      authorizationHeader: `Authorization: Bearer ${token}`,
    });
  });
});

describe("Home Assistant pairing", () => {
  it("parses a Home Assistant pairing link", () => {
    const result = parsePairingUrl(
      "https://example.com/helper?callback_url=http%3A%2F%2Fha.local%3A8123%2Fapi%2Ff1_sensor%2Fauth%2Ff1tv%2Fcallback&session_id=session&nonce=nonce&expires_at=2026-05-03T12%3A00%3A00Z",
    );

    expect(result).toEqual({
      ok: true,
      config: {
        callbackUrl: "http://ha.local:8123/api/f1_sensor/auth/f1tv/callback",
        sessionId: "session",
        nonce: "nonce",
        expiresAtIso: "2026-05-03T12:00:00Z",
      },
    });
  });

  it("rejects pairing links without required details", () => {
    expect(parsePairingUrl("https://example.com/helper")).toMatchObject({
      ok: false,
    });
  });

  it("rejects public HTTP and malformed Home Assistant callback URLs", () => {
    const pairingLink = (callbackUrl: string) =>
      `https://example.com/helper?callback_url=${encodeURIComponent(callbackUrl)}&session_id=session&nonce=nonce&expires_at=2026-05-03T12%3A00%3A00Z`;

    expect(
      parsePairingUrl(
        pairingLink("http://ha.example.com/api/f1_sensor/auth/f1tv/callback"),
      ),
    ).toMatchObject({ ok: false });
    expect(
      parsePairingUrl(pairingLink("https://ha.example.com/api/other")),
    ).toMatchObject({ ok: false });
    expect(
      parsePairingUrl(
        pairingLink(
          "https://user:password@ha.example.com/api/f1_sensor/auth/f1tv/callback",
        ),
      ),
    ).toMatchObject({ ok: false });
    expect(
      parsePairingUrl(
        pairingLink(
          "https://ha.example.com/api/f1_sensor/auth/f1tv/callback?token=secret",
        ),
      ),
    ).toMatchObject({ ok: false });
  });

  it("allows local HTTP Home Assistant callback URLs", () => {
    const pairingLink = (callbackUrl: string) =>
      `https://example.com/helper?callback_url=${encodeURIComponent(callbackUrl)}&session_id=session&nonce=nonce&expires_at=2026-05-03T12%3A00%3A00Z`;

    for (const callbackUrl of [
      "http://localhost:8123/api/f1_sensor/auth/f1tv/callback",
      "http://ha.local:8123/api/f1_sensor/auth/f1tv/callback",
      "http://192.168.1.10:8123/api/f1_sensor/auth/f1tv/callback",
      "http://[fd12::1]:8123/api/f1_sensor/auth/f1tv/callback",
    ]) {
      expect(parsePairingUrl(pairingLink(callbackUrl))).toMatchObject({
        ok: true,
      });
    }
  });

  it("detects expired pairing sessions", () => {
    const config = {
      callbackUrl: "http://ha.local:8123/api/f1_sensor/auth/f1tv/callback",
      sessionId: "session",
      nonce: "nonce",
      expiresAtIso: "2026-05-03T12:00:00Z",
    };

    expect(isPairingExpired(config, Date.parse("2026-05-03T12:00:01Z"))).toBe(
      true,
    );
    expect(isPairingExpired(config, Date.parse("2026-05-03T11:59:59Z"))).toBe(
      false,
    );
  });

  it("builds an optional host permission origin for Home Assistant", () => {
    expect(
      callbackOriginPattern(
        "https://ha.example.com/api/f1_sensor/auth/f1tv/callback",
      ),
    ).toBe("https://ha.example.com/*");
  });
});

function makeJwt(payload: Record<string, unknown>): string {
  const header = { alg: "RS256", typ: "JWT" };
  return `${base64Url(header)}.${base64Url(payload)}.signature`;
}

function base64Url(value: Record<string, unknown>): string {
  return btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
