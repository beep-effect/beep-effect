# Goal Closeout Hosted Verification Plan

## Status

Status: P0 research and design complete, design revision 2 applied (critic
findings and the orchestrator rulings of 2026-11-12, recorded as decision
files); P1 not started. The manifest's phase statuses flip in the first
implementation commit.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Map the completion pipeline, schema, set-status, doctor, templates, migration set and coverage cause; design PR A. | Five `research/map-*.md` files and `research/design-pr-a.md` exist; DN-1 to DN-27 are recorded in `decisions/`. |
| P1 Implement | pending | Steps S1 to S8 of `research/design-pr-a.md` §3 (schema, claims, evaluator, completion core, writer, closeout check with views and doctor, readers, templates and prose). PR B (D-cov) runs alongside from lane `final-check-coverage-scope`. | Each step's package-scoped test command and `bun run check` pass; every new source file has a test for each exported unit, live layers included. |
| P2 Verify | pending | S9 batch migration (nine packets written, two archived tombstones receipt-only), then S10 (post-migration enforcement: `proposedCloseout` removal, raw-key guard, `yeet sweep --retire` trigger) and S11 (GOAL.md and PLAN.md checklist rewrite) in parallel, then S12 package proof. | Migration outcomes are in `history/migration-<date>.md`; the SPEC Verification Matrix is green; doctor online reports 0 introduced blocking findings. |
| P3 Yeet: PR to mergeable | pending | The orchestrator publishes PR A with `yeet open`, runs a scoped `yeet final-check --skip coverage=<reason>` on the content-final head (named in the PR body), flips it ready and drives it to mergeable. PR B merges first. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads; review window elapsed. |
| P4 Close | pending | Reflection, then `goals set-status goal-closeout-hosted-verification completed-retained` in PR A (it names PR A); after the merge, refresh, doctor online and `yeet sweep --retire`. | Refresh prints plain `verified`; the `origin/main` jq check passes; no `closeout-unverified` finding and no P0 closeout row. |

## Steps

Full contract in `research/design-pr-a.md` §3. ∥ marks steps whose files
do not overlap, so parallel agents can take them; each step ends green on
its own. Step agents leave the tree dirty; the orchestrator commits and
publishes.

| Step | After | Summary |
| --- | --- | --- |
| S1 | none | Schema contracts in `Goals.schemas.ts` and `Decisions.schemas.ts` |
| S2 ∥ | S1 | `RedAttribution.ts` claims reader (committed versus preview sources); decision rendering and `decisions add` flags |
| S3 ∥ | S1 | Evaluator: DN-1 binding, attribution (red or missing), review-thread port, `GoalCompletionIoLive` with the `Cache.makeWith` listing memo, pull `state` |
| S5 ∥ | S1 | Bind writer in `SetStatus.ts` (`--final-pr`, `--adopt-merged`) plus `FinalPullRequest.ts` |
| S7 ∥ | S1 | Portfolio index, archive tombstone and reflection gate read `closeout` only |
| S8 ∥ | none | Bootstrap template, goldens, `_template`, `goals/README.md`, AGENTS.md, skills |
| S4 | S2, S3 | Completion core: delete recovery and the local verdict read; hosted gating from the verdict; committed claims; receipt v2 |
| S6 | S4 | `CloseoutCheck.ts` classification, doctor blocking finding, filtered closeout views, graph and session consumers |
| S9 | S4, S5, S6, S7 | Batch migration of the 11 packets (tombstones receipt-only); tests run after the orchestrator commits |
| S10 ∥ | S9 | Remove `proposedCloseout`, guard the raw key in doctor, wire the `yeet sweep --retire` closeout trigger; regenerate the schema catalog |
| S11 ∥ | S8, S9 | Rewrite every active or paused GOAL.md and PLAN.md closeout step with an idempotent script, hand-fix their other live prose that still prescribes `proposedCloseout`, and fill this packet's Scope lines |
| S12 | S10, S11 | Re-run the census and the rewrite after the last `main` merge; package proof; the orchestrator publishes |
| S13 | S12 | This packet's closeout by the new route |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and the `ops/manifest.json`
   phase statuses. Record PR B as `supporting` in
   `completionGate.pullRequests`. Once PR A is open, run
   `bun run beep goals set-status goal-closeout-hosted-verification completed-retained`.
   It writes `closeout` naming PR A with the matching `initiative.status`,
   and the commit ships in PR A.
4. After the merge, from a checkout at `origin/main`,
   `bun run beep goals completion refresh --slug goal-closeout-hosted-verification`
   must print plain `verified`. If a red needs naming, land a
   `redAttribution` decision file in a decisions-only PR and refresh again
   once it merges. Then run `bun run beep goals doctor --online` and confirm
   there is no `closeout-unverified`; `yeet sweep --retire` from PR A's lane
   must leave no P0 closeout row.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add goal-closeout-hosted-verification --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/goal-closeout-hosted-verification/GOAL.md)" -le 4000
jq . goals/goal-closeout-hosted-verification/ops/manifest.json
rg -n "goal-closeout-hosted-verification|GOAL.md|agentLaunchers|packetAnchorDocument" goals/goal-closeout-hosted-verification
git diff --check -- goals/goal-closeout-hosted-verification
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug goal-closeout-hosted-verification`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
