# D7 Untrusted-Ingestion Threat Model

Date: 2026-07-11

## Scope and trust statement

This model covers the deterministic first proof described by the
[`SPEC`](../SPEC.md): an explicit GitHub watchlist drives captured fixtures through
snapshots, observations, lifecycle-bearing candidate claims, and a committed
Markdown daily brief. Tests perform no live network or LLM calls, but README and
issue text inside fixtures remains untrusted source data. It can still disclose a
credential, corrupt attribution, or produce unsafe public Markdown, and the same
boundary contracts will later front a live GitHub adapter.

The binding rule is simple: ingested source text is data, never agent
instructions. No source string may become a prompt instruction, tool argument,
shell fragment, configuration value, file path, or raw Markdown/HTML without the
specific boundary for that representation validating or encoding it.

This artifact adopts the active
[`ingestion-security-secret-governance`](../../../explorations/ingestion-security-secret-governance/README.md)
exploration by citation under SPEC D7. Its
[`RESEARCH.md`](../../../explorations/ingestion-security-secret-governance/RESEARCH.md)
and
[`DECISIONS.md`](../../../explorations/ingestion-security-secret-governance/DECISIONS.md)
remain the baseline doctrine and design record; this artifact narrows them to the
first proof rather than copying or graduating that broader packet.

## Security outcomes

The proof uses three observable outcomes. P1 must assign one to every adversarial
fixture and P2/P3 must assert the resulting record, error, and projection state.

- **Redact:** replace a sensitive span with a stable non-sensitive marker before
  the accepted snapshot body or any derived record is persisted. Retain only safe
  finding metadata, offsets, counts, rule identity, and a non-reversible content
  hash; never serialize the matched value. Hash and anchor discipline follows
  the two-digest contract in
  [`architecture-proposal.md`](./architecture-proposal.md) (gate G4): a raw
  acquisition digest computed before redaction drives change detection, while
  evidence anchors and payload deduplication bind to the accepted
  post-redaction bytes under a recorded content-safety policy version.
- **Quarantine:** do not admit content into an accepted snapshot, observation,
  claim, assessment, or brief. Persist only a typed reason plus safe source
  identity, attribution metadata, and hashes needed for idempotence and review.
- **Render-safe:** content may proceed only as explicitly untrusted data after
  canonicalization and context-specific encoding. A brief must display it as
  quoted or fenced source material, escape raw HTML and Markdown control syntax,
  sanitize link destinations, and preserve evidence and lifecycle labels.

These outcomes are not silent drops. Redaction and quarantine produce typed,
observable findings. Render-safe content retains provenance to the accepted
snapshot and evidence span.

## Attack-surface inventory

The layer names below are logical responsibilities. G1 will choose concrete
package ownership, and G5 will choose fixture placement; this artifact does not
pre-decide either concurrent architecture decision.

| Surface | Trust transition and first-proof exposure | Required boundary |
| --- | --- | --- |
| Watchlist entry | Authored configuration can contain malformed repository identities, markup, control characters, unexpected fields, or values intended to escape into paths, commands, logs, or the brief. | The configuration-entry layer schema-decodes a closed record, accepts only the explicit GitHub repository identity and selected artifact kinds, bounds text fields, rejects controls, and derives transport URLs rather than accepting arbitrary fetch URLs. Labels remain untrusted display text. |
| Fixture ingestion | Captured README and issue bytes enter through a deterministic fixture adapter. A fixture is untrusted even when committed and reviewed. | The source-adapter boundary enforces byte and record limits, strict decoding, source kind, stable identity, content hash, and attribution metadata before handing text to product logic. It has no network, subprocess, tool, or LLM capability. |
| Snapshot store | A naive immutable snapshot can permanently retain a credential or malformed payload and later feed every projection. | The ingestion content-safety layer runs before an accepted snapshot body is durable. Redacted/normalized bodies may be accepted; quarantined inputs retain only safe metadata and hashes. Store ports must not log raw rejected content. |
| Observation and claim extraction | Extraction can erase source context, turn injected prose into a directive, admit an ungrounded assertion, or copy a secret into several records. | The extraction/use-case layer consumes accepted snapshot data only, treats all source spans as quoted evidence, constructs anchors from the source text, requires valid attribution, and prevents observations from rendering directly. Claim admission and lifecycle policy remain explicit. |
| Brief projection | The daily brief is committed to a public repository. Markdown, raw HTML, link destinations, control characters, and copied secrets can become disclosure or render-time hazards. | The projection layer uses structured brief data and a context-aware Markdown renderer. It never concatenates source text into markup, emits no raw HTML from sources, sanitizes destinations, displays record IDs and lifecycle state, and fails closed on ungrounded content. |
| Future live GitHub adapter | A later adapter adds authentication, remote URLs, DNS, redirects, pagination, rate limits, and mutable upstream state. None is exercised by the first proof. | Design-time only: a product-neutral driver accepts the validated watchlist identity, uses guarded Effect HTTP, reuses `SafeRemoteHost`, and returns bytes plus transport metadata. Live transport policy belongs to its roadmap stage. |

