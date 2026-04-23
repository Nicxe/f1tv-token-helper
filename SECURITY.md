# Security Policy

## Sensitive data

F1TV subscription tokens and Authorization headers are secrets. Do not include them in issues, logs, screenshots, pull requests, or test fixtures.

The extension is designed to keep tokens in popup memory only. It must not persist tokens with `chrome.storage`, `localStorage`, `sessionStorage`, IndexedDB, files, telemetry, analytics, or network calls.

## Reporting a vulnerability

Report security issues privately to the repository owner. Include a short reproduction, affected version or commit, and the expected impact.

Do not open a public issue for token leakage, broad host permission regressions, unintended network transmission, or cookie access outside the allowlisted Formula 1 domains.
