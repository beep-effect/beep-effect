# D17 adversarial bake-off review

Overall verdict: the sheets are candidate screens, not ratifiable verdicts. Rubric §0 says nothing launches without the workload and gold artifacts, yet the live corpus has 76 PDFs rather than the contracted 443, and this packet has no F1 or `gold/v1` files (`bakeoff-input.md:3`, `workload-contract.md:8-14`). Rubric §4 also forbids final verdicts before a compatibility run. None ran. Calling the choices "provisional" does not create a sixth verdict state.

## 1. Per-sheet review

### Storage

- Weakest load-bearing claim: "M4 shows the proposed three-engine runtime fits the primary ceilings together" (`bakeoff-storage.md:94`). M4 is a synthetic 2,600-event/10,000-vector/10,000-quad proxy, not W1, and its measurements have no script, raw output, or committed receipt (`:42-50`, `:133`). The cited result cannot be independently replayed.
- Source checks: [L1] does confirm file-backed PGlite and typed connection errors; [L3] confirms a fresh in-memory Oxigraph store per request and no use of `timeoutMs`; [L6] explicitly warns that cross-store build failure leaves a partial bundle. Those three citations support the facts but undercut the claimed production shape.
- Rubric breach: PGlite, DuckDB, and Oxigraph receive G5 `PASS` from synthetic Linux proxies even though full W1, durable disk, crash recovery, and the target matrix are unknown (`:20-24`, `:32`, `:44-50`). PGlite adjacency receives G7/G8 passes for graph/proof tables that do not yet exist. Oxigraph's 10,000-quad rebuild does not prove restart cost for W1 plus proof quads.
- The role winners follow the midpoint table only because future adapters get near-full integration scores and recovery unknowns barely depress task scores. That smuggles incumbency and "fewer engines" back into the rubric. Overturn `bundle` to `park pending compatibility`; retain the four choices only as the first bundle to probe.

### Embeddings

- Weakest claim: Snowflake gets G6/G7 `PASS` because a remote file publishes a hash and identity *can* key rebuilds (`bakeoff-embeddings.md:30`). No complete manifest is committed, no artifact is local, and no replay ran. "Can be pinned" is not pinned. The same omission makes other models `UNKNOWN`, so the gate is applied selectively.
- Source checks: [L-ORT] proves only that a face-detection service wraps ORT load/session failures; `bun.lock` pins ORT 1.27.0; [L-API] exposes a provider model name but no immutable revision or artifact hash. None proves tokenization, pooling, MRL truncation, normalization, or embedding replay.
- Rubric breach: W1 has no queries/qrels, and embeddings are absent from the workload's stated ingest-to-KG loop (`workload-contract.md:50-59`). Snowflake's 34-38 task score is therefore a proxy preference. The runtime ranges overlap, all decisive ORT measurements are unknown, and the 256-dimensional choice has not run once.
- The verdict follows a 3.5-point proxy midpoint lead, not the contracted workload. Overturn `pick-one` to `park`; carry Snowflake/GTE and native ORT/Transformers.js into one held-constant test after a retrieval task exists.

### Input

- Weakest claim: HTML and Markdown normalization are "Identity by default" while retaining HAST/mdast positions (`bakeoff-input.md:47-48`). Unist offsets address the original markup. Entity decoding, removed syntax, generated HTML nodes, and whitespace changes make visible canonical text non-identical. PDF.js has no original character stream to which extracted glyph text can losslessly map.
- Source checks: [L1] confirms stable content ids and paged UTF-16 text but `ExtractionResult` has no span field; [L3]/[L4] confirm the beep Markdown/HTML packages are models, not parsers; [L8] confirms Wink `Tokenization` carries token offsets; [L9] is a bounded locator-to-existing-text mapper, not the proposed general parser source-map service.
- Rubric breach: PDF.js gets G4/G8 `PASS*` for an adapter that does not exist while G5-G7 remain unknown (`:19`). Rehype and PDF.js are absent locally, no malformed fixtures or G-structure gold exist, and the sheet itself says PDF.js/MuPDF are a rubric tie (`:59-61`). The score table still prints a PDF winner and gives Unified 30-38 task points without an HTML run.
- The roster is sensible; the verdict is premature. Overturn PDF and HTML/Markdown parser picks to `park pending the shared probe`. Keep file-processing and Wink as `already-have` bricks, not as proof that their proposed adapters pass the end-to-end span floor.