External URLs found inside README or issue text are content, not acquisition
instructions: the first proof may render a sanitized link but never follows it.
Likewise, repository instructions and code blocks never become commands or agent
context.

## Content-boundary risks

| Risk | Threat description | First-proof relevance | Required outcome | Enforcement layer |
| --- | --- | --- | --- | --- |
| Prompt injection | Source prose attempts to override policy, change roles, disclose context, invoke tools, or make downstream agents treat data as instructions. Invisible or encoded text can hide the attempt. | Direct: captured README and issue text can contain such prose and can appear in a public brief. There is no LLM in the proof, but future agents can read the repository artifact. | **Render-safe:** flag with safe span metadata; normalize or visibly mark invisible controls; quote/fence the minimum necessary excerpt; never interpolate it into instructions. Detection is advisory, while data/instruction separation is mandatory. | Ingestion content-safety policy, extraction/use-case boundary, and projection renderer. |
| Secret-shaped tokens | Source text contains a credential-like token, private-key block, authorization value, or high-confidence provider secret shape. Copying it creates a public disclosure and durable replicas. | Direct: fixture source is copied through snapshots and the committed brief unless stopped. | **Redact:** replace before accepted snapshot persistence and all derived records. A high-confidence match that cannot be safely replaced is **quarantined**. | Ingestion content-safety layer before the snapshot store; projection performs a defense-in-depth assertion. |
| Dangerous URLs and HTML | Raw tags, event attributes, scriptable schemes, nested Markdown destinations, or parser-differential markup can execute, mislead, or exfiltrate when rendered. | Direct: GitHub source commonly contains links and HTML, while the output is Markdown in a public repository. | **Render-safe:** treat source HTML as text, escape markup, allow only explicitly safe destination schemes, and neutralize invalid links. No source HTML passes through as raw brief HTML. | Structured projection schema and context-aware Markdown renderer. The first proof does not claim browser-grade HTML sanitization. |
| Control and invisible characters | C0/C1 controls, bidirectional controls, zero-width characters, Unicode tags, or embedded nulls can hide instructions, spoof attribution, disturb logs, or change rendering. | Direct in captured text and fixture bytes. | **Render-safe** when deterministic normalization/removal preserves meaning and records a finding; otherwise **quarantine**. Newlines and tabs are accepted only in schema-approved contexts. | Strict decode/canonicalization at ingestion, followed by renderer assertions. |
| Oversized inputs | Excessive bytes, code points, lines, fields, or record counts can exhaust memory, expand snapshots, slow tests, or create an unusable public brief. | Direct despite no network: a committed fixture can trigger local resource exhaustion or output amplification. | **Quarantine** before full parsing or persistence, with a typed limit error. P1 fixes byte, character, per-field, per-source, and brief-output limits. | Fixture/source adapter for byte limits; ingestion schema for structural limits; projection layer for output budget. |
| Malformed encodings | Invalid UTF-8, truncated byte sequences, lone surrogates, or decoder replacement can alter evidence offsets and hide dangerous text. | Direct at the fixture byte boundary and fatal to deterministic evidence anchors. | **Quarantine**; decode strictly and never repair with silent replacement. | Source adapter before hashing canonical text, extraction, or snapshot admission. |
| Missing or broken attribution | Missing source identity, license state, artifact locator, snapshot hash, invalid span bounds, mismatched quote, or an attribution URL inconsistent with the watchlist makes a claim unverifiable or deceptive. | Direct: grounded public claims are the proof's central contract. | **Quarantine** from observations, claims, and briefs until repaired. A safe snapshot-status record may remain for diagnosis. | Adapter metadata decode, authoritative-record constructors, claim admission, and grounded-projection validation. |
| License revocation or source withdrawal | Continuing to publish copied content after license revocation or removal can violate source terms and leave claims appearing current after their evidence is no longer publishable. | Direct as a deterministic lifecycle scenario, even though no live upstream change is polled. | **Quarantine** the affected content from rebuilds; purge snapshot bodies as G4 requires, retain a safe tombstone and hashes, transition dependent claims, and rebuild the brief without revoked excerpts. | Source lifecycle/use-case policy and authoritative store, followed by projection rebuild. G4 owns exact retention and purge semantics. |

