# Storage bake-off

**Family:** storage. **Rubric:** v2.0 ratified. **Workload:** W1, 25 papers, Linux x64 primary; later packaging targets remain deferred by the contract [R1][R2]. Scores are decision evidence, not a replacement for the end-to-end compatibility round.

The decision axis is D16/A1: make the append-only provenance ledger authoritative, then rebuild vector, property-graph, and RDF views from it [D1][A1]. The proof-ledger kernel is therefore a consumer of the system of record, not a second write model [A1].

Incumbent checks, from live source:

- `@beep/pglite` is an in-process, file-backed Effect SQL service with typed `PgliteError`; it wraps plain PGlite 0.5.6 and contains no pgvector integration [L1][L5].
- `SparqlQueryService` is a bounded `select|ask|construct` contract whose default layer is unsupported, not a store [L2]. The current Oxigraph adapter builds a fresh in-memory store from request quads on every call [L3].
- The Python reference's PyOxigraph backend can open a persistent native store and flush it; that recovery shape does not transfer to the repo's in-memory JavaScript/WASM package [LS2][OX].
- `effect/Graph` is used as an in-memory algorithm value, not durable storage [L4]. The practice KG really does compose app-owned `kg.pglite` and `practice.duckdb`; its builder warns that partial failure leaves a partial bundle [L6].

## Gate table

`P` = pass, `F` = fail and park, `U` = UNKNOWN pending the named probe. A projection passes gate 8 only when its stable id joins losslessly to the authoritative ledger; it need not duplicate every schema field [R3].

