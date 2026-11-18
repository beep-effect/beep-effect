# Legacy Drain Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

<!--
Phase ids MUST match ops/manifest.json `phases[]` exactly. Until 2026-08-06 this
table listed four phases ending at `P3 Close` while the manifest listed five
(P3 Yeet, P4 Close), so every packet scaffolded from it inherited a plan that
disagreed with its own machine state — an executor following both could close
out before the PR was mergeable, or skip P4 entirely.

Audited 2026-08-06 across all 112 packets carrying both files: exactly **four**
had inherited this contradiction (identity-iri-core, law-docketing-patent-spine,
law-docketing-reliability, law-time-capture-spine) and all four are now fixed.
A packet may legitimately use its own scheme — M1–M4 milestones, P1a/P1b
sub-phases, bolded ids, or prose instead of a table — so equality of phase-id
sequences is NOT the rule; the rule is that a plan must not contradict its own
manifest. A naive id-sequence comparison flags 8 packets, half of them false
positives, which is why this is a review concern rather than an automated gate.
-->

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/legacy-drain/GOAL.md)" -le 4000
jq . goals/legacy-drain/ops/manifest.json
rg -n "legacy-drain|GOAL.md|agentLaunchers|packetAnchorDocument" goals/legacy-drain
git diff --check -- goals/legacy-drain
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug legacy-drain`; add a `kind: checkpoint` file there, never edit this block._

### beep-effect-cutover archived by goals/history-message-overlay, 2026-11-06

SPEC.md's line that beep-effect-cutover is archived is done: on 2026-11-06 goals/history-message-overlay tracked the reviewed commit-message map at docs/history/ and moved the whole folder (1.3 MB: census, cutover, research) to $HOME/.local/state/beep/archive/beep-effect-cutover/. Nothing was deleted.

Lane git-history-rewrite · PR #2785

Reverse: mv $HOME/.local/state/beep/archive/beep-effect-cutover $HOME/YeeBois/projects/beep-effect-cutover

### drainable class built; first live observation started 221 grace windows, 2026-11-13

P0 to P2 done in lane goals/legacy-drain. The `drainable` class lives in `ResidueReapDrain*.ts` with the live probe in `ResidueReapDrainLive.ts`; `residue-reap-drain.test.ts` proves the predicate against real git fixtures (grace window, opt-in, bundle-before-remove with an unwritable bundle refused, unknown liveness refused, registered worktree refused, borrowed object store refused, HEAD movement restarting grace).

First live dry run, 2026-11-13T22:06Z, `residue-reap --fleet --classes drainable`, 56 s: 352 fleet checkouts, 9 registered legacy clones holding 166,242,401,382 bytes. 221 lanes met the predicate and started their grace windows (registry `draining`). 129 were refused: session-ledger 78, clean-tree 42, liveness 18, open-pr 11, proof-unit 9, owned-worktrees 9 (every legacy clone), timer-host 3 (`beep-effect`, `beep-effect0`, one `beep-effect11` lane), object-borrowers 1 (`beep-effect0` borrows from `beep-effect`), plus 1 unreadable layout. Liveness was confirmed dormant for 332 checkouts, against 0 under the mirror's own rule.

The first apply wave is time-gated: the earliest grace expiry is 2026-11-20T22:06Z, and only after the merged code runs at least one more observation at unchanged HEADs.

Fix found by the live run: a dangling unit symlink in `~/.config/systemd/user` failed the timer-host probe for every checkout; dangling unit links are now skipped, since systemd cannot load them either.

Lane goals/legacy-drain

Reverse: Clear drainingSince/drainingHead in registry.json rows, or revert the drainable class PR

<!-- beep:decisions:end -->
