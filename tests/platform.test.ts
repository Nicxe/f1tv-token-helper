import { describe, expect, it } from "vitest";

import {
  FORMULA1_HOST_PATTERNS,
  type PermissionsLike,
  containerStoreId,
  cookieStoreIdsForTab,
  describeSiteAccess,
  findHomeAssistantTab,
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
const BEFORE_EXPIRY = Date.parse("2026-05-03T11:50:00Z");

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
    expect(requiredSiteAccess(PAIRING, false, BEFORE_EXPIRY)).toEqual([]);
  });

  it("asks for Formula 1 only without a pairing", () => {
    expect(requiredSiteAccess(null, true)).toEqual(FORMULA1_HOST_PATTERNS);
  });

  it("adds the Home Assistant host once paired", () => {
    expect(requiredSiteAccess(PAIRING, true, BEFORE_EXPIRY)).toEqual([
      ...FORMULA1_HOST_PATTERNS,
      "http://192.168.1.10/*",
    ]);
  });

  it("stops asking for the Home Assistant host once the pairing expired", () => {
    expect(
      requiredSiteAccess(PAIRING, true, Date.parse("2026-05-03T12:00:01Z")),
    ).toEqual(FORMULA1_HOST_PATTERNS);
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
      findMissingOrigins(
        permissions,
        requiredSiteAccess(PAIRING, true, BEFORE_EXPIRY),
      ),
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

  it("checks the container of the active tab before the default store", () => {
    expect(
      cookieStoreIdsForTab({ cookieStoreId: "firefox-container-2" }),
    ).toEqual(["firefox-container-2", undefined]);
  });

  it("only reports real containers for opening the sign-in tab", () => {
    expect(containerStoreId(null)).toBeUndefined();
    expect(containerStoreId({ cookieStoreId: "firefox-default" })).toBe(
      undefined,
    );
    expect(containerStoreId({ cookieStoreId: "firefox-container-2" })).toBe(
      "firefox-container-2",
    );
  });
});

describe("Home Assistant tab after sending", () => {
  const tabs = [
    { id: 1, url: "http://192.168.1.10:9000/portainer" },
    { id: 2, url: "http://192.168.1.10:8123/config/integrations" },
  ];

  it("ignores other services on the same host in Firefox", () => {
    expect(findHomeAssistantTab(tabs, CALLBACK, true)).toEqual(tabs[1]);
  });

  it("returns nothing when only other ports are open", () => {
    expect(findHomeAssistantTab([tabs[0]], CALLBACK, true)).toBeUndefined();
  });

  it("matches default ports and skips tabs without a URL", () => {
    const callback = "https://ha.example.com/api/f1_sensor/auth/f1tv/callback";
    expect(
      findHomeAssistantTab(
        [{ id: 3 }, { id: 4, url: "https://ha.example.com:443/lovelace" }],
        callback,
        true,
      ),
    ).toEqual({ id: 4, url: "https://ha.example.com:443/lovelace" });
  });

  it("keeps the first matching tab on Chrome", () => {
    expect(findHomeAssistantTab(tabs, CALLBACK, false)).toEqual(tabs[0]);
  });
});