| Candidate / role | G1 envelope | G2 license | G3 sustainable | G4 typed failure | G5 resources | G6 security/offline | G7 deterministic eval | G8 semantic floor |
|---|---|---|---|---|---|---|---|---|
| PGlite core, SoR/provenance | P: Bun in-process [L1] | P: Apache-2.0 [C1] | P: released package 0.5.6 [L5] | P: typed `PgliteError` [L1] | P: primary-target M1/M4/M6 | P: pinned npm; no runtime fetch [L1] | P: exact SQL + explicit tie order; M1 chain replay | P: relational columns retain spans, RDF tags, model id, proofs [R3] |
| PGlite adjacency, property view | P: same Bun process [L1] | P: Apache-2.0 [C1] | P: same released core [L5] | P: typed SQL boundary [L1] | P: no extra engine in M4 | P: same pinned local package [L1] | P: ordered exact SQL rebuild [L6] | P: graph ids join authoritative rows [L6][R3] |
| PGlite + pgvector, vector | P: in-process extension [PGL] | P: PostgreSQL SPDX ratified [C1] | P: pgvector v0.8.6 tests; PGlite bundle exists [PGV][PGL] | P: extension SQL failures surface through typed client [L1] | U: extension W1 RSS/p95/rebuild unmeasured | U: offline install/lockfile probe absent | P: exact mode only; ANN is non-eval [PGV] | P: vector row joins ModelIdentity ledger row [R3] |
| PGlite + AGE, property graph | P: in-process extension [PGL] | P: Apache-2.0 [C1] | U: PGlite extension CI/release probe absent | U: failure mapping not probed | U: W1 p95/RSS/rebuild unmeasured | U: offline install/lockfile probe absent | U: Cypher rebuild/order replay not tested | P: projection ids join full ledger [R3] |
| DuckDB exact arrays, vector | P: native Bun sidecar [L7] | P: MIT [L8] | P: released cross-platform binding [L8] | P: typed `DuckDbError` [L7] | P: M2/M4/M6 | P: pinned native package; no fetch [L7][L8] | P: exact distance + `id` tie-break in M2 | P: table stores stable id + ModelIdentity [R3] |
| DuckDB VSS, vector | P: native extension [DV] | P: MIT [DV] | P: released but experimental [DV] | P: SQL errors; no success fallback [DV] | U: W1 HNSW RSS/p95/rebuild unmeasured | F: M7 found no bundled artifact; `INSTALL` would fetch | U: HNSW rebuild/ties not replay-tested | P: stable id can join ledger [R3] |
| sqlite-vec, vector | P: loadable local extension [SV] | P: Apache-2.0 OR MIT [C1] | P: active tagged pre-v1, pure C [SV] | P: reference raises typed processing errors [LS1] | U: Bun W1 and package footprint unmeasured | U: Bun offline bundle/integrity probe absent | P: exact KNN + id tie-break [SV] | P: id/metadata join retains ModelIdentity [LS1][R3] |
| LanceDB, vector | P: embedded local directory [LDB] | P: Apache-2.0 [LDB] | P: active released TS package [LDB] | U: typed failure/degradation mapping not probed | U: Bun binary bytes, RSS, and W1 p95 unmeasured | U: offline package/integrity probe absent | P: exact fallback for eval; ANN excluded [LDB] | P: rows carry stable id and metadata [LDB][R3] |
| USearch, vector | P: JS/native/WASM library [US] | P: Apache-2.0 [US] | P: active multi-platform source [US] | U: typed failure/degradation mapping not probed | U: local Bun RSS and W1 p95 unmeasured | U: offline binding/integrity probe absent | P: `exact` mode + post-sort id [US] | P: key joins ledger; index alone lacks metadata [US][R3] |
| Kuzu, property graph | P: embedded native/WASM [KZ] | P: MIT [KZ] | F: repository archived 2025-10-10 [KZ] | U: failure mapping not probed | U: W1 resource probe absent | U: offline artifact/integrity probe absent | U: ordered Cypher cold replay not tested | P: properties can carry ledger ids [R3] |
| CozoDB, graph/vector | P: embedded Node/WASM [CZ] | P: MPL-2.0, file-level note required [CZ] | U: pre-1 storage/API compatibility and CI build plan | U: binding failure mapping not probed | U: W1 p95/RSS/binary bytes absent | U: offline binding/integrity probe absent | U: HNSW + Datalog rebuild not replay-tested | P: relations can retain all schema fields [CZ][R3] |
| SurrealDB embedded, graph/SoR | P: embedded JS/WASM modes [SR] | F: core is BSL-1.1, outside matrix [SR] | P: active releasable project [SR] | U: embedded failure mapping not probed | U: W1 embedded probe absent | U: offline embedded artifact probe absent | U: rebuild/order probe absent | P: multi-model records can encode schema [SR][R3] |
| Oxigraph JS/WASM, RDF view | P: in-process JS/WASM [OX] | P: Apache-2.0 OR MIT [C1] | P: released package 0.5.9 [L5] | P: typed adapter errors [L3] | P: M3/M4/M6 | U: package is local, but adapter ignores `timeoutMs` [L2][L3] | P: rebuild + SPARQL `ORDER BY`; M3 | P: live adapter round-trips IRI/bnode/literal datatype/lang/graph [L3] |
| quadstore + Comunica, RDF view | P: Bun/LevelDB library [QS] | P: MIT [QS] | P: active, semver, persistent backend tested [QS] | U: typed failure/timeout mapping not probed | U: W1 p95/RSS/rebuild and package bytes absent | P: local RDF/JS source; remote actors excluded [QS][COM] | P: rebuild then SPARQL `ORDER BY` | P: RDF/JS terms and named graphs [QS] |
| RDF/JS + Comunica, RDF view | P: in-memory Bun engine [COM] | P: MIT [COM] | P: maintained by Comunica Association [COM] | U: typed failure/timeout mapping not probed | U: W1 p95/RSS and bundle bytes absent | P: RDF/JS engine only; URL sources disabled [COM] | P: ordered query over canonical dataset | P: RDF/JS bindings retain term types [COM] |
| Plain JSONL + rebuild, SoR | P: Bun filesystem only | P: internal code | P: self-owned and trivially vendorable | U: torn-tail/typed recovery implementation absent | P: M5 resource proxy | P: no network; app-owned file | P: M5 hash chain/order, canonical schema encoder still owed [A1] | P: schema JSON retains every distinction [R3] |
| PostgreSQL + pgvector, parked SOTA | F: operator-managed server [R1] | P: PostgreSQL License [PG]; pgvector SPDX ratified [C1] | P: current core + v0.8.6 tests [PG][PGV] | U: typed application failure mapping not probed | U: W1 server RSS/cold/p95 absent | U: deployment artifact/integrity plan absent | P: exact mode + stable id order [PGV] | P: relational rows retain full schema [R3] |

## Scores

Scores use task quality 40 / operational fit 25 / integration+migration 20 / sustainability 15 [R1]. `*` means at least one hard gate is still UNKNOWN; it cannot enter the compatibility bundle until resolved. Totals are interval sums. No unmeasured property is assigned a point estimate.

Synthetic storage-scale proxies on DankStation Linux x64, Bun 1.4.0, warm package cache. They allocate across 25 paper ids but do not use the real W1 corpus:

