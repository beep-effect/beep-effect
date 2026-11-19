# Gate Output: Switch On What Exists Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-verify the six sites against the current head and settle the two open choices: which entry carries the unbuilt-dependency probe (the generated `check` script or a `beep-cli` route), and where the GitHub-check report's durable file lives. | Each site's state matches `SPEC.md` Target Surfaces or the spec is corrected; one decision file per choice. |
| P1 Agent signal through Turbo | complete | Fixes 1 and 2: export the agent keys from `@beep/runtime-env`, add them to `turbo.json`, set `AGENT=1` and `--output-logs=errors-only` in `turboStep`/`turboRunArgs` under a detected agent, and re-record the cache baseline. | AC1 to AC4 and AC9 hold; the two measured numbers are written to `history/`. |
| P2 Quiet surfaces | complete | Fixes 3, 4 and 5: formatter options on `CliColor.formatterLayer` and `globalFlags: "summary"` in the repo CLI; envelopes off stdout when the artifact env is set, with a durable GitHub-check report; the submit step on the split executor. | AC5 to AC7 hold. |
| P3 Unbuilt-dependency probe | complete | Fix 6: the one-line probe on both package-local check entry points, reusing `missingReferenceOutputs`. | AC8 holds; a fresh lane's package check prints one line where it printed one TS6305 per reference. |
| P4 Verify | complete | Run `bun run beep quality package-verify` for every touched package and `bun run beep cache audit`; record the before and after character counts. | AC9 and AC10 hold; evidence is under `history/`. |
| P5 Yeet: PR to mergeable | complete | Publish through yeet and drive each PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Work Breakdown

P1, P2 and P3 touch disjoint files and land as three pull requests, the packet's limit. P1 carries
the cache-baseline re-record. P3 waits for P0's probe decision; if it changes the generated
`check` command, it re-records per-package baselines in the same PR.

1. P1. Make the agent key list public in `@beep/runtime-env`; add the test that compares it with
   `turbo.json`; extend `global.passThroughEnv`; in `Tasks.ts` read the audience once and thread
   `AGENT=1` and `--output-logs=errors-only` through `turboStep`. Update
   `root-tasks-turbo-inputs.test.ts`, `doctest-turbo-inputs.test.ts` and the argv expectations in
   `quality-tasks.test.ts`.
2. P2. Widen `CliColor.formatterLayer`; pass `globalFlags: "summary"` through `CliRuntime.main`'s
   `env` in `bin-main.ts` or through a formatter layer around the program; add the command-tree
   help test. Gate both `Console.log` envelope calls in `Tasks.ts` on the artifact env; write the
   GitHub-check report beside the lane report. Route `MONITOR_READY_SUBMIT_STEP_ID` through
   `executeRepoPlanStepSplit` in `IssueArtifacts.ts`.
3. P3. Expose the probe from `CheckCensus.ts` as a one-line check; wire it into the chosen entry
   point and `runPackageTask`; add a fixture with one unbuilt reference.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status gate-output-switch-on completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug gate-output-switch-on` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add gate-output-switch-on --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/gate-output-switch-on/GOAL.md)" -le 4000
jq . goals/gate-output-switch-on/ops/manifest.json
rg -n "gate-output-switch-on|GOAL.md|agentLaunchers|packetAnchorDocument" goals/gate-output-switch-on
git diff --check -- goals/gate-output-switch-on
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug gate-output-switch-on`; add a `kind: checkpoint` file there, never edit this block._

### P1 agent signal through Turbo built, 2026-11-18

Fixes 1 and 2 are implemented with tests. AC1: a test fails when the agent table gains a key Turbo's pass-through lacks. AC2: 820 characters under either agent marker, from 14,238. AC3: nine tests over the step builder and the real task path. AC4: a cache hit through the task path prints 1,098 characters and no test summary; a caller's own log setting wins. AC9: the cache audit reports no blocking finding after the re-record.

Lane fix/gate-output-switch-on

Reverse: Revert the three commits on the lane and restore the previous root cache baseline.

### P2 quiet surfaces built, 2026-11-18

Fixes 3, 4 and 5 are implemented with tests. AC5: a test walks every command path; a subcommand help page fell from 2,490 to 1,911 characters and root help is unchanged at 4,776. AC6: with the side channel set, both envelopes go to their files and stdout carries neither; without it stdout is byte-identical to before. AC7: the detached submit step runs on the split executor, its JSON line stays in the step log, and the parent still prints the readiness monitor job id. The attached fallback, which shares the step id without `--detach`, keeps streaming.

Lane fix/gate-output-quiet-surfaces

Reverse: Revert the three commits on the lane.

### P3 unbuilt-dependency probe built, 2026-11-18

Fix 6 is implemented with nine tests over a fixture with one unbuilt reference. AC8: on `@beep/schema` with two upstream declaration indexes missing, the compiler alone printed 134,905 characters in 711 lines; `beep-cli check` prints one line of 175 characters, and `bun run check` prints that line between Bun's command echo and exit line, 269 characters. No compiler starts. A built tree runs the check unchanged. P0 closed with it: both open choices have a decision file, and the spec's count of generated check scripts (186) is 208 at this head. Six package-keyed SHA-256 digests in the baseline request matched token detectors; a path and line allowlist for such requests landed on `main` first, because the hosted scan pins its configuration to the base. Numbers: `history/2026-11-18-p3-probe-and-verify.md` in this packet.

Lane fix/gate-output-check-probe

Reverse: Revert the probe commits on the lane, run the scripts writer and restore the previous per-package cache baselines.

<!-- beep:decisions:end -->
