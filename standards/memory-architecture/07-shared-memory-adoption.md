# 07 — Shared Memory and Code-KG Adoption

Status: adopted (pilot).
Decided: 2026-08-06. Pilot review: 2026-08-20.

This document records the operator-level memory plane adopted on 2026-08-06
and the wiring that implements it. It implements the entry of the same date
in [`04-decision-log.md`](./04-decision-log.md) and supersedes the Cognee
role assignments in
[`06-agent-memory-operations.md`](./06-agent-memory-operations.md) and in the
2026-07-08 role-update note in
[`05-context-graph-capability-assessment.md`](./05-context-graph-capability-assessment.md).

## Decision

Two tools, two roles, no metered API key in either hot path.

**Durable dev-memory: basic-memory** (AGPL-3.0 — internal tooling only). One
shared store at `~/YeeBois/memory/beep-shared`, registered as the
basic-memory project `beep-shared`, read *and* written by all four coding
agents — Claude Code, Codex CLI, Grok CLI, Cursor — through the MCP server
`uvx basic-memory mcp --project beep-shared`. The store lives outside the
repository and is shared by every beep-effect clone; it is not a repo
artifact. AGPL-3.0 constrains it to internal developer tooling: it must not
be distributed or embedded in any customer-facing artifact. The
Effect-native port below is the path if that ever changes.

**Code knowledge graph: codegraph** (MIT). A deterministic tree-sitter →
SQLite(WAL)+FTS5 index over this repository, served over MCP by
`codegraph serve --mcp`. No LLM appears anywhere in its index path. Every
launcher sets `DO_NOT_TRACK=1` and `CODEGRAPH_NO_UPDATE_CHECK=1`, because
codegraph ships default-on telemetry with a persistent id despite its
"100% local" marketing; run `codegraph telemetry off` once as the persistent
switch behind those env vars. Its index directory `.codegraph/` is
gitignored.

## Evidence

The decision rests on an external bake-off dated 2026-08-06: twelve
adversarial code-level dossiers with `path:line` evidence, an X/web
practitioner sentiment sweep, and live trials run against this repository at
`a1550127dc` (180 packages, 5,336 TypeScript files). The verdict memo is
`~/YeeBois/research/codebase_graph_and_memory/BAKEOFF.md`; the rubric,
dossiers, sentiment sweep, trial protocol, and raw trial output are under
`~/YeeBois/research/codebase_graph_and_memory/_research/bakeoff/`. Both
paths are external to this repository and read-only from it.

The live trials that decided the two roles:

- **Cross-agent recall.** A note written from one CLI was recalled verbatim
  by another in a fresh session (Claude → Grok → Claude round trip). That is
  the only property "shared memory" can mean, and it is exactly the property
  Cognee's agent-scoped MCP memory fragments do not provide.
- **Concurrency.** Ten parallel writers, zero lost notes, and a clean
  `basic-memory doctor` afterwards.
- **Index speed.** codegraph indexed this repository into 73k nodes and 232k
  edges in 5.3 seconds (295 MB artifact); an incremental sync took 0.95
  seconds and was immediately queryable.
- **Query accuracy.** Five of five ground-truth queries answered correctly on
  the first try, returning `path:line`, with no API key anywhere in the path.

Post-trial weighted scores were codegraph 84/100 and basic-memory 75/100,
each first in its role; the runners-up failed on caller-graph completeness
and on operational reality respectively.

## Store conventions

Binding. They are mirrored in the store's own
`~/YeeBois/memory/beep-shared/README.md`, which is authoritative for the
store itself; keep the two in sync when either changes.

1. **One fact per note.** Small, titled, retrievable units — never session
   dumps.
2. **Folders are types.** `decisions/` for architectural and process
   decisions with date and rationale; `code-facts/` for durable facts about
   the codebase, citing `path:line` where possible; `episodes/` for dated
   events worth remembering; `profiles/` for people, tool, and agent
   profiles.
3. **`author:` frontmatter is mandatory.** basic-memory has no native
   attribution, so every note carries an `author:` key with one of
   `claude-code`, `codex`, `grok`, `cursor`, `human`.
4. **Temporality is git.** The store directory is a git repository and every
   meaningful write session is committed; history queries are
   `git log -p <note>`. Never rewrite history.
