# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-13 — spine track

**Question:** Which of the five candidate tracks (contract kernel, KG ingestion+eval, fleet
protocol surface, query/browser ops, memory routing) is the packet's spine — the one the first
goal packet(s) build, with the others as later waves consuming it?

**Answer:** All five tracks stay in scope ("everything that you found valuable"), sequenced by
the agent's valuation with **contract kernel + evidence ladder (ports 1–2) as the spine**.
Provisional wave order behind it: KG ingestion+eval (strongest product pull toward the
legal/patent KG work), query/browser ops (most concrete retrofit target in `beep qa`), memory
routing, fleet protocol surface last (fully greenfield, least consumer pull until the kernel
defines the evidence types protocols would carry).

**Rationale:** The operator declined to prune; the answer is a sequencing statement, not a
single-cycle scope — decompose maps all tracks as candidate goal packets, the first slice
builds only the kernel. Kernel-first was the recommendation because every other track depends
on its types, the ACS/in-toto research findings land there, and in-repo consumers already
exist (yeet verdicts, `qa-inventory/v1`, `ClaimGate`). Rejected as spine: KG ingestion+eval
(would hand-roll kernel pieces ad hoc), query/browser ops (narrower payoff), fleet protocol
surface (greenfield without kernel evidence types).

## 2026-08-13 — ACS posture

**Question:** How should the contract kernel position itself against Microsoft's Agent Control
Specification (the closest "gate + evidence receipt" prior art, MIT, 0.3.1-beta draft;
`research/landscape/skill-contract-formats.md` §9)?

**Answer:** Adopt vocabulary now, adapter later (recommendation accepted). Port ACS's
fail-closed decision semantics, intervention-point vocabulary, and audit-record field
discipline into the kernel schemas with attribution; an actual ACS adapter (their governance
verdicts as prerequisite gate evidence) stays a later-wave goal candidate.

**Rationale:** Interop-ready without coupling the spine to a beta external spec. Rejected:
full adapter in the spine (couples the first slice to a spec that can churn; beep has no
ACS-governed runtime today); purely native (reinvents named fail-closed vocabulary, weakens
positioning, forfeits cheap future interop).

## 2026-08-13 — receipt shape

**Question:** Should the kernel's evidence receipts adopt the in-toto attestation shape or a
leaner native one? (`research/landscape/workflow-evidence-frameworks.md` §6)

**Answer:** in-toto-aligned schemas, unsigned first (recommendation accepted).
`EvidenceReceipt`/`FailureReceipt` as Effect Schemas mirroring the Statement split —
digest-bound subject, versioned `predicateType`, typed predicate — plus a SLSA-VSA-shaped gate
summary. DSSE signing/envelopes deferred to a later wave; in-toto export becomes a projection,
not a migration.

**Rationale:** Aligning the shape is nearly free and buys named vocabulary + cheap export;
signing drags key management and signer identity into a first slice where no consumer requires
signatures. Rejected: full in-toto from day one (key discipline too early); lean native shape
(re-derives what in-toto standardized, makes export a migration).
