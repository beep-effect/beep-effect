# P5 evidence — gauntlet defect register (verified against repo + local data)

Date: 2026-07-30 · Companion to `2026-07-30-ac4-ac5-gauntlet.md`. Items were
observed client-side on the Windows test target (details in the out-of-repo
raw archive, `gauntlet-evidence/2026-07-30/`), then verified on this
workstation against the shipped bundle copy (DuckDB read-only), the source
corpus staging tree, and the repo code — same day. Status legend:

- **CONFIRMED-data** — reproduced by query against the shipped bundle.
- **CONFIRMED-code** — mechanism located in repo source.
- **CONFIRMED-source** — corroborated against the out-of-repo corpus.
- **OBSERVED** — seen in tool output during the run; not independently re-verified.
- **OPEN** — needs build-side or product-side work to resolve.

## Root cause synthesis (upgrades the run's truncated-key hypothesis)

The run hypothesized families collapse because the pipeline keys on the bare
docket number while the practice's true key is `<client>.<docket>`. Local
verification sharpened this into **two independent pipeline defects**:

1. **The client dimension is never extracted where it matters.**
   `documents.client` is populated on 81 of 7,330 rows — all from one
   hand-labeled demo subset, and *never* on a row that also carries
   `docket_family`. Client-prefixed attorney references (e.g. `CLIENT-B.F-2`,
   `CLIENT-C.F-3`) are present throughout the source corpus text, so the
   dimension is extractable; the organizer simply does not extract it. Family
   nodes are then keyed on the bare family string
   (`PracticeKg.projections.ts:325` — the row's `client` field is in scope
   and excluded from the natural key). Result: two clients sharing a docket
   number collapse into one family (A-1/A-2/A-3).
2. **`enrichment.docket_families` is mention-derived, but projections treats
   it as membership.** The arrays record *which families' documents mention a
   candidate number* — prior-art citations included — and
   `PracticeKg.projections.ts:380–395` builds `uspto-anchor` family nodes and
   membership edges from them. 75 of 150 enrichment rows fan to more than one
   family (31×2, 18×3, 10×4, 5×5, 3×6, 3×7, 2×9, 1×11, 1×15, 1×16). That is
   the entire cartesian defect (A-12), and it also resolves A-15:
   `uspto-anchor` is a mention anchor, not a parentage assertion — the defect
   is presenting it as membership.

One fix each, plus a rebuild, clears the two blockers.

## A. KG ingestion pipeline

