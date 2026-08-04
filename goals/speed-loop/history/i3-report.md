# PR-A part 2 implementation report

## What landed

- Local GitHub-check batteries now execute schema-backed static waves. The default
  `fail-fast` policy finishes the active wave, retains every sibling failure, and
  marks every later-wave lane `not-run-early-stop`. `--collect-all` preserves the
  prior all-lanes behavior.
- `yeet verify` and publish plans carry the wave inventory, and the quality
  subprocess emits a schema-decoded `github-check-run/v1` report. Yeet consumes
  the final outer report and records the selected policy plus sublane outcomes
  in `yeet-verdict/v1`.
- The clean-HEAD frozen-install preflight now runs before the expensive verify or
  publish proof. It remains a dedicated Yeet step because it uses the detached
  clean-worktree executor rather than a normal Quality lane.
- Plan mode no longer fetches the base ref. It remains read-only and can render
  the local plan offline; non-plan runs retain the base refresh guard.
- Publish intent is now a tagged state machine: reviewed staged changes or a
  clean existing commit ahead of `origin/<branch>` (falling back to the base when
  that remote-tracking ref is absent). Existing commits skip staging/commit,
  retain base-freshness and clean-worktree guards, then run the normal exact-HEAD
  proof path. `--reuse-verified` still skips proof only through the existing
  exact-SHA proof-state assertion.
- A commit message is required only for the staged intent that creates a commit;
  the existing-commit path no longer demands a contradictory throwaway message.

## Final wave table

| Order | Wave | Lanes | Count | Evidence |
| ---: | --- | --- | ---: | --- |
| 0 | `preflight` | `quality:changeset-status`; all seven `repo-sanity:*` lanes; `quality:knip`; `fallow:audit`; `fallow:dead-code`; secrets, security, SAST, and Nix | 15 | Cheap/policy gates are the high-yield first slice prescribed by `r1-failfast-yeet.md`; Repo Sanity is 93s p50 at about 2% failure. The separate clean-HEAD install preflight is 6.3s mean with 0 failures in 49 observations. |
| 1 | `heavy` | `quality:build`, `quality:lint`, `quality:check` | 3 | Inventory section 2 records hosted p50s of 98s, 327s, and 429s respectively; Lint Policy and Check have materially higher observed failure rates than Docgen. |
| 2 | `test` | `quality:test` | 1 | Test is retained after the earlier failure-prone policy/type gates; hosted unit is 635s p50 and integration is 277s p50. |
| 3 | `documentation` | `quality:jsdoc-ratchet`, `quality:docgen` | 2 | Inventory section 2 records JSDoc Ratchet at 289s p50 / 0% failure and Docgen at 498s p50 / about 2% failure, making them the expensive low-yield tail. |

The canonical order and evidence pointer live beside `githubCheckLaneWaves` in
`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts`, citing
`goals/quality-speedup/research/quality-time-inventory.md` section 2. All waves
remain serial; no unmeasured RSS concurrency experiment was introduced.

## Schema changes

- Quality: `GithubCheckFailurePolicy`, `GithubCheckLaneWave`,
  `GithubCheckLaneWaveSpec`, `GithubCheckLaneRunStatus`, `GithubCheckLaneRun`,
  and `GithubCheckRunReport`.
- `GithubCheckLaneSpec` now retains its static wave alongside `stage` and
  `blockedBy`; the flat `githubCheckLaneSteps` projection is gone.
- Repo plan: optional schema-backed `RepoPlanWave[]` metadata on proof steps.
- Yeet: `YeetStagedPublishIntent` and `YeetExistingCommitPublishIntent`, exposed
  through the `YeetPublishIntent` tagged union.
- Verdict: `failurePolicy` (constructor/decode default `fail-fast` for older v1
  documents) and the distinct lane status `not-run-early-stop`.

Decode coverage exercises the policy/report schemas and both publish-intent
members. Runtime tests exercise same-wave sibling failures, fail-fast later-wave
suppression, collect-all continuation, clean-ahead acceptance, and dirty,
contained, and no-ahead rejection.

## Verification

- Repo-cli source overlay tsgo:
  `bunx tsgo -p /tmp/repo-cli-pra-overlay.json --pretty false` - **0 errors**.
- Targeted Vitest:
  `quality-tasks.test.ts`, `ci-lane.test.ts`, `yeet.test.ts` - **3 files, 167
  tests passed** (65 + 20 + 82).
- Required plan command:
  `bun run beep yeet verify --plan --json 2>/dev/null | head` - rendered the
  prepare preflight plus the four proof waves and all 21 lane ids; no verify was
  executed.

## Deviations

- The r1 research suggested a durable prepared-commit checkpoint for a narrower
  retry. The task explicitly requested accepting any clean local commit(s) ahead
  of the remote/base, so this implementation models that state directly and
  relies on the existing full-proof / `--reuse-verified` exact-SHA machinery
  instead of adding a second checkpoint format.
- The clean-HEAD install preflight is ordered before the wave proof but is not
  duplicated inside the Quality wave report; its detached-worktree execution and
  existing Yeet verdict lane remain authoritative.
- Vitest emitted the repository's existing advisory that `vitest.config.ts`
  uses `__dirname`, which a future Vite native config loader will not support;
  it did not affect the 167 passing tests and was outside this slice.
