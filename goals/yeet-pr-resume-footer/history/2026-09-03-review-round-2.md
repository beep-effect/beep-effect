# 2026-09-03 — PR #975 hosted review round (Greptile, Codex Cloud, CI)

PR #975 opened via `yeet publish --start-pr-early --monitor --pr`. The footer
dogfooded itself on the first push: workspace, branch, one agent row, the
`bun run beep yeet resume 975` fence, and the v2 twin; `yeet resume 975 --list`
resolved the session from the registry and plain `yeet resume 975` refused to
fork the live desktop session (window name and pid printed).

## Greptile (score 1/5, three P1 threads)

| Thread | Ruling |
| --- | --- |
| Tracked research exposes local metadata (`research/2026-09-03-exploration.md`) | Valid. The exploration and panel docs carried the projects path, the clone inventory, and a session label. Scrubbed to `<projects-root>` / `<clone>-<xx>`; the public footer never carried any of it. |
| PR URLs lose repository identity (`Resume.ts`) | Valid. `PrRef` now keeps the URL's repository and drives the lookup with it; bare numbers keep the checkout repository. |
| Footer stamp overwrites concurrent edits (`ProvenanceFooter.ts`) | Valid. Re-read immediately before the write, splice against the fresh body, skip identical footers, read back once and warn on a non-footer mismatch. GitHub has no conditional body update. |

## Codex Cloud (six P2 threads; no leak finding against the footer)

Stamp step never recorded in the verdict; `--agent=0` treated as omitted;
`monitor --watch` / `--until-merged` bypassed the stamp; Codex model should
come from `turn_context`; `--state-root` flag unwired; URL repository (same as
Greptile). All accepted and fixed in the follow-up commit.

## CI attribution

| Check | Attribution | Action |
| --- | --- | --- |
| Vercel (3) | rate limited, same on the last three merged PRs | exempt by the mergeability rule |
| Heavy / Check | introduced: `yeet-pr-provenance-boundary.test.ts` passed a bare literal where the schema wants an `Option` (`hostHarness`) | fixed; `bun run beep quality test-tsgo` is the local twin |
| Heavy / Coverage Regression | introduced: `Yeet.command.ts` and `PullRequest.ts` floors broken by untested new paths; inherited: `@beep/box-provisioning` missing from the baseline (added on main by #947/#960) | tests restore the floors; the missing row was merged with a scoped `coverage --filter=@beep/box-provisioning --write-baseline` (first attempt hit the no-location TS2589 build flake, retry passed) |
| Fallow Advisory Envelopes | introduced: 4 complexity hotspots (`detectPrProvenanceFromPaths` 22/36, `makeRecord` 20/18, `Resume.run` 12/14, `detect` 8/9) and one duplicated registry lookup filter | refactor lane |

## Lane gotchas recorded

- `bunx --bun vitest` (forks pool) hangs on this workstation; repo lanes use
  node `bunx vitest`. Codex briefs must say `--pool=threads`.
- Stale dependency dists make `package-verify` fail in untouched files; rebuild
  the closure with `bunx turbo run build --filter="@beep/repo-cli^..."`.

## Round 3 (Greptile on `a82e32c4cd`)

| Thread | Ruling |
| --- | --- |
| Repository casing splits registry partitions (`detectPrRepository` kept origin casing, `PrRef` lowercased URLs) | Valid; fixed in `11bc482030` with a mixed-case-origin regression test. |
| Scrubbed metadata remains in the PR's earlier commits | Not fixable by editing: force-push is denied and GitHub keeps a PR's commits viewable after close or squash-merge. Main only receives the squash-merged tree. Left open for the owner to decide whether a clean-ancestry replacement PR is worth a fresh review cycle. |

Divergence with `main` was resolved by merging `origin/main` through a
temporary sync branch into the PR branch (no rewrite), then pushing. The local
proof's `pre-push:nix` red was environment-only (no `nix` on the detached
publish PATH; hosted Nix Shell passes) and is acknowledged as such.

## Round 4 (Greptile 4/5 on `d83c4799ad`; hosted coverage ratchet)

- Body-race residual: the stamp now yields to concurrent editors with a
  bounded reconcile (three rounds); if contention persists the newest foreign
  body is written back verbatim and the footer self-heals on the next monitor.
  Invariant: a foreign edit is never left overwritten.
- Coverage: the four new modules had no baseline identity; tests raised them
  (`Resume.ts` statements 75 -> 89.7, `ProvenanceFooter.ts` 86 -> 93,
  `PrSessionRegistry.ts` branches 66.7 -> 95.2, `Resume.schemas.ts` to 100) and
  `Yeet.command.ts` lines back to 96.72 over the 96.19 floor; rows recorded with
  the scoped `coverage --filter=@beep/repo-cli --write-baseline`.
- Inherited: main's own Coverage Regression lane is red on the missing
  `@beep/box-provisioning` row; this branch carries the row.
- Hosted runners check out a detached HEAD, so the command-wiring dispatch
  test tolerates the PR-branch-only guards.
