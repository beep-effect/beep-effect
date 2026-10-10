# Domain Kernel Hardening Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Reconcile the retired entity stack to EntityKit and effect-drizzle; measure both nullable encodings. | Required facts + blockers recorded. |
| P1 Implement | complete | Add `deletedAt`/`deletedByPrincipal` to auditColumns; evidence the existing DomainModel retirement; demonstrate the `.errors.ts` convention. | `SPEC.md` acceptance criteria met. |
| P2 Verify | complete | Run kernel package checks + tests + docgen; capture evidence. | Green or blockers documented. |
| P3 Close | pending | PR, review response, closeout reflection, readiness. | Status/evidence updated; reflection exists. |

## P3 Closeout Checklist

Before marking the packet closed (`status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**, the
   **implementation**, and the **goal/prompt**; capture TODOs. Frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; update only when the contract changes.
- Kernel only — defer slice-entity work to sibling packets in the exploration MAP.
- Sequence-of-record for the whole initiative:
  `explorations/domain-layer-hardening/MAP.md`.

## Verification Commands

```sh
test "$(wc -m < goals/domain-kernel-hardening/GOAL.md)" -le 4000
jq . goals/domain-kernel-hardening/ops/manifest.json
rg -n "domain-kernel-hardening|GOAL.md|agentLaunchers|packetAnchorDocument" goals/domain-kernel-hardening
git diff --check -- goals/domain-kernel-hardening
bunx turbo run check test docgen lint --filter=@beep/shared-domain --filter=@beep/schema
```
