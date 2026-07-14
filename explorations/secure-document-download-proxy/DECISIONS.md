# Secure Document Download Proxy — Decisions

All eight alignment questions and the candidate fan-out were ratified in one
round on 2026-07-14. `LOCKED` entries bind the graduated goal. `DEFERRED`
entries are explicit implementation gates, not open alignment questions.

## 2026-07-14 — Q1 Scope boundary — LOCKED

**Question:** Is this a stand-alone capability or part of a driver/product goal?

**Answer:** Build a stand-alone, narrow secure-document-delivery capability with
attached consumer integrations. It owns the provider-neutral document-link
lifecycle, encrypted locator mapping, serving-key custody, and secure serve
contract. USPTO, Box, docketing, documents, and time-tracking consumers retain
authorization, provenance, and product workflow ownership.

**Rationale:** Delivery security is shared, while the authority to expose a
document is product-specific. A narrow capability preserves that line without
turning delivery into a generic crypto or proxy platform.

**Rejected options:** Burying delivery in `@beep/uspto`; folding it into a
documents or docketing product slice; a generic crypto, signed-URL, or proxy
platform.

## 2026-07-14 — Q2 Placement and promotion — LOCKED

**Question:** Which package and app boundaries own the reusable and runtime
pieces?

**Answer:** `packages/foundation/capability/secure-document-delivery` owns the
document-specific schemas, typed errors, mint/resolve/revoke contracts,
versioned encrypted-mapping envelope, and persistence/custody ports. It is
**INCUBATED** until two real importers exist; that two-importer test is the
promotion gate. `apps/professional-desktop/server` owns HTTP routing, session
authorization, PGlite binding, and OS-custody binding. `law-practice/server` and
`documents/server` adapt authorized product references. Provider fetch remains
in drivers such as `@beep/uspto` and `@beep/box`.

**Rationale:** The split keeps portable document-delivery semantics independent
from the desktop runtime while refusing to promote an abstraction on one
consumer's speculation.

**Rejected options:** `@beep/secure-links` (rejected as overbroad),
`@beep/document-proxy`, a driver-tier home, an app-only implementation, or
promotion before two real importers.

## 2026-07-14 — Q3 First slice — LOCKED

**Question:** Which origin and user workflow prove the first vertical slice?

**Answer:** Serve one USPTO/ODP File-Wrapper office-action PDF from the
approval spine in `goals/law-docketing-patent-spine`. Start with a deterministic
fixture. Live driver proof is allowed only after the ingestion-security
guarded-fetch DNS-rebinding harness passes. The capability receives an
authorized provider reference; it never persists or generically dereferences a
raw origin URL.

**Rationale:** The docketing approval spine supplies a real authorization edge,
and `@beep/uspto` already owns provider fetch and same-origin credential rules.
Fixture-first proof avoids making network access or credentials part of routine
acceptance.

**Rejected options:** Box first; a free-standing URL proxy; accepting or storing
raw origin URLs; live-fetch acceptance before the rebinding harness.

## 2026-07-14 — Q4 Token model and TTL — LOCKED

**Question:** What does the URL carry, and where are expiry and revocation
decided?

**Answer:** Mint a stateful opaque CSPRNG reference, preferably a dedicated
128–256-bit token. UUIDv4 is acceptable only with a strict-v4 route shape. The
URL contains no provider, matter, document, user, or expiry data. An encrypted,
revocable mapping row is authoritative; store predicates enforce expiry and
revocation. TTL is consumer-supplied and purpose-bound under a packet-owned
maximum.

**Rationale:** A stateful reference gives immediate revocation, existence
opacity, and non-revealing URLs. Purpose-bound TTL avoids silently importing an
upstream policy.

**Rejected options:** Stateless sealed tokens; business identifiers or expiry
in the URL; UUID format as authorization; client-enforced expiry; inheriting the
upstream seven-day default. **The seven-day default is not inherited.**

## 2026-07-14 — Q5 Document-link cryptography — LOCKED

**Question:** How is the mapping sealed without creating a shared crypto
platform?

**Answer:** Use a document-link-specific, versioned AES-256-GCM envelope through
WebCrypto, reusing technique from
`packages/tooling/library/ai-metrics/src/archive.ts` without sharing its codec.
Use a fresh 96-bit nonce, algorithm and envelope version, key id, and AAD binding
the token id or hash, workspace, origin-adapter kind, expiry, and version.
Version, AAD, or authentication mismatch is an explicit decode failure. Encrypt
mapping payloads only, never PDF bytes.

