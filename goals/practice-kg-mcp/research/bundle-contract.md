# Bundle Contract — practice-kg-mcp (PR-2/PR-3 joint design)

Status: contract · Date: 2026-07-27 · Scope: binds P1 (`beep corpus graph`) and
P2 (MCP host). Verified against the live corpus home (`<corpus-root>` =
the out-of-repo corpus home) and repo source on 2026-07-27.

## 1. Inputs inventory (verified shapes)

All build inputs already exist; the build lane is projection-only.

| Input | Location (under corpus root) | Verified shape |
| --- | --- | --- |
| Catalog DB | `catalog/corpus.duckdb` | 5 tables (read-only verified via `@duckdb/node-api` under `bun run`): `corpus_source_files` (16,774 rows; `run_label, copy_mode, source_label, origin_path, relative_path, dest_path, dedupe_of_path, referenced_raw_path, size_bytes, mtime_epoch, mtime_iso, sha256, salvaged_at, digest, artifact_id`), `corpus_organized` (7,330; `digest, source_label, source_relative_path, category, client, docket, docket_family, version_index, organized_relative_path, effective_name, restored, materialized`), `corpus_enrichment` (150; `candidate, candidate_kind, status, application_number, patent_number, invention_title, first_applicant_name, first_inventor_name, occurrence_count, docket_families, parent_application_numbers`), `corpus_duplicate_sets` (7,284), `corpus_restorations` (568) |
| Reports | `catalog/reports/{catalog,organize,enrich}-summary.json` | `organize-summary`: 105 docketFamilies / 643 docketFiles / 81 clientFiles / 28 emailArchives / 3,271 emailExportFiles / 3,055 unsortedFiles / 7,330 canonicalArtifacts. `enrich-summary`: 99 familyAnchors resolved, 0 failed (150 candidates: 99 resolved, 51 notFound). `catalog-summary`: 16,774 sourceFiles, **7,342 distinctDigests total** (base run 7,330 + 12 new from `2026-07-refresh`) |
| Extract join | `staging/extract/sources.jsonl` | `{artifactId, digest, engine (libpff\|tika), format, operationId, relativePath, sizeBytes, status}` — the digest ↔ operation join |
| Extracted text | `staging/extract/text/operation:<opId>.txt` | 6,702 text artifacts; join to documents via `sources.jsonl` |
| Tika metadata | `staging/extract/metadata/operation:<opId>.json` | Tika key/value (content-type, encoding, etc.) |
| PST children | `staging/extract/children/artifact:<digest>{,.export/}` | ~27 PSTs. **pffexport trees**, one dir per message: `Message.txt`, `OutlookHeaders.txt` (parseable `Key:\tValue` — Subject, Sender name/email, Client submit time, Conversation topic), `Recipients.txt`, `ConversationIndex.txt`; `artifacts.jsonl` per PST lists all child paths (663,272 total per `extract-summary.json`) |
| Organized tree | `organized/{clients,dockets,email-archives,_unsorted}` | `dockets/<family>/<docket>` (e.g. `10000/10000AU01`); `clients/` has **exactly one entry** (`precision-planting`); archives named `<source-label>--<name>.pst` |
| Demo inputs | `staging/oppold-demo-inputs/*.txt` (~40 files) | Real OA responses/assignments/apps, docket numbers in filenames |
| Demo USPTO | `staging/demo-uspto/{10008,10011,10013,10108,fulltext}` | Official PDFs + `US<patent>-fulltext.txt` — feeds side-by-side pulls |

**Drift flags:** (a) grounding's "7,330 digests" is the base run; total is 7,342.
(b) **No `*.messages.jsonl` anywhere** — the libpff JSONL format postdates this
extract; email rows must be parsed from `OutlookHeaders.txt`/`Recipients.txt`.
(c) `staging/extract-2026-07-refresh/` **exists with the full output structure**
despite the refresh packet recording extraction as deferred — P1 must diff its
`sources.jsonl` and either fold it in or exclude it explicitly in
`bundle.manifest.json`; do not silently ignore it.

## 2. PGlite side — KG schema

