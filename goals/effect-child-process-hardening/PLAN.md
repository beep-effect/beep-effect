# Effect Child-Process Hardening Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect repo consumers and the pinned upstream docs, source, platform backends, and tests. | Inventory and locked decisions are recorded in `research/`. |
| P1 Implement | complete | Harden ownership and restore canonical process boundaries. | Source acceptance scans pass. |
| P2 Verify | complete | Run focused tests/checks, docgen, and repo proof. | Verification is green or unrelated failures are documented. |
| P3 Yeet | complete | Publish and drive a PR to mergeable when explicitly authorized. | Hosted required checks and review are green. |
| P4 Close | complete | Record reflection and flip packet lifecycle in the delivery PR. | Reflection and packet-state checks pass. |

P1 through P4 evidence is recorded in
`research/2026-07-30-verification.md`. Publication was authorized on
2026-07-30; the patch was isolated from the shared checkout, published as
[PR #509](https://github.com/beep-effect/beep-effect/pull/509), and rebased onto
current `origin/main`.

## Implementation Sequence

1. Localize driver process-output collection and remove the misplaced
   `@beep/utils` export.
2. Fix output ownership, explicit stdin, exit handling, and timeout escalation
   in drivers, the desktop picker, and ACP tooling/tests.
3. Set mode-aware stdin defaults in `StepExec`; migrate compatible repo CLI
   callers and delegate repo-run capture to the existing runner.
4. Remove redundant explicit child-process layers under aggregate platform
   layers.
5. Add focused mock coverage, one real large-output test, and changesets.
6. Run acceptance scans, package verification, docgen, and `yeet verify`.

## P4 Closeout Checklist

Completed before marking the packet `completed-retained`:

1. Wrote `history/reflections/2026-07-30-codex.md` via `/reflect`.
2. Ran `bun run beep lint reflection-artifacts`.
3. Updated packet status/evidence in the same delivery PR.

## Execution Notes

- Preserve unrelated worktree changes.
- Do not broaden scope to native process APIs.
- Publication and hosted-state mutation were explicitly authorized on
  2026-07-30.

## Verification Commands

```sh
test "$(wc -m < goals/effect-child-process-hardening/GOAL.md)" -le 4000
jq . goals/effect-child-process-hardening/ops/manifest.json
rg -n "effect-child-process-hardening|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-child-process-hardening
git diff --check -- goals/effect-child-process-hardening
bun run beep goals doctor
bun run docgen:local
bun run beep yeet verify
```
