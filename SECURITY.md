# Security

This repository is public. Do not commit secrets, tokens, credentials, or
plaintext API keys. Prefer `op://…` references and `op run`. Pre-commit
gitleaks is required; do not disable it to land a change.

## Report a vulnerability

Use GitHub's private vulnerability reporting on
[beep-effect/beep-effect](https://github.com/beep-effect/beep-effect/security/advisories/new).
Do not open a public issue for an unfixed vulnerability.

## What we will not treat as a vuln report

- Findings that require committing a secret to reproduce.
- Unauthenticated scans of private or client matter data (there is none in
  this tree by policy).
- Dependency noise already tracked in `osv-scanner.toml` with a dated ignore.
