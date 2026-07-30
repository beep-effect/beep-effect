# Practice KG MCP

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship the first queryable IP-law knowledge graph over the Oppold practice corpus
to Tom's Claude Desktop within one week: a read-only, local-first stdio MCP
server (bun-compiled, .mcpb-packaged) over a portable data bundle — a
deterministic docket-family spine, span-grounded OA candidate claims, email
correspondence edges, and corpus full-text search, every row carrying
provenance. This packet takes live ownership of the knowledge-graph scope
orphaned when `goals/ip-law-knowledge-graph` was deleted (2026-07-14, PR #401).

The MCP surface is the product thesis, not a shim: Claude Desktop is client #1;
Word, Outlook, cron jobs, and background agents are the same consumer.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-kg-mcp/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (decisions D-1–D-8).
3. [`PLAN.md`](./PLAN.md) - phased execution plan (P0 packet+spike → P5 handoff).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Dependency Packets

| Packet | Relationship |
| --- | --- |
| [`oppold-corpus-pipeline`](../oppold-corpus-pipeline/README.md) / [`oppold-corpus-refresh`](../oppold-corpus-refresh/README.md) | Completed corpus substrate (catalog/organize/enrich) this packet projects from. |
| [`mcp-kit`](../mcp-kit/README.md) / [`mcp-host-retrofit`](../mcp-host-retrofit/README.md) / [`uspto-mcp`](../uspto-mcp/README.md) | Completed MCP substrate; uspto-mcp is the host template and ships alongside. |
| [`epistemic-bitemporal-edge-core`](../epistemic-bitemporal-edge-core/README.md) | Completed authority substrate for candidate-claim persistence. |
| [`langextract-capability`](../langextract-capability/README.md) + law-practice OA packets | Span-grounded extraction precedent generalized in P3. |
| [`legal-document-intake`](../legal-document-intake/README.md) | Umbrella program; P4-proper resumes after handoff with Tom's captured questions as requirements. |
| [`agent-execution-authority`](../agent-execution-authority/README.md) | In flight; the D-4 read-only posture keeps this packet outside its scope. |

## Current Phase

P5 Acceptance evidence: the AC-4/AC-5 gauntlet ran 2026-07-30 on the Windows
target — five provisional passes carrying a failed G-3 label item and two
partial deliverables (correctness axis pending Tom), AC-5 zero egress met as
specified on sampled observation, and **AC-2 not met** (graph nodes carry no
provenance). P4 Distribution is complete. Next: P6 graph-integrity repair (two
verified blocker mechanisms in family attribution) gates the AC-6 install; P7
server hardening follows the defect register's B-items.

## Latest Evidence

- 2026-07-30: **AC-4/AC-5 gauntlet run** — G-1..G-5 provisional PASS on the
  document layer and epistemic conduct, with G-3's required label failing as
  delivered; AC-5 sampled pass (2,326 samples / 85.7 min / zero rows);
  document-level provenance 15/15, 11/11, 8/8; graph layer NOT trustworthy in
  the shipped build (cross-client family contamination + mention-derived
  cartesian joins, both verified locally same-day). Evidence:
  [`history/p5/`](./history/p5/) (gauntlet record, defect register A/B/C,
  code-session final report). Raw transcripts/logs out-of-repo.
- 2026-07-27: **R1 packaging spike — GO.** Locked .mcpb layout: single
  `practice-kg-mcp.exe` (PGlite WASM assets embedded via `type: "file"`
  imports + `--asset-naming`) + DuckDB native sidecars
  (`node_modules/@duckdb/node-bindings-win32-x64/{duckdb.node,duckdb.dll}`)
  beside the exe. Windows x64 binary built and both DB probes pass under wine
  (`PGLITE_OK`, `DUCKDB_OK`); compiled effect MCP stdio proven via the
  uspto-mcp binary (initialize + tools/list). Evidence:
  [`history/p0/`](./history/p0/). Quick win ready: `uspto-mcp.exe` compiled +
  smoke-tested for Tom's machine.
- 2026-07-27: Packet authored; decisions D-1–D-8 locked (delivery shape, data
  families, Windows topology, read-only posture, governance, storage, Phase-2
  product split, .mcpb packaging). .mcpb capabilities verified against the spec
  (binary server type; `user_config` directory prompt; skills remain
  manual-upload-only).

## Notes

- Corpus content and PII never enter the repo; the data bundle is built on the
  workstation and shipped out-of-band.
- Phase 2 (separate packet, post-handoff): generic IP-practice starter stack
  for firms — revives `explorations/stack-installer`; license pass required on
  the curated skills goldmines before redistribution.
