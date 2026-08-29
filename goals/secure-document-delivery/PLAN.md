# Secure Document Delivery Plan

## Status

Status: `pending` — P0 security and packaged-runtime spikes are next.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Threat model and packaged-keyring spikes | pending | Record assets/actors/abuse cases; prove known-answer, tamper, AAD/version/auth failure and rotation; prove packaged Windows/macOS/Linux custody behavior; settle webview HTTP and Range/HEAD policy. | Envelope/custody/serve contracts are reviewable; the first adapter is accepted or rejected with evidence; unresolved security behavior blocks P1. |
| P1 Implement | pending | Add the incubated capability, typed ports/errors/schemas, PGlite migration/binding, custody adapter, product-reference adapters, and separate authenticated sidecar route for one USPTO fixture. | One authorized fixture traverses mint → seal → gate → serve; denial paths fail closed and no prohibited data persists. |
| P2 Verify | pending | Run envelope, custody, identical-404, expiry/revocation, route/auth/header, streaming/cancellation, Range/HEAD, restart/migration, focused package/app, and repo proof. | Every `SPEC.md` acceptance item is green or a reproducible blocker is archived without weakening the contract. |
| P3 Close | pending | Drive the PR to mergeable through Yeet, write the closeout reflection, archive non-secret proof, and synchronize packet state. | Yeet/GitHub reports mergeable; reflection lint passes; README, PLAN, and manifest match evidence. |

## P0 Spike Contract

- Threat model token theft, local unprivileged callers, Host/origin confusion,
  session rollover, database theft, ciphertext substitution, stale keys,
  keyring loss/lock, oversized/range requests, cancellation, and restart.
- Produce deterministic known-answer vectors and mutation cases for ciphertext,
  version, algorithm, key id, nonce, and every AAD field.
- Prove old-key decrypt/new-key encrypt, revoke, delete, unrecoverable key, and
  partial-rotation failure behavior without plaintext fallback.
- Package Windows, macOS, and Linux probes around the generic `IPersistence`
  adapter; do not import `@beep/m365`.
- Choose explicit first-slice Range and HEAD behavior, maximum response bytes,
  cancellation semantics, Host allowlist, session/audience binding, and response
  headers. Verify packaged webviews; custom protocol remains fallback only.

## Blockers

- Live USPTO origin fetch is blocked by the guarded-fetch DNS-rebinding/redirect
  harness in `explorations/ingestion-security-secret-governance`.
- Deterministic fixture-backed implementation and verification may proceed.

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`, covering
   tooling, implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, this plan, and `ops/manifest.json` from final evidence.
4. Confirm Yeet/GitHub mergeability and archive no secret, raw URL, or PDF bytes.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Do not promote the capability before two real importers.
- Keep driver fetch, product authorization/provenance, and consumer TTL/revocation
  UX outside the foundation capability.
- Do not replace fixture proof with credentialed network proof while blocked.

## Verification Commands

```sh
test "$(wc -m < goals/secure-document-delivery/GOAL.md)" -le 4000
jq . goals/secure-document-delivery/ops/manifest.json
rg -n "secure-document-delivery|blockedBy|GOAL.md|agentLaunchers|packetAnchorDocument" goals/secure-document-delivery
git diff --check -- goals/secure-document-delivery explorations/secure-document-download-proxy explorations/ATLAS.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
