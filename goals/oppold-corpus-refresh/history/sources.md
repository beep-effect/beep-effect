# Source Inventory

## Authority order for this packet

1. The 2026-07-03 grilling-session decisions
   ([`history/decision-log.md`](./decision-log.md)).
2. [`SPEC.md`](../SPEC.md), including the explicit supersessions of the retained
   packet.
3. `goals/oppold-corpus-pipeline/` for tone, redaction posture, manifest shape,
   and existing provenance contracts where not superseded.
4. Repo-level `AGENTS.md`, `CLAUDE.md`, and architecture standards.

## Data sources (outside the repo)

The four in-scope data sources are intentionally redacted in repo files:

| Label | Generic description | Repo policy |
| --- | --- | --- |
| `source-a` | New email-export directory | No concrete path, filename, count, size, or content in repo |
| `source-b` | Second new email-export directory | No concrete path, filename, count, size, or content in repo |
| `source-c` | Standalone PST file | No concrete path, filename, count, size, or content in repo |
| `source-d` | June-era recovery directory | No concrete path, filename, count, size, or content in repo |

The concrete mapping from labels to local data-home paths belongs outside the
repo at `<CORPUS_ROOT>/ops/refresh-source-map.json`.

## Repo sources

- `goals/oppold-corpus-pipeline/SPEC.md` - retained contract being extended and
  explicitly superseded for append-only run raw and archive-move behavior.
- `goals/oppold-corpus-pipeline/PLAN.md` - phase style and verification tone.
- `goals/oppold-corpus-pipeline/ops/manifest.json` - manifest schema to mirror.
- Existing corpus provenance contracts referenced by the retained packet,
  especially `CorpusProvenanceRecord` shapes.
- `packages/tooling/tool/cli` - target home for the `beep corpus` salvage and
  archive-move command extensions.

## External references

No external references are required for packet creation. Future execution should
use only local tooling and the outside-repo source map; no document content is
sent to external services.