- **M1 PGlite ledger proxy:** file API on `/tmp` tmpfs; 2,600 hash-linked events. Engine init 3.730 s, 100 single writes p95 0.79 ms, 200 indexed reads p95 2.31 ms, reopen+count 116 ms, 0 broken links, 1,004 MB RSS, 40 MB data directory. Reopen was tested; power-loss recovery is UNKNOWN.
- **M2 DuckDB exact-vector proxy:** in-memory 10,000×384 float arrays. Init 8.9 ms, rebuild 114 ms, 60 exact top-10 queries p95 7.27 ms, 100 writes p95 7.06 ms, delete-100 0.38 ms, 495 MB standalone RSS.
- **M3 Oxigraph projection proxy:** long-lived in-memory 10,000 quads. Rebuild 153 ms, 200 SPARQL reads p95 2.99 ms, 100 updates p95 0.31 ms, delete verified, dump 36.7 ms/0.77 MB, 96 MB standalone RSS.
- **M4 selected bundle proxy:** 2,600 PGlite events + M2 vectors + M3 quads in one process. Ready after 2.026 s, 1,145 MB RSS, one query per store in 9.55 ms, 40 MB file-backed artifact. Full W1 and power-loss injection remain UNKNOWN.
- **M5 JSONL proxy:** `/tmp` tmpfs, 2,600 chained events. fsync-write p95 0.08 ms, rebuild 2.29 ms, indexed read p95 0.0006 ms, 45 MB RSS, 1.35 MB file; these are not durable-disk numbers.
- **M6 installed footprint:** PGlite 26 MB + Oxigraph 8 MB + DuckDB API/native glibc+musl packages about 141 MB = about 175 MB, below the 250 MB dependency ceiling [R2]. Per-target packaging should ship one DuckDB libc variant.
- **M7 VSS acquisition:** local `LOAD vss` failed because the extension was absent and required `INSTALL vss`; no network install was attempted.

### System of record and provenance log

| Candidate | Task /40 | Operational /25 | Integration+migration /20 | Sustainability /15 | Total /100 |
|---|---:|---:|---:|---:|---:|
| **PGlite append-only ledger** | 34–37 [M1: p95/reopen; power-loss UNKNOWN] | 19–22 [M1/M4/M6; RSS is high] | 18–20 [L1/L6: Effect SQL, typed error, live composition] | 10–13 [PGL: dump/import minor upgrades; bus factor UNKNOWN] | **81–92 [sum]** |
| Plain JSONL + rebuild* | 20–27 [M5: chain/rebuild; torn-tail/transactions UNKNOWN] | 23–25 [M5: tiny; durable disk UNKNOWN] | 9–14 [A1/R3: canonical encoder, lock, checkpoint, migration all new] | 14–15 [self-owned; no upstream] | 66–81 [sum] |

### Vector projection

| Candidate | Task /40 | Operational /25 | Integration+migration /20 | Sustainability /15 | Total /100 |
|---|---:|---:|---:|---:|---:|
| **DuckDB exact arrays, VSS off** | 34–37 [M2: exact p95/update/delete/rebuild] | 18–22 [M2/M4/M6: measured under bundle ceilings] | 18–20 [L7/L6: existing Effect service and composition] | 12–14 [L8/L5: released binding; issue latency UNKNOWN] | **82–93 [sum]** |
| PGlite + pgvector* | 33–38 [PGV: exact/ANN/upsert/delete; local W1 p95 UNKNOWN] | 14–20 [PGL: 42.9 KB extension; W1 RSS/rebuild UNKNOWN] | 11–16 [L1/L5: raw client reachable, package absent; extension API unstable] | 10–13 [PGV/PGL: strong tests, unstable PGlite API; bus factor UNKNOWN] | 68–87 [sum] |
| sqlite-vec* | 29–35 [SV/LS1: exact KNN, WAL, delete+insert; W1 p95 UNKNOWN] | 15–21 [SV: pure C/WASM; Bun bytes/RSS UNKNOWN] | 8–13 [LS1: Python reference only; new Bun wrapper and migration] | 8–11 [SV/C1: active but pre-v1 breaking changes] | 60–80 [sum] |
| LanceDB* | 30–36 [LDB: exact/ANN/update/delete; W1 p95 UNKNOWN] | 10–18 [LDB: embedded; Bun bytes/RSS/rebuild UNKNOWN] | 8–13 [LDB: new native service/table migration] | 10–13 [LDB: active; issue latency/test depth UNKNOWN] | 58–80 [sum] |
| USearch* | 26–33 [US: exact/ANN/remove; filters/transactions and local p95 UNKNOWN] | 18–23 [US: small vendor claim; Bun RSS/package probe UNKNOWN] | 7–12 [US/R3: new native service plus metadata join] | 11–14 [US: active multi-platform; issue latency UNKNOWN] | 62–82 [sum] |

