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