No content detector is treated as an oracle. False positives remain reviewable
through safe metadata, but likely secrets and structurally invalid content fail
closed. Conversely, a prompt-injection detector miss cannot grant authority:
the architecture never gives ingested text an instruction channel.

## Adversarial fixture classes for P1

This catalog supplies fixture classes and expected behavior, not fixture
placement. Placement must follow the accepted G5 decision in the concurrently
authored architecture proposal: executable fixtures belong to the owning test
surface, while packet material is evidence only. Payload sketches deliberately
avoid real credentials and packet-sanitization matches.

| Fixture class | Payload sketch | Expected pipeline outcome |
| --- | --- | --- |
| Plain instruction override | README paragraph telling a reader or agent to ignore prior rules and invoke a tool. | **Render-safe:** advisory span finding; accepted only as quoted/fenced evidence; no tool or instruction transition; grounded brief remains deterministic. |
| Invisible instruction | Ordinary prose containing zero-width or bidirectional controls around an instruction-like phrase. | **Render-safe** after explicit normalization or visible marking with offsets preserved or remapped by recorded policy; quarantine if anchors cannot remain sound. |
| Secret-shaped credential | Synthetic, non-valid provider-token shape assembled by the test so no plausible credential literal is committed. | **Redact:** stable marker in accepted snapshot and derivatives; safe finding metadata only; projection contains no matched value. |
| Private-key-like block | Non-valid key-block framing with synthetic body text. | **Redact** the whole span, or **quarantine** if the detector cannot establish safe boundaries; raw block absent from records and brief. |
| Raw HTML event sink | Image or anchor markup carrying an event-handler attribute. | **Render-safe:** emitted only as escaped text or omitted with an explicit finding; no raw tag or event attribute reaches brief markup. |
| Scriptable or obfuscated link | Markdown/HTML destination that decodes to a scriptable scheme or uses nested encoding. | **Render-safe:** destination becomes inert while visible source text and provenance remain. The pipeline never fetches it. |
| Control-character record | Issue text containing a null, forbidden C0/C1 control, or terminal/log manipulation sequence. | **Quarantine** when unsafe to canonicalize; otherwise render-safe normalization with a typed finding and deterministic anchors. |
| Oversized source | Fixture declares or produces content beyond a P1 byte/character/line limit. | **Quarantine** with typed limit data; no accepted snapshot, extraction, or brief amplification. |
| Malformed byte stream | Invalid or truncated UTF-8 sequence whose lossy decoding would change offsets. | **Quarantine** before canonical text hashing or persistence; typed decode failure. |
| Missing attribution | Source omits repository identity, artifact locator, license state, or snapshot hash. | **Quarantine** from authoritative claims and projections; safe diagnostic status only. |
| Broken evidence anchor | Quote disagrees with the referenced snapshot span, or offsets are reversed or out of range. | **Quarantine** at record construction/admission; no claim or brief entry. |
| Watchlist config injection | Repository/config fields contain markup, path traversal text, shell-like fragments, an email-formatted address, or an absolute home-directory path. | **Quarantine** the entry at schema decode; no path, command, URL, log, or brief interpolation. |
| Attribution-host mismatch | Artifact locator names a source outside the decoded watchlist identity. | **Quarantine** as broken attribution; no adapter call and no derived record. |
| License revoked | A second deterministic run changes an accepted source to revoked or withdrawn. | **Quarantine** content from projections; purge/tombstone and claim-lifecycle transitions follow G4; clean-store rebuild is equivalent. |
| Safe near miss | Benign security documentation discusses injection or shows a clearly synthetic token fragment. | Accepted without destructive redaction when rules say it is a near miss; any advisory finding is stable, reviewable, and does not change authority. |

P1 must add mixed-payload cases as well as one-risk fixtures: for example, an
oversized source with a secret near the limit and dangerous HTML inside an
instruction-like paragraph. Expected precedence is fail closed without leaking
the lower-layer payload in an error, log, snapshot, or golden diff.

## `SafeRemoteHost` assessment for the live adapter

Shipped SSRF-safe host validation already exists as `@beep/schema`
`SafeRemoteHost` in
`packages/foundation/modeling/schema/src/SafeRemoteHost.ts`. It is exported and
tested, rejects literal loopback, link-local, RFC1918/ULA, metadata, and
IPv4-mapped IPv6 targets, fails closed with `BlockedHostError`, supports an
explicit hostname allowlist, and accepts an injected DNS resolver while keeping
the schema module free of I/O.

The shipped consumers demonstrate two integration levels. Box injects
fail-closed operating-system DNS lookup before SDK connection in
`packages/drivers/box/src/Box.streaming.ts`; the NLP dataset loader in
`packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts` still carries a
literal-only duplicate. Reuse and convergence are preferable to rebuilding a
third host classifier for GitHub.

