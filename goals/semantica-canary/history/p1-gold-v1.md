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
| Anchors accepted | 371/379 (`fraction` 0.978891820580475) |
| `gold.json` digest | `515c85b356cc837bc34edb088f2a9c17147e6e5fd7b3135103dd8a4dd25f855b` |
| `spotCheckedFraction` | 0 — pending the operator spot-check annotation pass |

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