### Reasoning

- Weakest claim: EYE gets G8 `PASS` for proof explanations (`bakeoff-reasoning.md:41`), while the
  sheet later admits proof capture, decoding to `InferenceEvent`, independent verification, and
  rule-hash binding are unbuilt (`:59`, `:78-83`). Ascent fails G8 because proof relations would be
  new adapter logic. EYE receives the opposite treatment for equivalent missing work.
- Source checks: [L2] confirms the ontology reasoner returns sorted inferred quads but no rule or
  premise ids; [L5] confirms N3.js mutates a store and records no derivations; [L4] confirms v3 Rete
  accepts promise actions but calls them without `await`. EYE itself is neither installed nor
  locked in this checkout, so its decisive claims were not live-source checked.
- Rubric breach: the only scored candidate still has G4, G5, and G7 `UNKNOWN`, no gold run, and no
  typed adapter. "Only survivor" is an artifact of the asymmetric G8 ruling. A conditional
  pick-one with three open hard gates is a park, not a verdict.
- Overturn EYE `pick-one` to `park` with EYE as the first adaptation probe. Its full-rerun API also
  conflicts with the ledger's incremental invalidation story until measured and specified.

### Extraction

- Weakest claim: the hybrid earns 32-36 task points because one claim merge "retains conflicts and
  spans" (`bakeoff-extraction.md:32`). `EvidenceBatch`, `ExtractionMethod`, the merge, and the
  orchestrator do not exist in packages; `EvidenceBatch` is not even in `shared-schema.md`. G4 is
  marked `PASS (contract)` for an unwritten implementation (`:19`, `:82`).
- Source checks: [B1]/[B2] confirm bounded LangExtract input, typed parse/generation failures, and
  fail-closed remote policy; [B3] confirms the handoff emits `relations: []` and creates mention ids
  without materializing `Mention` values; [B6] confirms a missing Wink span fabricates
  `{start: 0, end: needle.length}`. The cited incumbent defects are real.
- Rubric breach: the nonexistent hybrid gets 11-13 sustainability points and a high task floor with
  zero G-entity/G-relation evidence. Its quality score counts the remote LLM's hoped-for breadth,
  while its operations score discounts that lane as optional. The sheet also emits both
  `already-have` and `pick-one`, which is not one family verdict.
- Overturn hybrid `pick-one` to `park/tie pending gold`. Pattern-only and hybrid must run the same
  evidence contract before the hybrid can claim any quality increment.

## 2. Cross-family composition

1. No span contract composes. Shared schema says "char offsets against a named canonicalization"
   but names neither UTF-16 nor a canonical-text identity. Live `VerifiedSpan` is UTF-16. Unist
   positions address source markup, PDF.js positions address synthesized text items, and the
   proposed `EvidenceBatch` has no schema. A span can be locally valid and globally meaningless.
2. Embeddings chooses `dim: 256` (`bakeoff-embeddings.md:69-73`); storage's only vector proof is
   10,000x384 (`bakeoff-storage.md:45`, `:90`). There is no mixed-model rejection, dimension-keyed
   table, metric/normalization contract, 256 rerun, or projection migration test.
3. EYE reruns the whole ruleset. The ledger expects incremental truth maintenance, invalidation,
   reverse support, and append-only proof events. No owner defines the transaction that invalidates
   stale conclusions, advances projection watermarks, and publishes a consistent snapshot.
4. DuckDB M2 is in-memory. The sheet never decides whether vectors persist or rebuild at startup,
   what the ledger stores, or how DuckDB-exact migrates to pgvector without changing ranking
   semantics. "Rebuildable projection" is not a migration story.
