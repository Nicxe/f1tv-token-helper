import {
  type PairingConfig,
  callbackOriginPattern,
  isPairingExpired,
} from "./pairing.js";

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

export type TabLike = {
  id?: number;
  url?: string;
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
  nowMs = Date.now(),
): string[] {
  if (!firefox) {
    return [];
  }
  return pairing && !isPairingExpired(pairing, nowMs)
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

// The permission pattern covers every port on the host, so pick the tab whose
// origin, port included, is the Home Assistant that issued the pairing.
export function findHomeAssistantTab<T extends TabLike>(
  tabs: T[],
  callbackUrl: string,
  firefox: boolean,
): T | undefined {
  if (!firefox) {
    return tabs.find((candidate) => candidate.id);
  }
  const origin = new URL(callbackUrl).origin;
  return tabs.find(
    (candidate) =>
      candidate.id && candidate.url && originOf(candidate.url) === origin,
  );
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function containerStoreId(
  tab: TabWithCookieStore | null,
): string | undefined {
  const storeId = tab?.cookieStoreId;
  return storeId && storeId !== FIREFOX_DEFAULT_COOKIE_STORE
    ? storeId
    : undefined;
}

// Containers in Firefox keep their own cookies. Look in the container of the
// tab the user is on first, then in the default store (undefined).
export function cookieStoreIdsForTab(
  tab: TabWithCookieStore | null,
): (string | undefined)[] {
  const storeId = containerStoreId(tab);
  return storeId ? [storeId, undefined] : [undefined];
}
