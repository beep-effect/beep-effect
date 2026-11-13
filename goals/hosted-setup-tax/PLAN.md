# Hosted Setup Tax Plan

## Status

Status: `active` (P0 and P1 in progress; TURB-01 slice 1 merged as #3063; slice 2 merged as #3117)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | in-progress | Re-check lever status against `origin/main`, rebuild the TURB-01 replay corpus in-repo, take the scorecard re-baseline once certainty-scorecard reports runner-minutes per green code head. | Lever table in SPEC current; re-baseline recorded as a checkpoint. |
| P1 Implement | in-progress | Land the slices below in order, each behind its admission gate, three open PRs at most. | Every slice merged or dropped by a decision file. |
| P2 Verify | pending | Read a 7-day scorecard cohort of green code heads after the last slice; record parity ledgers under `history/`. | p50 at most 244 runner-min with each of this goal's levers' minutes attributed once in dedup order (minutes from #3028, #3029, #3030, #3040, #3043, #3046 and sibling goals reported beside, never counted), all 15 required contexts present, ledgers green. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

PR-sized, in landing order. "Global input" means the PR touches `turbo.json`, `bun.lock`, root
`package.json` or a workflow file: it freezes coverage rows at base, runs the full matrix and re-records
`standards/cache-qualification-baseline.json` in the same PR. Every CI-YAML slice names its tested revert in
the PR body and a decision file. At most three of these are open at once.

**Wave 1 (startable now, no selector change):**

1. **feat(quality): derive coverage owners for generated standards inventories** (TURB-01 slice 1) [M].
   Owner rows in `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` for the
   instrumentation catalog, the JSDoc and schema-first inventories, the policy fingerprint, the
   cache-qualification baseline and `standards/fallow.boundaries.generated.jsonc`, generated from a reader
   scan rather than hand-asserted. Gate: per-file planner fixtures select exactly `@beep/repo-cli` (or the
   scanned readers), an unmapped standards file such as `standards/fallow.boundaries.provenance.jsonc` still
   returns full, a first-parent replay shrinks only commits whose sole full trigger is a mapped file, and a
   token- and segment-aware drift check is proven by a seeded `path.join` fixture; reseal
   `standards/policy-tools.fingerprint.json`. Not a global input. The PR runs full Test Unit once.
2. **ci: one hosted lint:shadcn owner and one changeset-graph run in Repo Sanity** (PERIH-02, PERIL-04) [M],
   global input. Retire the `shadcn-lint` job, run `lint:shadcn` in Repo Sanity, drop it from
   `policyStateTasks`, remove the duplicate `changeset-graph` step from the CiLane `repo-sanity` body (the
   `GithubChecks.ts` lane stays: it is the only local graph check). Gate: planted shadcn violation red on PR
   and push and green when removed, the one-owner unit test, no masking by an earlier Repo Sanity failure, a
   plan-label test showing one `changeset-graph` execution, a corrupt `.changeset` fixture still red. Touches
   `RouteFootprints.ts` and `WaveOrder.ts` lane rows. Merges `main` after any heavy-pool-diet change to
   `policyStateTasks`. Revert: restore the job and lane
   arm.
3. **feat(fc-runs): oracle-checked property census and drift join** (TEST-01, the tripwire) [M]. An oracle
   wrapper on `effect/Arbitrary` and the `@effect/vitest` prop registration through the Vitest setup records
   (file, test, runs, seed) with per-file collection and hook time; old and new logs must be identical in
   (file, test, runs, seed) on 3 heads, joined across the four Property Laws slices of #3056 (union equals the
   full sweep, no test in two slices, the repo-cli Vitest shard boundary included); fixtures for module-scope
   `fcRuns`, props without `fcRuns`, renamed tests, and a `passWithNoTests` override. It checks the #3030
   selection in `packages/tooling/test-kit/fc-runs/src/PropertySelection.ts`; it does not change floors or
   seeds. A global input only if it edits root `vitest.shared.ts` or `vitest.config.ts`; plan for that.
4. **test(fc-runs): split property files the census shows still paying module-scope or hook cost** (TEST-01,
   the residual file split under D26) [S], after slice 3. Input: slice 3's census, including its per-file collection
   and hook timings. Splits keep the same generator, seed and floor. Its outcome is recorded in a decision
   file either way: the files split, or a finding that none qualifies. The HOST-05 gate (Property Laws p95
   over 10 minutes) is read only after this slice lands. Opens when slice 1 or 2 has merged, to stay within
   three open PRs.

**Wave 2 (pure install removals):**

5. **ci: Nix Shell without the workspace install** (PERIH-05) [S], global input, with **ci: shared slim
   Security/SAST dispatch** (PERIH-06 slice 1) [M] as its own PR if the parity ledger is not ready. Gate: Nix
   green on its own PR, a broken-flake mutation red, an argv drift test against the CiLane nix steps
   (`--option warn-dirty false`), the `ci-runner-security` assertion updated; Security/SAST parity ledger of
   argv and env, red exits, fixture exclusions and a planted Semgrep finding. Revert: restore the install step.
6. **chore(deps): explicit trustedDependencies allowlist** (DEPS-01) [S + S], global input. Allowlist in root
   `package.json`, the trust-list comment in `scripts/cloud/bootstrap.sh` corrected, and a guard for
   unclassified install scripts that reads installed `package.json` scripts. Gate: two-head A/B over at least
   2 to 3 paired runs with identical census and verdicts, `bun pm untrusted` equal to the deny set. Batch with
   slice 5 if both are ready in the same week, to pay for one full matrix.
7. **test(quality): replay the coverage scope corpus before and after owner rows** (TURB-01 slice 2) [S], once
   certainty-scorecard's corpus with partition mapping (ROUT-05) is in the repo. Records the full-to-scoped
   conversion share the scorecard reports.
8. **feat(ci): PR size labelling in the pre-toolchain CI binary, with a fail-open label_failed output**
   (HOST-09 CLI) [S]. The bootstrap command set the pinned binary carries has no `pr-size` today. CLI only, so
   it can land in this wave; the label write stays off the Change Profile result.

**Wave 3 (after heavy-pool-diet's PERIH-11 pin-bump chain, route-soundness-repair's PERIH-10 base-ref patterns
with backward-compatible decode, and its ROUT-07):**

9. **ci: lane-relevance outputs from change-profile with fixtures** (PERIH-04 CLI) [M]. New Change Profile
   keys for Codegen, Ecosystem, Nix and IPC in `CiOperational.patterns.json` and its schema (Labs excluded),
   push events all-true, offline replay of historical PR heads with zero old-runs/new-skips heads.
10. **ci: pin bump** (PERIH-04 and HOST-09 CLI) [S], through heavy-pool-diet's reviewed pin-bump PR
    (PERIH-11); one bump may carry both CLI changes.
11. **ci: job-level skips from change-profile outputs** (PERIH-04 workflow switch) [S], global input. Guards
    written `!= 'false'`; the old-binary/new-workflow fixture runs every lane. Revert: drop the job-level `if`s
    (the step-level gates are kept until this slice has run 7 days).
12. **perf(ci): fold PR size into Change Profile** (HOST-09 workflow switch) [S], global input, after slices 8
    and 10. The label write is a separate fail-open step off the `Change Profile -> Test Unit / Heavy
    Admission` path and out of the Change Profile job's result, which gates eleven non-test lanes, with a `label_failed` output and summary line; the failure-injection fixture and label-set
    parity gate it. Revert: restore the `pr-size` job.
13. **ci: switch Security and SAST to the pinned dispatcher with head fallback** (PERIH-06 slice 2) [M],
    global input.
14. **ci: run Fallow envelopes inside Labs and create the advisory check run under checks: write** (PERIL-01)
    [M], global input, after slices 11 and 12. Fallow runs after the Labs coverage body with
    `continue-on-error`; the standalone `fallow-advisory` job stays for fork PRs and any host without the
    permission. Gate: 10-run shadow with matching envelope fields, a seeded finding giving a failed check run
    that the Yeet merge gate refuses, Coverage Regression green with a red Fallow step, a RouteCensus Fallow
    row. Revert: restore the standalone job for same-repository PRs.
15. **test(ci): replay the Test Plan against hosted logs** (ROUT-01 residual) [S]: `ci lane --partition
    --dry-run` against hosted logs, mutation fixtures for partition, scope and `turbo.json` edits forcing the
    full lane, empty partitions sealing a manifest. Needs ROUT-05 and ROUT-07.
16. **perf(ci): PR Build on hosted runners (A/B)** (HOST-09 slice 3) [M], draft experiment, peak RSS on 5
    hub-touching heads; a heavy-lane input, so two PRs under the `heavy.yml` `@main` rule if adopted.
17. **ci: rerun-runner-loss from the CI binary** (HOST-09 slice 2) [M], only after
    `goals/yeet-monitor-app-identity` merges its rerun widening (decision file).

**Close:** read the 7-day scorecard cohort, record the parity ledgers and per-lever attribution under
`history/`, read Property Laws p95 against the HOST-05 gate (only after slice 4 has landed), then the
reflection and the `closeout` record.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status hosted-setup-tax completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug hosted-setup-tax` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- **Dependencies:** `ci/certainty-scorecard` for the acceptance number and the re-baseline;
  `ci/route-soundness` for ROUT-07 (before slices 9 to 11 and 15) and PERIH-10 (before slices 9 to 13).
  heavy-pool-diet's PERIH-11 before slices 10 to 13. When each job-removing lever lands
  (PERIH-02, ROUT-01 (already landed in #3030), PERIH-04, HOST-09's PR Size fold, PERIL-01), record it as a
  `kind: checkpoint` decision so the owner of `explorations/github-merge-queue`'s gated `merge-group-parity`
  candidate can read it (D28).
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add hosted-setup-tax --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/hosted-setup-tax/GOAL.md)" -le 4000
jq . goals/hosted-setup-tax/ops/manifest.json
rg -n "hosted-setup-tax|GOAL.md|agentLaunchers|packetAnchorDocument" goals/hosted-setup-tax
git diff --check -- goals/hosted-setup-tax
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug hosted-setup-tax`; add a `kind: checkpoint` file there, never edit this block._

### P0 lever re-check at 5e09d90a6da; TURB-01 slice 1 implemented, 2026-11-10

Lever table re-checked against origin/main 5e09d90a6da: #3041 merged (no open PR on shared files remains), #3056 split Property Laws into four slices (recorded as a decision; TEST-01 row corrected). TURB-01's cited lines (`CoverageScope.ts:76-98`, `:772`) were still accurate before this slice. TURB-01 slice 1 lands in this PR: owner rows for six generated standards paths, the reader scan and its live drift check, and an in-repo first-parent replay (67 of 727 commits shrink, 0 violations). P0's scorecard re-baseline still waits on certainty-scorecard. Next startable slices: 2 (PERIH-02 and PERIL-04) and 3 (TEST-01 oracle census); slice 4 follows slice 3.

Lane feat/turb-01-standards-coverage-owners

Reverse: Revert this PR; the packet returns to the c90929b1ff1 lever check.

### TURB-01 slice 1 merged as #3063; slice 2 (PERIH-02, PERIL-04) implemented, 2026-11-10

TURB-01 slice 1 merged as #3063 (b757bd0400f); README and the SPEC TURB-01 row now say so. Slice 2 re-checked its cited lines at origin/main b757bd0400f: `lint:shadcn` sat at `Tasks.ts:3709` (SPEC said 3706), the CiLane changeset-graph step at `CiLane.ts:1973` (SPEC said 1953), the `GithubChecks.ts:577-581` lane and the `RouteFootprints.ts:157` row as cited, and `WaveOrder.ts` carried only a comment. heavy-pool-diet had not changed `policyStateTasks` since the graduation, so no merge of main was needed first. Job removed: Shadcn Lint (non-required), one hosted job and its 60 to 70 s of setup per run, recorded here for the merge-group-parity candidate. Next startable: slice 3 (TEST-01 oracle census, running separately); slice 4 follows slice 3.

Lane claude/relaxed-wu-e85a5e

Reverse: Revert this PR; the packet returns to the TURB-01 slice 1 checkpoint.

### Slice 2 (PERIH-02, PERIL-04) merged as #3117 over two attributed reds, 2026-11-12

#3117 merged as 10ed12d4410 on 2026-11-12 from head 2c988a91828. The planted-violation gate was shown on hosted runs before the merge: Repo Sanity failed on the planted `bg-zinc-100` on pushed head bec729b71ee, the merge of main over plant commit 4afb6371360 (run 42778378836, job 129702702080, its only failing step) and passed with the plant removed at 2c988a91828 (job 129705325011); the planted file is in neither the squash nor main. The push-event half rests on the shared lane body (check.yml runs `ci lane repo-sanity` on push; `ci-repo-sanity-owners.test.ts` asserts the step for both event shapes), not on a planted push to main. Two reds merged with it under S11. Heavy / Lint Policy was introduced by this slice: `lint:effect-vitest` flagged the trailing `.pipe(Effect.scoped)` in the masking test of `ci-repo-sanity-owners.test.ts`; it reached main and #3120 (5e9ee8341bd) fixed it. The local proof missed it because `package-verify` does not run that root lint and the final-check run was cut short by host load. Heavy / Coverage Regression's nine ratchet rows were inherited. Job removed for the merge-group-parity candidate: Shadcn Lint (non-required).

Lane docs/hosted-setup-tax-slice-2-merged · PR #3117

Reverse: Revert #3117 (10ed12d4410) as recorded in the slice 2 decision file; this checkpoint is status only.

### Baselines before d8326d5593 are not comparable (declaration-only builds), 2026-11-13

declaration-only-builds PR 2 (#3208) merged at `d8326d55935849b4bf6fd29ec4ef80327efd6af8` (2026-11-13T05:44:35Z). Library builds are now `tsrs -p tsconfig.json --emitDeclarationOnly`: no Babel step, no `babel` script key, no JavaScript in a library dist.

- Every `#build` cache entry (local, remote, CI) misses once from that commit. The first run after merging main rebuilds cold and is not a regression.
- Any wall-time, cache-size or dist-size baseline this packet recorded before that commit is not comparable with a reading after it. Re-take the baseline before reading an after-number.
- Measured by the owning goal (181 packages, serial, fastest of three): build 80.9 s to 32.9 s, dist 232.5 MB to 147.9 MB, compile unchanged (`goals/declaration-only-builds/research/2026-11-13-build-after.md`).
- A lane editing generated files (package.json scripts, the catalog, turbo.json, the policy fingerprint, the cache baseline, the check-census baseline) merges main first and re-runs the generators.

Lane chore/ci-goals-finish

Reverse: Delete this checkpoint; it records a fact about main and changes no behaviour.

<!-- beep:decisions:end -->
