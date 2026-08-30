# P0 Inventory — cognee roles, MCP surfaces, codegraph installer

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

Read-only inventory for `shared-memory-code-kg-wiring`. Repo paths relative to
`/home/elpresidank/YeeBois/projects/beep-effect16`. **Snapshot 2026-08-06
16:47–16:55 CDT**; three surfaces changed *during* the sweep (see Blockers).

## 1. Cognee role-assigning references

`rg -i 'cognee|beepintir'` matches ~80 files; only those below assign a **role**.
Everything under `explorations/`, `docs/agent-memory-infra/*-clone.md|*-docs.md`,
and `standards/schema-catalog.generated.jsonc` is research or incidental.

### `AGENTS.md` "Agent Memory" (full, `AGENTS.md:94-100`)

```markdown
## Agent Memory

- Cognee is the durable always-on dev-memory; file memory (`CLAUDE.md` /
  `MEMORY.md`) remains Layer 1. All memory decisions and operational detail
  live in `standards/memory-architecture/`.
- If memory is unavailable in-session, fall back to repo-local docs, code
  search, and this file.
```

A **second** cognee law sits outside that section, `AGENTS.md:118-120` (Context
Economy): "durable cross-session knowledge belongs in file-memory or Cognee, not
here." `CLAUDE.md` is a **symlink to `AGENTS.md`**, so one edit covers both; both
are prompt-cache prefix, keep the diff minimal.

### `standards/memory-architecture/`

| Cite | Role assigned |
| --- | --- |
| `04-decision-log.md:78` | The binding decision: `## 2026-07-08: External Memory Stack — … Cognee Is the Sole Dev-Memory Incumbent …`. `:97` "**(B) Dev-tooling memory:** Cognee (bounded: embedded/local or all-Postgres profile, never the full compose stack) is the sole always-on dev-memory incumbent." `:124` "`AGENTS.md`/`CLAUDE.md` name Cognee (bounded) as the durable dev-memory". |
| `04-decision-log.md:37` | 2026-07-25 Graphiti retirement; `:54` "Cognee remains the sole always-on dev-memory incumbent per the 2026-07-08 entry." |
| `04-decision-log.md:7` | 2026-08-01 clarification; `:18` "Cognee's always-on operator dev-memory role is unchanged." Also sets the **binding** operator/product authority boundary. |
| `06-agent-memory-operations.md` | 35-line runbook for the above. `:10-11` "Cognee and the read-frozen Graphiti service are operator-level MCP facilities, supplied by user plugin/settings rather than the repository `.mcp.json`"; `:20` "Prefer Cognee for durable dev-memory recall." |
| `05-context-graph-…-assessment.md:189` | Blockquote "**Role update (2026-07-08):** Cognee is now the **sole always-on dev-tooling…**". Donor doc otherwise; needs a supersession pointer only. |
| `README.md` | No cognee mention at all. Only its Document Index needs a `07-` row. |

Outside the standard, `docs/agent-memory-infra/00-recommendation.md:21,132`
carries the "Role B — dev-tooling memory: Cognee survives" verdict, justified at
`:163-166` by sunk wiring ("`beepintir` MCP server, cognee plugin skills").
Evidence base, not law.

### `04-decision-log.md` entry format (so a new entry matches)

`# Decision Log` + one-line purpose, `---`, then dated entries newest-first:

```markdown
## YYYY-MM-DD: Title Case Summary (optional qualifier)

**Context:** prose, hard-wrapped ~76 cols, links as [`path`](../../path)

**Decision:** prose, or the label alone followed by a `-` bullet list

**Consequences:**

- bullets; the last is often `Origin: <packet path>`
```

Bold-label paragraphs, no nested headings. Variants in use:
`**Decision (clarification, not supersession):**` (`:16`),
`**Boundary restated (binding):**` (`:58`). **`---` separators are
inconsistent** — at `:5` and `:76`, absent between the 2026-08-01 and 2026-07-25
entries. A new top entry goes after the `---` at `:5`.

### Skills / `.claude/`: **zero references**

`rg -i 'cognee|beepintir'` over `.claude/` (agents, hooks, skills,
settings.json, launch.json) and over `~/.claude/skills/`, `~/.agents/skills/`
returns nothing. The only related repo skill is the retired `mcp-graphiti-memory`
(`04-decision-log.md:66`).

### Project-level cognee registration: **none**

`.mcp.json` has no cognee/beepintir entry — user-level only, exactly as
`06-agent-memory-operations.md:10-11` describes: `~/.claude.json` `.mcpServers`
has exactly one key, `beepintir` → `http://127.0.0.1:8001/mcp`, and
`~/.codex/config.toml:1704-1705` `[mcp_servers.beepintir]` →
`http://localhost:8001/mcp`. Per SPEC, delete neither.

