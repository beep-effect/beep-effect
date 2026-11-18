# Gate Output: Switch On What Exists Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Re-verify the six sites against the current head and settle the two open choices: which entry carries the unbuilt-dependency probe (the generated `check` script or a `beep-cli` route), and where the GitHub-check report's durable file lives. | Each site's state matches `SPEC.md` Target Surfaces or the spec is corrected; one decision file per choice. |
| P1 Agent signal through Turbo | pending | Fixes 1 and 2: export the agent keys from `@beep/runtime-env`, add them to `turbo.json`, set `AGENT=1` and `--output-logs=errors-only` in `turboStep`/`turboRunArgs` under a detected agent, and re-record the cache baseline. | AC1 to AC4 and AC9 hold; the two measured numbers are written to `history/`. |
| P2 Quiet surfaces | pending | Fixes 3, 4 and 5: formatter options on `CliColor.formatterLayer` and `globalFlags: "summary"` in the repo CLI; envelopes off stdout when the artifact env is set, with a durable GitHub-check report; the submit step on the split executor. | AC5 to AC7 hold. |
| P3 Unbuilt-dependency probe | pending | Fix 6: the one-line probe on both package-local check entry points, reusing `missingReferenceOutputs`. | AC8 holds; a fresh lane's package check prints one line where it printed one TS6305 per reference. |
| P4 Verify | pending | Run `bun run beep quality package-verify` for every touched package and `bun run beep cache audit`; record the before and after character counts. | AC9 and AC10 hold; evidence is under `history/`. |
| P5 Yeet: PR to mergeable | pending | Publish through yeet and drive each PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P6 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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

_No checkpoint files yet._

<!-- beep:decisions:end -->
