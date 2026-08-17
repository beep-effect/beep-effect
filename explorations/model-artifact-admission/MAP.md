# Map — Model Artifact Admission

Status: RATIFIED BY OPERATOR 2026-08-17 with the five adversarial-review
amendments below (8-lane grok+codex review; reports in
`research/2026-08-17-adversarial/`).

## Ratification amendments (2026-08-17)

- **A. The fixture disposition is `restricted`** (carrying the scope kits) —
  never a scoped `admitted`, which A3 does not define. `admitted` remains the
  unscoped status.
- **B. The fixture is the CHAT ARRANGEMENT with a closed component set:**
  materialized model id, `maxTokens`, system-prompt digest,
  tool-wrapper/`toolChoice` semantics, output-parser version, retry plan.
  Live code holds **three** arrangements (chat kernel, repair model, filing
  model); the repair and filing arrangements are named as the second and
  third admission candidates rather than hidden behind "the pinned default".
- **C. Kits enumerated v1** (admission-local): role
  `[matter-work, internal-tooling, lab]`; data-class
  `[client-matter, public, synthetic]`; modality `[text, image]`. The A1
  assurance floor becomes a policy table over (role, data-class) → minimum
  assurance tag.
- **D. Digest payload = identity envelope + ordered component digests ONLY**
  — never entity identity fields (`id`/`createdAt`/`orgId` would make
  rebuilds unstable by construction). The digest builder lives server-side,
  where driver imports are legal; the domain stays driver-free.
- **E. Referential integrity and completeness:** a disposition's referenced
  qualification must reference the same arrangement revision
  (schema-level invariant), and qualification completeness = every evidence
  envelope field present or explicitly marked not-applicable — absence is
  recorded, never omitted.

Per the prospective-path rule, candidate goals are named by slug only until
the operator ratifies this MAP and a lane/queue decision creates the packet.

## Candidate Goal Packets

| Order | Proposed slug | Mission | Dependencies | Live capability composition |
| --- | --- | --- | --- | --- |
| 1 | `model-arrangement-admission-core` (not yet created) | Deliver the ratified admission substrate: content-addressed `ModelArrangementRevision` (provider-attested identity envelope + controlled-component digests), `ModelArrangementQualification` (evidence envelope), `ModelArrangementDisposition` (five statuses, restricted scope kits, human-only supersession), the three-tier assurance floor, and the two-axis as-of eligibility query. First fixture (ratified): admit the repo's own live pinned arrangement. First consumer contract (ratified): the professional runtime approval gate references an admission-disposition id. | Agents + epistemic-pattern reuse; no external gates. | Reuse `ProviderInstance` (public identity fields; no-token law), the Anthropic driver's pinned-default config as the fixture arrangement, `ClaimDisposition` as the record-shape precedent (not a reusable type), the `EdgeAuthority` half-open two-axis predicate as the as-of pattern, `RuntimeUsageRecord` as linked execution evidence, `LiteralKit` for assurance/status/role kits (admission-local, net-new). NET-NEW: all three schemas, assurance kits, digest rules, eligibility query. |
| 2 | `model-admission-eval-harness` (not yet created; **gated**) | Author and freeze evaluation-plan revisions (corpus digests, per-case typed results, sentinel suites) that qualifications consume. | `model-arrangement-admission-core`. **Gate:** the first real (non-fixture) qualification demands more than recorded-evidence envelopes. | Reuse docgen/proof-manifest determinism patterns; qa judge-gate precedent for typed verdicts. |
| 3 | Runtime enforcement wiring (described, not a slug; **gated**) | Approval gate consults admission eligibility before candidate review. | Core + the approval-gate consumer landing in the professional runtime's own roadmap slot. | ProfessionalRuntime approval contracts. |

## Dependency Edges

```text
model-arrangement-admission-core
  -> model-admission-eval-harness      (gated: first real qualification)
  -> runtime enforcement wiring        (gated: approval-gate consumer)
```

## Chosen First Vertical Slice

Admit the repo's live pinned arrangement end to end: build its
`ModelArrangementRevision` (real identity envelope, real component digests),
record a minimal `ModelArrangementQualification` (identity-assurance evidence
+ deterministic invariant checks only), record an `admitted`-status
disposition scoped to non-matter internal tooling, and prove:

- the arrangement digest is stable across rebuilds (canonical ordering);
- a mutated component digest yields a NEW revision and the old disposition
  does not transfer (no inheritance);
- the as-of query answers eligibility at (`validAt`, `knownAt`) and a
  superseding disposition flips it without mutating the prior record.

Not in the slice: eval-harness authoring, runtime enforcement, any
requalification automation, any UI.

## Inherited Constraints (binding)

- No disposition inheritance across revisions; human-only supersession.
- No scalar trust score. No credentials or raw probe output in records.
- Epistemic edge vocabulary stays closed (`supports|refutes|contradicts`).
- Admission grants scope eligibility only — never an `ExecutionVerdict`,
  never a release.
- Role/modality/data-class kits are admission-local (ratified amendment).

## Re-entry Gates

- Eval-harness and enforcement gates above reopen this packet at decompose.
- An assurance-ladder change (new provider attestation kinds) is a
  `keyVersion`-style revision through reopened decompose.