5. **Supersede, do not silently edit.** When a fact changes, update the note
   *and* state what it replaced and when.
6. **Confidentiality (hard rule).** No pre-publication patent text, invention
   disclosure, client correspondence, or any OIP corpus material enters this
   store, ever. The store is local-only: never pushed to a remote, never
   synced to any cloud.

## Wiring

| Agent | Config file | Entries |
|---|---|---|
| Claude Code | repository `.mcp.json` (project scope) | `basic-memory`; `codegraph` with an `env` block carrying both variables |
| Codex CLI | `~/.codex/config.toml` | `[mcp_servers.basic-memory]`, `[mcp_servers.codegraph]`, `[mcp_servers.codegraph.env]` |
| Grok CLI | `~/.grok/config.toml` (written by `grok mcp add -s user`) | the same two server tables plus the env sub-table |
| Cursor | `~/.cursor/mcp.json` | the same two entries; codegraph additionally passes `--path ${workspaceFolder}` |

Only the Claude Code row is repo-tracked. The other three are machine-local
operator configuration and cannot ship in a pull request; the exact commands
are recorded in
[`goals/shared-memory-code-kg-wiring/research/SOURCES.md`](../../goals/shared-memory-code-kg-wiring/research/SOURCES.md).
Note that `codegraph install` writes none of these env blocks and has no Grok
target, so all four registrations are hand-written.

This is the first memory server in the repository `.mcp.json`. Cognee stays
where it was, in user-level configuration — the split described in `06` still
holds, it just no longer describes the default recall path.

## What this retires

- **Cognee loses the durable always-on dev-memory role.** Its MCP memory
  fragments are agent-scoped, which defeats the purpose of a shared store;
  its locks are process-local and therefore unsafe across the several agent
  processes running here; and it phones home with a persistent id. It stays
  installed and available for document-KG experiments, and the user-level
  `beepintir` configuration is deliberately **not** deleted.
- **Graphiti stays retired** (2026-07-25 entry) and does not return. Its
  ingestion path requires an LLM, which violates the keyless rule
  structurally rather than by configuration.
- **Nothing is migrated.** Existing Cognee and Graphiti data stays where it
  is; `beep-shared` starts empty and accumulates from live sessions.

## Pilot review — 2026-08-20

Two weeks after adoption, judged on three criteria:

1. **Real cross-CLI recall.** Do agents actually recall decisions written by
   a different CLI, in ordinary sessions, without being prompted to look?
2. **codegraph replacing grep-storms.** Do symbol-definition and caller
   questions get answered from the index instead of by repeated ripgrep
   sweeps?
3. **Zero store corruption.** `basic-memory doctor` clean, no lost or mangled
   notes, git history intact.

Following the precedent the 2026-07-08 entry set for the Graphiti-to-Cognee
gate, the fallback on failure is Layer-1 file memory (`CLAUDE.md` /
`MEMORY.md`) alone — not a return to Graphiti, and not a reinstatement of
Cognee's retired role.

## Medium term: the Effect-native port

The frontier scan behind the bake-off found no Effect-native memory or
knowledge-graph implementation of any kind. For a legal-AI product whose moat
is structured knowledge, this layer is eventually worth owning. Recorded
intent only — it is not scheduled work and no part of this adoption:

- Port basic-memory's store model (markdown as source of truth, SQLite FTS as
  materialization) to `@beep/memory` with `S.Class` note schemas, `LiteralKit`
  for note kinds and folders, Effect `HashMap` graph views, and an
  `effect/unstable/http` MCP server.
- Port Graphiti's bi-temporal validity intervals on edges as the temporal
  schema, minus its runtime.
- Keep codegraph as the code-KG engine; its SQLite schema is readable from
  TypeScript directly if a tighter integration is ever wanted.

## Boundary (unchanged)

The 2026-08-01 operator/product authority boundary is **binding and
unchanged by this document**. Everything above is operator memory: developer
recall across coding sessions and codebase structure lookup. Product tables in
the professional runtime remain the sole authority for product records, they
never become an operator-memory backend, and operator memory — now
basic-memory rather than Cognee — never becomes product authority. Neither
basic-memory nor codegraph enters any product runtime, default deployment, or
authority path.