5. Oxigraph is long-lived only until the Bun process exits. Its 10,000-quad synthetic rebuild omits
   W1 statements and proof DAG expansion. Restart rebuild cost, stale-read behavior, and the
   ledger-to-Oxigraph checkpoint are unspecified.
6. Budgets were applied per family, not to the bundle. Storage already reports 1,145 MB RSS and
   about 175 MB dependencies. ORT/model, PDF parsing, EYE, and extraction have not been added. The
   remaining 855 MB RSS and 75 MB dependency headroom may disappear immediately.
7. Ownership collides: input and LangExtract both claim source mapping; extraction and shared
   schema both claim mention shape; reasoning and storage both claim proof/invalidation identity;
   pipeline and projection services both claim update ordering. There is no single schema or commit
   protocol resolving any of these pairs.

## 3. Probe audit

- Storage's M1-M7 are prose receipts with no harness. Crash injection, durable-disk mode, cache
  state, projection size, pass thresholds, and all non-Linux targets are unspecified.
- Embeddings does not define qrel sampling, retrieval metric, minimum gain, chunking, complete
  identity fields, or what "offline reinstall" may read. Three cold restarts are not a matrix.
- Input does not define canonical text, offset unit, loss-map oracle, malformed recovery policy,
  parser caps, or a minimum G-structure score. The promised first-25 set is not materialized.
- Reasoning's "one probe" is an acceptance program. It lacks a frozen N3 translation, proof
  verifier, rule/input caps, timeout semantics, and expected byte canonicalization.
- Extraction names useful metrics but no winning threshold, minimum hybrid lift, LLM capture format,
  provider-revision rule, slice ids, or maximum unaligned/failure rate.

Run first: one schema-validated provenance canary spanning one W1 PDF plus F1 Markdown and HTML,
through parse, canonical source maps, `EvidenceBatch`, ledger commit, 256-d DuckDB query, Oxigraph,
EYE proof, and `EvalReport`. Run it offline twice, then crash/restart between ledger commit and each
projection. Require identical ids/hashes, every mention slice to equal canonical text, independently
verified proofs, consistent watermarks, and aggregate budgets. This retires more risk than any
family-local benchmark, after the missing corpus manifest and gold fixtures are committed.

## 4. Verdict vocabulary and atlas sync

The current phrases cannot be synced without inventing state. `provisional`, `conditional`, `tie`,
and extraction's dual verdict are absent from A9. Until gates close, use `park`, with candidacy in a
separate note. If the probes pass, the lossless mappings are:

| Family | Family verdict | Atlas row mapping |
| --- | --- | --- |
| Storage | `bundle` | PGlite ledger `adapt`; DuckDB exact `adapt`; PGlite adjacency `adapt`; Oxigraph `adapt`; rest `park` |
| Embeddings | `pick-one` | Snowflake artifact `adopt`; native ORT service `adapt`; rest `park` |
| Input | per-stage `pick-one` | file-processing `adapt`; Unified `adopt`; winning PDF parser `adopt`; source-map service `adapt`; Wink Tokenization `already-have` |
| Reasoning | `pick-one` | EYE `adapt`; all other shipping candidates `park` |
| Extraction | `pick-one` | hybrid contract `adapt`; reused bricks `already-have`; broken incumbent adapters `park` |

Input still needs role-qualified atlas rows: `@beep/md` is `already-have` as a destination model but
`park` as a parser. A single unqualified Verdict column cannot state both.

## 5. Top three regrets

1. EYE WASM: every append or retraction triggers full translation/reasoning/proof decode; W1 crosses
   the time/RSS cap, or stale proof events survive because no invalidation transaction exists.
2. The storage bundle: PGlite commits while DuckDB/Oxigraph fail, queries observe different ledger
   epochs, restart rebuild exceeds five seconds, and deletion/compaction remains undefined.
3. Hybrid extraction: the LLM creates the apparent relation-quality win, then offline operation
   collapses to unmeasured patterns; replay cannot reproduce provider output and conflict nodes
   multiply without a stable claim identity.

Storage: REWORK.
Embeddings: REWORK.
Input: REWORK.
Reasoning: REWORK.
Extraction: REWORK.
