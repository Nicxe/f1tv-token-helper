import { type PairingConfig, callbackOriginPattern } from "./pairing.js";

export const FORMULA1_HOST_PATTERNS = [
  "https://formula1.com/*",
  "https://*.formula1.com/*",
];

const FIREFOX_DEFAULT_COOKIE_STORE = "firefox-default";

export type PermissionsLike = {
  contains(
    permissions: { origins: string[] },
    callback: (result: boolean) => void,
  ): void;
};

export type TabWithCookieStore = {
  cookieStoreId?: string;
};

export function isFirefoxExtensionUrl(url: string): boolean {
  return url.startsWith("moz-extension://");
}

// Gecko accepts a match pattern with a port but then matches nothing, so the
// Home Assistant default http://host:8123 would never be reachable. A pattern
// without a port matches every port. Chrome keeps its exact origin pattern.
export function homeAssistantPermissionPattern(
  callbackUrl: string,
  firefox: boolean,
): string {
  if (!firefox) {
    return callbackOriginPattern(callbackUrl);
  }
  const url = new URL(callbackUrl);
  return `${url.protocol}//${url.hostname}/*`;
}

export function requiredSiteAccess(
  pairing: PairingConfig | null,
  firefox: boolean,
): string[] {
  if (!firefox) {
    return [];
  }
  return pairing
    ? [
        ...FORMULA1_HOST_PATTERNS,
        homeAssistantPermissionPattern(pairing.callbackUrl, true),
      ]
    : [...FORMULA1_HOST_PATTERNS];
}

export async function findMissingOrigins(
  permissions: PermissionsLike,
  origins: string[],
): Promise<string[]> {
  const checks = await Promise.all(
    origins.map(
      (origin) =>
        new Promise<boolean>((resolve) => {
          try {
            permissions.contains({ origins: [origin] }, (result) => {
              resolve(Boolean(result));
            });
          } catch {
            resolve(false);
          }
        }),
    ),
  );
  return origins.filter((_, index) => !checks[index]);
}

export function isFormula1Pattern(pattern: string): boolean {
  return FORMULA1_HOST_PATTERNS.includes(pattern);
}

export function describeSiteAccess(origins: string[]): string[] {
  const labels = origins.map((origin) =>
    isFormula1Pattern(origin)
      ? "Formula 1 (formula1.com) to read your sign-in"
      : `Home Assistant (${origin.replace(/\/\*$/, "")}) to send the token`,
  );
  return [...new Set(labels)];
}

// Containers in Firefox keep their own cookies, so also look in the store of
// the tab the user is on. undefined means the browser default store.
export function cookieStoreIdsForTab(
  tab: TabWithCookieStore | null,
): (string | undefined)[] {
  const storeId = tab?.cookieStoreId;
  if (!storeId || storeId === FIREFOX_DEFAULT_COOKIE_STORE) {
    return [undefined];
  }
  return [undefined, storeId];
}