For the future live adapter, derive the HTTPS endpoint from an allowlisted GitHub
host and validated repository identity, then reuse `assertAllowedRemoteUrl` as
the fail-fast guard. This is necessary but not sufficient: the module documents
the residual DNS-rebinding time-of-check/time-of-use risk because validation and
connection can resolve different addresses. Live production work must add the
exploration's still-unshipped guarded HTTP layer with connect-time address
pinning, per-hop redirect validation, credential stripping, and current
reserved-range coverage. None of that code, nor any network test, belongs in the
fixture-only first proof.

## Baseline adoption and delivery split

| Doctrine adopted by citation | Baseline status on 2026-07-11 | First proof enforces | Deferred |
| --- | --- | --- | --- |
| Prompt-injection posture | Exploration doctrine only: deterministic, local, flag-not-block findings; the exploration is active at `research` with eight open questions. No prompt-injection detector implementation was found in runtime source. | Source text is structurally data-only; deterministic advisory findings; invisible-control handling; safe quotation/encoding; no LLM or tool capability in the fixture path. | Broader heuristic banks, render-versus-extract checks, ML second opinions, and any live prompt assembly. |
| Secret scrub | Exploration doctrine only. Existing redaction utilities are precedents, not a shipped shared ingestion scrub. | Deterministic secret-shape scan before accepted snapshot persistence; redact/quarantine outcomes; no matched value in logs, errors, records, briefs, or fixture goldens. | General PII, OOXML, privileged-document audit, shared pattern-bank graduation, vault, and secret resolution. |
| Guarded HTTP | `SafeRemoteHost` is the shipped exception; the connect-time `GuardedHttpClient` remains exploration doctrine. | No network capability. Watchlist identity and future endpoint shape are constrained; source URLs in text are never followed. | DNS pinning, redirect handling, live authentication, pagination, retries, rate limits, and production GitHub transport tests. |

The first proof also adopts the exploration's honest-reporting principle: it
records what was checked and never equates a zero-finding result with proof that
content is safe. The broad exploration's package placement, secret governance,
PII/OOXML, PDF x-ray, and browser sanitization questions remain open and are not
silently resolved here.

## Explicit non-threats and out-of-scope work

- Live API rate-limit abuse, retry storms, pagination amplification, redirect
  loops, DNS failures, force-push races, and network denial of service are absent
  from the fixture runtime. They belong to the production GitHub transport
  roadmap stage, where the live adapter introduces them.
- Credential theft from live GitHub authentication is absent because the proof
  performs no authenticated call and needs no provider token. Secret-shaped text
  *inside content* remains in scope because it can reach the public brief.
- Model jailbreak success, model-output exfiltration, and provider prompt
  retention are absent because the proof makes no LLM call. Data/instruction
  separation remains in scope because the persisted boundary will later feed
  model-backed stages and can be read by agents today.
- Browser DOM mutation XSS is not exercised: the deliverable is Markdown in a
  repository, not a web UI. Raw source HTML and dangerous link destinations are
  still render-boundary threats, so the proof escapes or neutralizes them; a
  browser-grade sanitizer belongs with a future UI/rendering surface.
- Archive bombs, OOXML hidden runs, PDF failed-redaction x-ray, image OCR, and
  binary-part residue are outside the selected GitHub README/issue text formats.
  Their doctrine remains adopted for later document-ingestion work, not
  implemented speculatively here.
- Scheduled/unattended abuse and autonomous recommendation-driven code changes
  are excluded by SPEC Non-Goals. The proof is operator-invoked, and generated
  recommendations have no code-write capability.
- General third-party license-compliance automation is not part of the proof.
  Source license/attribution capture, revocation handling, and projection purge
  are in scope because grounded public publication depends on them.

## Recon corrections

None. Live inspection confirms the security-capability split recorded in
`research/recon-findings.md`: the exploration doctrines remain unshipped, while
`SafeRemoteHost` and its live consumers are shipped prior art.

## Gate decision

This artifact owns no lettered deferred-decision gate; it is a P0 exit
requirement under locked decision D7. Its resolution is recorded in the SPEC
decision table as **D16 (2026-07-11)**: the active
ingestion-security-secret-governance exploration is adopted by citation as
the untrusted-ingestion baseline, narrowed to the fixture-to-public-brief
attack surface, with redact/quarantine/render-safe outcomes assigned per risk
and the adversarial fixture-class catalog above feeding P1; shipped
`SafeRemoteHost` is reused rather than rebuilt, and live transport hardening
remains a roadmap-stage obligation.
