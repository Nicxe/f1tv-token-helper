import {
  type TokenValidationResult,
  resolveSubscriptionToken,
} from "./token.js";

type TokenCandidate = {
  label: string;
  value: string;
};

const SIGN_IN_URL = "https://account.formula1.com/";
const COOKIE_NAME = "login-session";
const COOKIE_URLS = [
  "https://account.formula1.com/",
  "https://www.formula1.com/",
  "https://f1tv.formula1.com/",
];

const fetchButton = getElement<HTMLButtonElement>("fetch-token");
const signInButton = getElement<HTMLButtonElement>("open-signin");
const copyButton = getElement<HTMLButtonElement>("copy-header");
const downloadButton = getElement<HTMLButtonElement>("download-header");
const revealButton = getElement<HTMLButtonElement>("reveal-header");
const clearButton = getElement<HTMLButtonElement>("clear-token");
const statusElement = getElement<HTMLElement>("status");
const detailElement = getElement<HTMLElement>("status-detail");
const expiryElement = getElement<HTMLElement>("expiry");
const productElement = getElement<HTMLElement>("product");
const sourceElement = getElement<HTMLElement>("source");
const headerOutput = getElement<HTMLTextAreaElement>("header-output");

let currentToken: Extract<TokenValidationResult, { ok: true }> | null = null;
let currentSource = "";
let headerVisible = false;

render();

signInButton.addEventListener("click", () => {
  chrome.tabs.create({ url: SIGN_IN_URL });
});

fetchButton.addEventListener("click", () => {
  void fetchToken();
});

copyButton.addEventListener("click", () => {
  void copyHeaderValue();
});

downloadButton.addEventListener("click", () => {
  downloadHeader();
});

revealButton.addEventListener("click", () => {
  headerVisible = !headerVisible;
  render();
});

clearButton.addEventListener("click", () => {
  currentToken = null;
  currentSource = "";
  headerVisible = false;
  render();
});

async function fetchToken(): Promise<void> {
  setBusy(true);
  setStatus("Scanning", "Checking the local Formula 1 browser session.");

  const candidates = [
    ...(await getCookieCandidates()),
    ...(await getActiveTabCandidates()),
  ];

  const result = chooseToken(candidates);
  if (result.validation.ok) {
    currentToken = result.validation;
    currentSource = result.source;
    headerVisible = false;
  } else {
    currentToken = null;
    currentSource = "";
    setStatus("No token", result.validation.message);
  }

  setBusy(false);
  render(result.validation.ok ? undefined : result.validation);
}

function chooseToken(candidates: TokenCandidate[]): {
  validation: TokenValidationResult;
  source: string;
} {
  let firstFailure: TokenValidationResult | null = null;
  let expiredFailure: TokenValidationResult | null = null;

  for (const candidate of candidates) {
    const validation = resolveSubscriptionToken(candidate.value);
    if (validation.ok) {
      return { validation, source: candidate.label };
    }
    firstFailure ??= validation;
    if (validation.code === "expired") {
      expiredFailure = validation;
    }
  }

  return {
    validation: expiredFailure ??
      firstFailure ?? {
        ok: false,
        code: "empty",
        message: "No Formula 1 login session was found.",
      },
    source: "",
  };
}

async function getCookieCandidates(): Promise<TokenCandidate[]> {
  const candidates: TokenCandidate[] = [];

  for (const url of COOKIE_URLS) {
    const cookie = await getCookie(url, COOKIE_NAME);
    if (cookie?.value) {
      candidates.push({
        label: new URL(url).hostname,
        value: cookie.value,
      });
    }
  }

  return candidates;
}

function getCookie(
  url: string,
  name: string,
): Promise<chrome.cookies.Cookie | null> {
  return new Promise((resolve) => {
    chrome.cookies.get({ name, url }, (cookie) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(cookie ?? null);
    });
  });
}