## 2. Current `.mcp.json` (mtime 15:42, unmodified)

Seven servers: `shadcn`, `next-devtools`, `serena`, `nlp`, `fallow`,
`chrome-devtools`, `webstorm`. Two verbatim entries showing the house style:

```json
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": [
        "start-mcp-server",
        "--context",
        "claude-code",
        "--language-backend",
        "JetBrains",
        "--project-from-cwd"
      ]
    },
    "fallow": {
      "type": "stdio",
      "command": "./node_modules/.bin/fallow-mcp"
    },
```

Explicit `"type": "stdio"`, `command` + `args`, 2-space indent; one `http`
outlier (`webstorm`, `url` + `headers`). **No entry carries an `env` block** — the
`DO_NOT_TRACK=1` / `CODEGRAPH_NO_UPDATE_CHECK=1` rule needs a new `"env"` key or a
wrapper. Gating at `.claude/settings.json:103-104`:

```json
  "enabledMcpjsonServers": [],
  "disabledMcpjsonServers": ["serena", "sourcegraph", "webstorm"],
```

## 3. Machine-local CLI MCP surfaces

**(a) Codex** — `~/.codex/config.toml` (1792 lines) has `[mcp_servers]` as flat
TOML tables at `:1666-1718`:

```toml
[mcp_servers.beepintir]
url = "http://localhost:8001/mcp"

[mcp_servers.firecrawl]
command = "op"
args = ["run", "--", "npx", "-y", "firecrawl-mcp"]
enabled = false

[mcp_servers.firecrawl.env]
FIRECRAWL_API_KEY = "op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY"
```

Keys in use: `command`, `args`, `url`, `enabled`, `startup_timeout_sec`,
`bearer_token_env_var`, plus a `[mcp_servers.<name>.env]` sub-table — that
sub-table is where the two env vars go. No basic-memory or codegraph entry.
(`:89` `name = "mcp-graphiti-memory"` is a disabled *skills* entry, not a server.)

**(b) Grok** — `grok mcp list` (`~/.local/bin/grok`), full output at 16:54:53:

```
  xai-docs: https://docs.x.ai/api/mcp
  basic-memory: uvx basic-memory mcp --project beep-shared
```

Backed by `~/.grok/config.toml:23-31` (`command = "uvx"`, `args = ["basic-memory",
"mcp", "--project", "beep-shared"]`, `enabled = true`) — this appeared *mid-sweep*,
see Blockers. Add syntax: `grok mcp add <NAME> <COMMAND_OR_URL> [ARGS]...` with
`-t stdio|http|sse` and `-s user|project` (`user` = `~/.grok/config.toml`).
No codegraph entry.

**(c) Cursor — installed.** `which cursor` → `/usr/bin/cursor`;
`~/.config/Cursor/` populated. `~/.cursor/mcp.json` exists (mtime 2026-07-10),
in full:

```json
{
  "mcpServers": {
    "sourcegraph": {
      "type": "http",
      "url": "https://sourcegraph.com/.api/mcp"
    }
  }
}
```

Same shape as the repo `.mcp.json`. No cognee/basic-memory/codegraph.

**Toolchain:** `codegraph` = `~/.nvm/versions/node/v26.3.0/bin/codegraph` v1.5.0;
`uvx` = `~/.local/bin/uvx`; **`basic-memory` is NOT on PATH** — it runs only via
`uvx basic-memory …`, matching the grok entry and the SPEC's `doctor` check.

## 4. codegraph installer surface (nothing installed)

`codegraph --help` has an `install` subcommand and **no `mcp` subcommand**:
*"Install codegraph MCP server into one or more agents (Claude Code, Cursor,
Codex CLI, opencode, Hermes Agent)"*, plus `uninstall`.

`install --help` options: `-t/--target <ids>` (comma-separated or
`auto|all|none`), `-l/--location <global|local>`, `-y/--yes` (non-interactive →
`--location=global --target=auto`), `--no-permissions` (skip the auto-allow
permissions list, Claude Code only), `--refresh`, and `--print-config <id>` —
*"Print MCP config snippet for the named agent and exit (no file writes)"*.

Valid ids, from the error on a bogus id: `claude, cursor, codex, opencode,
hermes, gemini, antigravity, kiro`. Only the documented no-write
`--print-config` was run; no install/init/index.

