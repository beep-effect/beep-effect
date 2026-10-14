# Friction Receipts

Recorded as each one happened. Paths are home-relative.

## 2026-10-14: the synthesis agent overstated numbers it had been given correctly

- **Doing:** relaying the headline claims of the 57-agent literature sweep.
- **Evidence:** a refutation pass gave 15 headline claims to separate agents, each told to read
  the primary source and refute the claim. 8 were confirmed and 7 were partly wrong; none was
  refuted outright. Examples:
  - The synthesis invented an XGBoost baseline for PANORAMA (arXiv 2510.24774).
  - It claimed MarkushGlyph (2607.28532) changed model rankings, but rankings were unchanged.
  - It reported "69–94% newest-version bias" for 2608.14610. That is actually a share of errors,
    and the top end came from a small legal model.
  - It generalized court-opinion pinpoint recall (2608.12571) to every document type.
  The corrections are folded into [SWEEP-2026-10-14.md](./SWEEP-2026-10-14.md), with an appendix
  listing all 15 verdicts.
- **Prevention:** a sweep's synthesis stage is not evidence. Before quoting synthesized numbers
  or putting them in a packet, run one refutation agent per headline claim against the primary
  source.

## 2026-10-14: the library's root `catalog.json` is stale; the authoritative catalog is `catalog/library.json`

- **Doing:** resolving source IDs for `acquire --source` after inventory.
- **Evidence:** in `~/YeeBois/research/beep-effect/`, `library.json` names the catalog as
  `catalog/library.json` (1,203 sources after this intake). The root `catalog.json` held 1,168
  sources and none of the 21 new identities, so a `jq` lookup against it returned 0 matches.
- **Prevention:** the runbook (`docs/runbooks/research-library.md`) should name
  `catalog/library.json` as the lookup target, or `status` should print source IDs for one
  intake. Otherwise the stray root file should be removed or regenerated.

## 2026-10-14: the anchor deep-dive described IPRally's eval data without opening it

- **Doing:** checking the anchor deep-dive against the released data after acquisition.
- **Evidence:** the deep-dive said typed edges survive in `targets/*.csv`. In the evaluation
  archive, all 879,302 target rows are `parent=0`/`edge=none`; typed labels appear only in
  `train_sample` (see the addendum at the top of [SWEEP-2026-10-14.md](./SWEEP-2026-10-14.md)).
- **Prevention:** claims about a dataset's contents need an opened archive, not README prose.
  Pair a later acquisition with a quick census.
