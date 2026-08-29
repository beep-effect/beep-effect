# Official Data Sync Foundation Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Confirm source authority, repo patterns, and Effect v4 APIs. | Source choices and constraints are recorded in `SPEC.md` and `research/README.md`. |
| P1 Implement | completed | Add sync backend, generated data exports, schema consumers, workflow, and tests. | Code surfaces named by `SPEC.md` are implemented. |
| P2 Verify | completed | Run focused checks and fix scoped fallout. | Scoped verification is green; unrelated current-worktree blocker is documented. |
| P3 Close | pending | Capture closeout evidence and reflection if this packet is retained. | README, manifest, and reflection history are updated. |

## Implementation Slices

1. Sync backend: fetch bytes/text, hash sources, parse XML/JSON/CSV/tar data,
   render multi-file projections, compute canonical JSON patches, and emit
   Markdown/JSON reports.
2. Data targets: generate ISO 4217, IANA media type, IANA tzdb, and CLDR
   territory modules plus JSON sidecars.
3. Data package: re-export raw values, lookup maps, literal arrays, and source
   metadata through stable `@beep/data` modules.
4. Schema package: derive literals/codecs from `@beep/data` via typed
   `Struct` helpers.
5. Automation: schedule/update workflow with report artifacts and PR body
   generation.
6. Goal packet: preserve source decisions, acceptance criteria, and future
   closeout requirements.

## P3 Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection by copying
   `history/reflections/_TEMPLATE.md` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
2. Run `bun run beep lint reflection-artifacts` if the packet remains marked
   `reflectionRequired: true`.
3. Update `README.md` latest evidence and `ops/manifest.json` phase statuses.

## Execution Notes

- Preserve unrelated local work, especially concurrent Sha256/Cuid/libpff/file
  changes.
- Do not make `@beep/schema` fetch network data at runtime.
- Do not couple sync hashing to `@beep/schema/Sha256`.
- Prefer official source metadata over guessed freshness.

## Verification Commands

```sh
bun run beep sync-data-to-ts --all --check --report-dir "$(mktemp -d)"
bun run --cwd packages/tooling/tool/cli check
bun run --cwd packages/tooling/tool/cli test sync-data-to-ts
bun run --cwd packages/foundation/primitive/data check
bun run --cwd packages/foundation/primitive/data test
bun run --cwd packages/foundation/modeling/schema check
bun run --cwd packages/foundation/modeling/schema test CurrencyCode Timezone TerritoryCode MimeType
bun run beep lint schema-topology
test "$(wc -m < goals/official-data-sync-foundation/GOAL.md)" -le 4000
jq . goals/official-data-sync-foundation/ops/manifest.json
git diff --check -- goals/official-data-sync-foundation
```
