# Practice M365 Contacts Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Operator-attended Entra app registration (certificate credential) with admin consent and RBAC-for-Applications scoping to the attorney's mailbox; confirm the seeding job's home; census the salvaged CSV columns (counts and headers only — no contact content in the repo). | Registration + scoping evidence in `history/`; job home chosen; CSV census recorded. |
| P1 Implement | pending | Auth-lane config split and confidential-client constructor → write-safe HTTP executor → contact schemas + create/list verbs → seeding job with dedup/tagging. Schema → service contract → implementation, in that order. | Acceptance criteria for lanes, verbs, and the dry-run seeding report are met. |
| P2 Verify | pending | Fixture proofs for both lanes; credential-gated live smoke (mutation opt-in, self-cleaning); executed seeding run with rollback path recorded; package-verify handoff. | Verification matrix green; seeding receipt in `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json`
   phase statuses + `initiative.status`.

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
