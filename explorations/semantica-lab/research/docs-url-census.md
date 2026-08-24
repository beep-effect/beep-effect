# Docs URL census (D3)

Live-fetched 2026-08-24. `llms.txt` is recorded only when GET returned real Markdown
(not HTML 404). SPDX from the GitHub license API and/or the repo LICENSE file.

## Vector

| Item | Docs | llms.txt | Repo | License | Note |
|------|------|----------|------|---------|------|
| FAISS | https://faiss.ai/ | none found | https://github.com/facebookresearch/faiss | MIT | C++/Python library, not a server |
| Pinecone | https://docs.pinecone.io/ | https://docs.pinecone.io/llms.txt also https://docs.pinecone.io/llms-full.txt | https://github.com/pinecone-io/pinecone-ts-client | proprietary (SDK Apache-2.0) | no public engine repo; SaaS only |
| Weaviate | https://docs.weaviate.io/weaviate | https://weaviate.io/llms.txt | https://github.com/weaviate/weaviate | BSD-3-Clause | `/developers/weaviate` 302s here |
| Milvus | https://milvus.io/docs | https://milvus.io/llms.txt | https://github.com/milvus-io/milvus | Apache-2.0 | distributed server |
| Qdrant | https://qdrant.tech/documentation/ | https://qdrant.tech/llms.txt | https://github.com/qdrant/qdrant | Apache-2.0 | llms-full.txt 404 |
| pgvector | https://github.com/pgvector/pgvector | none found | https://github.com/pgvector/pgvector | PostgreSQL | README is the docs; no separate site |
| sqlite-vec | https://alexgarcia.xyz/sqlite-vec | none found | https://github.com/asg017/sqlite-vec | Apache-2.0 OR MIT | pre-v1; WASM-capable; last push 2026-05-18 |
| PGlite | https://pglite.dev/docs/about | none found | https://github.com/electric-sql/pglite | Apache-2.0 | pgvector documented at https://pglite.dev/extensions/#pgvector via `@electric-sql/pglite-pgvector` |

## Graph

| Item | Docs | llms.txt | Repo | License | Note |
|------|------|----------|------|---------|------|
| FalkorDB | https://docs.falkordb.com/ | https://docs.falkordb.com/llms.txt also https://docs.falkordb.com/llms-full.txt | https://github.com/FalkorDB/FalkorDB | SSPL-1.0 | source-available, not OSI |
| Neo4j | https://neo4j.com/docs/ | https://neo4j.com/docs/llms.txt | https://github.com/neo4j/neo4j | GPL-3.0 | also https://neo4j.com/llms.txt (product index) |
| Amazon Neptune | https://docs.aws.amazon.com/neptune/latest/userguide/intro.html | https://docs.aws.amazon.com/neptune/latest/userguide/llms.txt | none (managed service) | proprietary | no engine repo; samples only |
| Apache AGE | https://age.apache.org/age-manual/master/index.html | none found | https://github.com/apache/age | Apache-2.0 | PG extension; PGlite ships `@electric-sql/pglite-age` |

## Triplet / RDF

| Item | Docs | llms.txt | Repo | License | Note |
|------|------|----------|------|---------|------|
| Oxigraph | https://docs.rs/oxigraph/latest/oxigraph/ | none found | https://github.com/oxigraph/oxigraph | Apache-2.0 OR MIT | WASM JS in repo `js/`; oxigraph.org 302s to GitHub |
| Apache Jena | https://jena.apache.org/documentation/ | none found | https://github.com/apache/jena | Apache-2.0 | Java; SPARQL via ARQ |
| Blazegraph | https://blazegraph.com/ | none found | https://github.com/blazegraph/database | GPL-2.0 | archived 2026-03-23; last release 2020 |
| Eclipse RDF4J | https://rdf4j.org/documentation/ | none found | https://github.com/eclipse-rdf4j/rdf4j | BSD-3-Clause | Java RDF toolkit plus stores |
| Anzo | https://docs.cambridgesemantics.com/anzo/v5.4/userdoc/Home.htm | none found | none public | proprietary | live GET 503 this session; Wayback 2025-12-07 title "Anzo 5.4 Documentation"; cambridgesemantics.com/anzo/ now 302s to Siemens RapidMiner |

## Embeddings

