# Brief — Harvey LAB Firm-Knowledge Mining

Status: OPERATOR-RATIFIED 2026-08-13.

## Problem

The repo has strong schema, provenance, judge, and legal-domain foundations,
but it lacks a durable Effect-native rubric evaluation surface and does not
prove that OOXML tracked changes survive ingestion into the canonical Md
model. Harvey LAB's synthetic Calderwood & Harkness corpus supplies realistic
distributed firm knowledge and graded tasks, while its own harness is
redline-blind. This makes tracked-changes-aware ingest the narrow, legally
meaningful wedge and the corpus a standing measurement asset.

## Appetite

One cycle split into two independently shippable goals: first an Effect-native
evaluation framework plus one externally comparable upstream baseline run;
then the tracked-changes ingest wedge. A fixture spike is the wedge's P0
kill-gate. Corpus generation and DMS taxonomy remain re-entry points.

## Solution Sketch

1. Pin the synthetic C&H corpus as an on-demand standing test asset with
   provenance and containment rules. Run the upstream podman + metered-key
   harness once to capture a comparable baseline; do not retain it as the
   durable evaluation runtime.
2. Build a repo-native eval surface from the methodology, not a code port:
   schema-first rubrics, isolated criterion judge calls, all-pass plus
   diagnostic scoring, closure/precision criteria, neutral-band outcomes,
   typed judge services, and integration with existing judge/QA evidence.
3. Before tracked-changes implementation, run the U4 fixture spike across
   OOXML/Pandoc/Md boundaries. Prove `w:ins`/`w:del` identity, ordering, and
   content survive. If the seam fails hard, stop the semantic redline design
   and fall back to an explicit structural representation.
4. On a passing spike, land the smallest tracked-changes-aware ingest rung and
   evaluate it first against synthetic C&H fixtures. Real OIP diligence data
   remains on-device only and outside this cycle.

## Rabbit Holes

- The upstream harness needs podman, pandoc, and metered API keys; the baseline
  is a one-time operator-approved run, not routine CI.
- The public corpus is large; pinning and on-demand storage must not silently
  add 5+ GB to the repo or normal gates.
- Generic Pandoc `Span`/`Attr` may carry redline information, but survival
  through Md-canonical is unproven; U4 decides.
- All-pass arithmetic and inferred task taxonomies are hypotheses unless the
  eval records their assumptions.
- OIP corpora must never enter telemetry, remote evaluation, or C&H mounts.

## No-Gos

- No Python LAB eval port as the durable framework.
- No real client corpus in the first cycle.
- No tracked-changes implementation after a failed U4 kill-gate without a new
  operator decision.
- No corpus generator or DMS taxonomy implementation in these two goals.
- No claim that C&H is acceptance proof for practice-KG or general legal AI.