| Target | Would write | Snippet |
| --- | --- | --- |
| `claude` (global) | `~/.claude.json` | `"codegraph": {"type":"stdio","command":"codegraph","args":["serve","--mcp"]}` |
| `claude -l local` | `<cwd>/.mcp.json` | same |
| `codex` | `~/.codex/config.toml` | `[mcp_servers.codegraph]`, `command = "codegraph"`, `args = ["serve", "--mcp"]` |
| `cursor` | `~/.cursor/mcp.json` | same as claude, plus `"--path", "${workspaceFolder}"` |

Server command is `codegraph serve --mcp`. **No target emits an `env` block**, and
there is **no `grok` target**.

## 5. `standards/memory-architecture/README.md` layout

`# Memory Architecture Standard` → `> **Status amendment (2026-06-17) — read
first.**` blockquote (`:3-14`) → `## Core Thesis` → `## The Three Imperatives` →
`## Document Index` → `## Relationship to Other Standards` → `## Anti-Goals`.

The index (`:44-55`) is a two-column table of backticked bare filenames, no links:

```markdown
## Document Index

| Document | Purpose |
|---|---|
| `00-no-escape-theorem.md` | Mathematical constraints that govern all memory architecture decisions |
…
| `06-agent-memory-operations.md` | Operational runbook implementing 04's dev-memory decision: provisioning envelope, recall routing, session continuity |
```

A `07-shared-memory-adoption.md` row appends there. The 2026-06-17 blockquote is
the precedent for a "read first" supersession banner.

## 6. `.gitignore` / `.codegraph/`

At 16:47 `rg 'codegraph' .gitignore` exited 1; at 16:55 it matches. `git diff`
shows an **uncommitted** append after `/codex-task-*.txt`:

```
+# codegraph local index (shared-memory-code-kg-wiring)
+.codegraph/
```

No `.codegraph/` directory exists at the repo root. `git status --porcelain`:
` M .gitignore`, ` M goals/INDEX.md`, `?? goals/shared-memory-code-kg-wiring/`.
Branch is **`main`** — PR-only per SPEC, so branch before committing.

## Blockers / surprises

1. **P1 is already in flight, concurrent with this P0 sweep.** Three surfaces
   changed between my own reads: `.gitignore` gained `.codegraph/` (16:47 absent
   → 16:55 present); `~/.grok/config.toml` gained `[mcp_servers.basic-memory]`
   (mtime 16:53:57; absent from `grok mcp list` at ~16:53, present at 16:54:53);
   and `~/YeeBois/memory/beep-shared/` was created 16:52–16:53 with `.git/`, all
   four SPEC folders (`code-facts/ decisions/ episodes/ profiles/`) and a
   2065-byte conventions `README.md`. **This inventory is a snapshot of a moving
   target** — P1 must re-verify before writing; acceptance criterion 1 and the
   Grok half of criterion 3 already appear satisfied.
2. **`codegraph install --target claude` writes `~/.claude.json`, not the repo
   `.mcp.json`.** Only `-l local` targets `.mcp.json`, resolved against the
   **CWD** — my probe printed
   `/home/elpresidank/YeeBois/research/codebase_graph_and_memory/.mcp.json`
   because that was the shell's cwd. Hand-write the two entries instead.
3. **The installer cannot satisfy the keyless/no-telemetry rule.** No target
   emits `env`, so `DO_NOT_TRACK=1` and `CODEGRAPH_NO_UPDATE_CHECK=1` must be
   added by hand in all four configs (`codegraph telemetry off` exists as a
   separate persistent switch).
4. **Cursor is fully installed** (`/usr/bin/cursor`) with an existing
   `~/.cursor/mcp.json` holding one `sourcegraph` entry — wiring is a two-key
   merge into an existing file, not a file creation.
5. **Cognee's repo footprint exceeds the SPEC's one-section edit.** Beyond
   `AGENTS.md:94-100`, the law also lives at `AGENTS.md:118-120`, throughout
   `06-agent-memory-operations.md` (its entire recall-routing section is
   cognee/graphiti), and at `05-…:189`. A new `07-` doc plus a `04-` entry will
   leave `06-` reading as a direct contradiction unless `06-` is amended too.
6. **The three most recent `04-` entries all restate the cognee role**
   (2026-08-01, 2026-07-25, 2026-07-08), and 2026-08-01 makes the
   operator/product boundary **binding**. Write the new entry as a *role
   retirement*, not a supersession of that boundary: basic-memory inherits the
   operator-memory role; product authority stays product-only.
7. **New `.mcp.json` servers will not auto-start.** `.claude/settings.json:103`
   has `enabledMcpjsonServers: []`, so "both start clean in a fresh Claude Code
   session" needs a first-run approval or the two names added there.
8. **`basic-memory` is not an installed binary** — reachable only through `uvx`,
   so every launcher must use `uvx basic-memory …` and first run fetches from the
   network into the uv cache.
