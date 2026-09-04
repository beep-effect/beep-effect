# Friction receipts — yeet-pr-resume-footer PR 1 (2026-09-03)

1. **`bunx --bun vitest` hangs (forks pool).** Doing: focused test lanes in Codex briefs and the
   package audit. Evidence: `RUN v4.1.11 .../packages/tooling/tool/cli` then no output for
   20–30 min in three lanes; `--pool=threads` passes 44/44. Prevention: brief template should
   name `bunx vitest run <files> --pool=threads`; a repo-level vitest pool default for bun
   would remove the trap.
2. **Stale dependency dists fail `package-verify` audit in untouched files.** Doing:
   `bun run beep quality package-verify @beep/repo-cli`. Evidence:
   `src/commands/Ci/CiLane.ts(17,10): error TS2305: Module '"@beep/schema/Unknown"' has no
   exported member 'UnknownFromJsonString'` while the source exports it; cleared by
   `bunx turbo run build --filter="@beep/repo-cli^..."` (32 tasks). Prevention: package-verify
   could build the package's dependency closure first, or print a stale-dist hint when a
   diagnostic names a workspace subpath.
3. **`goals doctor` flags a brand-new packet as `stale-active` (21+ days).** Doing: validating
   the just-materialized packet. Evidence: advisory on `yeet-pr-resume-footer` with zero git
   history. Prevention: treat packets with no committed history as fresh.
4. **`goals bootstrap --plan --json` has no writer.** Doing: materializing the packet. Evidence:
   help text "no writer exists"; files were written by a jq loop over `entries[].payload`.
   Prevention: ship the writer (`--apply`).
5. **Original design shipped a `cd "$BEEP_PROJECTS/<clone>"` template.** Doing: reviving
   CSF-007's footer. Evidence: the Codex-finding simulation would re-file it; the number-only
   fence plus local registry made the block path-free. Prevention: recorded in packet DECISIONS.
6. **A locally regenerated baseline turned `main` red for every PR.** Doing: reading the
   `Heavy / Coverage Regression` red on the final head. Evidence: #990 rewrote
   `standards/coverage.regression-baseline.jsonc` (33 hunks) and raised the untouched
   `Quality.command.ts` row above what hosted measures (40.61 vs 39.6 lines); three consecutive
   `main` pushes are red on that row and the lane is a required check. Prevention: the
   ratchet should refuse to raise a row for a file the PR did not touch, or the scoped writer
   should hold unmeasured rows (the remediation string already says so; the unscoped
   `coverage:baseline:write` still rewrites everything).
7. **Hosted Docker availability decides `SqlTest.ts` coverage.** Doing: same read. Evidence:
   `SqlTest.pglite.test.ts` skipped 7/8 on one EC2 runner (Testcontainers probe timed out at
   45 s) and 5/8 on every `main` run; the floor was minted with Docker present, so the row is
   red whenever the runner's daemon is absent. Prevention: exclude Docker-gated tests from the
   ratchet lane or mint the floor from the Docker-free posture. Follow-up evidence: PR #989's
   lane built the same image in 17 s at 19:46Z, then four consecutive runs of this PR from
   22:15Z to 00:10Z hit the 45 s probe budget on four different instances; the probe now has a
   120 s budget and logs its failure cause (`SqlTest.pglite.test.ts`), so the next skip note
   names the reason instead of "unavailable or redundant".