### Property-graph projection

| Candidate | Task /40 | Operational /25 | Integration+migration /20 | Sustainability /15 | Total /100 |
|---|---:|---:|---:|---:|---:|
| **PGlite adjacency/proof tables** | 24–31 [L6/M1: update/replay measured; no Cypher conformance] | 23–25 [M4: no extra engine] | 18–20 [L1/L6: established graph-table pattern] | 10–13 [PGL: core upgrade caveat; bus factor UNKNOWN] | **75–89 [sum]** |
| PGlite + AGE* | 27–35 [PGL/C1: Cypher candidate; W1 correctness/p95 UNKNOWN] | 13–20 [PGL: 138.2 KB bundle; RSS/rebuild UNKNOWN] | 10–15 [L1: extension absent and API unstable] | 8–12 [C1: Apache project; PGlite extension CI UNKNOWN] | 58–82 [sum] |
| CozoDB* | 28–36 [CZ: Datalog/MVCC/HNSW; local conformance/p95 UNKNOWN] | 12–20 [CZ: prebuilt targets; Bun bytes/RSS UNKNOWN] | 6–11 [CZ: new Datalog boundary, storage migration, MPL note] | 4–8 [CZ/C1: pre-1 compatibility; current release/issue latency UNKNOWN] | 50–75 [sum] |

### RDF/triplet projection

| Candidate | Task /40 | Operational /25 | Integration+migration /20 | Sustainability /15 | Total /100 |
|---|---:|---:|---:|---:|---:|
| **Oxigraph, long-lived derived store** * | 34–38 [M3/OX: SPARQL, term conformance, p95/update/delete/rebuild] | 21–24 [M3/M4/M6: 8 MB package, small marginal RSS] | 17–19 [L3: adapter exists; long-lived store/update/timeout tests still needed] | 11–14 [OX/C1: dual license/released; issue latency UNKNOWN] | **83–95 [sum]** |
| quadstore + Comunica* | 29–35 [QS: RDF/JS/named graphs/patch; filter pushdown and W1 p95 UNKNOWN] | 12–20 [QS: LevelDB persistence; bytes/RSS/rebuild UNKNOWN] | 7–12 [QS/COM: new backend and query packages] | 8–12 [QS: active semver; bus factor/issue latency UNKNOWN] | 56–79 [sum] |
| RDF/JS + Comunica* | 24–32 [COM: SPARQL over RDF/JS; it is not storage, W1 p95 UNKNOWN] | 10–19 [COM: in-memory; bundle bytes/RSS UNKNOWN] | 8–13 [L2/COM: contract fit but new dataset lifecycle] | 11–14 [COM: association maintained; issue latency UNKNOWN] | 53–78 [sum] |

## Verdict

**Bundle.** Use one authoritative append-only PGlite ledger and four rebuild rules:

1. **System of record + provenance winner:** adapt `@beep/pglite` to immutable content-addressed proof/event rows and atomic ledger commits. **Runner-up:** plain JSONL + rebuild, retained only as a canonical export/recovery format until real-disk torn-write tests exist.
2. **Vector winner:** adapt `@beep/duckdb` with deterministic exact array search for M1; keep VSS off. M2 already clears the 100 ms budget at 10,000×384. **Runner-up:** PGlite + pgvector, contingent on a bundled-extension W1 probe and stable migration plan.
3. **Property-graph winner:** derived PGlite adjacency, reverse-support, and minimal-justification tables. It adds no engine and matches the existing practice-KG pattern. **Runner-up:** PGlite + AGE only if a named Cypher subset becomes an acceptance requirement.
4. **RDF winner:** adapt `@beep/oxigraph` into one long-lived, rebuildable local projection behind `SparqlQueryService`; add update, timeout enforcement, and conformance tests. **Runner-up:** quadstore + Comunica.

This is not `already-have`: each winner needs a new lab-specific schema/service or lifecycle change. M4 shows the proposed three-engine runtime fits the primary ceilings together, but the compatibility round must still run real W1, crash injection, canonical proof hashes, offline reinstall, and the deferred platform matrix.

