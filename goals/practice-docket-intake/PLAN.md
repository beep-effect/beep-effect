# Practice Docket Intake Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Ground the design in the existing packets and packages. | `SPEC.md` relation table and Decision Log are written. |
| P1 Implement | in progress | Build the three slices below. | Acceptance criteria are met. |
| P2 Verify | pending | Package handoffs, property tests, live smoke after registration. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish each slice through yeet and drive it to mergeable. | Each PR is merge-ready; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

One PR per slice. Slices 2 and 3 depend on slice 1 being merged.

| Slice | Content | Surfaces |
| --- | --- | --- |
| 0 | This packet and the registration runbook. | `goals/practice-docket-intake`, `docs/runbooks` |
| 1 | `@beep/m365` app-only lane, per-lane scope configs, write-safe executor; calendar event create, update and find-by-key; master category list and create; message category update; paged message listing; attachment list and download. | `packages/drivers/m365`, `packages/drivers/m365-mcp` (test stubs) |
| 2 | Docket intake values and pure policy, ports, the classify, enter and review pipeline with typed outcomes, the digest; property tests. | `packages/law-practice/domain`, `packages/law-practice/use-cases` |
| 3 | Adapters (Graph, language model, state store, matter lookup), the service app, its systemd user unit, the live smoke. | `packages/law-practice/server`, `apps/docket-intake` |

## Operator-Attended Steps

Routed through the orchestrator session, never asked in chat:

1. Entra app registration and Exchange role assignment
   (`docs/runbooks/docket-intake-entra-registration.md`).
2. Attorney spot-check of the first tentative entries.

## P4 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; record every implementing decision in its
  Decision Log.
- Fixtures contain no real client mail. Evidence in `history/` carries ids,
  counts and hashes only.

## Verification Commands

```sh
test "$(wc -m < goals/practice-docket-intake/GOAL.md)" -le 4000
jq . goals/practice-docket-intake/ops/manifest.json
rg -n "practice-docket-intake|GOAL.md|agentLaunchers|packetAnchorDocument" goals/practice-docket-intake
git diff --check -- goals/practice-docket-intake
```
