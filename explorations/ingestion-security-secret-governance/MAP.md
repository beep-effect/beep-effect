# Ingestion Security + Secret/PII Governance — Map

This is the ratified fan-out. The content-security and secret-governance tracks
share a confidentiality boundary but retain separate ownership, sequencing,
and stop conditions. Only the first slice is graduated; five candidates remain
behind their named gates.

## Candidate Goal Packets

| Order | Track | Slug | Mission | Dependencies and gates | Existing capabilities / honest net-new |
| --- | --- | --- | --- | --- | --- |
| **GRADUATED** | Content | [`ingestion-secret-scrub`](../../goals/ingestion-secret-scrub/README.md) | Transform authorized extracted text into sanitized text, category/count proof, `safeForPrompt`, non-secret retention-bounded evidence, and coverage/residue metadata. | None; first slice is credential/private-tag detection only. PII/OOXML are later policy-gated expansions. | Reuse `packages/tooling/library/ai-metrics/src/privacy.ts` (`AiMetricsRedactionResult` and pattern/count proof), `packages/foundation/capability/observability/src/CauseRedaction.ts` (broader log/error pattern bank), and `packages/foundation/capability/file-processing/src/`. **NET-NEW:** canonical shared pattern bank, prompt-safe result envelope, residue/coverage contract, and no-raw-match evidence projection. |
| 2 | Content | `ingestion-injection-findings` | Add deterministic local advisory `InjectionFinding` records over the scrub result envelope. | Depends on `ingestion-secret-scrub`; pdf.js/FTO gates constrain design freeze where hidden PDF content participates. | Reuse judgment-free anchors from `packages/foundation/modeling/provenance/src/TextAnchor.ts` and scored-span shape from `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`. **NET-NEW:** injection categories/rules, baseline governance, detector, and file-processing-owned finding model. |
| GATED | Content | `safe-html-sanitization` | Complete server and browser sanitizer adapters around the implemented pure typed-AST safety contract. | Browser-boundary spike must prove where raw HTML strings reach the browser. | Reuse the `@beep/html` conformance, deny-by-default policy, deterministic serializer, and module-issued `SafeHtml` marker. **NET-NEW:** `sanitize-html` server adapter, DOMPurify browser adapter, and their invalidating conversion contract. |
| GATED | Content | `guarded-remote-fetch` | Enforce normalized URL, DNS, pinned-connect, redirect, credential-header, timeout, hop, and byte policy for remote ingestion. | DNS-rebinding/redirect harness must prove connected address equals validated address before Box, USPTO, or NLP-MCP migration. | Extend `packages/foundation/modeling/schema/src/SafeRemoteHost.ts`; add request/redirect policy to `packages/foundation/capability/api-transport/src/`; bind Undici in an explicit Node adapter. **NET-NEW:** pinned lookup adapter, rebinding harness, and consumer migration. |
| INCUBATE | Secret | `secret-resolution-contract` | Resolve provider-neutral credential references sequentially with typed continue/stop semantics, `Redacted` values, and non-secret source metadata. | Incubate app/server-local; foundation/capability promotion requires at least two proven consumers. Proposed precedence must be ratified. | Reuse `packages/drivers/onepassword-cli/src/OnePasswordCli.service.ts`, `packages/shared/domain/src/values/OnePasswordReference/OnePasswordReference.model.ts`, and technical availability metadata in `packages/foundation/capability/mcp-kit/src/SourceAuth.ts`. **NET-NEW:** provider-neutral resolver port/errors/precedence contract and driver adapters. |
| BLOCKED | Secret | `per-user-credential-vault` | Store and lifecycle-manage product-owned encrypted credential records without leaking secret values. | Blocked on ownership/tenancy ratification, product-slice selection, and threat-model spike. | Reuse the AEAD envelope precedent in `packages/tooling/library/ai-metrics/src/archive.ts`. **NET-NEW:** credential record, wrapped per-user/per-credential keys, custody adapter, authorization, rotation, revocation, recovery, and deletion workflows. |

## Re-entry Points

The five non-graduated candidates are re-entry points under the repository's
reopen-at-`decompose` convention. Reopen when `ingestion-secret-scrub` ships;
the HTML, fetch, resolver-promotion, and vault rows retain their additional
proof and ownership gates.

## Cross-Reference Boundaries

| Surface | Relationship to this program | Exact boundary |
| --- | --- | --- |
| `goals/llm-provider-subscription-auth` | Closed, excluded dependency/context | `goals/llm-provider-subscription-auth/README.md` records shipped token-free vendor-CLI delegation. It neither stores nor resolves provider credentials; CLI authentication remains independent. |
| `explorations/secure-document-download-proxy` | Sibling crypto owner | Its document-serving boundary owns opaque link tokens and serving-key custody. The credential vault owns credential-record crypto only. See `explorations/secure-document-download-proxy/RESEARCH.md`. |
| `@beep/api-transport` | SSRF request/redirect policy home | Promoted shared capability at `packages/foundation/capability/api-transport/src/`; Node/Undici pinned lookup remains a server/platform adapter. |
| USPTO two-control doctrine | Authorization constraint | `explorations/uspto-patent-driver-depth/BRIEF.md` and `DECISIONS.md` keep technical `SourceAuth` availability separate from law-practice matter consent. The resolver never authorizes a matter. |

