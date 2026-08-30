# Practice M365 Contacts Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Operator-attended Entra app registration (certificate credential); mailbox access granted exclusively via the Exchange RBAC-for-Applications assignment scoped to the attorney's mailbox (never the unscoped tenant-wide Entra contacts role — grants are additive), proven with `Test-ServicePrincipalAuthorization`; confirm the seeding job's home; census the salvaged CSV columns (counts and headers only — no contact content in the repo). | Registration + scoped-grant proof in `history/`; job home chosen; CSV census recorded. |
| P1 Implement | pending | Auth-lane config split and confidential-client constructor → write-safe HTTP executor → contact and contact-folder schemas with their create/list verbs → seeding job (folder discover-or-create, dedup, tagging). Schema → service contract → implementation, in that order. | Acceptance criteria for lanes, contact and folder verbs, and the dry-run seeding report are met. |
| P2 Verify | pending | Fixture proofs for both lanes across contact and contact-folder verbs; credential-gated live smoke (mutation opt-in, self-cleaning); executed seeding run with rollback path recorded; package-verify handoff. | Verification matrix green; seeding receipt in `history/`. |
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

- The driver work and the seeding job may ship as separate PRs; each rides
  the full yeet path.
- The mailbox is only written by the P2 executed seeding run and the
  self-cleaning live smoke — both operator-authorized.
- Preserve unrelated worktree changes; keep `SPEC.md` normative.

## Verification Commands

```sh
test "$(wc -m < goals/practice-m365-contacts/GOAL.md)" -le 4000
jq . goals/practice-m365-contacts/ops/manifest.json
rg -n "practice-m365-contacts|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-m365-contacts
git diff --check -- goals/practice-m365-contacts
```
