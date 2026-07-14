# Ingestion Security + Secret/PII Governance — Decisions

## 2026-07-14 — Q1: Program scope

**Status:** LOCKED

**Question:** Is this one implementation wedge, or a program with separate
content-security and secret-governance outcomes?

**Answer:** Keep one exploration and shape it as a **two-track program** that may
graduate multiple goals. The content-security track owns pre-LLM scrub/proof,
advisory injection findings, document integrity/sanitization, and guarded remote
fetch. The secret-governance track owns a provider-neutral resolution contract
and a separately owned per-user credential vault.

`goals/llm-provider-subscription-auth` stays closed and excluded: it is a
token-free vendor-CLI authentication surface, not secret storage or resolution.
"CLI authenticated," "credential resolvable," and "matter authorized" are
three independent facts.

**Rationale:** The tracks share a confidentiality boundary but not ownership or
lifecycle. Keeping one exploration preserves the cross-cutting threat model;
graduating separate goals prevents file ingestion, platform drivers, and
product-owned vault semantics from collapsing into one package or delivery unit.

**Rejected options:** One monolithic ingestion-and-secrets goal; moving vault or
resolution into the closed subscription-auth goal; treating CLI authentication,
credential availability, or matter authorization as equivalent.

## 2026-07-14 — Q2: First slice

**Status:** LOCKED — reordered from the pre-draft recommendation

**Question:** Which net-new capability is the first vertical slice?

**Answer:** Start with the **pre-LLM secret scrub**, a narrow
`@beep/file-processing` transform:

`authorized extracted text -> sanitized text + category/count metadata +
safeForPrompt + non-secret retention-bounded audit evidence + coverage/residue`

The first implementation covers credential/private-tag detection and one
canonical pattern bank composed from
`packages/tooling/library/ai-metrics/src/privacy.ts` and
`packages/foundation/capability/observability/src/CauseRedaction.ts`. It reuses
the `AiMetricsRedactionResult` counted-proof precedent. Matched secret material
never persists in `TextAnchor.quote`; evidence contains only a mask or digest,
category, and non-secret location metadata. PII and OOXML coverage expand only
behind explicit policy. Advisory injection findings are the next increment over
the same result envelope.

**Rationale:** The pre-draft put injection detection first. Alignment reordered
the work because the scrub establishes the honest confidentiality boundary
before any authorized extracted text reaches a prompt, log, or durable finding.
It also forces the reusable proof envelope, safe-prompt gate, pattern-bank
ownership, residue honesty, and raw-secret non-persistence that later injection,
PII, and document-integrity increments need.

**Rejected options:** Prompt-injection detection first; vault first; PDF x-ray
first; a broad PII/OOXML scrub in the first slice; persisting matched quotes for
review.

## 2026-07-14 — Q3: Secret homes

**Status:** LOCKED

**Question:** Where do the provider-neutral resolver and encrypted credential
vault belong?

**Answer:** A provider-neutral resolution contract may graduate to a
foundation/capability package **only after multi-consumer proof**. It owns
explicit precedence, typed recoverable/fatal failures, `Redacted` results, and
non-secret source metadata, and imports no driver or product slice. Until that
proof exists it incubates app/server-local. `@beep/onepassword-cli` remains the
1Password driver; server/app adapters bind it.

The encrypted vault belongs in the product slice that owns its user, tenancy,
authorization, recovery, retention, and deletion semantics. Slice selection is
blocked until the credential ownership model proposed in `BRIEF.md` is ratified
at shape sign-off. Neither capability belongs in `@beep/identity`, and there is
no monolithic `@beep/secrets` package.

**Rationale:** A portable contract must describe resolution without depending on
one provider, while a vault is inseparable from product authorization and data
lifecycle. Promotion without multiple consumers would create speculative
foundation. Combining the two would mix policy, storage, crypto, and drivers.

**Rejected options:** `@beep/identity`; a monolithic secrets package; placing the
vault in a foundation package; importing `@beep/onepassword-cli` from the
provider-neutral contract; promoting before multiple real consumers exist.

## 2026-07-14 — Q4: Content-security homes

**Status:** LOCKED

**Question:** Which packages own ingestion findings, provenance, HTML safety,
and runtime sanitization?

**Answer:** `@beep/file-processing` owns ingestion orchestration, advisory
`InjectionFinding`, redaction proof, and OOXML/PDF-integrity findings.
`@beep/provenance` remains a judgment-free anchor substrate. `@beep/html` owns
pure `SafeHtmlAttributes`, allowed-element metadata, strict URL-attribute
schemas, and safe-output markers—not a runtime sanitizer.

The HTML policy must not derive a safe attribute set from live
`GlobalAttributes` verbatim: `packages/foundation/modeling/html/src/Html.attributes.ts`
includes `EventHandlerAttributes` and `style`, both XSS sinks. `sanitize-html`
is the server-side adapter and DOMPurify is the browser render-boundary adapter.
A spike must prove whether raw HTML or the typed AST currently reaches the
browser before the sanitizer output contract freezes.

**Rationale:** Findings contain judgment and belong with the consuming ingestion
policy; provenance must stay reusable and neutral. Pure schema/metadata belongs
in `@beep/html`, while environment-specific sanitizer engines remain adapters.

**Rejected options:** Scored findings in `@beep/provenance`; treating
`@beep/html` as a runtime sanitizer; copying all `GlobalAttributes` into the
allowlist; server-only or browser-only sanitization.

## 2026-07-14 — Q5: Build, buy, licenses, and patent posture

**Status:** LOCKED

**Question:** What may be adapted, what must be reimplemented, and which legal
or technical gates constrain the design?

