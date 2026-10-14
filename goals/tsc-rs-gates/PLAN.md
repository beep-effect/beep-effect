# Run the typecheck and build gates on tsc-rs Plan

## Status

Status: `completed-retained`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Measure tsc-rs against the patched tsgo, attribute every diagnostic difference, and land the upstream 7.1 fixes. | `research/measurements-2026-10-13.md` records the numbers; the eleven fixes are green under tsgo, tsc-rs and stock 7.1-dev and ship in their own PR. |
| P1 Implement | complete | Pin `tsc-rs`, swap the generated `beep:check`, `beep:check:tests` and `beep:build` defaults, regenerate manifests, update the toolchain runbook and the version-coupling test. | Acceptance criteria in `SPEC.md` are met; `--fast` stays off. |
| P2 Verify | complete | Hosted `Heavy / Check` and `Heavy / Build` on the swap PR, plus the first cache-cold timings against the 2026-10-13 baseline (7m39s turbo time). | Hosted gates green on tsc-rs; timings recorded in `research/`. |
| P3 Yeet: PR to mergeable | complete | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/tsc-rs-gates/GOAL.md)" -le 4000
jq . goals/tsc-rs-gates/ops/manifest.json
rg -n "tsc-rs-gates|GOAL.md|agentLaunchers|packetAnchorDocument" goals/tsc-rs-gates
git diff --check -- goals/tsc-rs-gates
```
