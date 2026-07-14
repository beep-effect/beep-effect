# Ingestion Security + Secret/PII Governance — Brief

## Problem

Privileged and secret material must not leak through document ingestion, model
prompts, logs, audit evidence, browser rendering, remote fetches, or credential
resolution. Today the useful bricks are separated: extraction can produce text,
redaction precedents can count known patterns, drivers can obtain credentials,
and host schemas can reject obvious SSRF targets, but no single honest boundary
can say what was scrubbed, what residue remains, whether content is safe for a
prompt, whether a credential is technically resolvable, or whether a remote
connection reached the address that policy validated.

The runtime needs one honest **confidentiality boundary** without pretending it
is one package. Content safety, credential availability, CLI authentication,
and matter authorization must remain distinguishable. The program therefore
shapes two coordinated tracks that can graduate and ship independently.

## Appetite

**Proposed — ratify at shape sign-off:** fund a six-week program appetite, split
into independently stoppable goal-sized bets. Spend the first two weeks on the
pre-LLM secret-scrub vertical and its proof envelope. Spend the remaining
appetite only on increments whose spikes and ownership gates close. If a gated
increment cannot demonstrate its proof inside the appetite, graduate the proven
contract and leave the gated candidate queued rather than broadening the slice.

## Solution Sketch

### Track A — content security, with scrub first

The first slice is a narrow `@beep/file-processing` transform:

```text
authorized extracted text
  -> canonical credential/private-tag pattern bank
  -> sanitized text
  + counts and category metadata
  + safeForPrompt
  + non-secret, retention-bounded audit evidence
  + coverage and residue report
```

Start with the counted-proof shape in
`packages/tooling/library/ai-metrics/src/privacy.ts`
(`AiMetricsRedactionResult`) and compose one canonical pattern bank with the
broader error/log redaction precedent in
`packages/foundation/capability/observability/src/CauseRedaction.ts`. Detection,
replacement, proof, and audit projection share that bank. A matched secret may
exist transiently while the transform replaces it, but it never persists in
`TextAnchor.quote`, a log, a finding, or an audit row. Evidence stores only a
mask or digest, category, count, and non-secret location/coverage metadata.

The next increment adds deterministic, local, advisory `InjectionFinding`
records to the same result envelope. Later, policy-gated PII/OOXML expansion can
add purpose-aware evidence and honest residue reporting. PDF integrity uses a
pdf.js-based x-ray result contract only after the graphics-state/raster and FTO
gates. `@beep/provenance` remains judgment-free; findings live with
`@beep/file-processing`.

HTML safety splits pure policy from runtime adapters. `@beep/html` defines safe
elements, `SafeHtmlAttributes`, strict URL-attribute schemas, and trusted-output
markers. It must exclude event-handler attributes and unsafe `style` inherited
by live `GlobalAttributes` in
`packages/foundation/modeling/html/src/Html.attributes.ts`. `sanitize-html`
runs server-side and DOMPurify runs at the browser render boundary. A spike
first proves whether typed AST or raw HTML reaches that boundary.

Guarded remote fetch extends pure `SafeRemoteHost` classification at
`packages/foundation/modeling/schema/src/SafeRemoteHost.ts`, places request and
redirect policy in `@beep/api-transport`, and keeps Undici pinned lookup in a
Node server/platform adapter. Every redirect is revalidated, credential headers
are stripped cross-origin, URL userinfo/fragments/unsafe schemes are rejected,
and redirects/time/bytes are bounded. Box, USPTO, and NLP-MCP migrate only after
the rebinding harness proves connected address equals validated address.

### Track B — secret governance

An explicit sequential resolver tries sources in the proposed order below and
returns only `Redacted` values plus non-secret source metadata. Typed
`MissingSecret` and `PlaceholderRejected` continue; auth, transport,
malformed-reference, and integrity failures stop. Placeholder validation occurs
before return, never through `ConfigProvider.orElse` refinement fallback.
`@beep/onepassword-cli` remains the first provider driver, bound by a server/app
adapter. Subscription-auth CLI tokens never enter the chain.

The provider-neutral contract incubates server/app-local. It earns promotion to
foundation/capability only after at least two real consumers prove that the
contract—not one driver or slice—is shared. The encrypted credential vault is a
separate product-slice concern, selected only after the ownership model and
threat model are ratified.

Its provisional envelope reuses
`packages/tooling/library/ai-metrics/src/archive.ts`: WebCrypto AES-256-GCM,
algorithm id and envelope version, random 96-bit nonce per encryption, AAD over
user + credential + provider + version, and wrapped per-user/per-credential data
keys. There is no passphrase-derived master key in v1. Rotation, revocation,
recovery, and deletion are part of the contract. This vault owns credential
records only; `explorations/secure-document-download-proxy` owns link-token and
serving-key custody.

## Proposed Policy Blocks

Every block below is **proposed — ratify at shape sign-off**.

### 1. Credential ownership and tenancy model

**Proposed — ratify at shape sign-off:** in the solo-practice local-first v1,
the human user is the credential owner; the local workspace is the storage and
administration boundary. Keep user and workspace identifiers distinct even when
they are initially one-to-one. A provider instance references a credential but
does not own or copy it. Matters never own credentials and matter authorization
never follows from a reference. Organization/workspace-shared credentials are a
future explicit sharing model, not an alias for a user credential. User deletion
revokes and deletes owned credential records and their wrapped data keys, subject
only to a non-secret deletion tombstone. This ratification gates product-slice
selection.

### 2. Resolution precedence

