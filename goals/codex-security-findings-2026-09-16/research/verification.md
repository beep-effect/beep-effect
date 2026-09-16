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