async function getActiveTabCandidates(): Promise<TokenCandidate[]> {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url || !isFormulaUrl(tab.url)) {
    return [];
  }
  const tabId = tab.id;
  const tabUrl = tab.url;

  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: collectSessionCandidatesFromPage,
      },
      (results) => {
        if (chrome.runtime.lastError || !Array.isArray(results)) {
          resolve([]);
          return;
        }

        const values = results.flatMap((result) =>
          Array.isArray(result.result) ? result.result : [],
        );
        resolve(
          values.map((value) => ({
            label: `${new URL(tabUrl).hostname} active tab`,
            value,
          })),
        );
      },
    );
  });
}

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(tabs[0] ?? null);
    });
  });
}

function collectSessionCandidatesFromPage(): string[] {
  const values: string[] = [];
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("login-session="));

  if (cookie) {
    values.push(cookie.slice("login-session=".length));
  }

  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) {
        continue;
      }

      const value = storage.getItem(key);
      if (
        value &&
        (key.toLowerCase().includes("session") ||
          key.toLowerCase().includes("token") ||
          value.includes("subscriptionToken"))
      ) {
        values.push(value);
      }
    }
  }

  return values;
}

function isFormulaUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "formula1.com" || hostname.endsWith(".formula1.com");
  } catch {
    return false;
  }
}

async function copyHeaderValue(): Promise<void> {
  if (!currentToken) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentToken.bearerValue);
    setStatus("Copied", "Paste the copied Bearer value into F1 Sensor.");
  } catch {
    copyWithFallback(currentToken.bearerValue);
    setStatus("Copied", "Paste the copied Bearer value into F1 Sensor.");
  }
}

function copyWithFallback(value: string): void {
  const element = document.createElement("textarea");
  element.value = value;
  element.setAttribute("readonly", "true");
  element.style.position = "fixed";
  element.style.opacity = "0";
  document.body.append(element);
  element.select();
  document.execCommand("copy");
  element.remove();
}

function downloadHeader(): void {
  if (!currentToken) {
    return;
  }

  const blob = new Blob([currentToken.authorizationHeader], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "f1tv-authorization-header.txt";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded", "TXT export contains the full Authorization header.");
}

function render(error?: Extract<TokenValidationResult, { ok: false }>): void {
  const token = currentToken;
  const hasToken = token !== null;

  copyButton.disabled = !hasToken;
  downloadButton.disabled = !hasToken;
  revealButton.disabled = !hasToken;
  clearButton.disabled = !hasToken && !error;

  if (hasToken) {
    const expiry = new Date(token.expiresAtIso);
    const status = token.nearExpiry ? "Expires soon" : "Ready";
    const detail = token.nearExpiry
      ? "Refresh your F1TV session soon."
      : "Manual export is available.";

    setStatus(status, detail);
    expiryElement.textContent = expiry.toLocaleString();
    productElement.textContent = formatClaim(token.payload.SubscribedProduct);
    sourceElement.textContent = currentSource || "Formula 1 session";
    headerOutput.value = headerVisible
      ? token.authorizationHeader
      : maskHeader(token.authorizationHeader);
    revealButton.textContent = headerVisible ? "Hide" : "Show";
    return;
  }

  if (!error) {
    setStatus("Idle", "No token loaded.");
  }

  expiryElement.textContent = "-";
  productElement.textContent = "-";
  sourceElement.textContent = "-";
  headerOutput.value = "";
  revealButton.textContent = "Show";
}

function setStatus(status: string, detail: string): void {
  statusElement.textContent = status;
  detailElement.textContent = detail;
}

function setBusy(isBusy: boolean): void {
  fetchButton.disabled = isBusy;
  fetchButton.textContent = isBusy ? "Scanning" : "Fetch";
}

function maskHeader(header: string): string {
  const visibleStart = header.slice(0, 32);
  const visibleEnd = header.slice(-12);
  return `${visibleStart}...${visibleEnd}`;
}

function formatClaim(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "-";
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}
