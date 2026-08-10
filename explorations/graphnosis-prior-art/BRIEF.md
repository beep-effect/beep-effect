# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

This packet dissolves ([Q1](./DECISIONS.md)); what remains to shape is the two graduations that
Q1 carved out. Everything else the mining produced travels as amendments
([`research/AMENDMENTS.json`](./research/AMENDMENTS.json)) and is deliberately **not**
re-litigated here — with one exception noted below: Q6's determinism-tier constraint has no
amendment carrying it, so packet B's standards edit adopts it.

A shape-stage verification pass (2026-08-06, against main @ `4aa421d9d3`) corrected this brief in
place; the one mining error it exposed is disclosed in [`RESEARCH.md`](./RESEARCH.md) and folded
into the text below.

## Problem

**A — Contradictions have a judge but no detective.**
`goals/epistemic-contradiction-triage` builds the adjudication surface — and assumes
contradictions arrive already-found. Nothing in the tree finds them: detection is an explicit
Non-Goal (`SPEC.md:23-26`) and adding detection heuristics is a stop-and-re-scope condition
(`SPEC.md:138-139`). The donor's whole epistemic contract (contradictions surfaced to the owner,
never auto-resolved) is one we already share on the triage side; the upstream half has no owner,
and by the triage packet's own text it never will unless a separate packet exists. For a legal
product, an undetected contradiction between two office actions is not a ranking nuance — it is
the product failing at its job.

**B — Three repo-wide laws with no owning packet, one with a live counterexample.**
The trained-skills paper's governance rules are repo-law shaped, not feature shaped:

1. **Rule 5** — a minting process cannot raise its own ceiling (Q3 settled the mechanism:
   min-composed, artifact may only lower, absence = most restrictive).
