# <Goal Title> Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | pending | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
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
test "$(wc -m < goals/<slug>/GOAL.md)" -le 4000
jq . goals/<slug>/ops/manifest.json
rg -n "<slug>|GOAL.md|agentLaunchers|packetAnchorDocument" goals/<slug>
git diff --check -- goals/<slug>
```
