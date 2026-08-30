# Sources

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

Provenance ledger for `shared-memory-code-kg-wiring`. This packet graduates
from an **external research collection**, not an in-repo exploration.

## Primary evidence (external, read-only)

| Source | What it carries | Freshness |
| --- | --- | --- |
| `~/YeeBois/research/codebase_graph_and_memory/BAKEOFF.md` | Verdict memo: adopt codegraph + basic-memory, retire cognee-as-shared-memory, no graphiti return, Effect-native port path, wiring plan, risk table | 2026-08-06 |
| `.../\_research/bakeoff/TRIAL-RESULTS.md` | Live trials vs beep-effect @ a1550127dc: codegraph 73k nodes/232k edges in 5.3s, 5/5 ground-truth queries, 0.95s incremental; basic-memory claude↔grok verbatim recall, 10/10 concurrent writers, doctor clean | 2026-08-06 |
| `.../\_research/bakeoff/dossiers/*.md` (12) | Adversarial code-level dossiers with file:line evidence (incl. cognee: agent-scoped MCP fragments, process-local locks, persistent-ID telemetry) | 2026-08-06 |
| `.../\_research/bakeoff/community-sentiment.md` | X/web practitioner sentiment + trust ranking; star-authenticity verdicts | 2026-08-06 |
| `.../\_research/bakeoff/RUBRIC.md` | Weighted scoring rubric (multi-agent shared RW 20, keyless 15, beep-effect fit 15, ...) | 2026-08-06 |
| `.../INDEX.md` | 120 verified candidates, 104 cloned repos, full bonus-criteria schema | 2026-08-06 |
| Verdict artifact | https://claude.ai/code/artifact/02d62b1f-4cae-4acf-b3d0-daf218b1fed0 | 2026-08-06 |

## Upstream projects and licenses

| Project | Role here | License | Note |
| --- | --- | --- | --- |
| `basicmachines-co/basic-memory` (0.22.1 trialed) | Shared memory store over MCP | AGPL-3.0 | Internal tooling only; do not distribute or embed customer-facing |
| `colbymchenry/codegraph` (1.5.0 trialed) | Deterministic code-KG (tree-sitter → SQLite/FTS5) | MIT | Run with `DO_NOT_TRACK=1`, `CODEGRAPH_NO_UPDATE_CHECK=1`; engines pin `<25` ran clean on node 26 |
| `topoteretes/cognee` | Retired from durable dev-memory role | Apache-2.0 | Remains available for document-KG experiments |

## In-repo bricks

- `standards/memory-architecture/00..06` — the existing memory doctrine this
  packet amends (esp. `04-decision-log.md`).
- `.mcp.json` — existing MCP surface (`serena` et al.) the new servers join.
- `AGENTS.md` §Agent Memory — the law line this packet rewrites.

## Machine-local wiring commands (documented, not repo-tracked)

Preferred: the idempotent repository bootstrap (store + project + codegraph
index + doctor probe):

```sh
bash scripts/setup-agent-memory.sh
```

Manual equivalents (basic-memory pinned to the reviewed release `0.22.1`):

```sh
# store + project registration
uvx basic-memory@0.22.1 project add beep-shared ~/YeeBois/memory/beep-shared
git -C ~/YeeBois/memory/beep-shared init
# per-checkout code KG
DO_NOT_TRACK=1 CODEGRAPH_NO_UPDATE_CHECK=1 codegraph init
DO_NOT_TRACK=1 CODEGRAPH_NO_UPDATE_CHECK=1 codegraph telemetry off
# grok
grok mcp add basic-memory -- uvx basic-memory@0.22.1 mcp --project beep-shared
# codex: add matching [mcp_servers.basic-memory] to ~/.codex/config.toml
#        (use args ["basic-memory@0.22.1", "mcp", "--project", "beep-shared"])
# cursor: add the same two servers in Cursor MCP settings
```
