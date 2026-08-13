# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-08 — C&H corpus is a standing test asset

**Question:** Is the Calderwood & Harkness corpus a one-off research subject,
or a standing asset the project tests itself against?

**Answer:** Standing asset. The C&H corpus (and the 250 graded firm-knowledge
tasks over it) can and should be leveraged to test aspects of beep-effect
against — ingestion, retrieval, indexing, knowledge-graph construction,
agentic search, judge pipelines, and whatever else touches scaled corpora.
Any goal graduated from this packet must carry this directive forward in its
SPEC (this entry seeds the goal decision log per the graduation contract).

**Rationale:** Benjamin, mid-mining-run (2026-08-08, verbatim intent): "it
[is] worth our time to potentially leave a record in the exploration & any
graduated goals that this knowledge corpus can and should be leveraged to
test various aspects of our project against. Injestion, retrieval, etc."
The corpus is MIT-licensed, realistic (real OOXML work product, distributed
context, no grep-able keywords), persistent, and comes with rubric-graded
ground truth plus published frontier baselines — a rare external benchmark
that measures exactly the amortized-representation bet beep is making.
Rejected alternative: treating this packet as pattern-mining only, discarding
the corpus after research — that would waste the graded ground truth.

## 2026-08-08 — LAB eval code: reference for roll-our-own, not a port

**Question:** Do we port harvey-labs' evaluation code, or build our own eval
framework using theirs as reference?

**Answer:** Roll our own, better. Use their eval code (rubric schema, LLM
judge, criterion-scoped deliverables, all-pass scoring, dual-judge profile)
as reference material for an Effect-native eval framework we build ourselves.
MIT would permit a direct port, but the disposition for `lab-eval` in
`research/SOURCES.md` is deliberately set to reference-for-roll-our-own.

**Rationale:** Benjamin, same message: "I think it's the right move to use
their eval code as reference material for an even better one we roll our
selves." Their harness is ~1.7k lines of Python glue; the durable value is
the methodology, not the code. An Effect-native rebuild gets schema-first
rubrics (Effect Schema instead of loose JSON), typed judge services, and
integration with the existing beep qa / judge-inventory machinery instead of
a parallel Python stack. Rejected alternatives: (a) vendoring/porting their
Python — wrong runtime, parallel stack to maintain; (b) running their harness
as-is long-term — acceptable only as a bootstrap/baseline harness while ours
does not exist yet.

## 2026-08-13 — Align closed: tracked-changes wedge and eval shape

**Decision:** The wedge is tracked-changes-aware ingest. The U4 fixture spike
is its P0 kill-gate. A 2026-08-13 code check found no explicit `ins`/`del`
handling in `pandoc-ast`; generic `Span`/`Attr` likely carries the information
at the Pandoc layer, but survival through md-canonical is unproven. If U4 fails
hard, fall back to structural representation.

The first corpus is synthetic C&H. A real diligence data room comes later and
remains on-device only under OIP confidentiality. Run the upstream
podman+metered-keys harness once for an externally comparable baseline, then
build the Effect-native eval as the durable surface.

Decompose into two goals: (1) the eval framework, including the one baseline
run; and (2) the tracked-changes wedge rung. Generator and DMS rungs remain MAP
re-entry points.

**Rationale:** This selects the unclaimed, OIP-load-bearing wedge while making
the uncertain conversion boundary fail fast and preserving an evidence-based
fallback.
