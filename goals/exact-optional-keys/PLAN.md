# Exact optional schema keys Plan

## Status

Status: `active` (P0-P2 and P4 complete 2026-10-23; P3 implementation PR #2145 merged; PR #2316 carries the alias rule repair and retained-readiness closeout; proposedCloseout completed-retained)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Ground `optional` vs `optionalKey` in Effect v4 source + runtime probe; census; grill decisions. | `research/optional-vs-optional-key.md` and the SPEC Decision Log are written. |
| P1 Implement | complete | (a) `exact-optional-keys` codemod rule + fixture tests for every form; (b) run it with `--write`; (c) typecheck/test-driven fixes: call-site conditional spreads, ledgered `UndefinedOr` exceptions; (d) `prefer-exact-optional-key.grit` + recall/precision tests + biome.json registration; (e) EF-40 + doc amendments. | Codemod dry-run 0, rg 0, grit 0 outside ledger. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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
test "$(wc -m < goals/exact-optional-keys/GOAL.md)" -le 4000
jq . goals/exact-optional-keys/ops/manifest.json
rg -n "exact-optional-keys|GOAL.md|agentLaunchers|packetAnchorDocument" goals/exact-optional-keys
git diff --check -- goals/exact-optional-keys
```
