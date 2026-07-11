# LangExtract Capability

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

### Closeout reconciliation (2026-07-11)

Retroactive closeout: the work shipped weeks ago but the manifest stayed at
"P4 Implement in-progress" since 2026-06-07. Git evidence:

- `@beep/langextract` landed on main 2026-06-07/08
  (`3961138de6` feat(langextract) plus hardening fixes through `33b0e0b378`)
  with source, tests, and docs at `packages/foundation/capability/langextract`.
- It is consumed in production by the office-action extraction rung
  (PR #265, merged 2026-06-18).
- P5 (quality review fix loop) is marked completed because the repo-wide
  crispening/standards remediation waves (PRs #294-#326, with ratchets now
  blocking) ran over this package and subsume the planned packet-local review
  loop.

## Mission

Deliver a canonical research-first execution packet for `@beep/langextract`, an
Effect v4-native foundation capability for LLM-powered structured extraction
with source-grounded character spans.

The implementation target is a provider-neutral extraction substrate inspired by
`google/langextract` and the cloned Effect v3 reference port, while preserving
repo architecture law and reusing `@beep/nlp` primitives before introducing new
models.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/langextract-capability/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Closed (all phases completed; see Closeout reconciliation above).

## Latest Evidence

[`history/2026-06-07-packet-bootstrap.md`](./history/2026-06-07-packet-bootstrap.md)
records the packet creation verification.

[`research/synthesis.md`](./research/synthesis.md) records the accepted
implementation proposal. The proposal review inventory is stored in
[`research/reports/proposal-review-round-1.md`](./research/reports/proposal-review-round-1.md)
with zero required findings.

## Source material

The gold-intake provenance for the folded research note lives in
[`research/SOURCES.md`](./research/SOURCES.md): mined nuggets → upstream
repos+licenses → external citations → composed `@beep/*` bricks. It derives from
the `_gold-intake` initiative
([`explorations/_gold-intake/`](../../explorations/_gold-intake/)) and the
sibling exploration
[`explorations/deterministic-doc-structure-extraction`](../../explorations/deterministic-doc-structure-extraction)
(which owns the net-new streaming-gate + deterministic-regex half of the cluster).

## Notes

- `@beep/langextract` belongs in `packages/foundation/capability/langextract`
  only while it stays provider-neutral substrate.
- General reusable NLP primitives must be reused from or promoted into
  `@beep/nlp` instead of duplicated.
- Provider adapters, provider env config, CLI workflows, rendering, and
  visualization are V1 non-goals for the foundation package.
- 2026-06-29: gold-intake research note added at research/gold-intake-anti-inference-prompt-mode.md (see for anti-inference "pure-OCR" prompt-mode + JSON-contract candidate prompts + n-best/null-score scoring + context-budget chunking).
