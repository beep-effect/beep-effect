# Capture

<!--
Stage 0. Append-only raw dump. New material goes under a new dated heading at
the bottom.
-->

## 2026-07-31

Spin-off ratified during the knowledge-surface-automation interview (see
`goals/knowledge-surface-automation/SPEC.md`, "Spin-off explorations"): deliberately
kept OUT of Workstream D's v1 scope so the now-view engine ships without a time
dimension.

The idea: Workstream D turns goal manifests into a disposable bun:sqlite projection
(frontier, blockers, unlock paths). Add valid-time/transaction-time semantics on top:
`beep goals next --as-of <commit|date>` and `explain <slug> --as-of ...` replay the
graph as it stood then — over an event ledger rather than manifest snapshots.

Raw ingredients:

- Workstream D's projection is already rebuild-from-source; --as-of generalizes
  "source" from HEAD manifests to (manifest state at T). Git history of
  `goals/*/ops/manifest.json` IS a free event ledger candidate (commit = transaction
  time; manifest `updated` = valid time claim).
- `goals/epistemic-bitemporal-edge-core` landed a bitemporal edge kernel; this
  exploration is its named sibling — same two-timeline discipline applied to roadmap
  state instead of epistemic claims. Reuse vs simplified single-timeline replay is the
  core design fork.
- Evidence receipts (D↔C shared primitive, `ops/evidence.json`) are natural ledger
  events: receipt minted at T unlocks node at T.
- Queries that would earn the cost: retroactive frontier audits ("what did we believe
  was unblocked on June 1 and why"), respec forensics (what a status flip actually
  unlocked vs predicted), velocity measurement over unlock latencies, achievement-relic
  timelines.

Risks/unknowns: git-derived ledgers are rewrite-fragile (history rewrites happened in
2026-07); dual timelines may be over-engineering if nobody asks time-travel questions;
event granularity (per-commit vs per-status-transition) changes storage and semantics.
