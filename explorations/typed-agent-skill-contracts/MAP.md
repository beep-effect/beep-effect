# Typed Agent Skill Contracts — Map

<!--
Stage 4. Candidate goal packets, sequencing with rationale, the first vertical
slice, inherited risks, and the capability check. Sources: BRIEF.md,
DECISIONS.md, research/inventory/ verdict tables.
-->

## Candidate goal packets

| # | Slug | Mission | Depends on | Status |
|---|------|---------|-----------|--------|
| 1 | `skill-contract-kernel` | Build `@beep/skill-contract` (foundation/modeling, schemas-only), retrofit the `qa-inventory/v1` judge gate as its first live consumer, and render + re-extraction-gate its SKILL.md projection via `@beep/md`. | — | **GRADUATED 2026-08-13** → [`goals/skill-contract-kernel/`](../../goals/skill-contract-kernel/) |
| 2 | `kg-ingestion-contracts` | Typed source→KG ingestion pipeline: frozen `IngestionManifest`, phase-typed state machine with compensations, canonical-IRI policy service with evidence-bearing decisions, claim-level span ledger emitting PROV-O; Barrister-style gold-path CI gates. | 1 (receipts, ladder) | candidate |
| 3 | `ops-evidence-ladder` | Evidence-ladder retrofit onto yeet verdict/monitor lanes; first real implementation of the bounded-recovery service against the kernel's budget/attempt schemas. | 1 | candidate |
| 4 | `browser-lease-capabilities` | Fresh-ref epochs, exclusive tab leases with fencing, capability-scoped default-off browser action set, human-handoff protocol state for the beep qa loop. | 1 (gates) | candidate |
| 5 | `memory-routing-manifest` | Intent→context routing manifest as schema-validated data (extending `@beep/ai-sync`), plus the transcript-audit gate proving memory reads preceded first response; SKILL.md projections for `.claude/skills` become kernel-backed here. | 1 (contract root, projection) | candidate |
| 6 | `fleet-protocol-contracts` | A2A/ActivityPub typed protocol clients with discovery-before-invocation phase typing; credential-chain state machine; shared OAuth/PKCE service. | 1 (evidence types) | candidate |

## Sequencing rationale

DECISIONS §spine track: the kernel is the dependency of every other wave, the ACS/in-toto
research findings land in it, and it has immediate in-repo consumers. Waves 2–6 are ordered by
product pull (KG work feeds the legal/patent bet), retrofit concreteness (yeet, qa), then
greenfield surface (protocols last — least consumer pull until kernel evidence types exist).
Waves 2–6 graduate only after their own shape passes the definition-of-ready; picking one up
reopens this `graduated` packet at `decompose` for that shape pass (graduation contract;
DECISIONS 2026-08-24 §status flip).

**Track → candidate mapping** (the locked decision names five *tracks*; this map yields six
*goal candidates* because the contract-kernel track spawns a second, consumer-retrofit goal):
contract kernel → #1 (spine) **and** #3 (its evidence-ladder/recovery retrofit onto yeet);
KG ingestion+eval → #2; query/browser ops → #4; memory routing → #5; fleet protocol surface →
#6. DECISIONS §spine track carries the same mapping note.

## Cross-packet coordination: protocol-as-value (2026-08-24)

[`explorations/protocol-as-value`](../protocol-as-value/README.md) (at `shape`, no MAP yet)
proposes a journal/register/fold substrate with canonical encoding and versioned digests that
overlaps several waves here. Re-check this section when that packet reaches decompose:

- **Wave 2 (kg-ingestion-contracts):** its manifest/state-machine/evidence-ledger/PROV-O work
  should consume that substrate or declare a compatibility seam, not re-derive it.
- **Wave 3 (ops-evidence-ladder):** the yeet lane is one of the journal/register instances the
  protocol brief wants to collapse — avoid a second audit/register vocabulary.
- **Wave 4 (browser-lease-capabilities):** reuse its fenced-register/refusal-value types if
  they land first.
- **Wave 6 (fleet-protocol-contracts):** strongest interaction — clients, credential chains,
  and OAuth/PKCE stay in wave 6; the transport-neutral global protocol value, per-role
  projections, and conformance folds belong to the protocol kit. Their future MAPs need an
  explicit dependency or handshake; fleet messaging is a named first consumer on the
  protocol side.
- **Kernel receipts (goal 1):** digest-bound subjects use today's digest types with an
  explicit migration seam to the proposed canonical-encoding substrate — no competing
  canonical encoding (DECISIONS 2026-08-24 §digest seam).

## Amendment J re-entry (2026-08-26)

