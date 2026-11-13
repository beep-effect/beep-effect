# Declaration-Only Builds Plan

## Status

Status: `in-progress` (P0, PR 1 open)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | in-progress | PR 1, no behaviour change: the repo-wide baseline, the build-versus-check diagnostics comparison through the check-program census, and the three stale findings. | The "Baseline and proof harness" criteria in `SPEC.md` are met and PR 1 is merged. A decision file records whether check-once survives. |
| P1 Implement | pending | PR 2: remove Babel and JavaScript emit from the generated build and the scaffolds; regenerate every scripts block; extend the build output contract test. PR 3 only if P0 kept it: serve the own-source check from the build. | The "Declaration-only build" criteria are met; the check-once criterion is met or cut by decision. |
| P2 Verify | pending | Re-measure with the baseline's method; confirm the hosted gate on PR 2 as the proof that nothing reads `dist/*.js`; record any Exception Ledger rows. | After numbers are in `research/`; every red is attributed. |
| P3 Yeet: PR to mergeable | pending | Publish each PR through yeet and drive it to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Pull Requests

At most three, opened one at a time in this order.

1. **Baseline and proof harness.** Measures and fixes only. It decides whether
   PR 3 exists.
2. **Declaration-only build.** Changes `tsconfig.base.json`, a global Turbo
   input, so it invalidates every build cache entry once. Tell the sibling
   verification goals before it merges and after.
3. **Check once.** Conditional. Cut first if the appetite runs out or any
   diagnostic difference shows up.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add declaration-only-builds --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/declaration-only-builds/GOAL.md)" -le 4000
jq . goals/declaration-only-builds/ops/manifest.json
rg -n "declaration-only-builds|GOAL.md|agentLaunchers|packetAnchorDocument" goals/declaration-only-builds
bun run beep lint package-scripts
bun run beep quality check-census
bun run beep quality package-verify @beep/repo-cli @beep/repo-cli-kit
git diff --check -- goals/declaration-only-builds
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug declaration-only-builds`; add a `kind: checkpoint` file there, never edit this block._

### P0 measured: baseline and equivalence in research, PR 1 open, 2026-11-13

Baseline (main at 2cadc8caa0d, 181 emitting packages, fastest of three, serial): compile 52.2 s, Babel 66.4 s over the 168 packages that run it, declarations-only compile 53.2 s. JavaScript and its maps are 84.0 MB of a 228.6 MB `dist` total. The saving in PR 2 is the Babel pass and the bytes; dropping JavaScript emit does not make the compile faster.

Equivalence: 2,912 build-versus-check comparisons identical, so check-once is kept. The stale tsbuildinfo glob moved to PR 2 because removing it changes every build task hash.

Lane chore/declaration-only-builds-baseline

Reverse: None needed; a status note.

<!-- beep:decisions:end -->
