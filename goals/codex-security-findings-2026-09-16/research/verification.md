# Verification evidence

- Full `bun run beep quality package-verify @beep/repo-cli`: audit passed
  (810.0 seconds), docgen passed (28.8 seconds).
- Focused Effect Vitest, Graft cache, Graft deep refresh, and scheduler tests
  passed after correcting the formatter helper call.
- The maintenance environment test also passed with two synthetic provider
  keys inherited from its parent process. No real credentials were used.
- Shell scratch regression tests: 3 passed; both launchers pass `bash -n`.
- Historical corpus regression suite: 84 passed. All five full pin verifiers
  report verified unchanged after documented citation relocation.
- Effect Vitest inventory: zero introduced and zero resolved findings. Only
  source positions and existing fingerprints in the four edited tests changed;
  rule, classification, and status counts remain unchanged.
- Reflection artifacts and diff whitespace checks passed.

`bun run beep yeet repair` passed: all 15 cheap gates, full repository docgen,
affected build/check/lint, and 206 CLI test files / 4,013 tests passed.

Full Yeet verification passed on the updated base. Hosted checks remain pending.

The branch was fast-forwarded to `43d7018cd3` after PR #1142 landed during
admission. The queued proof was interrupted before it began, and the staged
remediation was restored with its index. The shared inventory merged cleanly.
The full verification result below covers this updated base.

Full `bun run beep yeet verify` completed successfully at 2026-09-16T05:21Z.
All 15 cheap gates and the 30 pre-push lanes passed. The updated-base CLI suite
passed 206 files / 4,025 tests; all ten coverage shards passed, with CLI statement
coverage 83.26% and line coverage 83.48%.

Scope caveat: before the branch commit, commit-range SAST, secrets, and selected
docgen lanes had an empty range. Publish must prove the committed change; these
empty-range checks are not evidence for newly staged content. Full repository
docgen already passed during repair and package docgen passed independently.

## Publish attempts

- Attempt 1 (05:22Z–06:13Z): all 15 cheap gates and 30 pre-push lanes passed,
  including every coverage shard; the merge preview against `origin/main`
  conflicted on `standards/effect-vitest.inventory.jsonc` (inherited from
  #1143). Nothing was pushed.
- Merged `origin/main` at `8a99d4aac9` and regenerated the inventory on the
  merged tree: zero introduced, zero resolved findings. Content-key review
  against main: zero added rows; three rows dropped whose cited source lines no
  longer exist on main.
- Attempt 2 (06:48Z): cheap gates failed only on `fallow:health`, one
  inherited cognitive finding in `proof-job.test.ts` (from #1143; main's own
  Fallow check is red on the same tree). A local table-driven repair passed the
  file's 62 tests and the health gate, then main landed the same fix as #1150,
  so the branch merged main again and adopted #1150's version instead.
  Effect Vitest ratchet unchanged.
- Attempt 4 (07:33Z–08:36Z, head `ad75cdfd58`): all 15 cheap gates, the 30
  pre-push lanes, and all ten coverage shards passed; the coverage ratchet
  failed only on the new-file rule for `ProofJob.ts` and `ProofJobLauncher.ts`,
  which #1143 added to main without baseline rows. Main's own hosted Coverage
  Regression is red on the same rule at `8a99d4aac9` and `5e520d997e`.
- Merged `origin/main` at `9e77f17410`: #1149 rewrote the #1137 scheduler test
  (main's version adopted), #1145 moved to Effect Vitest rc.115 (reinstalled,
  ratchet zero introduced / zero resolved; sixteen stale rows dropped that
  main's own tree no longer produces), and the security regression suites plus
  fallow health pass on the merged tree.
- PR #1160 review round 1 (L3 security review, confidence 4/5, one P2): the
  maintenance allowlist did not cover the structural sibling rebuild, so
  `graft build` children still inherited the unit's provider environment.
  The allowlist now spans pull, install, and rebuild; the env regression test
  runs all three phases against synthetic keys and keeps the meaning-tier
  build override. Package check and the Graft deep refresh suite pass.
