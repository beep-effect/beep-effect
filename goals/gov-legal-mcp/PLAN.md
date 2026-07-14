# Gov Legal MCP Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Contract and naming audit | pending | Inventory GovInfo/eCFR public operations and shipped mcp-kit call shapes; freeze source gates, normalization, 64-char truncation/digest rules, report schema, and offline fixtures. | Every tool has an input source, proposed stable name, auth gate, and collision-report row; drift/blockers are recorded before implementation. |
| P1 Implement thin host | pending | Scaffold `gov-legal-mcp`; add bounded read-only toolkits/handlers, deterministic naming/report generation, gated composition, sanitized dispatch, annotations, server, and bin. | Both proven drivers mount through one server under their correct gates; generation is deterministic and duplicate-safe. |
| P2 Verify | pending | Run collision/auth/schema/span fixtures, no-diff regeneration, focused package gates, docgen, and repo proof. | Every SPEC criterion is green or a scoped blocker is archived without widening into delivery breadth. |
| P3 Close | pending | Drive the PR to mergeable through Yeet, archive evidence, write reflection, and synchronize lifecycle. | Hosted checks/review are green; reflection and packet evidence are current. |

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest from evidence.
4. Confirm collision report no-diff proof and Yeet/GitHub mergeability.

## Execution Notes

- P0 must use the live public exports; do not infer operation coverage from the
  old exploration snapshot.
- Keep this package read-only and bounded to the two proven drivers.
- Preserve unrelated worktree changes and keep `SPEC.md` normative.

## Verification Commands

```sh
test "$(wc -m < goals/gov-legal-mcp/GOAL.md)" -le 4000
jq . goals/gov-legal-mcp/ops/manifest.json
rg -n "gov-legal-mcp|GOAL.md|agentLaunchers|packetAnchorDocument" goals/gov-legal-mcp
git diff --check -- goals/gov-legal-mcp
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
