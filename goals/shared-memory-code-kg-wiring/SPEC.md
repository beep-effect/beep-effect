# Shared Memory & Code-KG Wiring Spec

## Objective

All four coding agents (Claude Code, Codex CLI, Grok CLI, Cursor) read and
write one shared knowledge plane: **basic-memory** as the durable cross-agent
memory store and **codegraph** as the deterministic codebase knowledge graph —
both keyless end-to-end — with cognee retired from the durable dev-memory role
and `standards/memory-architecture/` updated to match reality.

Verdict provenance: the 2026-08-06 bake-off (12 adversarial dossiers, sentiment
sweep, live trials against this repo) in
the machine-local codebase-graph/memory bake-off dossier `BAKEOFF.md`. See
[`research/SOURCES.md`](./research/SOURCES.md).

## Non-Goals

- No Effect-native `@beep/memory` implementation (that is a future packet; this
  packet only records the port intent).
- No migration of existing cognee/graphiti data.
- No customer-facing or product surface changes; internal dev tooling only.
- No changes to the corpus pipeline or any OIP client material handling.

## Target Surfaces

- The `beep-shared` store (new, machine-local, outside the repo): the shared
  basic-memory project, git-initialized. Shared by ALL beep-effect clones.
- `.mcp.json`: add `basic-memory` and `codegraph` server entries (alongside
  existing `serena` etc.).
- Codex (`~/.codex/config.toml`), Grok (`grok mcp add`), Cursor MCP settings:
  register the same two servers (machine-local; document exact commands in
  `research/`, do not commit user-level configs to the repo).
- `.gitignore`: add `.codegraph/`.
- `standards/memory-architecture/`: new `07-shared-memory-adoption.md`
  (decision + wiring + conventions), amend `04-decision-log.md`, update
  `README.md` taxonomy pointers.
- `AGENTS.md` "Agent Memory" section: replace the cognee-as-durable-memory law
  with the basic-memory + codegraph routing (keep the edit lean — this file is
  prompt-cache prefix).

## Constraints

- **Keyless is a hard rule**: no metered API key anywhere in either hot path.
  codegraph runs with `DO_NOT_TRACK=1` and `CODEGRAPH_NO_UPDATE_CHECK=1` in
  every launcher/wrapper.
- Memory-store conventions (enforced in the store's own README):
  folders `decisions/ code-facts/ episodes/ profiles/`; one fact per note;
  `author:` frontmatter key identifying the writing agent (basic-memory has no
  native attribution); the store dir is a git repo (history = temporality).
- **Confidentiality**: no pre-publication patent text or client-confidential
  OIP material ever enters `beep-shared` (standing rule; the store is
  local-only and must stay out of any cloud sync).
- basic-memory is AGPL-3.0: internal tooling use only; it must not ship inside
  any distributed or customer-facing artifact (the Effect-native port is the
  path if that ever changes).
- cognee MCP stays available for document-KG experiments but loses the
  "durable always-on dev-memory" role; do not delete user-level cognee config.
- Follow repo law for all edits (`AGENTS.md`, `CLAUDE.md`); `main` is PR-only;
  ship via yeet.

## Acceptance Criteria

- [x] `basic-memory` project `beep-shared` exists at
      a machine-local path outside the repo, git-initialized, with a conventions
      README and the four folders.
- [x] `.mcp.json` registers `basic-memory` (scoped to `beep-shared`) and
      `codegraph`; both start clean in a fresh Claude Code session.
- [x] Codex, Grok, and Cursor each have the same two servers registered
      (evidence: config excerpts + a live tool call per CLI).
      **Live tool-call scope:** Claude Code + Grok proven end-to-end in
      `history/2026-08-06-wiring-evidence.md`. Codex registration confirmed
      (`codex mcp list`); live tool call deferred until weekly quota resets
      (~2026-08-08). Cursor registration confirmed in `~/.cursor/mcp.json`;
      live tool call deferred (no headless cursor-agent CLI on the wiring
      machine). Exception ledger below covers the machine-local gap.
- [x] Cross-agent round-trip proven: one CLI writes a decision note, a second
      CLI recalls it verbatim in a fresh session (evidence in `history/`).
- [x] `codegraph` is initialized for this repo (`.codegraph/` gitignored) and
      answers a symbol-definition and a callers query in-session with zero
      API keys.
- [x] `standards/memory-architecture/` names basic-memory + codegraph as the
      adopted plane, records the cognee retirement rationale with a pointer to
      the external bake-off, and sets the pilot review date 2026-08-20.
- [x] `AGENTS.md` Agent Memory section matches the new routing.
- [x] `goals/INDEX.md` regenerated via `bun run beep goals index --write`.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/shared-memory-code-kg-wiring/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/shared-memory-code-kg-wiring/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/shared-memory-code-kg-wiring` | Passes |
| Memory round-trip | write-note from CLI A; search-notes from CLI B (fresh session) | Verbatim recall; evidence archived in `history/` |
| Code-KG queries | `codegraph query LiteralKit` + a callers/`node` query | Correct file:line; no network keys |
| Store integrity | `uvx basic-memory@0.22.1 doctor` | Clean |
| Repo quality | `bun run beep yeet verify` | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The external bake-off evidence is unavailable and a decision depends on it.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| User-level CLI configs (Codex/Grok/Cursor) are machine-local and cannot ship in the PR | P1 wiring | Benjamin | Only repo-tracked surfaces (.mcp.json, standards, gitignore) are PR-shippable | Documented commands in `research/` + evidence excerpts in `history/` stand in for tracked config |