## Sequencing

1. Ship `ingestion-secret-scrub` first and prove no raw secret persists across
   transform output, anchors, audit evidence, logs, and prompt handoff.
2. Add `ingestion-injection-findings` over the stable envelope; its findings
   remain advisory and baseline acceptance remains audited and expiring.
3. Run HTML, pdf.js/FTO, rebinding, and vault threat-model spikes in parallel
   with shape/decomposition, but graduate gated implementation only when each
   named proof closes.
4. Incubate `secret-resolution-contract` in the first app/server consumer. Promote
   only after a second consumer proves the abstraction and no driver imports
   leak inward.
5. Select and graduate `per-user-credential-vault` only after the proposed
   ownership model is ratified and the threat model identifies a product slice
   and key-custody adapter.

## First Vertical Slice

Given matter-authorized extracted text containing supported credential or
private-tag shapes, `ingestion-secret-scrub` returns prompt-usable sanitized text
and a schema-backed proof containing category counts, pattern-bank version,
non-secret masked/digested evidence, coverage, and residue. `safeForPrompt` is
true only when no supported secret-shaped residue or unknown coverage remains.
Tests prove that the original match does not occur in output, `TextAnchor.quote`,
serialized evidence, errors, logs, snapshots, or telemetry. PII, OOXML,
injection scoring, PDF x-ray, and vault resolution are not required for this
first proof.

## Capability Check

| Major component | Live capability | Disposition |
| --- | --- | --- |
| Extracted-text orchestration | `packages/foundation/capability/file-processing/src/` | **EXTEND**; content-security result/finding owner. |
| Counted secret-redaction proof | `packages/tooling/library/ai-metrics/src/privacy.ts` | **REUSE/GENERALIZE** `AiMetricsRedactionResult`; do not create a parallel proof idiom. |
| Observability redaction patterns | `packages/foundation/capability/observability/src/CauseRedaction.ts` | **REUSE INPUTS** in one canonical bank; avoid divergent log and ingestion patterns. |
| Neutral text anchors | `packages/foundation/modeling/provenance/src/TextAnchor.ts` | **REUSE**, but never persist matched secret in `quote`; no scored judgments here. |
| Scored finding precedent | `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts` | **MIRROR** in file-processing; do not move the domain model. |
| HTML metadata/AST | `packages/foundation/modeling/html/src/Html.meta.ts`, `packages/foundation/modeling/html/src/Html.attributes.ts`, `packages/foundation/modeling/html/src/Html.model.ts`, and `packages/foundation/modeling/html/src/Html.conformance.ts` | **REUSE** the implemented pure conformance, policy, canonical serialization, and opaque safe marker. Live `GlobalAttributes` event handlers and `style` remain explicitly unsafe. Parsers and runtime sanitizers are **NET-NEW environment adapters**. |
| Pure remote-host classification | `packages/foundation/modeling/schema/src/SafeRemoteHost.ts` | **EXTEND IN PLACE** with missing ranges/names; keep I/O-free. |
| Shared transport transforms | `packages/foundation/capability/api-transport/src/` | **EXTEND** with request/redirect policy. Pinned DNS/connect behavior is **NET-NEW platform code**. |
| 1Password CLI access | `packages/drivers/onepassword-cli/src/OnePasswordCli.service.ts` | **REUSE AS DRIVER** through an adapter; never import into a provider-neutral foundation contract. |
| `op://` value object | `packages/shared/domain/src/values/OnePasswordReference/OnePasswordReference.model.ts` | **REUSE**. |
| Technical source availability | `packages/foundation/capability/mcp-kit/src/SourceAuth.ts` | **REUSE CONCEPT**, not as matter authorization. |
| Credential AEAD envelope | `packages/tooling/library/ai-metrics/src/archive.ts` | **REUSE PRECEDENT** after threat modeling. Product vault, key lifecycle, and custody are **NET-NEW**. |

## Open Risks Inherited From The Brief

- Ownership/tenancy ratification and the vault threat model gate vault slice
  selection; no placeholder package is approved.
- pdf.js graphics-state/raster proof and counsel's FTO decision gate the
  PDF/injection design freeze.
- Browser data-path proof gates the sanitizer carrier and trust-invalidating
  conversion list.
- DNS-rebinding/redirect proof gates all guarded-fetch consumer migrations.
- Pattern-bank versioning, overlap, encoding, and residue honesty gate any
  `safeForPrompt` claim.
- PII quotes and OOXML expansion require purpose, retention, access, and deletion
  policy before implementation.
