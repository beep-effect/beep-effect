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
`19c9aa06b0` (plan `2fc4f570…`, archive commit `87fc463`). Once the operator granted
write access the push landed on 2026-11-08 and all 50 tree hashes verified. Running the
sweep from a host whose credential covers the archive repo, or adding the
archive repo to the helper, would prevent this.

## 2026-11-08: Yeet open pushed, then stopped before creating the PR

`bun run beep yeet open` pushed the lane and then failed with `gh did not return
a gh login token (exit 1)`. The worker's `gh` wrapper refuses `gh auth token` by
design, so Yeet needs `BEEP_GH_TOKEN_REF` set on this host, and nothing set it.
The failure came after the push, so the lane looked published with no PR.
Checking the GitHub identity before the push would have failed the command
cleanly, and a host-provided `BEEP_GH_TOKEN_REF` would have avoided it.

## 2026-11-08: Consumer scans miss commands inside relocated data

The batch 2 scan looked for code that reads packet files. It did not flag the
fallow matrix's `acceptanceCommands`, which named `bun goals/.../ops/*.ts`
scripts this batch archives; they surfaced only when each reference was
checked for a live target. Listing references whose target no longer exists,
after the archive write, would catch this kind of entry in every batch.
