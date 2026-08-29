# Research — Patent Citation Candor Gate

<!--
Stage 1 synthesis and index. The depth lives in the two lane artifacts under
research/; this file is the canonical cold-session surface over them
(explorations/README.md stage contract). Lanes ran 2026-08-04, codex-only
(GPT-5.6 Sol, xhigh) per DECISIONS.md.
-->

## Lane artifacts

1. [`research/01-repo-surfaces.md`](./research/01-repo-surfaces.md) — grounded
   file:line inventory of every live surface and in-flight SPEC contract the
   wedge composes, reconciled against nuggets `T2-F2`/`T3-F7`/`ADHD-1`;
   net-new symbols re-confirmed at zero occurrences.
2. [`research/02-candor-legal-frame.md`](./research/02-candor-legal-frame.md) —
   bounded candor/IDS legal frame from six public primary-source captures
   (37 CFR 1.56/1.97/1.98, MPEP 2001/609, Therasense en banc opinion), with
   the never-compute boundary drawn and cited. Captures are gitignored
   working copies under `assets/vendor/legal-sources/`, reproducible from the
   upstream URLs in [`research/SOURCES.md`](./research/SOURCES.md) §3.

Provenance ledger: [`research/SOURCES.md`](./research/SOURCES.md).

## What the landscape says (synthesis)

**The composition surface is real and sufficient for the first rung.** Live
source provides `PatentReference` (three optional fields: country, number,
kind code), `PriorArtReference` (an examiner-linked occurrence with
office-action fixture semantics the wedge would supersede), `Claim`,
`TextAnchor`/`VerifiedTextAnchor`, `EvidenceSpan`, and the
`RuntimeCandidateDraft`/`RuntimeApprovalGate` pair — which today has **no
candor or observation-version field** (confirmed at the contract site). The
`ExecutionLedger` ports are the append-only precedent for an event-shaped
law-practice record. Everything deeper (CitationMention, prosecution
observations with release/code/mapping identity, hardened anchor drift rules)
exists only as SPEC contract in the three active goals and is compose-only
per the locked dependency posture.

**The legal frame bounds the schema, not the other way around.** Rule 56
materiality (regulatory, PTO practice) and Therasense but-for materiality
plus the affirmative-egregious-misconduct exception (litigation defense) are
distinct standards with distinct roles; the system must preserve two separate
attorney-judgment slots and may never compute either, never compute
cumulativeness or intent, and never infer duty satisfaction from the absence
of recorded events. What the system MAY record is enumerable fact state:
1.97 timing-window arithmetic from dates, 1.98 content presence (list,
copies, concise explanation, translations), fee/statement acts,
supplemental-IDS lineage, and observation staleness against source versions.

**The false-closure risk named in CAPTURE is the design center.** Both lanes
converge on it: closure claims must bind to exact observation versions
(Lane A: the gate lacks the field; Lane B: an unscoped "duty satisfied"
boolean is legally incoherent under 1.56(a)).

## Open questions carried to align

The two manifest `openQuestions` (PatentFragmentLocator home; which IDS
mechanics CandorDisposition records) plus Lane B's align questions 1–10 —
notably: disposition vocabulary (Q3), per-observation-version binding vs
documented grouping (Q4), dual cumulativeness judgments (Q5), 1.97(e)
statement facts (Q6), supplemental-IDS relation model (Q7), continuing-
application matrix scope (Q8), and "duty satisfied" as dated scoped opinion
only (Q9).