**Sensitivity:** using each score range midpoint, every role winner survives any single 5-point transfer between scoring buckets. Evidence ranges still overlap for DuckDB exact vs pgvector and PGlite adjacency vs AGE, so unknown probes can overturn a winner even though weight shifts alone do not.

## Park list

- **PGlite + pgvector:** vector runner-up; park until local W1 p95/RSS/rebuild, offline bundle, and minor-upgrade migration are proven.
- **PGlite + AGE:** property-graph runner-up; park unless Cypher becomes required and the extension clears CI/resource probes.
- **DuckDB VSS:** park; persistent HNSW has no WAL recovery and is not production-recommended, while this checkout lacks a pinned offline artifact [DV][M7].
- **sqlite-vec:** park; credible exact vector engine, but only the Python reference is integrated and the API is pre-v1.
- **LanceDB:** park; strong vector feature set, but Bun footprint, W1 latency, rebuild, and target-binary evidence are missing.
- **USearch:** park; attractive exact/ANN projection, but metadata joins, Bun binding, and W1 resource evidence remain unproved.
- **Kuzu:** park permanently unless stewardship changes; archived repository fails gate 3.
- **CozoDB:** park; excellent graph/vector shape, but pre-1 compatibility, current releasability, and local resource evidence are UNKNOWN.
- **SurrealDB embedded:** park; BSL-1.1 fails the ratified in-process license matrix.
- **quadstore + Comunica:** RDF runner-up; park until it beats the measured Oxigraph adapter on the same SPARQL corpus.
- **RDF/JS + Comunica:** park as a query-engine option, not a store; Oxigraph already supplies the measured local dataset engine.
- **Plain JSONL:** park as authority; keep the canonical stream format for export/recovery experiments.
- **PostgreSQL + pgvector:** park by envelope; retain as the recovery/task-quality SOTA comparator.

## Parked-SOTA appendix

The envelope-parked comparator is operator-managed PostgreSQL + pgvector, the closest stronger form of the chosen ledger/vector shape. It fails gate 1 even though its recovery envelope is better.

| Candidate | Task /40 | Operational /25 | Integration+migration /20 | Sustainability /15 | Total /100 | Park reason |
|---|---:|---:|---:|---:|---:|---|
| Local PGlite + DuckDB exact winner | 34–37 [M1/M2] | 18–22 [M4/M6] | 18–20 [L1/L7] | 12–14 [PGL/DV] | **82–93 [sum]** | None on primary target |
| PostgreSQL + pgvector | 35–39 [PGV/PG: ACID, WAL, exact/ANN; W1 p95 UNKNOWN] | 8–15 [server cold/RSS/artifact UNKNOWN] | 8–14 [PG: operator server and Effect boundary new] | 14–15 [PGV: v0.8.6 + regression/TAP tests] | 65–83 [sum] | **G1 FAIL:** operator-managed server |

## Sources appendix

Only sources opened in this pass are listed. Census-sourced repository/license claims cite the fetch-verified census rather than an unvisited license page.

