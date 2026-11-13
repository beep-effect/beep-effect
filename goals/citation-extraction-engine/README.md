# Citation Extraction Engine

Lifecycle: completed-retained. On 2026-11-08 the operator approved replacing exhaustive
parity with bounded six-form extraction and document-local linking. The six
forms are full/short case, Id., supra, 35 U.S.C. and 37 C.F.R. on supplied plain
text, with exact verified UTF-16 source anchors and explicit ambiguity.

This is a replacement completion contract, not another first slice. Historical
parity obligations are superseded, not claimed complete. Preserve the merged
engine, schemas, prerequisite contracts, attribution and useful evidence until
the actual implementation comparison establishes what to keep or replace.

Start with [GOAL.md](GOAL.md), [SPEC.md](SPEC.md), [PLAN.md](PLAN.md), and the
[scope ruling](decisions/2026-11-08-six-form-completion-contract.md). The
[research assessment](research/2026-11-08-re-grounding.md) explains the strategy
change; the [source ledger](research/SOURCES.md) retains earlier provenance.

The frozen selection screen and actual native/TypeScript comparison support the
[selection decision](decisions/2026-11-08-select-typescript-recognizer.md): exact
eyecite-ts 0.34.2 behind a product-neutral driver. The actual server-only
CitationExtractorLive now composes isolated recognition, genuine source and
component verification, existing mention/authority identities and strict local
linking. The legacy four-operation CitationEngine remains available. No Python
runtime change or API retirement is part of this delivery.

The [public Layer receipt](history/evidence/2026-11-08-six-form-public-layer.md)
records all 29 frozen inputs / 33 expected occurrences passing on Bun and Node,
and 16 public resource/capture/regression controls. These are finite-profile
results, not general accuracy or deployment attestation. The implementation and
review fixes merged in final [PR #2966](https://github.com/beep-effect/beep-effect/pull/2966)
on 2026-11-09 (`9f44753a8c1`) through a ruleset bypass. Heavy / Check, Heavy /
Test Integration, Heavy / Docgen and Heavy / Doctest were cancelled on its head;
[`decisions/2026-11-13-final-2966-attributed-reds.md`](decisions/2026-11-13-final-2966-attributed-reds.md)
attributes each one with its fix PR. The `closeout` record names #2966; the
[batch migration](../goal-closeout-hosted-verification/history/migration-2026-11-13.md)
adopted it from the legacy proposal.

The original packet is recoverable at git commit 7dc8c2d443d. Original corpora,
decisions, checkpoints and ledgers remain as historical evidence, not release
gates. No superseded exhaustive row is promoted by this bounded delivery.

Source of lifecycle and routing: [ops/manifest.json](ops/manifest.json).