2. **Per-edge lifetime caps** — bounded walks are bounded by per-**edge** lifetime caps (the
   paper's Theorem 2 mechanism, not a generic walk-level counter); every capped walk declares
   its caps and records a stop reason; cap-reached is a normal outcome, not an error (Q8
   settled ordering: caps before any adherence instrument).
3. **Law-scanner non-vacuity** — every scanner asserts its own scan matched something. The live
   counterexample: `LawScan.ts:98-183` computes `scannedFiles` and returns it unguarded; nothing
   anywhere asserts it is non-zero (`Laws.command.ts` only logs it). A glob typo would report
   the repo law-clean forever. **Corrected scope** (the mining overstated this): `runLawScan`
   is the choke point for only 2 of the 7 named modules (`EffectFn`, `FrozenGrantSet`);
   `EffectImports` and `TerseEffect` scan directly, `NoNativeRuntime` has its own loop, and
   `AllowlistCheck`/`SchemaDiagnostics` are not source scanners at all. The law needs one
   assertion per scan path — four paths, not one edit.

No active packet owns any of the three, and laws without an owner stay prose.

## Appetite

**Small-to-medium — two focused goal packets, not a campaign.** Packet A stays small by
producing against an already-shipped contract (see sketch). Packet B is medium, not small: the
non-vacuity law touches four scan paths, not one choke point. Each packet should still be one
short PR ladder (schema → service contract → first slice, per the standing design order); if
either sprawls past that, cut scope back to the first slice rather than extending the appetite.
The mining, alignment, and evidence are already paid for; these packets spend that capital, they
do not re-earn it.

## Solution Sketch

**A — `epistemic-contradiction-detection`.**

- Detection is a **pure function of a belief-view snapshot** — same determinism doctrine as
  ranking (Q2): no wall-clock, no model calls in v1, goldenable (and per Q6, any determinism
  declaration it makes ships in the same PR as its golden vectors).
- v1 detects **typed direct-conflict classes only** — negation and value-conflict between
  beliefs sharing subject + predicate.
- **Modality is a guard with a stated v1 default.** Q9 places the MATRES vocabulary on
  belief-view revision — but that exploration is at **capture stage**, so packet A must not
  block on it: v1 treats modality as an optional input, defaulting to *comparable* when absent.
  This admits false positives (a hypothetical flagged against a factual), which is acceptable
  only because every candidate lands in human triage — detection proposes, triage disposes.
  When revision ships the vocabulary, the guard tightens without a contract change.
- **Output is the shipped contract, not a new one.** `ContradictionCandidate` already exists,
  sealed and owned by the triage packet
  (`packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts:58-85`:
  `candidateKey`, `candidateDigest`, `assessment`, `matchBasis`, `pair`, …), and its
  `ContradictionAssessment` **requires** a `confidence` field. Packet A is a producer against
  that contract: conflict class rides the existing `matchBasis`/`assessment` shape, and
  confidence is emitted as a **documented per-class constant** (exact negation ⇒ one fixed
  value, value-conflict ⇒ another) — deterministic constants, never tuned scores. Any field the
  contract turns out to need is negotiated with the triage packet's owner as its own change,
  not smuggled in by the detector.
- Boundary with triage: detection is upstream-only. The stop-and-re-scope clause in the triage
  SPEC stays intact; this packet is that clause's answer, not its violation. Note the timing:
  triage is mid-flight (P2 verify in progress, yeet pending), so packet A grafts onto a
  consumer that has not closed — one more reason v1 produces against the shipped schema rather
  than extending it.

**B — repo-law bundle (working slug: `agentic-governance-laws`).**

- **Caps and non-vacuity land as scanners with violating fixtures, never prose alone** — the
  donor's conformance-fixture discipline. **Rule 5 is different by design:** per Q3 it holds by
  construction (the clamp comes from context, so a generous declaration buys nothing); its
  schema is the enforcement, and any scan for sites bypassing the schema is belt-and-suspenders
  lint, not the mechanism.
- **Rule 5:** ceiling schema (`declaredCeiling` optional, min-composed at use, absence = most
  restrictive per Q3). TierGate already owns the runtime clamp half. The first *declaration*
  site is chosen during this packet's own shaping — the mining offers no verified candidate
  (the EdgeAuthority amendment concerns the valid-interval invariant, not ceilings), so naming
  one here would be invention.
- **Per-edge caps:** `StopReason` as a LiteralKit (`completed` / `cap-reached` / `blocked`) +
  the law that capped walks declare per-edge lifetime caps and record the reason. The Skill
  model stub adopts this shape when it grows; the adherence instrument (Q8) later consumes
  these records.
- **Non-vacuity:** the law — every scanner asserts non-zero scan coverage — plus its
  deliberately-vacuous fixture. The `LawScan.ts` code fix itself lands earlier, in the
  code-change amendment PR stage (see Sequencing); packet B's first slice states the law, ships
  the fixture, and cites the already-landed fix as proof the law is enforceable. One landing,
  not two.
- **Q6 rides this packet's standards edit** (its only owner — no amendment carries it): a
  determinism-tier declaration lands only in the same PR as the golden vectors that can falsify
  it. The Q10 envelope paragraph does **not** live here — it lands in the amendment-application
  pass, per the align close.
- **Territory boundary:** `explorations/agent-governance-control-plane` is adjacent (agent
  governance surface). Packet B owns *laws and their scanners* — ceiling schema, caps,
  non-vacuity; it does not own any control-plane surface, policy UI, or runtime beyond the
  TierGate clamp that already ships. That sentence goes in packet B's SPEC as a non-goal.

**Sequencing** (also the PR ladder): packet docs-PR first → spec-delta amendments docs-PR
(carries the Q10 standards paragraph) → code-change amendment PRs (WinkCorpus tie-break;
DocText `Effect.acquireUseRelease` bracket so the caller's **existing**
`FilingTextExtraction.ts:184-194` timeout actually tears the parse down — no new timeout;
LawScan non-vacuity fix) → graduate A and B. The code PRs and graduation are independent except
where stated: B's law cites the landed LawScan fix; A does not block on belief-view revision.

## Rabbit Holes

- **Detection heuristics / ML scoring.** v1 is typed conflict classes with per-class constant
  confidence, full stop. The shipped contract's required `confidence` field is satisfied by
  those constants; the moment a *tuned* threshold or similarity score appears in a design doc,
  scope has escaped — that debate belongs to a future packet with calibration data.
- **Extending the ContradictionCandidate contract.** The schema is triage's, and triage has not
  closed. Any extension is a negotiation with that packet, never a detector-side edit.
- **The graded sensitivity taxonomy.** Q5 chose binary-at-egress; it is not part of either
  graduation and arrives only with evidence (its landing site is the ingestion-secret-scrub
  amendment).
- **The adherence instrument.** Q8 ordered it after caps; designing "what counts as deviation"
  now would stall a small safety law on a metrics argument.
- **The envelope contract as a built thing.** Q10 says paragraph; the packet-shaped version
  rots fake-active with no consuming format.
- **Modality taxonomy completeness.** Adopt the MATRES axes as-published; extending the
  vocabulary is belief-view revision's call (it owns it per Q9), not detection's.

## No-Gos

- **No auto-resolution of contradictions** — adjudication is the owner's, always (donor
  contract + our triage packet, both).
- **No confidence-reinforced-by-access** — two identical office actions must not rank
  differently because one was opened more often (rejected-candidates table,
  [`research/amendments-open-goals.md`](./research/amendments-open-goals.md)).
- **No verbatim ports** — clean-room only; if any port becomes verbatim, Apache-2.0 attribution
  attaches and must be recorded in [`research/SOURCES.md`](./research/SOURCES.md).
- **No donor or Chronocept numbers in any SPEC** — the quarantine in
  [`research/SOURCES.md`](./research/SOURCES.md) travels into both graduated packets.
- **No detection work inside the triage packet** — its stop-and-re-scope clause stays law; all
  detection scope lives in packet A, producing against triage's shipped contract.
