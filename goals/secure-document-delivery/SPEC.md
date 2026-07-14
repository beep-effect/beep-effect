# Secure Document Delivery Spec

## Objective

Deliver a narrow, incubated secure-document-delivery capability that accepts an
already-authorized provider document reference, mints and persists a revocable
opaque mapping, and serves one fixture-backed USPTO/ODP File-Wrapper
office-action PDF through the authenticated professional-desktop sidecar. The
URL, renderer, history, referrer, caches, logs, and mapping envelope expose no
raw origin URL, business identifier, serving key, or persisted PDF bytes.

## Non-Goals

- A generic crypto, capability-URL, signed-URL, or proxy platform.
- Raw-origin-URL persistence, capability input, or generic dereference.
- Provider authorization, provenance, approval, or product workflow ownership.
- Tauri asset protocol or `tauri-plugin-localhost`; custom protocol is fallback only.
- PDF bytes inside encrypted mapping envelopes or a persistent PDF cache.
- Shared codec, keyset, or custody implementation with the credential vault.
- Box, viewer, time-tracking, or additional-origin implementation in this goal.
- Live USPTO fetch before the guarded-fetch DNS-rebinding harness passes.
- `@beep/m365` imports, 1Password recovery, new crypto/keyring dependencies, or
  changes to `goals/INDEX.md`.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/secure-document-download-proxy/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration [`DECISIONS.md`](../../explorations/secure-document-download-proxy/DECISIONS.md),
   [`MAP.md`](../../explorations/secure-document-download-proxy/MAP.md), and
   supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/capability/secure-document-delivery` for document-link
  schemas, typed errors, mint/resolve/revoke contracts, a versioned encrypted
  mapping envelope, and persistence plus `ServingKeyCustody` ports. The package
  is **INCUBATED** until two real importers exist.
- `apps/professional-desktop/server` for the loopback document route, Host and
  session/audience authorization, response policy, bounded streaming, and
  PGlite/OS-custody composition.
- `apps/professional-desktop/src/runtime/Pglite.ts` and `Migrations.ts` for the
  existing catalog-0.5.4 PGlite/Drizzle runtime and boot migration binding.
- `packages/law-practice/server` and `packages/documents/server` for adapters
  from product-authorized references; authorization/provenance remain there.
- `packages/drivers/uspto` for fixture/provider fetch behavior. Live fetch is
  blocked; the capability never fetches a raw URL.
- Focused fixtures, security tests, packet evidence, and documentation.

## Constraints

1. **Appetite proposed at graduation:** one focused goal for the fixture-backed
   USPTO OA vertical and its security gates. Additional origins and viewer
   polish are cuts, not hidden acceptance.
2. The capability receives only an authorized provider reference. Consumers own
   authorization, provenance, purpose, and revocation UX; drivers own provider
   dereference and credential/SSRF policy.
3. Mint a stateful opaque 128–256-bit CSPRNG reference. UUIDv4 is acceptable
   only under a strict-v4 route schema. The URL contains no provider, matter,
   document, user, or expiry data.
4. TTL is consumer-supplied and purpose-bound under a packet-owned maximum. The
   upstream seven-day default is not inherited. `expires_at > now` and
   `revoked_at IS NULL` are authoritative store predicates.
5. The document-specific envelope uses WebCrypto AES-256-GCM, a fresh 96-bit
   nonce, algorithm/envelope version, and key id. AAD binds token id or hash,
   workspace, origin-adapter kind, expiry, and version. Version, AAD, or auth
   mismatch is an explicit typed decode failure. Only the mapping is encrypted.
6. P0 threat-model, known-answer, tamper, AAD/version, and rotation proof gates
   envelope commitment. Technique may follow ai-metrics; codec/keyset sharing
   with ai-metrics or the credential vault is prohibited.
7. The document route is separate from permissive RPC CORS. Require loopback,
   Host validation, active per-launch session bearer, audience authorization,
   and token resolution. Missing, expired, revoked, unauthorized, malformed,
   tampered, wrong-version, and wrong-AAD requests receive the same 404 surface.
8. Every successful response declares `application/pdf`,
   `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, and
   `X-Content-Type-Options: nosniff`, with bounded streaming and cancellation.
   P0 chooses explicit Range/HEAD behavior and proves packaged-webview semantics.
9. `ServingKeyCustody` is narrower than credentials. Its first adapter may use
   installed `@azure/msal-node-extensions` `IPersistence` only after packaged
   Windows/macOS/Linux proof for available/locked/unavailable keyrings,
   rotation, delete, and recovery failure. Persist versioned wrapped keysets and
   key ids; active keys exist in process only as `Redacted`.
10. Use the existing desktop PGlite/Drizzle runtime and boot migrations. No
    bespoke or second store. Mapping rows never contain PDF bytes.
11. Clean-room the HTTP security contract; the patents-mcp-server route source
    remains license-unverified and may not be copied.
12. Live remote proof is blocked until the guarded-fetch lane proves pinned
    connect-time DNS-rebinding and redirect behavior. Routine acceptance stays
    deterministic and network-free.

## Decision Log

The exploration retains full rationale and rejected options.

