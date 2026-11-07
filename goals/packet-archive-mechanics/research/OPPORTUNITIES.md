# Packet Archive Mechanics: Friction Receipts

## 2026-11-07 — Batch 2 would have archived live tool inputs

Planning batch 2 (`beep goals archive --kind goals --batch 50`, plan
`60425e7f…`), a literal scan of every tracked non-Markdown file for
`goals/<batch slug>/` found five live surfaces the plan deletes: retention
calibration fixtures, the editor capability atlas, the Fallow feature matrix,
the effect-vitest census and the effect-schema-inventory prompt root. Batch 1
hit the same class of defect after merge (see the 2026-11-07 fixture decision).
`beep goals archive --plan` reports inbound Markdown links but no
non-link consumers. A plan-time consumer report (source, test, config and
workflow files that name a removed path) would catch this before the archive
write instead of in hosted CI.

## 2026-11-07 — Goal tombstones kept `opsScripts` for archived scripts

The batch 2 write left `effected-promotion`'s manifest listing 35 `ops/*.ts`
scripts that moved to the archive; `beep goals doctor` blocked on 35
`ops-script-missing` rows. Batch 1 found the same gap for `researchReports`.
Any manifest field that projects packet files needs a tombstone reprojection;
`TombstoneWriter` now narrows `opsScripts` too.

## 2026-11-07 — The worker credential cannot push the archive repo

On the dankserver worker the archive write committed locally, but
`git push` to `beep-effect/beep-effect-goals-archive` failed with
`could not read Username`: the worker credential helper serves only
`beep-effect/beep-effect`. The archive-first invariant needs that push before
the tombstone PR, so the batch waits for an approved push route. A one-time
push through the `gh` credential, approved by the operator, also failed with
`403 Permission ... denied`: that token reads the archive repo but cannot write
it. A first snapshot taken earlier went stale while it waited, because #2860
edited `effect-reference-workspace` on `main`; the batch was re-run from main
`19c9aa06b0` (plan `2fc4f570…`, archive commit `87fc463`, still unpushed). Running the
sweep from a host whose credential covers the archive repo, or adding the
archive repo to the helper, would prevent this.
