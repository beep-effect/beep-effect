# FreshBooks Driver Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Endpoint-validation spike against the dev app: invoice-PDF endpoint verdict, live request limits, webhook retry/disable schedule; study the `@beep/hubspot` pattern surface. | Spike report in `history/`; retrieval-verb go/no-go decided. |
| P1 Implement | pending | Scaffold via `bun run beep create-package`; schemas (accounts/businesses, clients, invoices, payments; `account_id` vs `business_id` modeled) → service contract → token helper with single-refresh-owner rotation → read verbs (+ PDF retrieval if P0 verified it). | Acceptance criteria for the package surface are met. |
| P2 Verify | pending | Fixture proofs; concurrent-refresh serialization test; credential-gated read-only live smoke; `bun run beep quality package-verify @beep/freshbooks`. | Verification matrix green. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. On the packet's final work PR, the P4 closeout edits are committed before this phase's publish, so the merge-ready verdict binds the head that actually merges. | `bun run beep yeet monitor` reports `merge-ready: yes` (the aggregate hard gate); zero unresolved review threads. |
| P4 Close | pending | Land the closeout reflection and packet-state flip in the same PR as the final work (same-PR packet-state flips) — these edits ride that PR before its publish, never a post-merge follow-up. | The final work PR contains the reflection and status flip; P3's merge-ready verdict covers it. |

## P4 Closeout Checklist

Run this checklist before the final work PR publishes — the reflection and
the `status` → `completed-retained` flip land in that same PR (same-PR
packet-state flips), never as a post-merge follow-up:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json`
   phase statuses + `initiative.status`.

## Execution Notes

- Credentials resolve through the recorded 1Password references at runtime
  (`op run` / `op read`); refs stay references everywhere.
- The new-package first-CI governance gates apply (changeset naming the
  package, docgen on exports, knip/fallow surfaces) — budget for them in P1.
- Preserve unrelated worktree changes; keep `SPEC.md` normative.

## Verification Commands

```sh
test "$(wc -m < goals/freshbooks-driver/GOAL.md)" -le 4000
jq . goals/freshbooks-driver/ops/manifest.json
rg -n "freshbooks-driver|GOAL.md|agentLaunchers|packetAnchorDocument" goals/freshbooks-driver
git diff --check -- goals/freshbooks-driver
```