**Answer:** Reimplement-not-copy applies to AGPL or otherwise unapproved
sources—not to permissive code. MIT, Apache, and BSD work may be adapted with
attribution. Port the Presidio recognizer/operator **contract**, not its service.
Model the PDF x-ray result contract on pdf.js and never PyMuPDF. Keep injection
detection deterministic, local, and advisory; do not use reinforcement learning.
A patent concern becomes a counsel flag, never a clearance conclusion.

The injection design cannot freeze until a pdf.js graphics-state/raster spike
and a freedom-to-operate decision gate complete.

**Rationale:** This posture permits responsible reuse without importing copyleft
runtime obligations or off-box processing into a privileged-data boundary. The
spikes distinguish a plausible design from proven PDF coverage and legal review.

**Rejected options:** Reimplementing all permissive prior art; AGPL runtime
dependencies; PyMuPDF; Presidio as a Python/REST service; RL classification;
describing exploration research as patent clearance.

## 2026-07-14 — Q6: Resolution semantics

**Status:** LOCKED

**Question:** How does resolution fall through, stop, and preserve secrecy?

**Answer:** The first provider is the existing 1Password CLI driver, bound by an
**explicit sequential resolver**. `MissingSecret` and `PlaceholderRejected`
continue to the next source. Authentication, transport, malformed-reference,
and integrity failures stop resolution. Placeholder validation happens before a
value can return; it must not be modeled as a `ConfigProvider.orElse`
refinement, because `orElse` does not fall through on source/refinement errors.

The proposed precedence is user vault -> `op://` reference -> environment; it
remains **proposed — ratify at shape sign-off** in `BRIEF.md`. Every result is
`Redacted` with non-secret source metadata. Driver stdout/stderr and error paths
must be audited so resolved values never reach logs. CLI subscription tokens are
outside this chain. Resolver/`SourceAuth` report technical availability only;
they never grant matter consent.

**Rationale:** Catching only typed absence/placeholder states permits honest
fallback without hiding broken authentication or tampering. Keeping subscription
tokens and consent outside resolution preserves the three independent control
facts ratified in Q1.

**Rejected options:** `ConfigProvider.orElse` refinement fallback; catch-all
fallback; environment first; including CLI subscription tokens; inferring matter
authorization from a resolved credential.

## 2026-07-14 — Q7: Vault cryptography

**Status:** LOCKED — provisional implementation choice behind threat modeling

**Question:** What is the provisional credential-record encryption envelope?

**Answer:** Use AES-256-GCM via WebCrypto, reusing
`packages/tooling/library/ai-metrics/src/archive.ts`: a versioned envelope with
an algorithm identifier, a fresh random 96-bit nonce per encryption, and AAD
binding user, credential, provider, and envelope version. Use wrapped
per-user/per-credential data keys. The owning slice must define rotation,
revocation, recovery, and deletion. V1 has **no passphrase-derived master key**;
adding one reopens the KDF decision. XChaCha is only a fallback after dependency
and license verification.

This contract encrypts credential records only.
`secure-document-download-proxy` separately owns link-token and serving-key
custody. A threat-model spike gates implementation commitment.

**Rationale:** The shipped archive envelope provides a native, versioned AEAD
precedent while scoped data keys and bound AAD limit substitution and lifecycle
blast radius. The provisional label prevents an algorithm choice from standing
in for key-custody, recovery, deletion, and attacker analysis.

**Rejected options:** Passphrase-derived master key in v1; unversioned ciphertext;
nonce reuse; one undifferentiated data key; immediate XChaCha dependency;
absorbing document-link crypto into the credential vault.

## 2026-07-14 — Q8: SSRF boundary

**Status:** LOCKED

**Question:** How are pure host classification and connect-time SSRF controls
split and proved?

**Answer:** Extend `SafeRemoteHost` pure classification in place with the missing
reserved ranges and metadata names identified by research. Add request and
redirect policy to promoted `@beep/api-transport`. Implement Node/Undici pinned
lookup in an explicit server/platform adapter. Revalidate every redirect; strip
`Authorization`, `Cookie`, and `Proxy-Authorization` across origins; reject
userinfo, fragments, and unsafe schemes; and bound redirects, time, and bytes.

Do not migrate Box, USPTO, or NLP-MCP consumers until a DNS-rebinding harness
proves that the connected address is the validated address. The spike must test
the pinned `connect.lookup` pattern across rebinding and redirect hops.

**Rationale:** Pure classification is reusable and testable, but only connection
pinning closes the DNS time-of-check/time-of-use gap. Central request policy in
`@beep/api-transport` avoids divergent redirect and header behavior while the
Node-specific mechanism stays out of foundation.

**Rejected options:** DNS I/O inside `SafeRemoteHost`; validation before lookup
without connection pinning; automatic redirects; denylist-only policy; migrating
consumers before the rebinding proof.

## Deferred gates

### 2026-07-14 — Vault-slice selection

**Status:** DEFERRED — blocked on ratification of the credential ownership and
tenancy model proposed in `BRIEF.md`.

### 2026-07-14 — pdf.js graphics-state/raster proof and FTO decision

**Status:** DEFERRED — both gates must complete before the PDF/injection design
freezes; the exploration records a counsel flag, not clearance.

### 2026-07-14 — Browser sanitizer boundary

**Status:** DEFERRED — spike whether raw HTML or the typed AST reaches the
browser, then freeze the trusted sanitizer output and invalidating conversions.

### 2026-07-14 — DNS-rebinding harness

**Status:** DEFERRED — prove pinned connect lookup and every redirect hop before
consumer migration.

### 2026-07-14 — Credential-vault threat model

**Status:** DEFERRED — identify attackers, key custody, recovery, rotation,
revocation, and deletion before committing the provisional crypto design.
