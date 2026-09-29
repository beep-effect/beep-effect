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
| `bun run beep harness-ledger prune-proposals [--window <sessions>] [--state-dir <dir>] [--write] [--json]` | Proposes retiring skills and MCP servers with zero hook-pulse touches in the last N sessions under the current harness hash. Dry run by default; `--write` appends the fresh `proposed` rows. |

## Trailer

A commit or PR that carries a harness edit cites its row with a trailer:

```text
Harness-Ledger: <rowId>
```

No row means the change is product work, not a harness edit.

`list` compares current harness surfaces using each row's recorded model and
reasoning effort by default. Pass `--model` or `--reasoning-effort` to compare
against a different regime explicitly. Hooks are excluded from zero-touch
pruning until hook execution telemetry exists; file-tool touches alone cannot
show whether an always-on hook is unused.

## Pruning window

Hook-pulse stamps a `harnessHash` on each `SessionStart` row: a digest of the
config-snapshot session and baseline hashes, the same two hashes the
fingerprint carries (`deriveHarnessHash` in `@beep/repo-ai-metrics`).
`prune-proposals` computes the current harness hash and counts a session only
when it carries at least one stamp and every stamp equals the current hash. A
session restarted across a harness edit, and a session with no stamp, is
skipped; the output reports both skip counts. Zero in-regime sessions is no
evidence, so nothing is proposed. Proposal evidence names the regime by the
first 12 hex characters of the hash, never by a path.

`--write` needs a full window: it appends only when N in-regime sessions were
observed for `--window N`, so every written row's `windowSessions` equals N. A
partial window writes nothing and says so (`nothing written: window not full
(<n> of <N> sessions under the current harness hash)`). A dry run still lists
what the partial window would propose and marks it as partial.

A chain that targets a surface can stop that surface from being proposed
again:

- a chain whose latest row is `proposed` blocks under any harness hash;
- a chain whose latest row is a human decision (`accepted`, `rejected`,
  `deferred`, `waived`) blocks only while that row's fingerprint derives the
  current harness hash. After a harness edit the decision's evidence has
  expired, and a full window under the new hash may propose the surface again;
- a `tombstoned` chain never blocks.

The output counts both kinds of block, as `already proposed` and `decided
under this harness`.

The writer drops the stamp, never the row, whenever it cannot prove its shell
walk matches the TypeScript snapshot (for example a non-ASCII path, 1000 or
more config files, or a missing tool). Such sessions count as unstamped, as
do sessions from writers that do not stamp yet (the Codex copy of the writer
and the Cursor adapter).

## Write fence

Every supported write (`propose`, `disposition`, and `prune-proposals
--write`) acquires an exclusive `harness-ledger/.write.lock` before reading the
chain and releases it after append or failure. A concurrent writer fails closed with
`HarnessLedgerBusyError`. If a process is killed before cleanup, verify no
writer is active before manually removing the leftover lock and retrying.