| # | Sev | Finding | Attribution | Status | Anchor / evidence |
| --- | --- | --- | --- | --- | --- |
| A-1 | Blocker | Cross-client contamination in a family: F-2 spans ≥3 inventions across ≥2 client prefixes (`CLIENT-A`, `CLIENT-B`, +1); a family-scoped query can surface one client's prosecution as another's — confidentiality hazard, warrants review independent of scoring | pipeline | CONFIRMED-data / -source / -code | root-cause §1; prefixes verified in corpus text; `documents.client` 81/7,330, never with `docket_family` |
| A-2 | Blocker | Family F-2 application chain simultaneously contaminated (foreign application present) and incomplete (`APP-2`, `APP-3` in the practice's own response headers, absent from graph) | pipeline | OBSERVED | G-3/3b; falls out of A-1 fix + A-14 |
| A-3 | High | Family attribution unreliable generally — defective in 3 of 4 families probed (F-1, F-3, F-2) | pipeline | CONFIRMED-data | subsumed by root-cause §1+§2 |
| A-4 | High | Dual-keyed enrichment divergence: 9 patents carry both app-keyed and patent-keyed rows; 5 of 9 have different family sets | pipeline | CONFIRMED-data | e.g. one patent: 16 families app-keyed vs 9 patent-keyed |
| A-5 | High | Recycle-bin `$R*` restore stubs ingested as first-class documents and assigned dockets by content (6/15 in G-4; several in G-2/G-3; one has no meaningful source filename at all) | source (present) + pipeline (promoted) | OBSERVED | quarantine or tag with distinct epistemic status |
| A-6 | High | Filename-derived docket labels indistinguishable from record-derived (one assignment's only family link is a docket string typed in its filename) | pipeline | OBSERVED | emit an attribution-source field |
| A-7 | Medium | Candidate claims not joinable to source documents: row `digest` hex == `activityOperation` hex (operation-derived); `sourceFile` points at `.txt` extractions vs `.doc/.docx` graph documents | pipeline | OBSERVED | emit source-document digest on claim rows |
| A-8 | Medium | No US file-wrapper documents for either G-2 patent (foreign counterpart prosecution only) | ambiguous | OPEN | scope decision: are US wrappers in ingestion scope? |
| A-9 | Medium | Manifest says `sourceRuns.refresh202607: "excluded"` while every observed provenance chain cites the 2026-07 refresh | ambiguous | OPEN (localized) | `PracticeKg.projections.ts:615–617` (`includeRefresh` flag); audit the actual build invocation in P6 |
| A-10 | Medium | No per-message email provenance — floor is the PST container; blocks privilege-log / fee-dispute proof of a specific message | pipeline (design) | OBSERVED | D-2c disclosure exists; decide whether to raise the floor |
| A-11 | Low | `builtAt` 2026-07-03 vs `bundleVersion` 2026-07-27-01 | pipeline | OPEN | reconcile stamp sources in the build |
| A-12 | Blocker | Cartesian join: one application anchors **7** families (amends the run's observed 6 — the shipped array is `F-4, F-5, F-6, F-1, F-7, F-8, F-9`); all patents/applications attach to every docket in each; 90 rows for 8 dockets | pipeline | CONFIRMED-data / -code | root-cause §2; systemic — 75/150 enrichment rows multi-family, max 16 |
| A-13 | Blocker | No USPTO prosecution status anywhere (no status, examiner, issue/abandonment, due dates); docket-status questions unanswerable by construction | scope decision | CONFIRMED-data | enrichment carries lookup status (`resolved`/`not-found`) + title/applicant/inventor only; ties to uspto-mcp promotion |
| A-14 | High | Every application node has null `docketFamily`, so app→family resolution rides entirely on the defective A-12 anchor edges | pipeline | OBSERVED | populate during build once A-1/A-12 land |
| A-15 | Medium | `uspto-anchor` semantics undocumented | pipeline (docs) | **RESOLVED (repo-side)** | it is a mention-derived enrichment anchor, not parentage — document it and stop deriving membership from it (A-12 fix) |

## B. MCP extension / server

| # | Sev | Finding | Status | Anchor |
| --- | --- | --- | --- | --- |
| B-1 | Blocker (fixed) | Bun-compiled exe resolved bare specifiers against the embedded virtual root; fixed via manifest `NODE_PATH`. Keep as regression test: launch from cwd `C:\` and drive `initialize` over stdio — the crash is lazy and cwd-sensitive | FIXED (this branch) | `apps/practice-kg-mcp/src/package.ts` env block; smoke now Desktop-faithful |
| B-2 | High | Node-level `kg_provenance` unsupported — family/application/patent identities fail 7/7 in both `natural_key` and `iri` forms | OBSERVED | implement, or declare the boundary in the tool contract |
| B-3 | High | One generic error string for all provenance failures — cannot distinguish no-record / unsupported-identity / malformed-query | OBSERVED | `PracticeKg.tool-handlers.ts`; return typed errors |
| B-4 | Medium | No disclosure of the node-provenance floor (email layer discloses its floor via D-2c label; nodes just error) | OBSERVED | add equivalent disclosure to node-bearing tools |
| B-5 | High | `kg_candidate_claims` not reached by natural phrasing — G-3's rejection question routed to BM25 + document read, so required labels never surfaced (failed a criterion as delivered) | OBSERVED | `PracticeKg.tools.ts` — sharpen description; discoverability, not data |
| B-6 | High | Default disclosure budget silently drops columns (`application`, `documentDigest`, `documentLabel`) and under-reported a family's documents (8 of 10); nothing signals truncation | OBSERVED | raise default or emit explicit truncation warning naming withheld columns |
| B-7 | High | Degenerate joins presented as real results — the docket × patent cross-product (90 rows / 8 dockets) is indistinguishable from a genuine table; a consumer published it as fact | OBSERVED | detect and label cartesian shapes; the one defect that defeats the epistemic design |
| B-8 | High | `corpus_search_text` returns no match offsets; snippets anchor to document head — "where does it say that" unanswerable without blind scanning | OBSERVED | `PracticeKg.fts.ts` + handler; return spans or snippet-around-match |

## C. Test process

| # | Sev | Finding | Status | Fix |
| --- | --- | --- | --- | --- |
| C-1 | High | `acceptance-gauntlet.md` referenced by the runbook but never shipped — no canonical question list on the target | OPEN | ship it with the handoff set |
| C-2 | Medium | Model self-reports about tool availability unreliable (claimed browser access while web search was UI-verified off) | RECORDED | verify controls against client UI only |
| C-3 | Medium | Literal provenance criterion unsatisfiable for graph-derived answers | ADOPTED | amend gauntlet-wide: resolve **or** be explicitly marked unverifiable |
| C-4 | Low | Runbook must prescribe Settings → Extensions (no `.mcpb` file association exists) | OPEN | runbook edit |
| C-5 | High | Desktop memory crosses chat boundaries — recalled a prior chat's docket memory and saved a new one; chat isolation alone is insufficient for clean re-runs | OPEN | clear/disable memory in the evaluation preflight; memories from this run still exist on the target |

## Local verification appendix (this workstation, 2026-07-30)

Read-only DuckDB queries against a copy of the shipped `practice.duckdb`:

- Fan-out distribution: `SELECT LEN(docket_families), COUNT(*) FROM enrichment
  … GROUP BY 1` → 75/150 rows > 1 family; max 16.
- A-12 row: candidate for application `APP-1` → 7-family array (includes
  `F-6`, unobserved in the run).
- Client coverage: `SELECT COUNT(*), COUNT(client) FROM documents` →
  7,330 / 81; the 81 all carry a null `docket_family`.
- Dual-key divergence: 9 app+patent-keyed pairs, 5 with differing family sets.
- Families with >1 distinct client in `documents`: zero — because the client
  column is null wherever a family is present (the collapse is invisible to
  the shipped data; it is only visible against the source corpus refs).
- Source corroboration: ripgrep over the corpus staging extracts finds the
  client-prefixed references for both probe families across document text and
  email bodies.
