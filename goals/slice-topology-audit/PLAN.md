# Slice Topology Audit Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Re-verify every line cite in `SPEC.md` against `origin/main` HEAD (the exploration measured `2c0c8eb046`–`8f646c1e82`), ratify the nine DEFERRED rows, and draft the `standards/architecture/DECISIONS.md` entries. | Amendment list with file:line targets; nine ratifications recorded; no open decision. |
| P1 Implement | pending | PR-A amendments → PR-B `audit` command + schemas + baseline → PR-C gate wiring. Schema first (`RoleVocabulary`, `RoleMember`, `ContractMember`, `AuditReport`, `AuditBaseline`, rule ids), then the walker/rule-engine service contract, then rules. | Each PR's acceptance rows in `SPEC.md` are met. |
| P2 Verify | pending | Run the first vertical slice on `main`: `audit --slice architecture-lab --json` ≥ 14 findings, `--write-baseline`, second run exit 0, injected regression exit ≠ 0; `package-verify @beep/repo-cli`; `docgen:local`. | Evidence recorded under `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish each PR through yeet and drive it to mergeable: required checks green, every review thread answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads; `merge-ready: yes`. |
| P4 Close | pending | Write the closeout reflection, flip packet state, and hand `architecture/slice-audit` to `canonical-proof-reconciliation`. | Packet status and evidence are updated; a closeout reflection exists. |

## Sequencing notes

- PR-A before PR-B: the auditor's `LiteralKit`s transcribe the doctrine text;
  writing them first would create a second source of truth.
- PR-B ships the baseline with the proof's divergences as counted
  `follow_ups` rows; the CLI's proof-audit-clean test is written but expected
  to pass only after `canonical-proof-reconciliation`'s manifest + lab PR.
- PR-C's required context is the lint-policy step; register the `CiLane` id in
  the same PR and promote it to its own required context only if the step's
  runtime exceeds the lint-policy budget (ratified 2026-08-30).
- Record friction receipts in the exploration's ledger the moment they happen.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. Confirm `goals/canonical-proof-reconciliation` can start (`requires:
   architecture/slice-audit` satisfied).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Exploration packet: [`explorations/v3-consistency-audit`](../../explorations/v3-consistency-audit/README.md) — `synthesis/40`
  R1, R2, R4–R12 are the ranked mechanisms; `synthesis/00` is the 110-row
  evidence table; `synthesis/15` §2 lists the 14 proof manifest locations the
  first vertical slice must find.

## Verification Commands

```sh
test "$(wc -m < goals/slice-topology-audit/GOAL.md)" -le 4000
jq . goals/slice-topology-audit/ops/manifest.json
rg -n "slice-topology-audit|GOAL.md|agentLaunchers|packetAnchorDocument" goals/slice-topology-audit
git diff --check -- goals/slice-topology-audit
bun run beep architecture audit --slice architecture-lab --json
bun run beep quality package-verify @beep/repo-cli
```