**Decision: one PGlite data dir containing (a) the existing epistemic tables
unchanged and (b) two packet-owned projection tables.** Candidate claims live in
the real `@beep/epistemic-tables` schema (`CandidateClaim`, `Evidence`,
`ClaimDisposition`, `EdgeVersion`, `UsageRecord` — all `EntityTable.pgTableFrom`
from domain entities); the P3 batch writes through the existing ClaimGate path,
so claims are never a second truth. `kg_node`/`kg_edge` are disposable
projections per the authority/projection doctrine. Alternative (packet-owned
claim copies) rejected: parallel truth, converter drift, doctrine violation.

```
kg_node(
  iri            text PRIMARY KEY,     -- deterministic, see IRI scheme
  kind           text NOT NULL,        -- LiteralKit: client | docket_family | docket
                                       --   | application | patent | document | email_archive
  natural_key    text NOT NULL,        -- e.g. "12345.10008", "12345.10008JP02", "12970708", "sha256:…"
  label          text NOT NULL,        -- display name (effective_name, invention_title, …)
  docket_family  text,                 -- bare family number: the organizer's spine hook
  client         text,                 -- client number from the <client>.<docket> reference form
  attribution_source text NOT NULL,    -- D-11, D-21: 'filename' | 'restored-name' | 'docket-register'
                                       --   | 'folder-path' | 'text-reference' | 'family-consensus'
                                       --   | 'client-map' | 'official-record' | 'mention'
  epistemic_status text NOT NULL,      -- 'derived-from-official-records' (spine)
                                       --   | 'candidate-unreviewed' (never for spine rows)
                                       --   | 'mention-derived' (anchor mention edges)
                                       --   | 'recycled-unverified' (recycle-bin $R stubs)
  provenance_kind  text NOT NULL,      -- 'catalog-digest' | 'uspto-anchor' | 'organize-row' | 'extract-operation'
  provenance_ref   text NOT NULL,      -- digest / application_number / path / operationId
  payload        jsonb NOT NULL        -- kind-specific extras (title, inventor, mtime, sizes)
)
kg_edge(
  subject_iri    text NOT NULL REFERENCES kg_node(iri),
  predicate      text NOT NULL,        -- closed LiteralKit set below
  object_iri     text NOT NULL REFERENCES kg_node(iri),
  epistemic_status text NOT NULL,
  provenance_kind  text NOT NULL,
  provenance_ref   text NOT NULL,
  PRIMARY KEY (subject_iri, predicate, object_iri)
)
kg_build(                              -- single-row build metadata; NEVER joined into results
  bundle_version text, built_from_runs text, counts jsonb,
  built_at text,                       -- wall-clock build instant
  corpus_snapshot_at text              -- newest catalogued source mtime
)
```

Predicates (closed set): `has_docket_family` (client→family), `has_docket`
(family→docket), `files_as` (docket→application), `granted_as`
(application→patent), `has_document` (docket→document; from
`corpus_organized.docket`), `family_document` (family→document, family-level
files), `archived_in` (document→email_archive), `continuation_of`
(application→application, from `parent_application_numbers`),
`mentioned_in_family` (application|patent→family, `mention-derived`: the family's
docket documents mention the number; never membership).

Membership of an anchor (`files_as`) exists only when the anchor's number is
mentioned by exactly one family's docket documents — file names and text
counted together — and that family is client-keyed (D-11c). `corpus_enrichment.docket_families` is read into the
DuckDB `enrichment` table for reference but never creates families or edges.

Node counts (2026-10-05-01 rebuild): 30 clients · 170 families (143
client-keyed + 27 bare remainders over 105 bare family numbers) · 438 dockets
· 181 applications · 63 patents · 7,330 documents · 28 archives.

**IRI scheme** — `@beep/identity` `make(...)` composers mint
`https://ns.beep.sh/...` IRIs (`.create(path).iri` / `.curie`, verified in
`packages/foundation/modeling/identity/src/Id.ts`; `rebase({iri, prefix})`
exists if a practice authority is wanted later). Scheme:
`https://ns.beep.sh/practice-kg/<kind>/<natural_key>` with natural keys:
client number (`12345`) · client-keyed family (`12345.10008`; bare `10008` only
for the unattributed remainder) · client-keyed docket code (`12345.10008JP02`) ·
8-digit application number · patent number · `sha256:<digest>` for
documents/archives. `kg_docket_family` accepts either form: a bare family
returns every keyed family sharing it.
All keys are natural ⇒ IRIs are rerun-stable with no sequence state.

