import {
  type TokenValidationResult,
  resolveSubscriptionToken,
} from "./token.js";
import {
  type PairingConfig,
  callbackOriginPattern,
  isPairingExpired,
  parsePairingUrl,
} from "./pairing.js";

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
const connectButton = getElement<HTMLButtonElement>("connect-ha");
const sendButton = getElement<HTMLButtonElement>("send-token");
const copyButton = getElement<HTMLButtonElement>("copy-header");
const downloadButton = getElement<HTMLButtonElement>("download-header");
const revealButton = getElement<HTMLButtonElement>("reveal-header");
const clearButton = getElement<HTMLButtonElement>("clear-token");
const clearPairingButton = getElement<HTMLButtonElement>("clear-pairing");
const statusElement = getElement<HTMLElement>("status");
const detailElement = getElement<HTMLElement>("status-detail");
const pairingInput = getElement<HTMLTextAreaElement>("pairing-input");
const haTargetElement = getElement<HTMLElement>("ha-target");
const pairingExpiryElement = getElement<HTMLElement>("pairing-expiry");
const expiryElement = getElement<HTMLElement>("expiry");
const productElement = getElement<HTMLElement>("product");
const sourceElement = getElement<HTMLElement>("source");
const headerOutput = getElement<HTMLTextAreaElement>("header-output");

let currentToken: Extract<TokenValidationResult, { ok: true }> | null = null;
let currentSource = "";
let headerVisible = false;
let pairingConfig: PairingConfig | null = loadPairingFromLocation();

render();
void loadPairingFromActiveTab();

signInButton.addEventListener("click", () => {
  chrome.tabs.create({ url: SIGN_IN_URL });
});

fetchButton.addEventListener("click", () => {
  void fetchToken();
});

connectButton.addEventListener("click", () => {
  connectPairing();
});

sendButton.addEventListener("click", () => {
  void sendTokenToHomeAssistant();
});

pairingInput.addEventListener("input", () => {
  render();
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

clearPairingButton.addEventListener("click", () => {
  pairingConfig = null;
  pairingInput.value = "";
  render();
});

function loadPairingFromLocation(): PairingConfig | null {
  const result = parsePairingUrl(globalThis.location.href);
  return result.ok ? result.config : null;
}

async function loadPairingFromActiveTab(): Promise<void> {
  if (pairingConfig) {
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.url) {
    return;
  }

  const result = parsePairingUrl(tab.url);
  if (!result.ok) {
    return;
  }

  pairingConfig = result.config;
  pairingInput.value = tab.url;
  setStatus("Connected", "Home Assistant pairing is ready.");
  render();
}

async function fetchToken(): Promise<boolean> {
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
  return result.validation.ok;
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

function connectPairing(): void {
  const result = parsePairingUrl(pairingInput.value);
  if (!result.ok) {
    setStatus("Pairing needed", result.message);
    render();
    return;
  }
  pairingConfig = result.config;
  setStatus("Connected", "Home Assistant pairing is ready.");
  render();
}

async function sendTokenToHomeAssistant(): Promise<void> {
  const pairing = pairingConfig;
  if (!pairing) {
    setStatus("Pairing needed", "Paste the pairing link from Home Assistant.");
    render();
    return;
  }
  if (isPairingExpired(pairing)) {
    setStatus("Expired", "Start a new pairing session in Home Assistant.");
    render();
    return;
  }

  if (!currentToken && !(await fetchToken())) {
    return;
  }
  if (!currentToken) {
    return;
  }

  const permissionGranted = await requestHomeAssistantPermission(
    pairing.callbackUrl,
  );
  if (!permissionGranted) {
    setStatus("Permission needed", "Allow access to this Home Assistant URL.");
    render();
    return;
  }

  setBusy(true);
  sendButton.disabled = true;
  setStatus("Sending", "Sending the token to Home Assistant.");

  try {
    const response = await fetch(pairing.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: pairing.sessionId,
        nonce: pairing.nonce,
        subscription_token: currentToken.token,
        source: "browser_extension",
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      code?: string;
    } | null;
    if (response.ok && body?.ok) {
      currentToken = null;
      currentSource = "";
      headerVisible = false;
      pairingConfig = null;
      pairingInput.value = "";
      setStatus("Done", "F1TV access was sent to Home Assistant.");
    } else {
      setStatus("Not sent", formatCallbackError(body?.code, response.status));
    }
  } catch {
    setStatus("Unreachable", "Home Assistant could not be reached.");
  } finally {
    setBusy(false);
    render();
  }
}

function requestHomeAssistantPermission(callbackUrl: string): Promise<boolean> {
  const origins = [callbackOriginPattern(callbackUrl)];
  return new Promise((resolve) => {
    chrome.permissions.request({ origins }, (granted) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(granted));
    });
  });
}

function formatCallbackError(code: string | undefined, status: number): string {
  switch (code) {
    case "gate_closed":
      return "F1TV pairing is disabled in this Home Assistant build.";
    case "expired_pairing":
      return "The pairing expired. Start again in Home Assistant.";
    case "invalid_nonce":
      return "Home Assistant rejected this pairing session.";
    case "auth_token_expired":
      return "The F1TV token has expired. Sign in again and retry.";
    case "invalid_auth_header":
    case "malformed_jwt":
      return "The F1TV token could not be validated.";
    default:
      return `Home Assistant rejected the token (${status}).`;
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
  const hasPairing = pairingConfig !== null;

  connectButton.disabled = !pairingInput.value.trim();
  sendButton.disabled = !hasPairing;
  clearPairingButton.disabled = !hasPairing;
  copyButton.disabled = !hasToken;
  downloadButton.disabled = !hasToken;
  revealButton.disabled = !hasToken;
  clearButton.disabled = !hasToken && !error;
  renderPairing();

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
  sendButton.disabled = isBusy || pairingConfig === null;
  sendButton.textContent = isBusy ? "Sending" : "Send to Home Assistant";
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

function renderPairing(): void {
  const pairing = pairingConfig;
  if (!pairing) {
    haTargetElement.textContent = "-";
    pairingExpiryElement.textContent = "-";
    return;
  }
  try {
    haTargetElement.textContent = new URL(pairing.callbackUrl).origin;
  } catch {
    haTargetElement.textContent = "Home Assistant";
  }
  pairingExpiryElement.textContent = new Date(
    pairing.expiresAtIso,
  ).toLocaleString();
}
