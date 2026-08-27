# Opportunities — friction receipts

## 2026-08-27 — Exact-snapshot Yeet refresh could not queue behind a sibling proof

- **What happened:** the first full semantic-foundation proof spent an extended
  period waiting for the repository-wide coordinator. After that proof passed
  and a documentation-status advisory was repaired, the required exact-snapshot
  refresh exited because a sibling checkout had acquired the coordinator. When
  owners released it, successive waiting siblings won the handoffs before this
  checkout could claim the lock.
- **Evidence:** `bun run beep yeet verify` reported `Another Yeet full proof for
  this repository is active` and identified the live owner checkout as
  `~/YeeBois/projects/beep-effect18`. The owner process was still running, so
  deleting the shared lock would have been unsafe.
- **What would have prevented it:** a supported Yeet queue or `--wait` mode that
  retains the requesting command, emits periodic owner heartbeats, and starts
  verification when the coordinator becomes available.
- **Disposition:** repo-quality operator improvement; wait for the live owner
  and retry without bypassing the coordinator.

## 2026-08-27 — Staged-only proof hid the required package changeset

- **What happened:** full Yeet verification passed while the implementation was
  staged, and `changeset-status` reported no changed product workspaces. After
  staged-only publication created the commit, the post-commit proof correctly
  identified `@beep/ontology` as changed and required a new changeset.
- **Evidence:** the staged run reported `product_workspaces=0`; the post-commit
  run reported `product_workspaces=1` and named `@beep/ontology` as missing an
  in-range changeset. The older M1 changeset is already part of `origin/main`,
  so it cannot satisfy this delivery range.
- **What would have prevented it:** make staged-only verification evaluate the
  index as the candidate commit for changeset attribution, or have staged-only
  publication create its temporary commit before spending the full proof.
- **Disposition:** add the required patch changeset and amend the reviewed
  commit; candidate for a Yeet staged-only regression test.

## 2026-08-27 — Restored residue invalidated reuse of a successful proof

- **What happened:** the exact amended commit passed all 25 Yeet lanes, but the
  proof workflow restored unrelated `.codex` edits before returning. Parking
  those edits again made the worktree clean for publication, while also changing
  the recorded diff fingerprint, so `publish --reuse-verified` refused the
  otherwise exact-head proof.
- **Evidence:** `bun run beep yeet status` reported `verify success` for commit
  `d6476b6703` with only `.codex` residue present; after a path-scoped stash,
  publication exited with `stale proof state: diff fingerprint changed`.
- **What would have prevented it:** bind reusable proof identity to the verified
  candidate snapshot and preserve unrelated residue outside that snapshot, or
  provide a first-class clean-candidate worktree for verify and publish.
- **Disposition:** retain the residue in a named stash, amend this receipt, and
  verify the clean candidate snapshot before publication.

## 2026-08-27 — Hosted coverage found debt omitted by the local full proof

- **What happened:** the clean candidate passed all 25 local Yeet lanes, but the
  hosted coverage-regression check found one new uncovered loader error path.
  The loader refactor also reduced the number of branch sites, which lowered the
  branch percentage even though the absolute uncovered-branch count stayed at
  the `origin/main` value.
- **Evidence:** before the follow-up test, `@beep/ontology` had 48 uncovered
  lines, 49 statements, 37 branches, and 34 functions. A focused comparison to
  `origin/main` showed baseline debts of 47, 48, 37, and 33 respectively. The
  added malformed-slice test restored the candidate to exactly 47, 48, 37, and
  33; 68 ontology tests now pass.
- **What would have prevented it:** include the affected coverage-regression
  lane in the canonical local pre-publication proof, or surface an explicit
  advisory that the full local lane set does not cover this hosted gate.
- **Disposition:** cover the fail-closed parse-error path and retain the existing
  baseline; the comparator correctly ignores a percentage-only denominator
  change when uncovered debt does not increase.