**Proposed — ratify at shape sign-off:** resolve sequentially from user vault ->
explicit `op://` reference -> environment. Continue only for `MissingSecret` or
`PlaceholderRejected`; stop for authentication, transport, malformed reference,
or integrity failure. Return `Redacted` plus non-secret source metadata. The
resolver and `SourceAuth` report technical availability, never matter consent.

### 3. Audit-data sensitivity

**Proposed — ratify at shape sign-off:** secret findings retain no raw match,
including in `TextAnchor.quote`; retain category, masked evidence or keyed
digest, counts, rule/pattern-bank version, non-secret offsets, coverage, and
residue status. PII quotes are disabled by default. Enabling a PII quote requires
a named purpose, explicit access policy, retention clock, and deletion path;
logs and telemetry receive counts/categories only.

### 4. Key lifecycle ownership

**Proposed — ratify at shape sign-off:** the owning product slice owns credential
record creation, rotation, revocation, recovery, and deletion workflows. A
server/platform key-custody adapter owns wrapping-key access and unwrap
mechanics; neither the resolver contract nor `@beep/identity` owns keys. Rotate a
credential data key on credential rotation or suspected compromise, version all
envelopes, retain no recoverable key after hard deletion, and make recovery an
audited user action rather than silent escrow.

### 5. Retention and deletion clocks

**Proposed — ratify at shape sign-off:** align with the ratified time-tracking
tiers in `docs/product/ip-attorney-time-tracking.md`: transient authorized raw
text and unredacted PII excerpts delete on successful transformation/purpose
resolution or by 7 days; non-secret scrub proof and explicitly consented,
redacted evidence delete by 30 days unless pinned to an unresolved review;
approval/baseline/deletion/rotation audit records delete by 12 months. Credential
ciphertext lives until user deletion, credential deletion, or revocation policy
requires earlier removal; deleting it also deletes its wrapped data key.

### 6. Sanitizer output contract

**Proposed — ratify at shape sign-off:** raw HTML is untrusted. Server-side
`sanitize-html` emits either a branded sanitized string or a safe typed AST—the
browser-boundary spike selects one canonical carrier. Only the canonical carrier
may receive a safe-output marker. Concatenation, template interpolation, raw
string conversion, AST mutation, reparsing through a non-approved parser, or URL
attribute insertion invalidates trust and requires re-sanitization. DOMPurify is
still mandatory immediately before browser rendering.

### 7. Failure posture

**Proposed — ratify at shape sign-off:** unresolved secret matches, unknown
coverage, or secret-shaped residue block `safeForPrompt` and therefore block the
prompt leg, while retaining sanitized/non-secret diagnostic proof. Injection
findings are advisory and never silently block ingestion. PII/OOXML policy
violations block the affected purpose/export, not unrelated ingestion. PDF
integrity findings are advisory but visibly prevent a claim of verified
redaction. Sanitizer failure blocks rich-HTML rendering and may fall back to
escaped plain text. Fetch-policy, redirect, size, timeout, DNS, or pinning failure
blocks that remote fetch.

### 8. Injection-baseline governance

**Proposed — ratify at shape sign-off:** only the user/attorney authorized for
the matter may accept an advisory injection finding into a baseline. Acceptance
is scoped to matter + source/content digest + rule id + pattern-bank version,
records rationale and actor, expires after 90 days, and invalidates on content or
rule-bank change. Baselines suppress duplicate presentation, never erase the
finding or turn advisory detection into content trust.

### 9. Operational egress policy

**Proposed — ratify at shape sign-off:** default deny. Prefer source-registered
exact HTTPS origins and bounded endpoint templates; allow one-shot user URLs
only through explicit policy and the same guarded transport. Denylists supplement
but never replace registration/allowlisting. The policy owns scheme, host, port,
redirect, header, timeout, byte, and hop limits. The platform adapter owns DNS
resolution and pinned connection; any proxy must preserve address validation and
redirect checks rather than become a bypass.

## Rabbit Holes

- The credential ownership model may point to a product slice that does not yet
  have the required tenant/deletion semantics; do not choose a package early.
- The vault threat model must settle wrapping-key custody, offline compromise,
  recovery, rotation, and deletion before provisional crypto becomes a build
  commitment.
- pdf.js must prove graphics-state/fill and raster coverage; the FTO decision is
  a separate counsel gate, not a technical checkbox.
- The browser may receive raw HTML, a string, or the typed AST today. The spike
  must trace the live path and name every trust-invalidating conversion.
- Regex and category-bank drift can create false confidence. Version the bank,
  report coverage/residue, and test overlaps, encodings, and partial matches.
- DNS rebinding, proxy routing, redirects, IPv4-mapped IPv6, and alternate IP
  encodings must be exercised by the harness, not argued away.
- PII and OOXML expansion can swallow the first slice. They stay policy-gated
  and inherit explicit purpose/retention/deletion requirements.

## No-Gos

- No reopening `goals/llm-provider-subscription-auth`; its token-free CLI-auth
  surface remains closed and outside credential storage/resolution.
- No monolithic `@beep/secrets` package and no resolver/vault in
  `@beep/identity`.
- No raw-secret persistence in anchors, findings, audit rows, logs, telemetry,
  support artifacts, or test fixtures.
- No RL-based injection detection and no off-box detector over privileged text.
- No AGPL runtime dependency; permissive adaptations require attribution.
- No crypto platform by assertion: algorithm selection does not substitute for
  a threat model, key custody, recovery, rotation, revocation, and deletion.
- No credential-as-consent, CLI-auth-as-resolution, or source availability as
  matter authorization.
- No consumer SSRF migration before the connected-address rebinding proof.
