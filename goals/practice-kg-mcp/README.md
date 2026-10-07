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

P8 Handoff + close. P6, P7, P9, P10 and P11 are complete (2026-10-06 to
2026-10-07): the graph is keyed by client, every row resolves to provenance
(AC-2, proved by `verify.ts`), the server needs no network (AC-5, proved under
enforced isolation), and the bundle exposes a stable matter-lookup contract and
a correspondent lookup for the docket-intake, email, and Box services
(`research/matter-lookup-contract.md`). The attorney's working files, saved
emails and docket register are in the bundle (`2026-10-06-03` on his PC with
extension 0.3.1; `2026-10-07-01` with extension 0.4.0 adds anchor dominance
(D-23) and matter correspondents (D-24)). Installs are verified without a
person by `practice-kg-mcp --self-check`. P11 (2026-10-07) added the mail
archives: bundle `2026-10-07-03` (`-02` rebuilt with one count per message,
D-27) places archive messages on matters by the
docket reference in their subject lines (D-26), so correspondents cover 169
of 187 matters instead of 23; it was diffed against `2026-10-07-01` with
`verify.ts --compare-to` (D-25) and lost nothing. Extension 0.4.0 reads it
unchanged; the PC moves from `2026-10-07-01` to it in the next quiet window.
What remains needs people: one session with him, scripted in
`research/attorney-session.md` (in-chat `kg_provenance`, G-1..G-5 verdicts,
his own questions for AC-6).

## Latest Evidence

- 2026-10-07: **P11 review fixes** — bundle `2026-10-07-03`: a filed email
  and its archive copy count once, and an archive item without a
  `Message-ID` is one message across export trees (D-27); same 4,524
  matter-address pairs over 169 matters, 434 rows with a lower, correct
  count; `verify.ts --compare-to`: nothing lost against `-02` or `-01`.
- 2026-10-07: **P11 landed** — bundle `2026-10-07-02`: lane E's message
  index read with `--mail-index`, 16,427 of 238,158 distinct archive messages
  placed on a matter by subject reference; correspondents 605 rows over 23
  matters -> 4,524 over 169; `verify.ts --compare-to` against `-04`: ok,
  nothing lost, one docket added from OCR text (`history/p11/`).
- 2026-10-07: **P11 prep landed** — `verify.ts --compare-to <old bundle>`
  diffs the matter tables of a rebuilt bundle against the one it replaces and
  fails on any lost matter, docket, or number (D-25); proved on `2026-10-07-01`
  against `2026-10-06-03`: 0 matters or dockets added or removed, 23 dockets
  gained numbers, none lost, exit 0. The quoted bare address (#1521) is fixed.
- 2026-10-06: **P7 landed** — `kg_matter_lookup` and the
  `PracticeKgMatterLookup` service over new `matters` / `matter_dockets`
  tables; claims carried into the rebuilt bundle with no model run; bundle
  `2026-10-06-01` verified (8,240 of 8,240 nodes resolve, 0 unresolved
  references, 16 claims); typed tool failures, withheld-column and match-offset
  signalling; nine spot calls byte-identical with and without network.
  Evidence: [`history/p7/`](./history/p7/).
- 2026-10-05: **P6 graph-integrity repair landed** — families keyed
  `<client>.<family>` from the documents' own reference form, anchors placed
  by unique mention with `mentioned_in_family` edges for the rest,
  `attribution_source` on every node, `$R` stubs labelled
  `recycled-unverified`, claim rows joinable by `sourceDocumentDigest`, build
  metadata split into `builtAt`/`corpusSnapshotAt`. Rebuilt bundle
  `2026-10-05-01` (graph store format 2): 8,240 nodes / 1,756 edges, 143 client-keyed families + 27
  bare remainders, 0 cartesian memberships. Evidence:
  [`history/p6/`](./history/p6/).
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