- **[R1]** `explorations/semantica-lab/research/criteria-rubric.md:25-85`; hard gates, weights, storage sheet, sensitivity law.
- **[R2]** `explorations/semantica-lab/research/workload-contract.md:8-16,31-63`; W1, target, ceilings, offline deterministic loop.
- **[R3]** `explorations/semantica-lab/research/shared-schema.md:11-50`; spans, RDF terms, ModelIdentity, append-only provenance, proofs.
- **[D1]** `explorations/semantica-lab/DECISIONS.md:112-118,142-165`; provenance-first law and system-of-record + projections amendment.
- **[A1]** `explorations/semantica-lab/research/adhd-reasoning.md:74-90,108-120`; PGlite proof-ledger and evidence-graph write model.
- **[C1]** `explorations/semantica-lab/research/docs-url-census.md:3-4,15-17,26,32,71-72`; fetch method, licenses, PGlite extensions, Oxigraph, Cozo note.
- **[M1-M7]** Synthetic local probes specified under Scores; ad hoc Bun commands wrote only under `/tmp` and left no repo artifacts.
- **[L1]** `packages/drivers/pglite/src/PgliteClient.service.ts:1-9,23-26,59-62,78-97,108-132`; live wrapper, raw client, persistence, errors, layer.
- **[L2]** `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:1-25,45-49,90-101,302-395`; contract, bounded profile, timeout, unsupported default.
- **[L3]** `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:69-193,196-264,266-293`; term mapping, per-request store, profiles, lazy layer.
- **[L4]** `packages/foundation/capability/nlp-processing/src/Graph/TextGraph.ts:803-812`; raw `effect/Graph.DirectedGraph` algorithm value.
- **[L5]** `package.json:22,47,179-184`; pinned DuckDB/PGlite/Oxigraph catalog and no pgvector package.
- **[L6]** `packages/law-practice/server/src/PracticeKg.projections.ts:532-545,597-623,707-747`; deterministic PGlite+DuckDB bundle and partial-failure caveat; `apps/practice-kg-mcp/src/runtime/Host.ts:100-131`; app-owned composition.
- **[L7]** `packages/drivers/duckdb/src/DuckDb.service.ts:1-24,82-143,456-593`; native product-neutral Effect service, typed operations, transactions, managed layer.
- **[L8]** `node_modules/@duckdb/node-api/README.md:1-32`; released binaries and platform matrix; `node_modules/@duckdb/node-api/package.json:1-13`; installed version/license.
- **[LS1]** `~/YeeBois/workstation-apps/semantica/semantica/vector_store/sqlite_vec_store.py:1-18,73-202,228-245,301-340`; persistence/WAL/errors/vec0/delete-then-insert reference.
- **[LS2]** `~/YeeBois/workstation-apps/semantica/semantica/triplet_store/oxigraph_store.py:1-6,21-74,80-97,218-292`; native persistent store, batch surface, flush, RDF term metadata.
- **[PGL]** [PGlite extensions](https://pglite.dev/extensions/), [extension API warning](https://pglite.dev/extensions/development), [filesystems](https://pglite.dev/docs/filesystems), [upgrade path](https://pglite.dev/docs/upgrade), [vendor benchmark](https://pglite.dev/benchmarks/).
- **[PGV]** [pgvector repository and documentation](https://github.com/pgvector/pgvector); exact/ANN, ACID/PITR, update/delete, rebuild, tests.
- **[SV]** [sqlite-vec vec0](https://alexgarcia.xyz/sqlite-vec/features/vec0.html), [KNN](https://alexgarcia.xyz/sqlite-vec/features/knn.html), [repository](https://github.com/asg017/sqlite-vec).
- **[DV]** [DuckDB VSS documentation](https://duckdb.org/docs/current/core_extensions/vss.html), [VSS repository](https://github.com/duckdb/duckdb-vss); experimental HNSW, persistence/recovery warning, update/delete.
- **[LDB]** [LanceDB quickstart](https://docs.lancedb.com/quickstart), [vector indexing](https://docs.lancedb.com/indexing/vector-index), [updates/deletes](https://docs.lancedb.com/tables/update), [repository](https://github.com/lancedb/lancedb).
- **[US]** [USearch repository and documentation](https://github.com/unum-cloud/usearch); platforms, exact/ANN, add/remove/save/load, vendor benchmarks.
- **[KZ]** [Kuzu repository](https://github.com/kuzudb/kuzu); archived status, embedded/ACID/Cypher/WASM, MIT.
- **[CZ]** [CozoDB repository and documentation](https://github.com/cozodb/cozo); embedded targets, Datalog/MVCC/HNSW, pre-1 compatibility, MPL-2.0.
- **[SR]** [SurrealDB repository](https://github.com/surrealdb/surrealdb), [embedded JavaScript documentation](https://surrealdb.com/docs/surrealdb/embedding); embedded modes and BSL-1.1 core.
- **[OX]** [Oxigraph JavaScript package](https://github.com/oxigraph/oxigraph/tree/main/js), [native Store documentation](https://docs.rs/oxigraph/latest/oxigraph/store/struct.Store.html); JS in-memory SPARQL/update vs native on-disk store.
- **[QS]** [quadstore repository and documentation](https://github.com/quadstorejs/quadstore); Bun/RDF/JS/named graphs, LevelDB, patch/delete, Comunica, semver, MIT.
- **[COM]** [Comunica FAQ](https://comunica.dev/docs/query/faq/), [Comunica repository](https://github.com/comunica/comunica); local/in-memory RDF/JS querying, RDF term bindings, association maintenance, MIT.
- **[PG]** [PostgreSQL WAL configuration](https://www.postgresql.org/docs/current/runtime-config-wal.html), [PostgreSQL license](https://www.postgresql.org/about/licence/); crash recovery, fsync/PITR, current releases, permissive license.
