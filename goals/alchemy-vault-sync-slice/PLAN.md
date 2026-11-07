# Alchemy Vault-Sync Slice Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded (`research/01-p0-spikes.md`, 2026-11-06). |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. PR 1 (D16): pin, driver scaffold, spikes, doctrine, kit freeze. PR 2: Postgres Platform driver + conformance suite + Cluster engine. PR 3: vault-sync aggregates/views/policies/sagas, Session middleware, Api (HTTP/CLI/MCP views), genesis import, projections, single-writer cutover. PR 4: frontend offline intents + QA recording, observability catalog, PII audit. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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

## Verification Commands

```sh
test "$(wc -m < goals/alchemy-vault-sync-slice/GOAL.md)" -le 4000
jq . goals/alchemy-vault-sync-slice/ops/manifest.json
rg -n "alchemy-vault-sync-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/alchemy-vault-sync-slice
git diff --check -- goals/alchemy-vault-sync-slice
```
