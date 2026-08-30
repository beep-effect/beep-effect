# Practice Mail Backfill Spec

## Objective

Make the historical mail estate searchable in the attorney's Outlook: secure
the PST-import user rights (one Exchange Online Plan 2 seat on the attorney,
after a CSP/New Commerce quote and a dry-run license assignment beside
Business Premium), enable the archive mailbox and auto-expansion, then
execute the Purview network-upload PST import per the r2 runbook — into the
archive under a segregated `/Historical-PST` root, in ≤100 GB tranches, with
per-tranche reconciliation — and finish with a recorded verification that
Outlook search reaches the imported history.

This is a documentation-and-operations goal: its deliverables are the
goal-local operator runbook, the operator-attended execution, and the
evidence trail — not repo product code.

## Non-Goals

- No Graph-based mail ingress of any kind (drafts, MIME, message creation) —
  ratified: Purview import is the only historical-mail lane.
- No retention-policy design and no release of `RetentionHoldEnabled` in
  this goal: imports leave retention hold ON; turning it off is a separate,
  explicitly operator-ratified decision once a retention policy exists.
- No curated per-matter filing of messages into Box (that is downstream
  corpus-chain work, out of this appetite).
- No PST content processing, parsing, or extraction — the carve-out imports
  the raw PSTs as-is; corpus processing stays with the salvage-restoration
  chain.
- No permanent SKU changes beyond the one EOP2 seat; step-down/cancellation
  terms are part of the quote evidence.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- This packet's own `research/` and `history/` (the runbook instance,
  quote/support-case evidence, per-tranche reconciliation records).
- The live tenant (licensing, archive enablement, Purview import jobs) —
  operator-attended only.

## Constraints

- **License path** (ratified): EOP2 seat on the attorney's mailbox is the
  default; Purview Suite for Business Premium is the recorded alternative
  only if the compliance stack is wanted. Quote and dry-run assignment
  come before purchase.
- **Import mechanics** (r2, as corrected through PR review): AzCopy staging
  and the mapping CSV must be paired — either the flat staging form (flat
  directory, blank `FilePath`) or the recursive form (`--recursive=true`
  with `FilePath` prefixes). The flat form uploads only top-level files:
  flatten nested PSTs into the staging directory first, or use the
  recursive form. `IsArchive=TRUE` with `TargetRootFolder=/Historical-PST`;
  never root `/` (documented to land content in hidden non-IPM folders).
- **Tranche discipline**: ≤100 GB per archive-import job; before tranche
  2/3, the Microsoft support case adjudicating the >100 GB
  auto-expanding-archive documentation conflict must be resolved — never
  assume. Expect ~24 GB/day/mailbox throughput, ≤20 GB per PST, and up to
  30 days for archive expansion.
- **Reconciliation before anything else**: each tranche's imported counts
  are reconciled against the staged manifest before the next tranche starts
  or any hold/retention change is contemplated.
- **Confidentiality**: generated mapping CSVs, PST inventories, and
  filenames are client-identifying and never enter this public repo. Tracked
  evidence uses counts, sizes, hashes, tranche ids, and job status — never
  client or matter names.

## Decision Log

Binding decisions live in the source exploration —
[`explorations/practice-office-provisioning/DECISIONS.md`](../../explorations/practice-office-provisioning/DECISIONS.md):
mail search modality, SKU preflight resolved, PST-import rights path. This
spec binds to them without restating.

## Acceptance Criteria

- [ ] Quote + dry-run license-assignment evidence recorded; EOP2 seat active
      on the attorney's mailbox; archive + auto-expansion enabled.
- [ ] The goal-local runbook instance is complete enough that a future
      assistant could re-run an import without this conversation.
- [ ] Tranche 1 imported into `/Historical-PST` and reconciled (counts
      match the staged manifest; discrepancies dispositioned).
- [ ] The >100 GB support-case verdict is recorded before any tranche 2/3
      execution.
- [ ] Outlook search over the imported history verified with the attorney
      and recorded as evidence.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-mail-backfill/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-mail-backfill/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-mail-backfill` | Passes |
| Tranche reconciliation | per-tranche record in `history/` (counts/hashes only) | Recorded |
| Search verification | dated evidence note in `history/` | Recorded |

## Stop Conditions

- The dry-run license assignment shows a service-plan conflict beside
  Business Premium (report; the alternative SKU decision goes back to the
  operator).
- The support case contradicts the staged >100 GB plan (report; re-plan
  tranches, do not improvise).
- A tranche reconciliation shows unexplained loss (stop imports; report
  with the job report evidence).
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
