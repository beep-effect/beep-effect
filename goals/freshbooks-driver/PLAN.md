# FreshBooks Driver Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Endpoint-validation spike against the dev app: invoice-PDF endpoint verdict, live request limits, webhook retry/disable schedule; study the `@beep/hubspot` pattern surface. | Spike report in `history/`; retrieval-verb go/no-go decided. |
| P1 Implement | pending | Scaffold via `bun run beep create-package`; schemas (accounts/businesses, clients, invoices, payments; `account_id` vs `business_id` modeled) → service contract → token helper with single-refresh-owner rotation → read verbs (+ PDF retrieval if P0 verified it). | Acceptance criteria for the package surface are met. |
| P2 Verify | pending | Fixture proofs; concurrent-refresh serialization test; credential-gated read-only live smoke; `bun run beep quality package-verify @beep/freshbooks`. | Verification matrix green. |
| P3 Yeet: PR to mergeable | pending | Publish work commits through yeet and drive the PR toward mergeable: required checks green, review comments answered and resolved. The packet's final merge-ready verdict is deliberately not taken here — it belongs to P4, after the closeout edits are published on the same PR. | Checks green and zero unresolved review threads on the latest work head. |
| P4 Close | pending | Land the closeout reflection and packet-state flip in the same PR as the final work (same-PR packet-state flips — never a post-merge follow-up), publish that closeout head through yeet, and take the packet's final gate on it. | `bun run beep yeet monitor` reports `merge-ready: yes` on the head that contains the reflection and status flip. |

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
4. Publish the closeout commit through yeet and run
   `bun run beep yeet monitor` until it reports `merge-ready: yes` on that
   head — the packet's final gate.

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
