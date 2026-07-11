# Pandoc AST Foundation Plan

## Status

Status: `completed-retained`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Ground on the exploration packet and repo modeling patterns. | Scope and non-goals were confirmed from `docx-roundtrip-interop`, `@beep/md`, and `@beep/lexical-schema`. |
| P1 Implement | completed | Create the pure `@beep/pandoc-ast` foundation/modeling package. | Models, codecs, mappers, reports, fixtures, tests, docs, and exports are present. |
| P2 Verify | completed | Run package-local checks and packet validation. | Package check/test/type-test/lint/docgen/build passed on 2026-06-15. |
| P3 Close | completed | Prepare retained closeout evidence and reflection if the packet is marked closed. | Closeout reflection `history/reflections/2026-07-11-claude.md` written during the 2026-07-11 reconciliation. |

## P0 Research Notes

- Used `explorations/docx-roundtrip-interop` as the graduated source.
- Reused package patterns from `@beep/md` and `@beep/lexical-schema`.
- Kept normal tests independent of a local Pandoc executable.

## P1 Implementation Notes

- `Pandoc.model` defines the v1 Pandoc AST mirror, including explicit unknown
  and gap nodes.
- `Pandoc.codec` decodes/encodes Pandoc JSON constructor wire forms and JSON
  strings through Effect Schema.
- `Pandoc.mapping` maps Pandoc AST to/from `@beep/md` and returns structured
  compatibility reports.
- `Pandoc.report` owns issue severities, directions, JSON pointers, and report
  profiles.
- Fixtures live under `packages/foundation/modeling/pandoc-ast/test/fixtures`.

## P2 Verification Notes

Completed package-local proof:

```sh
bun run --cwd packages/foundation/modeling/pandoc-ast check
bun run --cwd packages/foundation/modeling/pandoc-ast test
bun run --cwd packages/foundation/modeling/pandoc-ast type-test
bun run --cwd packages/foundation/modeling/pandoc-ast lint
bun run --cwd packages/foundation/modeling/pandoc-ast docgen
bun run --cwd packages/foundation/modeling/pandoc-ast build
bun run --cwd packages/foundation/modeling/identity check
bun run repo-exports:catalog:check
bun run docgen:local --full
```

## P3 Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` status/latest evidence and `ops/manifest.json` phase
   statuses.
4. If publishing is requested, use the repo Yeet workflow rather than ad hoc
   commit/push commands.

## Verification Commands

```sh
test "$(wc -m < goals/pandoc-ast-foundation/GOAL.md)" -le 4000
jq . goals/pandoc-ast-foundation/ops/manifest.json
rg -n "pandoc-ast-foundation|GOAL.md|agentLaunchers|packetAnchorDocument" goals/pandoc-ast-foundation
git diff --check -- goals/pandoc-ast-foundation explorations/docx-roundtrip-interop explorations/ATLAS.md packages/foundation/modeling/pandoc-ast
```
