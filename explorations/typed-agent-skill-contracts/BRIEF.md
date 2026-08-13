# Typed Agent Skill Contracts — Brief

<!--
Stage 3. Shape Up pitch at fat-marker fidelity: concrete enough to decompose,
rough enough to leave design latitude. Sources: CAPTURE.md, RESEARCH.md
(2026-08-13 sections), DECISIONS.md. Exit: the operator confirms it matches
the picture in their head.
-->

## Problem

Agent work across beep's fleet — skills, QA judging, yeet closeout, KG pipelines, protocol
clients — is governed by prose contracts plus workflow-specific validators. The OpenLink corpus
is the cautionary tale at scale: a year of production-discovered contract shapes (65-gate
delivery contracts, evidence ladders, bounded-recovery receipts) held together by regex and
drifting prose, with generators violating their own contracts. beep is materially better off —
it already has typed receipts in silos (`QualityIssue`, `qa-inventory/v1`,
`VerifiedTextAnchor`, `ClaimGate`, `TierGate`) — but there is no shared contract kernel:
completion claims are self-reported, evidence shapes don't compose across workflows, and every
new surface re-derives its gates ad hoc. Research confirmed no external framework closes this
loop either: ACS gates policy acceptability (not deliverables), A2A/MCP type transport
lifecycles (`COMPLETED` is a server assertion), in-toto types evidence (but not skill
promises). The composition is the open ground.

## Appetite

One focused cycle for the spine: the kernel package, the qa judge-gate retrofit, and the
SKILL.md render-as-encode projection (DECISIONS 2026-08-13, grill-with-docs round). The
bounded-recovery *service* is out of the cycle — only its receipt/budget schemas ship. Later
waves (KG ingestion+eval, query/browser ops, memory routing, fleet protocol surface — in that
provisional order, per DECISIONS §spine track) are separate goal packets, not this appetite.

## Solution sketch

A new **`packages/foundation/modeling/skill-contract`** package (`@beep/skill-contract`,
schemas-only; sibling to `@beep/provenance` — home and name locked in DECISIONS §kernel home /
§kernel name after doctrine review; `foundation/capability` fails its ≥2-importer gate at
birth) holding four schema families:

1. **`SkillContract` root** — the aggregate binding a skill's promise: identity (`$I`),
   input/output schema references, the gate registry, recovery policy, and receipt types.
   The human-facing `SKILL.md` projection is rendered *from* it (md-render-as-encode via
   `@beep/md`, in wave-1 scope per DECISIONS §SKILL.md projection), never hand-maintained
   beside it, and gated by re-extraction equality.
2. **`Gate` registry** — per gate: id (LiteralKit domain), severity, applicability, typed
   evidence requirement, remediation owner. Evaluation semantics ported from ACS with
   attribution: fail-closed (unknown/invalid/missing → denial), audit-record fields bound to
   every verdict. Completion is unrepresentable while an applicable blocking gate lacks its
   evidence — the `qa-inventory/v1` required-count check generalized to construction-time.
   Verdicts are **values** (a `Denied` verdict with its audit record), following the
   `TierGateVerdict`/`ClaimGateResult` precedent; `TaggedErrorClass` errors are reserved for
   real boundary failures (evidence decode failure, invariant violation).
3. **Evidence-ladder ADT** — `Accepted → Persisted → Delivered → SemanticallyApplied` with
   terminal union `LiveVerified | DeployableBlocked | FailedWithPartialEffects`; transitions
   are monotonic and each rung demands its evidence type. The ladder is the completion algebra;
   transport-level "completed" (A2A/MCP/Temporal) maps to a low rung, never the top.
4. **Receipts, in-toto-aligned and unsigned** (per DECISIONS §receipt shape) —
   `EvidenceReceipt` (digest-bound subject, versioned `predicateType`, typed predicate),
   `FailureReceipt` (attempts, budgets consumed, partial effects, terminal reason), and a
   SLSA-VSA-shaped `GateSummary` ("all blocking gates passed", referencing exact policy and
   input digests). DSSE signing is a later wave; export is a projection. The bounded-recovery
   *service* that would consume the budget/attempt schemas is deferred to its first real
   consumer (KG or ops wave) — schemas ship now, engine later (DECISIONS §bounded-recovery).

Substrate discipline: build on `LiteralKit`/`$I`/`withKeyDefaults`; extend Effect AI's
`Tool`/`Toolkit` rather than compete; reuse `VerifiedTextAnchor`'s receipt-vs-capability split
(opaque constructor = the only path to a "verified" value). Dependency ceiling: modeling may
import only `foundation/primitive` + `foundation/modeling` — all kernel deps (`@beep/schema`,
`@beep/identity`, `@beep/provenance`, `@beep/md`) comply.

First consumer retrofit (locked at grill): express the `qa-inventory/v1` judge gate as a
`SkillContract` instance — its findings/evidence-refs/required-count invariant maps onto the
Gate + EvidenceReceipt families, and `JudgeCheck`'s artifact/witness cross-checks become typed
gate evidence — proving the kernel composes with a live workflow rather than existing beside
it. The wave-1 projection proof renders that contract's own SKILL.md.

## Rabbit holes

- **Signing/key management** — explicitly deferred; do not let DSSE sneak into the spine.
- **A generic statechart engine** — steal XState vocabulary and testing ideas only; phase
  typing is Effect schemas/services, not a runtime interpreter.
- **Retrofit sprawl** — one consumer in the first slice; resist "while we're here" migrations
  of every yeet lane and QA check.
- **The ACS adapter** — vocabulary now, adapter later (DECISIONS §ACS posture); building the
  adapter belongs to a later wave.
- **Gates that claim semantic truth generically** — gates check typed evidence; semantic
  validators are per-domain plugins. A receipt proves an assertion was made and bound to
  bytes, not that it is true — re-extraction from authoritative artifacts is the only
  generic truth mechanism this packet endorses (pattern 3).

## No-gos

- No porting OpenLink implementations (regex validators, shell harnesses, secret handling) —
  contract *shapes* only, with attribution (SOURCES §2).
- No new envelope/attestation format competing with in-toto — align, then project.
- No protocol clients (A2A/ActivityPub) or credential-chain work in the spine.
- No SLSA build-provenance claims where no build occurred — packet-specific predicates only.
- No regex/substring gate evaluators — every gate decodes typed evidence or fails closed.
