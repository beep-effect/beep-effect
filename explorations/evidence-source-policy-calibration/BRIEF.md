# Brief

## Problem

G3 is about to freeze a semantic ingestion contract. A single confidence number
would mix the source's reliability, its expressed certainty, the extractor's
certainty, structural validation and a human decision. Existing bricks already
show the difference: optional model confidence survives alignment, span
confidence is required, source verification is independent of human approval,
and gate dispositions can be produced by a system principal. Consumers need
those distinctions on every extracted claim, including when an assessment is
missing or a once-current review is stale.

## Appetite

One bounded docs-only field-design wave, ending at shape before G3 scaffold.
Deliver cited research, closed alignment rounds and one ratified v1 contract.
Implementation, calibration experiments, threshold tuning and production corpus
operations consume G3's appetite and require its own acceptance gates.

## Solution Sketch

Each extracted claim represents a source-local assertion with exact source/text
versions and evidence spans. It carries five Option fields from the
[2026-10-09 ratification](./DECISIONS.md#2026-10-09--ratified-evidence-signal-field-set-v1):
sourceTrust (pinned scoped assessment reference), sourceAssertionConfidence,
extractorConfidence, validatorScore (structured report assessment), and
reviewerDisposition (accepted/rejected/abstained human decision).

A shared assessment envelope records producer/activity/version, basis,
calibration applicability and bitemporal history. Source and reader lineage stay
addressable. Changed inputs or judgments append a superseding assessment;
source copies do not become extra independent witnesses. Missingness is explicit
and never manufactures zero. Raw self-reports remain uncalibrated until evaluated.

Compose UnitInterval, source anchors, extraction-confidence fields, existing
human evidence basis/review, ClaimGate severity records and temporal edge
semantics. The five-field assessment envelopes, source-policy references,
full validation-report adapter and negative/abstain human review events are
NET-NEW G3 work. Existing code does not already implement the entire contract.

Synthetic acceptance examples: two mirrored documents retain separate claims
and shared lineage without two votes; a source with no declared certainty keeps
None even when the extractor emits 0.9; a warning report retains conforms=false
while a separate policy might allow admission; a changed prompt makes an old
review inapplicable without deleting it; an unseen entity keeps unavailable
validation distinct from a zero confidence.

G3 seeds its SPEC from DECISIONS and pins evidence-signals/v1 in the semantic
freeze. Re-entry here is decompose when G3 is scaffolded, not graduation now.

## Rabbit Holes

- Universal source reputation: trust is scoped, policy-bearing and revisable.
- Translating hedging into probability without a rubric or calibration evidence.
- Assuming an old required span score supplies missing model/prompt metadata.
- Adopting a graph plausibility score as SHACL conformance or citation support.
- Source-dependence detection at scale: retain unknown lineage and avoid false
  independence while G3 selects and evaluates its implementation.
- Assuming gated shapes or a bounded validator cover the final semantic seed.
- Treating aggregate calibration as proof of an individual claim's truth.
- Confusing lifecycle active/rejected/superseded with a human review decision.

## No-Gos

- No stored collapsed confidence or ranking score, including caches.
- No destructive evidence fusion, overwrite-on-rescore or delete-on-retraction.
- No fabricated values, calibration labels, historical versions or independent
  source status; no automatic human approval.
- No sixth top-level OCR signal; reader uncertainty stays in input provenance.
- No schema/package code, practice documents, paid services, goal scaffold,
  decompose or graduate in this lane.
- No post-freeze semantic change without a G3 migration retaining old history.
