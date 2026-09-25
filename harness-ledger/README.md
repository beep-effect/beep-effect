# Harness Ledger

Tracked, append-only evidence about harness edits. One row per proposed,
evaluated, or retired harness change.

A harness is prompts + control flow + tools + skills/memory + context
management + subagents. The model is held fixed.

Owning packet: [`goals/harness-evidence-ledger`](../goals/harness-evidence-ledger/SPEC.md).
Row schema: `HarnessLedgerRow` in `@beep/repo-ai-metrics`.

## Layout

| Path | Role |
| --- | --- |
| `rows/YYYY-MM.jsonl` | One JSON row per line, grouped by the month the row was written. |

## Laws

- **Append-only.** Rows go under `harness-ledger/rows/YYYY-MM.jsonl`. A
  month file only grows.
- **Rows are immutable.** A disposition change appends a new row whose
  `previousRowId` names the prior `rowId`. Never edit or delete a written row.
- **Single writer.** Only `bun run beep harness-ledger` writes here. Do not
  hand-edit files in this directory. Do not write here from any other tool.
- **Machine proposes, human admits.** The CLI and the pruning scan emit rows
  with disposition `proposed`. A human decides `accepted`, `rejected`,
  `deferred`, `waived`, or `tombstoned`. Nothing here applies a harness
  change.
- **No paths, secrets, or personal data.** Surfaces are hashed ids. Rows
  never carry file paths, prompts, tool arguments, secrets, or client
  material. This repo is public.
- **Evidence expires by fingerprint, not by date.** Each row captures the
  harness fingerprint at creation: model id, reasoning effort, and a content
  hash of the always-loaded harness surfaces. A row is stale when its
  fingerprint differs from the current one. An ordinary code commit does not
  expire evidence.
- **Tombstones carry `resurrectWhen`.** A retired surface or rejected
  mechanism names the condition that would justify trying it again, such as
  a new model id.

## Writer commands

| Command | Effect |
| --- | --- |
| `bun run beep harness-ledger propose --mechanism <class> --edit <commit:<sha>\|diff:<sha256>\|pending> [--hypothesis "<claim>" --expected-surface <kind> --expected-metric "<name>"] [--model <id>] [--reasoning-effort <level>] [--repo-revision <sha>] [--json]` | Captures the harness fingerprint now and appends one `proposed` row. Prints the row id and its trailer. |
| `bun run beep harness-ledger disposition --row <rowId> --to <accepted\|rejected\|deferred\|waived\|tombstoned> --evidence "<text>" [--score <n> --cost <n>] [--resurrect-when "<text>"] [--touched <kind>:<name> ...]` | Appends a row that supersedes the latest row of a chain. Refuses a row that is already superseded. |
| `bun run beep harness-ledger list [--stale] [--disposition <d>] [--month YYYY-MM] [--json]` | Folds each chain to its latest row and flags rows whose fingerprint differs from the current one. |
| `bun run beep harness-ledger prune-proposals [--window <sessions>] [--state-dir <dir>] [--write] [--json]` | Proposes retiring skills, hooks, and MCP servers with zero hook-pulse touches in the last N sessions. Dry run unless `--write`. |

## Trailer

A commit or PR that carries a harness edit cites its row with a trailer:

```text
Harness-Ledger: <rowId>
```

No row means the change is product work, not a harness edit.
