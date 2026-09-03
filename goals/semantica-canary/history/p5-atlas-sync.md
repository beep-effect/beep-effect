# P5 atlas sync — final park values

Date: 2026-09-02

Status: six Notion atlas rows set to `park`; no `drop` values were warranted; read-back verified.

## Scope and law

PLAN P5 step 1 syncs final `park`/`drop` values to the Notion `@beep/semantica` atlas only after
every family verdict is a dated `DECISIONS.md` entry (B1, A9). All five verdicts were confirmed
by [`p5-close.md`](./p5-close.md) before any write. Row-level `adopt`/`adapt`/`already-have`
values are now unblocked by the passed canary but sit outside this packet's scope; they belong to
the `semantica-atlas-sync` re-entry (DECISIONS O3/M4, "Atlas backlog" law row).

## Method

1. A read-only Codex lane (GPT-5.6 Sol, xhigh) mapped the family sheets' park lists and the dated
   family decisions onto atlas rows and produced a proposal. A row was proposed only when its
   title names the same technology a sheet explicitly parks and the later dated family decision
   selected a different boundary. Broad or role-ambiguous rows were excluded.
2. The orchestrating session re-read the four cited park lists, then inventoried the ten
   family-relevant catalogs live through the Notion MCP: 59 rows, every `Verdict` empty.
3. One canary write (`sqlite-vec`) was applied and read back before the remaining five writes.
4. A final SQL read-back across the ten catalogs returned exactly the six rows below as `park`
   and no other non-empty `Verdict`.

## Rows written

| Catalog | Row | Before | After | Evidence |
| --- | --- | --- | --- | --- |
| Vector Store — Backends | `sqlite-vec` | empty | `park` | storage park list; C1 bundle |
| Vector Store — Backends | `PgVector` | empty | `park` | storage park list (PGlite + pgvector); C1 bundle |
| Graph Store — Backends | `Apache AGE` | empty | `park` | storage park list (PGlite + AGE); C1 adjacency |
| Embeddings — Supported Models | `BGE` | empty | `park` | embeddings park list; C1 Embeddings verdict |
| Parse — Available Parsers | `DoclingParser` | empty | `park` | input park list (Docling, G5); C0 Input verdict |
| Semantic Extract — Extraction Methods | `ml` | empty | `park` | extraction park list; C0 Extraction verdict |

Park lists are the `## Park list` sections of `bakeoff-{storage,embeddings,input,extraction}.md`
under `explorations/semantica-lab/research/`; verdict entries are the dated `DECISIONS.md` sections. Page identifiers live in the
Notion workspace; each row's page history is the rollback surface.

## Not written, and why

- No `drop`: no extant catalog row is explicitly and finally dropped by a sheet or a dated verdict.
- `Oxigraph (embedded)`, embedding-model `OpenAI`, `pattern`, and `llm` match selected boundaries
  but need positive vocabulary (`adopt`/`adapt`/`already-have`) that this packet does not write.
- `Sentence-Transformers`, `FastEmbed`, `Datalog`, `Rete network`, and `forward chaining` each
  collapse several candidate roles; writing them would exceed the evidence.
- Selected winners with no catalog row (`@beep/doc-text`, PGlite ledger/adjacency, DuckDB exact
  arrays, lab-local rho-df) and the parked Snowflake/ONNX lane were not created; this sync never
  adds rows or schema.
- The Module Index, Findings, and Glossary databases carry no `Verdict` property and were not
  touched.

## Friction

The Codex lane's Notion OAuth grant was revoked (`invalid_grant`), so it could inventory only
ten catalogs live and produced the mapping from repo evidence; the writes were applied from the
orchestrating session's own Notion connection instead. Recorded in the exploration's
`research/OPPORTUNITIES.md`.
