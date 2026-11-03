# Party Slice Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete (2026-10-22) | Grill the slice shape; record placement and rulings. | Module placement and Decision Log in `SPEC.md`. |
| P1 Implement | complete (2026-11-03) | 1) prerequisite PartyId kit PR; 2) `create-package` for the three party packages; 3) domain (ids, propositions, claim binding, pure behavior); 4) use-cases (ledger and domain-neutral contact-source ports); 5) server (memory ledger, generic adapters); 6) law-practice contact adapter (bounded exception, see the Exception Ledger) and the `Party` -> `LegalPartyReference` rename; 7) remove or repoint the graduated scratchpad modules. | Acceptance criteria are met. |
| P2 Verify | complete (local publish gates passed) | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | in-progress (proposal in #2658) | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P1 Settlement Checklist (#2045)

- [x] Implement the SPEC's exact module-specifier boundary test in law-practice server,
  including suffix-package and same-line forbidden-import fixtures; check server manifest
  dependencies/devDependencies and exclude deliberate forbidden imports in test fixtures.
- [x] Implement the shared PartyKey v1 canonicalizer and pinned bytes/digest fixtures;
  prove mail-header/contact-card equality and the normalization/fallback cases.
- [x] Graduate shared identifier normalizers and hash their canonical values; pin header
  `Dana@example.test` versus card `dana@example.test` as equal normalized values, bytes and keys,
  plus Exchange DN, Username and E.164 consistency fixtures from the SPEC.
- [x] Implement active-veto-first resolution replay and deterministic contradiction review cases;
  pass every scenario in the SPEC's DistinctParty acceptance table.

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
test "$(wc -m < goals/party-slice/GOAL.md)" -le 4000
jq . goals/party-slice/ops/manifest.json
rg -n "party-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/party-slice
git diff --check -- goals/party-slice
```
