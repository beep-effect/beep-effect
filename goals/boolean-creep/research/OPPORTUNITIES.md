# Friction ledger — boolean-creep

Receipts recorded at the moment of friction (repo law: friction is a
first-class output). Public repo: paths relative, no secrets, no session ids.

## 2026-08-17 — headless grok lane dropped an evaluated record

- **Doing:** round-1 inventory sweep, ontology-mcp lane (headless grok,
  streaming-json).
- **Evidence:** the lane's thinking stream drafted a full disqualified record
  for `ToolbarState` (`packages/ontology/ui/src/aggregates/Session/Session.document.tsx`)
  but ended its turn (`stopReason: end_turn`) without ever issuing the append
  tool call; the report file held 1 record while the stream showed 2
  decisions. Recovered by replaying the raw transcript and appending after
  orchestrator re-verification.
- **Prevention:** the lane prompt now pins append discipline — "APPEND your
  record IMMEDIATELY after deciding each suspect, BEFORE opening the next
  file; every suspect you read code for MUST produce exactly one appended
  record" (rounds 2+). Keep raw transcripts always: they are the recovery
  layer, not telemetry.

## 2026-08-17 — raw `codex exec` does not take `--effort`

- **Doing:** launching the P2 design batches on codex CLI.
- **Evidence:** all six batches failed instantly with
  `error: unexpected argument '--effort' found` (codex v0.147.0). The
  `--effort` spelling belongs to the Codex *plugin* delegation interface; the
  raw CLI takes the config override `-c model_reasoning_effort=medium`.
- **Prevention:** in scripts, pass effort as
  `codex exec -c model_reasoning_effort=<level> ...` and smoke-test one job
  before fanning out (the early transcript peek caught this within seconds).

## 2026-08-17 — block comment terminated by a glob in prose

- **Doing:** writing `ops/validate-inventory.ts`.
- **Evidence:** the JSDoc header contained `data/sweeps/round*/*.jsonl`; the
  `*/` inside the glob closed the block comment and bun failed with
  `error: Unexpected *` at the comment line.
- **Prevention:** never write `*/` inside block comments — spell globs as
  "files under data/sweeps/" or use line comments for path patterns.

## 2026-08-23 — merge commit hook assumed an installed worktree

- **Doing:** merging `origin/main` into the PR branch from a fresh isolated
  worktree before the mergeability repair loop.
- **Evidence:** the conflict-free merge paused at `commit-msg` because
  commitlint could not resolve `@commitlint/config-conventional`; installing
  the frozen lockfile allowed the unchanged merge commit to complete.
- **Prevention:** install the locked workspace dependencies before creating a
  merge commit in a fresh worktree, or make the hook report that prerequisite
  before invoking commitlint.

## 2026-08-23 — pinned Bun installation reported a different runtime

- **Doing:** regenerating `bun.lock` after removing a deleted ghost workspace.
- **Evidence:** the repo pins Bun 1.3.14, but the executable installed under
  that version reported 1.4.0; `bun install` removed 66 unrelated lock entries
  in addition to the target workspace. The unrelated churn was restored, and
  the focused lockfile passed `bun install --frozen-lockfile`.
- **Prevention:** have agent bootstrap verify the resolved Bun executable's
  reported version against `.bun-version` before any lockfile-writing command.
