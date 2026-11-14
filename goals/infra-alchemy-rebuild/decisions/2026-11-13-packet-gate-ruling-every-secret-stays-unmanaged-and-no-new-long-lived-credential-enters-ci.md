---
title: "Packet gate ruling: every secret stays unmanaged and no new long-lived credential enters CI"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-github"
reversal: "A later decision names the secrets to manage and the delivery route the gate approves."
---

Ruling by the packet gate session, 2026-11-13, on the open question about secret delivery. All repository and environment secrets stay unmanaged on day one. No 1Password service-account token, and no other new long-lived credential, goes into CI for this stack. The README of `@beep/infra-github` keeps the table of secret names with and without a value source; a later decision works from it.

Amended by `2026-11-14-packet-gate-ruling-the-infra-github-app-key-is-the-one-credential-that-enters-ci.md`: the secret-value ruling above stands, and the `beep-infra-github` App's private key, an environment secret on `infra-github-prod` that only the token-mint step reads, is the one credential that enters CI for this stack.
