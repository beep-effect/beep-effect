---
title: "Vercel.EnvVar gains valueFrom so a secret never enters Alchemy state"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p4-oip-web"
reversal: "Remove valueFrom and valueDigest from @beep/alchemy-vercel EnvVar and pass secrets as value again, accepting plain text in the KMS-encrypted state bucket."
---

Accepted by the packet gate session, 2026-11-14; the PR body says it changes a merged library and why. Alchemy writes a `Redacted` prop as `{ "__redacted__": <plain text> }` in state (`alchemy/src/State/StateEncoding.ts`), so `EnvVar.value` put any secret in the state bucket in clear JSON, protected only by SSE-KMS at rest. `EnvVarProps` now takes exactly one of `value` (non-secret) and `valueFrom: { config }`; the provider reads the config key inside `diff` and `reconcile` (`Config.Redacted`), sends it only to Vercel, and stores `valueDigest` (SHA-256 hex, `effect/crypto/Digest`) so a rotated value plans an update. Neither or both fails with `EnvVarValueMissing`. Package tests prove the secret is absent from persisted state, that a literal `value` is present (the control), and that rotation is detected. The digest is unsalted: fine for a high-entropy token, guessable for a short value. The OipWeb stack uses `valueFrom` for `CRM_HUBSPOT_SERVICE_KEY`.
