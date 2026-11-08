# Citation Extraction Engine

Lifecycle: active. On 2026-11-08 the operator approved replacing exhaustive
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

Next: freeze a small reviewed public profile, compare the current public Layer
and pinned TypeScript candidates with official eyecite as a diagnostic, then
record the least costly passing implementation. No production dependency or
Python runtime has been selected. Keep resource ceilings and use Effect's
provided primitives before introducing custom infrastructure.

The original packet remains recoverable at git commit 7dc8c2d443d. Original
corpora, decision/checkpoint records and ledgers remain in this packet for
history. They are not the new release gates. PR #2927 is retained on main; owned
CI repairs and bounded implementation/verification remain open.

Source of lifecycle and routing: [ops/manifest.json](ops/manifest.json).