[`packet-system-redesign`](../packet-system-redesign/README.md) D22 reshaped
gate certificates onto the existing `@beep/skill-contract` kernel; D24 routes
the next shape pass here rather than reopening the completed kernel goal or
coupling it to `packet-convention-migration`.

Binding inputs for decompose:

- in-toto Statement envelope shape is allowed internally; signing and external
  verification remain deferred;
- outcomes are EARL/ACT `passed | failed | cantTell | untested |
  inapplicable`, not the kernel's current two-valued `allowed | denied`;
- reach is `complete | incomplete | unknown`, never nullable `conforms`;
- inconclusive checks are excluded from aggregate success by the producer;
- apply-by-id is a separate digest-bound plan with stale/unknown-id refusal;
- the first slice is one certificate-producing QA judge settlement.

The open decomposition choice is whether this becomes candidate 7,
`skill-contract-gate-certificates`, or amends an existing later-wave candidate.
It does not amend candidate 1 after closure, and candidate 3's current Yeet and
bounded-recovery mission must not absorb it without an explicit MAP amendment.

## First vertical slice (inside goal 1)

Define `Gate` + `EvidenceReceipt` schemas only; express **one** existing `JudgeCheck` rule
(cited-artifact-exists) as a typed gate returning a fail-closed verdict value; prove behavior
parity with the existing check in tests. Only then widen to the full `SkillContract` root,
ladder ADT, remaining receipt families, and the SKILL.md projection. If the slice fights the
substrate (e.g. opaque-constructor ergonomics), the fight surfaces before the surface is wide.

## Capability check

Per the graduation contract: every major component cites an existing repo capability or is
explicitly NET-NEW. Verdicts from [`research/inventory/`](./research/inventory/) (full
`file:line` tables inside):

| Component | Verdict | Source |
|-----------|---------|--------|
| Literal domains, derived guards, tagged unions (`LiteralKit`) | EXISTS | `@beep/schema` — [contract-kernel-evidence.md §1](./research/inventory/contract-kernel-evidence.md) |
| Identity/annotation composers (`$I`) | EXISTS | `@beep/identity` — same §1 |
| Schema defaults (`withKeyDefaults`) | EXISTS | `@beep/schema` — same §1 |
| Receipt-vs-capability split (opaque constructor) | EXISTS | `@beep/provenance` `VerifiedTextAnchor` — same §5 |
| Verdict-as-value precedent | EXISTS | `@beep/mcp-kit` `TierGateVerdict`, `@beep/epistemic-use-cases` `ClaimGateResult` — same §5, [protocol-query-memory.md §2](./research/inventory/protocol-query-memory.md) |
| Retrofit target schemas + evidence cross-checks | EXISTS | `@beep/repo-cli` `Inventory.schemas.ts`, `JudgeCheck.ts` — contract-kernel-evidence.md §4 |
| Markdown document model for the projection | EXISTS | `@beep/md` (`render`/`renderUnsafe` one-way rendering; the deprecated `DocumentToMarkdown` `S.encode` path is not the target — DECISIONS 2026-08-24) |
| `SkillContract` aggregate root | NET-NEW | contract-kernel-evidence.md verdict table, port 1 |
| Evidence-ladder ADT + terminal union | NET-NEW | same, port 2 |
| In-toto-aligned receipt family (`EvidenceReceipt`/`FailureReceipt`/`GateSummary`) | NET-NEW (vocabulary from in-toto/SLSA) | same, ports 1/4; [workflow-evidence-frameworks.md §6](./research/landscape/workflow-evidence-frameworks.md) |
| Fail-closed gate evaluation + audit records | NET-NEW (vocabulary from ACS) | [skill-contract-formats.md §9](./research/landscape/skill-contract-formats.md) |
| Bounded-recovery service | NET-NEW, **deferred** (schemas only in wave 1) | DECISIONS §bounded-recovery |

## Inherited risks

- **Retrofit parity**: the qa judge gate is live tooling; the retrofit must prove behavioral
  parity, not adjacent behavior (first-slice test requirement above).
- **Projection without its real consumers**: the SKILL.md projection ships before
  `.claude/skills` files consume it (operator accepted; DECISIONS §SKILL.md projection) — the
  re-extraction gate must be real, or the projection is decoration.
- **Spec churn upstream**: ACS is 0.3.1-beta; vocabulary is ported, not depended on. in-toto
  alignment is shape-only (unsigned), so drift risk is low.
- **Naming adjacency**: agents slice owns a persisted `Skill` entity; kernel symbols must stay
  distinct (`SkillContract`, not `Skill`).
