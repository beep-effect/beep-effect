# Slice-1 acceptance decisions

## 2026-09-24 — Full external payload fidelity

**Question:** What does decode without loss guarantee?

**Answer:** Preserve the complete upstream and Codex JSON value, including
unknown nested fields, through decode and encode. Validate known routing fields.

**Rationale:** Provider extensions must survive before the command understands
their meaning. Rejected: retaining routing fields only, which would narrow the
accepted lossless contract.

## 2026-09-24 — Normalized-only persistence

**Question:** What may the ledger and reports retain?

**Answer:** Persist normalized routing data only. Raw unknown and account-scoped
metadata stays in memory during processing.

**Rationale:** The routing ledger is not a raw provider archive. Rejected:
archiving public upstream payloads for later reprocessing. Historical snapshots
cannot recover fields omitted by normalization; this tradeoff is accepted.

## 2026-09-24 — Open wire schemas, strict internal models

**Question:** Which representation implements full fidelity?

**Answer:** Keep the five named `S.StructWithRest` boundaries and record narrow,
owned inventory exceptions. Keep normalized internal models as schema classes.

**Rationale:** This applies the existing lossless-wire exception used by Lexical
and Pandoc; it does not change architecture doctrine. Rejected: closed classes
plus a separate raw payload, which would add two representations and mapping
consistency rules without improving the agreed behavior.

## 2026-09-24 — Scope and completion

**Question:** Does the resulting design capture shared understanding?

**Answer:** Yes. The operator confirmed the design and explicitly requested
implementation, including the five inventory entries. Complete read-only slice 1
through an open, mergeable PR. Do not merge it.

**Rationale:** No new package, raw archive, projection write, timer, default-model
change, or architecture-wide decision is required. No design questions remain.

## 2026-09-25 — Package coverage isolation exceptions

**Question:** Include the verified coverage isolation repair in this delivery,
create a separate prerequisite PR, or wait for an upstream fix?

**Answer:** Include package-local `isolate: true` overrides for `@beep/wink`,
`@beep/utils`, and `@beep/identity`. The operator selected this recommendation
through Ask User Question and explicitly requested implementation.

**Rationale:** All 344 tests pass with isolation enabled in the diagnostic
coverage runs. The shared runner already documents package overrides; ordinary
tests already use isolation. Accept potentially slower coverage in these three
packages while preserving shared defaults, assertions, thresholds, dependencies,
and runtime interfaces. Rejected: a separate prerequisite PR or waiting for
upstream, both of which delay this delivery without narrowing the repair itself.
This is a scoped implementation exception, not an architecture doctrine change.

PR #1224 was merged by the operator before this repair began. Carry the approved
repair and remaining packet closeout in a follow-up PR, left open and mergeable.