| Item | Docs | llms.txt | Repo | License | Note |
|------|------|----------|------|---------|------|
| sentence-transformers | https://www.sbert.net/ | none found | https://github.com/huggingface/sentence-transformers | Apache-2.0 | sbert.net aliases here |
| FastEmbed | https://qdrant.github.io/fastembed/ | none found | https://github.com/qdrant/fastembed | Apache-2.0 | also https://qdrant.tech/documentation/fastembed/ |
| BAAI BGE | https://bge-model.com/ | none found | https://github.com/FlagOpen/FlagEmbedding | MIT | model cards on Hugging Face `BAAI/bge-*` |
| OpenAI embeddings | https://developers.openai.com/api/docs/guides/embeddings | https://developers.openai.com/api/docs/llms.txt also https://developers.openai.com/api/docs/llms-full.txt | https://github.com/openai/openai-python | proprietary (SDK Apache-2.0) | platform.openai.com/docs/guides/embeddings 302s here |

## Parsing

| Item | Docs | llms.txt | Repo | License | Note |
|------|------|----------|------|---------|------|
| Docling | https://docling-project.github.io/docling/ | none found | https://github.com/docling-project/docling | MIT | IBM Research origin; model weights licensed separately |
| unified/remark | https://unifiedjs.com/ | none found | https://github.com/unifiedjs/unified | MIT | remark docs https://remark.js.org/ repo https://github.com/remarkjs/remark (MIT) |
| pdf.js | https://mozilla.github.io/pdf.js/ | none found | https://github.com/mozilla/pdf.js | Apache-2.0 | in-process JS |

## Reasoning

| Item | Docs | llms.txt | Repo | License | Note |
|------|------|----------|------|---------|------|
| eyereasoner (eye-js) | https://eyereasoner.github.io/eye/ | none found | https://github.com/eyereasoner/eye-js | MIT | EYE Prolog engine also MIT (eyereasoner/eye); WASM demo https://eyereasoner.github.io/eye-js/example/ |
| N3.js | https://rdf.js.org/N3.js/ | none found | https://github.com/rdfjs/N3.js | MIT | parser/store; LICENSE.md MIT |
| rdf-validate-shacl | https://github.com/zazuko/rdf-validate-shacl | none found | https://github.com/zazuko/rdf-validate-shacl | MIT | `packages/drivers/shacl` package.json `"license": "MIT"`; last push 2026-04-02 |
| shacl-engine | https://github.com/rdf-ext/shacl-engine | none found | https://github.com/rdf-ext/shacl-engine | MIT | last push 2026-08-09; npm 1.1.2 |
| Dusa | https://dusa.rocks/docs | none found | https://github.com/robsimmons/dusa | GPL-3.0 | TS Datalog+ASP (finite-choice LP). Last push 2026-06-30. Best TS engine that still shows life |

## Flags

*(Gates quoted below are rubric v1 as of this census; v2.0 rebuilt the license and maintenance gates — see `criteria-rubric.md`.)*

Hard gates from `criteria-rubric.md`: in-process license MIT/Apache-2.0/BSD/ISC only; sidecar copyleft case-by-case; unverifiable license park; ~12 month maintenance floor.

- **Pinecone, Neptune, Anzo, OpenAI embeddings.** Engine/API is proprietary. Anzo also unverifiable (no public repo; live docs 503).
- **FalkorDB SSPL-1.0, Neo4j GPL-3.0, Blazegraph GPL-2.0, Dusa GPL-3.0.** Copyleft. In-process fail. Sidecar only with an explicit decision. Blazegraph is also abandonware (archived, last release 2020).
- **pgvector SPDX `PostgreSQL`.** Permissive BSD-family, but not in the rubric's MIT/Apache/BSD/ISC list. Needs an explicit call. Same code is what PGlite loads.
- **No TS/WASM Datalog engine clears both gates.** Dusa is maintained TypeScript but GPL-3.0. CozoDB has WASM (`cozodb/cozo`, MPL-2.0) but last push 2024-12-04, outside ~12 months. `vilterp/datalog-ts` is MIT TypeScript, last push 2024-12-31, same stall. DataScript is alive (2026-08-15) but ClojureScript and EPL-1.0.
- **Docling MIT covers the library only.** README says model weights keep their upstream licenses.
