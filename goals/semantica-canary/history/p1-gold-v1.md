# P1 step 8 — gold/v1 proposal receipt

Date: 2026-08-26. Branch: `feat/semantica-gold-v1`.

gold/v1 is the frozen LLM-proposed label set for the C0 evaluator: the first
10/5/3 W1 manifest ids (structure/entity/relation, D-C0-9), proposed by a
hosted model of a different provider family than the extractor
(xAI `grok-4.6` vs the Anthropic extractor, D-C0-1), through the lab's
content-addressed provider cache. Every anchor is re-derived from the
proposal's verbatim quote and passes canonicalizer verification before a
label is written; unverifiable quotes drop.

## Run

| Field | Value |
| --- | --- |
| Command | `canary gold propose` (live, W1 corpus root out of repo per D14) |
| Proposer | `xai` / `grok-4.6`, `taskType: "gold-proposal"` |
| Prompt artifact hash | `1bce70d152618aa6b5dcb74a65a42f6b4f375e5cde3df3b9a0cbebdda5f6bd1e` |
| Jobs | 18 (10 structure, 5 entity, 3 relation), sequential |
| Anchors accepted | 378/379 (108/108 structure, 257/258 entity, 13/13 relation) |
| `gold.json` digest | `e94228ce6ce3bf4e597ed282164e4392340548f43f5132c5f803dd6ee52439bc` |
| `spotCheckedFraction` | 0 — pending the operator spot-check annotation pass |

The committed artifact is corpus-local: encoded labels carry offsets plus
SHA-256 digests of the exact document slices (quote, entity surface, relation
subject/object) and never verbatim W1 text. Hydration re-slices the canonical
document text at the anchors, verifies each digest, and fails typed on
mismatch. Anchoring is exact-at-claimed-offset first, then nearest exact
occurrence within a 2,000-character drift window, then whitespace/hyphenation-
fold recovery within the same window (the stored span is always the exact
document slice); labels with no verifiable match drop — the one remaining
drop is a single entity proposal with no recoverable source span.

Structure ids: `057e356e94f8`, `05afbbf3e1e9`, `06c93f91ef3d`, `06df406f321e`,
`08e376be5ed2`, `0a4ab229f341`, `0a8de1437753`, `0d06c1a2189a`, `0f75da2dbb9f`,
`10828be135bf`. Entity ids are the first five of those; relation ids the first
three (D-C0-9).

## Operational notes

- Per-job hosted generation ran 5–40 minutes on grok-4.6 (heavy reasoning);
  the provider cache made every interrupted rerun free — the completed set
  replays offline with zero spend.
- Two mid-set aborts were xAI-side generation drops (~6 and ~15 minutes in)
  on the same entity job; the third attempt succeeded in 12.6 minutes through
  a diagnostic logging proxy. Failure class and prevention are recorded in the
  exploration ledger (`explorations/semantica-lab/research/OPPORTUNITIES.md`,
  2026-08-26 receipts), including the anchor-offset re-derivation fix that
  raised acceptance from near-zero to 97.9%.
- The proposer never sees extractor output; the extractor never sees gold
  (D-C0-1 family separation held end to end).

## Queued for the spot-check annotation pass

Review surfaced two label-semantics items the annotation pass adjudicates
(label content is proposer-owned; the operator pass, not hand edits, corrects
semantics and raises `spotCheckedFraction`):

- The relation gold for the first structure paper includes a
  `published in proceedings of` label whose object is a date rather than a
  venue — semantically inverted; drop or correct during annotation.
- Abstract structure labels are inconsistent across papers: some span only
  the `Abstract` heading, others the full abstract body. Pick one convention
  during annotation so structure F1 is not split across conventions.