**Rationale:** The local precedent avoids a new dependency; an explicit envelope
and AAD prevent substitution across tokens, workspaces, adapters, expiries, and
versions. Document-link crypto remains fenced from the credential vault owned by
the ingestion-security lane.

**Rejected options:** Fernet, Branca, PASETO, JWE, or a new crypto dependency;
sharing a codec with the credential vault; encrypting PDF bytes in the envelope;
unversioned ciphertext or unauthenticated context.

## 2026-07-14 — Q6 Serve boundary — LOCKED

**Question:** Which desktop boundary serves the authorized PDF?

**Answer:** Extend the existing authenticated Bun sidecar HTTP edge under
`apps/professional-desktop/server`. Keep the document route separate from the
permissive RPC CORS surface. Require loopback binding, Host validation, and
session/audience authorization in addition to the opaque token. Return an
identical 404 for missing, expired, revoked, unauthorized, and malformed
requests. Set `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`,
and `X-Content-Type-Options: nosniff`; declare PDF content type and implement
bounded streaming, cancellation, and an explicit Range/HEAD policy.

**Rationale:** The live sidecar already provides loopback HTTP and per-launch
bearer authentication. A distinct route can preserve standard HTTP security
semantics without granting document URLs the RPC route's broad CORS behavior.
The contract must be clean-room because the `patents-mcp-server` route source
has an unverified license.

**Rejected options:** Tauri asset protocol; `tauri-plugin-localhost`; IPC blobs;
reusing permissive RPC CORS; token-only authorization. A custom protocol is a
fallback only if packaged-webview proof invalidates the HTTP route.

## 2026-07-14 — Q7 Serving-key custody — LOCKED

**Question:** Who owns serving-key custody and what is the first adapter?

**Answer:** Define a narrow `ServingKeyCustody` port. The first adapter uses
`@azure/msal-node-extensions` generic `IPersistence` (MIT, already installed,
with `keytar` transitive) only if packaged Windows/macOS/Linux proof passes,
including locked or unavailable keyring, rotation, delete, and recovery-failure
paths. Persist a versioned wrapped keyset; hold active keys only as `Redacted`;
persist key ids beside ciphertext rows. This packet owns serving-key rotation,
revocation, recovery, and deletion.

**Rationale:** The installed library is a lower-friction cross-platform custody
candidate, but the capability must depend on its own port rather than M365 or a
particular credential product.

**Rejected options:** Importing `@beep/m365`; Tauri Stronghold; a new keyring
dependency before the packaged proof; plaintext fallback; credential resolver
or 1Password recovery without a future explicit recovery policy.

## 2026-07-14 — Q8 Backing store — LOCKED

**Question:** Where does the encrypted mapping persist?

**Answer:** Extend the professional-desktop PGlite/Drizzle runtime and its boot
migrations. The live catalog/runtime is `@electric-sql/pglite` **0.5.4**; the
earlier packet statement that desktop pins 0.4.6 is stale. Do not create a
bespoke store.

**Rationale:** The sidecar already owns file-backed PGlite, Drizzle composition,
and migration-on-boot. Reusing it gives one lifecycle and recovery surface.

**Rejected options:** Bespoke SQLite or filesystem storage; a second PGlite
database; targeting the stale 0.4.6 assumption.

## Deferred implementation gates

### 2026-07-14 — Threat model, tamper, rotation, and known-answer spike — DEFERRED

Before the envelope contract is committed, record the threat model and prove
known-answer decode, AAD/version/auth mismatch failures, tamper behavior, and
key rotation. This deferral blocks P1 envelope commitment, not graduation.

### 2026-07-14 — Packaged keyring portability spike — DEFERRED

Before selecting the first custody adapter, prove packaged Windows, macOS, and
Linux behavior for available, locked, and unavailable keyrings plus rotation,
delete, and recovery failure. This deferral blocks adapter commitment, not the
`ServingKeyCustody` port.

### 2026-07-14 — Live origin fetch behind rebinding harness — DEFERRED

Keep acceptance fixture-backed. Live USPTO fetch proof remains blocked until
the guarded-fetch DNS-rebinding/redirect harness from
`explorations/ingestion-security-secret-governance` proves pinned connect-time
address enforcement.
