import { describe, expect, it } from "vitest";

import {
  buildAuthorizationHeader,
  buildBearerValue,
  extractSubscriptionToken,
  resolveSubscriptionToken,
  validateSubscriptionToken,
} from "../src/token";

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