| Date | Locked decision | Source |
| --- | --- | --- |
| 2026-07-14 | Stand-alone narrow delivery capability; product consumers retain authorization and provenance. | [`Q1`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q1-scope-boundary--locked) |
| 2026-07-14 | Incubated `foundation/capability/secure-document-delivery`, desktop bindings, product adapters, provider fetch in drivers; promote after two importers. | [`Q2`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q2-placement-and-promotion--locked) |
| 2026-07-14 | Fixture-first authorized USPTO OA PDF from the docketing approval spine; no raw URLs; live fetch gated. | [`Q3`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q3-first-slice--locked) |
| 2026-07-14 | Stateful opaque CSPRNG reference; store-authoritative expiry/revocation; purpose-bound TTL with no inherited seven-day default. | [`Q4`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q4-token-model-and-ttl--locked) |
| 2026-07-14 | Versioned document-specific AES-256-GCM envelope with bound AAD and no shared vault codec. | [`Q5`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q5-document-link-cryptography--locked) |
| 2026-07-14 | Separate authenticated sidecar HTTP document route with identical 404, private/no-store, no-referrer, nosniff, and bounded streaming. | [`Q6`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q6-serve-boundary--locked) |
| 2026-07-14 | Narrow custody port; packaged `IPersistence` proof; wrapped versioned keyset and owned rotation/recovery/deletion. | [`Q7`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q7-serving-key-custody--locked) |
| 2026-07-14 | Extend desktop PGlite/Drizzle 0.5.4 runtime with boot migration; no bespoke store. | [`Q8`](../../explorations/secure-document-download-proxy/DECISIONS.md#2026-07-14--q8-backing-store--locked) |

## Acceptance Criteria

- [ ] P0 records the threat model and passes envelope known-answer, tamper,
      wrong-version, wrong-AAD, authentication-failure, and key-rotation spikes.
- [ ] P0 proves or rejects the packaged `@azure/msal-node-extensions` custody
      adapter on Windows, macOS, and Linux, including available, locked,
      unavailable, rotation, delete, and recovery-failure paths.
- [ ] One attorney-authorized, fixture-backed USPTO/ODP office-action reference
      traverses **mint → seal → gate → serve** and returns the expected bounded
      PDF bytes with the declared content type and security headers.
- [ ] The URL and serialized/logged/persisted proof contain no raw origin URL,
      provider/matter/document/user identifier, expiry data, serving key, or PDF
      bytes beyond the streamed fixture response.
- [ ] Missing, expired, revoked, unauthorized-session, wrong-audience,
      malformed-token, tampered-envelope, wrong-version, and wrong-AAD cases all
      produce the identical external 404 status/body/header surface.
- [ ] Store tests prove expiry and revocation predicates are authoritative and
      a revoked token cannot resolve even before expiry.
- [ ] Envelope tests prove fresh 96-bit nonces, required AAD fields, explicit
      decode failures, persisted key ids, active-key `Redacted` handling, and
      old-key decrypt/new-key encrypt rotation behavior.
- [ ] Host validation, loopback binding, session/audience auth, route isolation
      from RPC CORS, bounded streaming, cancellation, and the explicit
      Range/HEAD policy pass focused integration tests.
- [ ] Restart/migration proof uses the existing desktop PGlite/Drizzle runtime;
      no second store or persisted PDF cache appears.
- [ ] Focused package/app tests, repo gates, reflection lint, and Yeet
      PR-to-mergeable proof pass with no unrelated changes.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/secure-document-delivery/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/secure-document-delivery/ops/manifest.json` | Passes |
| Packet references | `rg -n "secure-document-delivery|blockedBy|GOAL.md|agentLaunchers|packetAnchorDocument" goals/secure-document-delivery` | Expected references present |
| Packet whitespace | `git diff --check -- goals/secure-document-delivery explorations/secure-document-download-proxy explorations/ATLAS.md` | Passes |
| Envelope security | P0 known-answer/tamper/AAD/version/rotation spike plus focused tests | All fail closed; rotation behavior explicit |
| Custody portability | Packaged Windows/macOS/Linux evidence | Adapter accepted or rejected without plaintext fallback |
| Vertical slice | Focused sidecar + capability fixture integration | One authorized OA PDF traverses mint → seal → gate → serve |
| Identical 404 | Response-matrix snapshot/assertion | Every denial class is externally indistinguishable |
| Store lifecycle | Clock, revoke, restart, and migration tests | Expiry/revocation authoritative; ciphertext/key ids persist; no PDF cache |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Blocked By

Live origin fetch only is blocked by the guarded-fetch DNS-rebinding/redirect
harness in `explorations/ingestion-security-secret-governance`. Fixture-backed
P0–P3 work is not blocked.

## Stop Conditions

- P0 cannot establish an authenticated/versioned envelope, unambiguous
  Range/HEAD policy, or packaged custody failure posture without weakening the
  ratified boundary.
- A raw URL, business identifier, serving key, or PDF bytes enter a prohibited
  URL, log, cache, envelope, or persistence surface.
- Any denial class becomes distinguishable or bypasses Host/session/audience,
  expiry, revocation, AAD, or authentication gates.
- Implementation requires a generic platform, new dependency, live fetch,
  additional origin/viewer, shared vault codec, or unrelated package scope.
- Verification requires unnamed credentials, cost, destructive effects, or
  policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
