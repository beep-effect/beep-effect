# Session Route Resolver Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Check from inside a T3-hosted Codex session whether `T3CODE_THREAD_ID` is set; confirm the Effect v4 APIs for the recursive union. | Both facts are recorded as checkpoint files. |
| P1 Implement | complete | Schemas, then presence capture in the identity reader and hooks, then `session resolve` over ledger, presence and the Claude live index; then the Codex thread-table and `t3` CLI readers (first to cut). | Acceptance criteria are met. |
| P2 Verify | in-progress | Run required checks and capture evidence. | Verification is green or blockers are documented. |
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
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add session-route-resolver --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/session-route-resolver/GOAL.md)" -le 4000
jq . goals/session-route-resolver/ops/manifest.json
rg -n "session-route-resolver|GOAL.md|agentLaunchers|packetAnchorDocument" goals/session-route-resolver
git diff --check -- goals/session-route-resolver
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug session-route-resolver`; add a `kind: checkpoint` file there, never edit this block._

### P0: T3-hosted sessions see T3CODE_THREAD_ID, Codex included, 2026-11-13

Observed in a T3-hosted Claude session's tool shell: T3CODE_THREAD_ID, CLAUDE_CODE_ENTRYPOINT=t3-code and CLAUDE_CODE_SESSION_ID are set, and the T3 userdata environment-id file holds the environment id. For Codex, the T3 Codex adapter (apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts, T3 checkout 2026-11-13) sets T3CODE_THREAD_ID per thread through shell_environment_policy, so a T3-hosted Codex tool shell sees its own thread id; the app-server process itself does not carry it, so presence is captured from the session's shells and hooks, not from the server process. `t3 thread show <id> --json` exits 1 with 'is no longer available' on stderr for a missing thread, which separates dead from unreachable.

Lane feat/session-route-resolver

Reverse: If a Codex shell under T3 lacks the variable, record that kind as resolving through t3 thread lookup by worktree or PR only.

### P0: the recursive route union uses S.suspend over opaque tagged members, 2026-11-13

Validated against the installed Effect v4 (node_modules/effect/dist/Schema.d.ts): S.suspend, S.TaggedStruct, S.Union with S.toTaggedUnion('_tag'). The repo pattern is packages/foundation/ui-system/dock/src/Dock.models-tree.ts: opaque members, a suspended reference typed S.Codec<X.Type, X.Encoded>, and an exported declare namespace carrying Type and Encoded.

Lane feat/session-route-resolver

Reverse: Replace the via-parent member's suspended field with a flat parent route and a depth field.

<!-- beep:decisions:end -->
