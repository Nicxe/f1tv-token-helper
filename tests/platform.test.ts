import { describe, expect, it } from "vitest";

import {
  FORMULA1_HOST_PATTERNS,
  type PermissionsLike,
  cookieStoreIdsForTab,
  describeSiteAccess,
  findMissingOrigins,
  homeAssistantPermissionPattern,
  isFirefoxExtensionUrl,
  requiredSiteAccess,
} from "../src/platform";

const CALLBACK = "http://192.168.1.10:8123/api/f1_sensor/auth/f1tv/callback";
const PAIRING = {
  callbackUrl: CALLBACK,
  sessionId: "session",
  nonce: "nonce",
  expiresAtIso: "2026-05-03T12:00:00Z",
};

describe("browser detection", () => {
  it("recognises Firefox extension pages", () => {
    expect(isFirefoxExtensionUrl("moz-extension://abc/popup.html")).toBe(true);
    expect(isFirefoxExtensionUrl("chrome-extension://abc/popup.html")).toBe(
      false,
    );
  });
});

describe("Home Assistant permission pattern", () => {
  it("keeps the exact origin pattern on Chrome", () => {
    expect(homeAssistantPermissionPattern(CALLBACK, false)).toBe(
      "http://192.168.1.10:8123/*",
    );
  });

  it("drops the port on Firefox", () => {
    expect(homeAssistantPermissionPattern(CALLBACK, true)).toBe(
      "http://192.168.1.10/*",
    );
    expect(
      homeAssistantPermissionPattern(
        "https://ha.example.com/api/f1_sensor/auth/f1tv/callback",
        true,
      ),
    ).toBe("https://ha.example.com/*");
    expect(
      homeAssistantPermissionPattern(
        "http://[fd12::1]:8123/api/f1_sensor/auth/f1tv/callback",
        true,
      ),
    ).toBe("http://[fd12::1]/*");
  });
});

describe("required site access", () => {
  it("asks for nothing on Chrome", () => {
    expect(requiredSiteAccess(PAIRING, false)).toEqual([]);
  });

  it("asks for Formula 1 only without a pairing", () => {
    expect(requiredSiteAccess(null, true)).toEqual(FORMULA1_HOST_PATTERNS);
  });

  it("adds the Home Assistant host once paired", () => {
    expect(requiredSiteAccess(PAIRING, true)).toEqual([
      ...FORMULA1_HOST_PATTERNS,
      "http://192.168.1.10/*",
    ]);
  });
});

describe("missing origins", () => {
  it("returns only origins that are not granted", async () => {
    const granted = new Set(["https://formula1.com/*"]);
    const permissions: PermissionsLike = {
      contains: ({ origins }, callback) =>
        callback(origins.every((origin) => granted.has(origin))),
    };

    await expect(
      findMissingOrigins(permissions, requiredSiteAccess(PAIRING, true)),
    ).resolves.toEqual(["https://*.formula1.com/*", "http://192.168.1.10/*"]);
  });

  it("treats a throwing permissions API as missing access", async () => {
    const permissions: PermissionsLike = {
      contains: () => {
        throw new Error("Invalid pattern");
      },
    };

    await expect(
      findMissingOrigins(permissions, ["http://ha.local/*"]),
    ).resolves.toEqual(["http://ha.local/*"]);
  });

  it("reports nothing missing when all access is granted", async () => {
    const permissions: PermissionsLike = {
      contains: (_, callback) => callback(true),
    };

    await expect(
      findMissingOrigins(permissions, FORMULA1_HOST_PATTERNS),
    ).resolves.toEqual([]);
  });
});

describe("site access labels", () => {
  it("describes Formula 1 once and names the Home Assistant host", () => {
    expect(
      describeSiteAccess([...FORMULA1_HOST_PATTERNS, "http://192.168.1.10/*"]),
    ).toEqual([
      "Formula 1 (formula1.com) to read your sign-in",
      "Home Assistant (http://192.168.1.10) to send the token",
    ]);
  });
});

describe("cookie stores", () => {
  it("uses only the default store outside containers", () => {
    expect(cookieStoreIdsForTab(null)).toEqual([undefined]);
    expect(cookieStoreIdsForTab({})).toEqual([undefined]);
    expect(cookieStoreIdsForTab({ cookieStoreId: "firefox-default" })).toEqual([
      undefined,
    ]);
  });

  it("adds the container store of the active tab", () => {
    expect(
      cookieStoreIdsForTab({ cookieStoreId: "firefox-container-2" }),
    ).toEqual([undefined, "firefox-container-2"]);
  });
});