**Matter tables (D-12).** The build also writes `matters` (one row per
`docket_family` node) and `matter_dockets` (one row per `docket` node, with the
application and patent numbers filed from it) into `practice.duckdb`. They are
the read surface for services; shapes and rules are in
`matter-lookup-contract.md`. `schemaVersion.duckdb` is `3`: `matters` carries
`client_name` from the docket register (D-21).

**Email messages are NOT PGlite rows.** 663k rows belong in DuckDB (§3);
PGlite keeps the spine small and fast. Archive-level linkage (D-2 caveat) is
expressed by `archived_in` edges plus DuckDB `email_messages.archive_digest`.

## 3. DuckDB side — shipped `practice.duckdb`

Contents (all built by `beep corpus graph`, all deterministic):

| Table | Source | Notes |
| --- | --- | --- |
| `documents` | `corpus_organized` ⋈ `corpus_source_files`, plus the unorganized files of each included run (deduped by digest) | one row per canonical artifact; carries `organized_relative_path`, family, docket, client, size, mtime. An included run's row is `unsorted` unless its folder path names exactly one docket, in which case it is a `docket` row under that docket |
| `document_text` | `staging/extract/text/*` ⋈ `sources.jsonl` | **full text inlined** for the 6,702 text artifacts (bounded: text artifacts are a small fraction of the 28 GB staging tree, which is dominated by PST export trees; enforce `--max-text-bytes`, default 2 MB/doc, overflow → excerpt + pointer) |
| `email_messages` | parsed `OutlookHeaders.txt` + `Recipients.txt` per message dir | `archive_digest, folder_path, message_ord, subject, conversation_topic, sender_name, sender_email, recipients, submit_iso, delivery_iso, message_rel_path` — **headers only, no bodies**; bodies resolve via corpus-root pointer to `Message.txt` (Tom's SSD copy has the full tree) |
| `enrichment` | `corpus_enrichment` with `docket_families` / `parent_application_numbers` **parsed from serialized strings to lists** | |
| `fts_postings`, `fts_terms`, `fts_docstats` | build-time tokenization of `document_text` + `email_messages.subject` | see FTS decision |

**FTS decision: precomputed inverted-index tables + BM25 scored in plain SQL.**
Zero runtime extensions ⇒ fully offline on Tom's machine, no
extension-under-bun-compile risk, deterministic build. Tokenizer: lowercase,
strip punctuation, keep docket/application/patent tokens verbatim (they are the
highest-value queries). Alternatives, one line each: DuckDB `fts` extension —
blocked on unverified offline INSTALL/LOAD under a bun-compiled binary (add to
R1 spike checklist; adopt post-week-1 if proven); wink-BM25 sidecar — in-memory
rebuild on every server start over 6,702 docs is wasteful and non-SQL.

Evidence note for the spike: `@duckdb/node-api` opened `corpus.duckdb`
read-only under plain `bun run` during this design pass — the native addon
works under bun; only `--compile` embedding remains open (resolved GO by the
R1 spike: external addon + on-disk sidecars).

## 4. Bundle layout + user_config contract

```
practice-kg-bundle/
  bundle.manifest.json    # bundleVersion (date-seq), schemaVersion per store,
                          # sourceRuns: base, includedRuns (labels of the folded-in
                          # runs), refresh202607 incl/excl (kept for older readers),
                          # counts (nodes, edges, docs, emails), corpusRootExpected: bool
  kg.pglite/              # PGlite data dir (epistemic tables + kg_node/kg_edge/kg_build)
  practice.duckdb
  README.txt              # one page, non-technical
```

`user_config` (mcpb manifest): `bundle_dir` (type `directory`, required) and
`corpus_root` (type `directory`, optional — enables click-through/body
resolution against the SSD copy; every tool must degrade gracefully to
"pointer only" when absent). Server env: `PRACTICE_KG_BUNDLE_DIR`,
`PRACTICE_KG_CORPUS_ROOT`.

**Refresh story (D-4 read-only):** full replace — ship a new
`practice-kg-bundle/` dir, swap atomically (rename old to `.bak`), no
merge-back ever. `bundle.manifest.json.bundleVersion` is surfaced by a
`kg_provenance` call with no args (server/status info).

## 5. Build entrypoint shape

> Amended 2026-07-27 per SPEC D-9 (architecture-guardian ruling): the build
> lane is NOT a repo-cli verb — repo-cli imports zero slice packages (tooling
> ceiling). The flags below move verbatim to `apps/practice-kg-mcp/src/build.ts`
> (thin flag-parse + layer wiring); the projection logic lives in
> `law-practice/server` `PracticeKg.projections.ts`, which writes the summary
> to `catalog/reports/graph-summary.json`.

```
bun run apps/practice-kg-mcp/src/build.ts
  --corpus-root <dir>          # existing corpusRootFlag
  --bundle-out <dir>           # default <corpus-root>/staging/practice-kg-bundle
  --include-refresh            # same as --include-run 2026-07-refresh (default: false, recorded either way)
  --include-run <label>        # fold one later source run in; repeatable
  --bundle-version <version>   # stamp the bundle, e.g. 2026-10-06-03 (default: the build's own version)
  --docket-register <file>     # the attorney's docket register as JSONL
  --skip-emails                # spine+text only (fast iteration)
  --max-text-bytes <n>         # per-document inline cap, default 2097152
  --overwrite                  # replace an existing bundle dir (mirrors organize --overwrite)
```

**Folding a run in (D-21).** A run is optional when it holds at least one file
the organizer never saw (a digest with no `corpus_organized` row). An optional
run that is not included is left out whole, so its copies of organized files do
not change those files' size, date, or origin chain. An included run adds:

- each of its unorganized files once, as a catalog row;
- its `staging/extract-<label>/` tree (`sources.jsonl` + `text/`), same layout
  as `staging/extract/`, as a text source.

For a file the organizer placed, `run_label` is the run the organizer's copy
came from and stays so when a later included run holds the same file; size and
date follow the same copy. `source_origin_chain` lists every run and path the
file appears in: read that, not `run_label`, to ask which runs hold a file.

Each added row's source path is read with `extractPracticeKgPathEvidence`.
Exactly one docket in the path becomes the row's docket and family, and the row
is filed as a `docket` document so the reference scans read its text. Exactly
one `<client>.<family>` key for that family becomes the row's folder client. A
path that names more than one is left alone.

**Docket register.** One JSON object per line:
`{"client": "12345", "docket": "10008US01", "clientName": "Example Client"}`;
`clientName` may be null. A line that does not decode stops the build and the
error names the line number, never its content. The register is client
material: convert it and keep it outside the repo.

Determinism rules (binding): every INSERT batch ordered by full natural key;
no wall-clock values in any row (build time lives only in `kg_build` /
manifest); IRIs from natural keys only; email parse order =
`(archive_digest, folder_path, message_ord)` derived from pffexport dir names.

## 6. Tool → query mapping (P2 host)

All tools read-only (`readOnlyHint: true` — pattern verified in uspto-mcp),
mcp-kit `defineFieldTiers` + columnar envelopes under byte budget (default
8000B like uspto-mcp), sanitized spans, SourceAuth gate `none`. Every response
envelope carries `epistemic_status` and `bundle_version`.

| Tool | Params | Store/query | Output + label |
| --- | --- | --- | --- |
| `kg_clients` | — | PGlite: clients + family counts via `has_docket_family`; plus "unattributed families" count; a client's `label` is its docket-register name when the register gives one, otherwise the number | spine label. Description states client attribution is sparse (1 client today) and families are the primary spine |
| `kg_docket_family` | `family` (e.g. "10008") | PGlite: family node + `has_docket` dockets + `files_as`/`granted_as` chain + top-N `has_document` (FieldTier: minimal = counts, complete = doc list) | spine label |
| `kg_application_lookup` | `application_number \| patent_number \| docket` | PGlite: resolve node, walk `files_as`/`granted_as`/`continuation_of`/`enriched_family` | spine label |
| `kg_find` | `query` (name/number fragment) | PGlite: ILIKE over `kg_node.label, natural_key`; note: 3,055 unsorted docs findable only via `corpus_search_text` | spine label |
| `corpus_search_text` | `query`, `limit`, `family?` | DuckDB: BM25 over `fts_*`, join `documents` for family/docket/paths; returns matched snippet + digest + organized path | spine label; snippets cite digest |
| `corpus_get_document` | `digest \| organized_path`, `range?` | DuckDB `document_text`; fallback pointer into `corpus_root` when over budget/absent | spine label; enables side-by-side (two calls) |
| `email_search` | `query?, sender?, after?, before?, family?` | DuckDB `email_messages` (subject/sender/recipients filters); family filter via archive→family heuristic **explicitly marked archive-level confidence** | spine label + linkage-confidence note |
| `kg_candidate_claims` | `docket \| family \| digest` | PGlite epistemic tables via existing converters; join `Evidence` spans | **`candidate — unreviewed`** on every row + evidence span |
| `kg_matter_lookup` | `reference` (docket, family, application, patent, or client number) | DuckDB `matters` + `matter_dockets`; `resolution` unique / ambiguous / none; `clientName` from the docket register | spine label |
| `kg_provenance` | `iri \| digest \| natural_key` (none ⇒ bundle status) | PGlite node → provenance columns; digest → DuckDB `documents` row + source_files origin chain | spine label |

## 7. Determinism & tests (AC-1, AC-2)

- **Unit lane (in-repo, synthetic):** tiny fixture corpus (fake
  `corpus.duckdb` built in-test + jsonl manifests + 3 fake message dirs, no
  real data) → run graph build twice into temp dirs → dump all tables
  `ORDER BY` full row → byte-identical; IRI snapshot test; provenance-complete
  check: `kg_node LEFT JOIN` provenance resolution has zero nulls (AC-2).
- **Integration lane (env-gated `BEEP_TEST_OPPOLD_CORPUS=1`, workstation
  only):** counts reconcile — 105 families, 643 docket files, 99 anchors,
  16,774 source rows, 7,330 base digests (+12 refresh when
  `--include-refresh`); rerun-idempotence on the real corpus.
- **Host lane (P2):** each tool against the fixture bundle; budget-overflow
  tier-degradation test (uspto-mcp `UsptoDocumentTiers` bulk-budget pattern is
  the template).

## 8. Open risks (found in the real data)

1. **Client attribution is nearly empty** — `organized/clients/` holds exactly
   one client (81 files). `kg_clients` will be thin; families are the real
   spine. Post-week-1: extend organize's `--client-map` and rebuild.
2. **Email parse is the heaviest build step** — 663k `OutlookHeaders.txt`/
   `Recipients.txt` files across ~27 export trees (small-file IO bound).
   Mitigate: stream per-PST via `artifacts.jsonl`, `--skip-emails` for
   iteration; per-PST resumability unnecessary (full replace).
3. **Refresh extract tree exists** despite recorded deferral — resolve
   in/out explicitly (§1 drift c) or counts won't reconcile.
4. **Serialized list columns** (`docket_families`, `parent_application_numbers`,
   `members`) are strings in DuckDB — parse from the JSONL manifests, not the
   DB copies, when in doubt.
5. **OutlookHeaders variance** — Exchange-DN sender addresses (no SMTP) on
   sent items (verified in sample); store both `sender_name` and raw address;
   don't assume RFC 5322.
6. **`operation:`/`artifact:` prefixes in filenames** — Windows-safe (colon
   only inside bundle-internal DuckDB values, not shipped paths), but never
   copy these paths into bundle filenames.
7. **Header timestamps are pffexport-local formats** ("Nov 24, 2025
   17:40:56.775819500 UTC") — parse with a fixed format list; reject-and-null
   on mismatch rather than guessing.

Out-of-scope note: `staging/oppold-demo-inputs` files carry docket numbers in
filenames — P3's OA batch can join them to the spine by filename regex, no new
mapping table needed.
