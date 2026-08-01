# Gov Legal MCP Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Contract and naming audit | complete | Inventory GovInfo/eCFR public operations and shipped mcp-kit call shapes; freeze source gates, normalization, 64-char truncation/digest rules, report schema, and offline fixtures. | Met 2026-07-31: `history/2026-07-31-p0-contract-audit.md` froze four tools, the naming/digest algorithm, report schema, and an 11-item offline test plan with zero blockers; the truncation fixture digest (`a06e92ed`) was independently verified. |
| P1 Implement thin host | complete | Scaffold `gov-legal-mcp`; add bounded read-only toolkits/handlers, deterministic naming/report generation, gated composition, sanitized dispatch, annotations, server, and bin. | Met 2026-07-31: `packages/drivers/gov-legal-mcp` mounts eCFR (`none`) and GovInfo (`hard`, vanishes without `GOVINFO_API_KEY`) through `composeGatedLayers` + `sanitizedToolkit` + `McpServer.layerStdio`; generation is fail-closed and byte-stable. |
| P2 Verify | complete | Run collision/auth/schema/span fixtures, no-diff regeneration, focused package gates, docgen, and repo proof. | Met 2026-07-31: 12/12 offline tests (collision, gates, MCP schemas, sanitized span, four hints, report no-diff, import-safe bin, schema property coverage); pre-push gate failures attributed and cleared (schema-first S.Class migration, fallow boundaries regen, staged changeset). |
| P3 Close | complete | Drive the PR to mergeable through Yeet, archive evidence, write reflection, and synchronize lifecycle. | Reflection `history/reflections/2026-07-31-claude.md` written; manifest/README/PLAN synchronized; PR published and monitored through Yeet. |

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
