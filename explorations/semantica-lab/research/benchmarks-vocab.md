# semantica benchmarks vocabulary skim (2026-08-24, T3)

Method (no clone): `gh repo list semantica-agi --limit 50` then
`gh api search/repositories?q=semantica+benchmarks` and
`q=semantica-benchmarks`. Sidecar URLs from PR #607 / commit `98cec956fe7e`.
Contents via GitHub contents API + `raw.githubusercontent.com` at the last
in-tree snapshot of the extracted tree (parent of the deletion commit).
Issue bodies for #570–#575 are cited only as **specified-not-landed** metric
names; they are not files of the recovered suite.

## Repository

| Field | Finding |
| --- | --- |
| name | `semantica-benchmarks` (claimed sidecar) |
| url (org, PR #607 summary) | `https://github.com/semantica-agi/semantica-benchmarks` — **HTTP 404** on 2026-08-24 (`gh api repos/semantica-agi/semantica-benchmarks`) |
| url (extraction commit) | `https://github.com/KaifAhmad1/semantica-benchmarks` — **HTTP 404** (`gh api repos/KaifAhmad1/semantica-benchmarks`) |
| org listing | `gh repo list semantica-agi --limit 50` returned only `semantica`, `.github`, `semantica-grant`. Search `semantica-benchmarks in:name` total_count **0**. |
| license | **UNVERIFIED** (no sidecar `LICENSE` readable). Parent tree `LICENSE` at snapshot `b42fbd978fba0086c693751d13ece9dcc8fd2922` is MIT, Copyright (c) 2026 Hawksight AI — that is the *source-tree* license, not a sidecar LICENSE file. |
| last push date | **UNVERIFIED** for the sidecar. Last in-tree snapshot of the 56 extracted files: parent `b42fbd978fba0086c693751d13ece9dcc8fd2922` of deletion commit `98cec956fe7e` (2026-06-10T12:46:45Z); PR #607 merged 2026-06-10T12:58:00Z. Issue #570 closed with comment "Shifted Benchmarks to new repo" (2026-06-15T07:15:55Z, KaifAhmad1). |
| star count | **UNVERIFIED** (repo not found). Org public stars the same day: `semantica` 10647, `.github` 0, `semantica-grant` 1. |

**What was actually extracted (#607, 56 files, 22636 deletions).** A
pytest-benchmark *performance* suite under `benchmarks/`, documented as
"Semantica Performance Benchmark Suite" in `benchmarks/benchmarks.md`.
Directories at the snapshot: `context/`, `context_memory/`, `core_processing/`,
`export/`, `infrastructure/`, `input_layer/`, `normalize/`, `ontology/`,
`output_orchestration/`, `quality_assurance/`, `results/`, `storage/`,
`visualization/`. **Not present:** `decision_intelligence/`,
`temporal_provenance/`, `memory_context/`, `structural_intelligence/`,
`module_tracks/`, `context_graph_effectiveness/`, `datasets/`, `fixtures/`,
or any JSON Schema under `fixtures/schema/`.

`benchmarks/infrastructure/test_git_lfs_pointers.py` still
`pytest.mark.skip(reason="Module track directories not yet created (#575)")`
and skip `"LFS dataset registry not yet implemented (#575)"`. PR #580
(pillar-1 tracks, 30 files) is **closed unmerged** (closed 2026-06-11). The
35-track epic therefore did not land in the 56 extracted files.

## Metric vocabulary

Recovered-suite metrics are pytest-benchmark timings. Quality names from
#570–#575 are **issue text only** (no matching file in the recovered tree).
Definitions ≤ 25 words; quotes ≤ 12 words.

| metric name | definition as stated (≤ 25 words; quote ≤ 12) | inputs it needs | file path |
| --- | --- | --- | --- |
| `stats.mean` | Mean wall-clock seconds per timed call. Columns requested as `"--benchmark-columns=min,mean,stddev,ops"`. | pytest-benchmark timings of the callable; **no gold labels** | `benchmarks/benchmarks_runner.py`; `benchmarks/results/run_20260207_14_53_36.json` |
| `stats.min` / `stats.max` | Extremal seconds across rounds. Human table headers "Min Time (ms)" / "Max Time (ms)". | same timings | `benchmarks/benchmark_results.md`; result JSON `stats` |
| `stats.stddev` | Sample standard deviation of round times; also the denominator of the compare Z-score. | same timings | result JSON `stats.stddev`; `benchmarks/infrastructure/compare.py` |
| `stats.ops` | Inverse of mean: operations per second. Human table "Operations/sec". | same timings | result JSON `stats.ops`; `benchmarks/benchmark_results.md` |
| `stats.median` / `q1` / `q3` / `iqr` | Robust location/spread of the round sample (pytest-benchmark extras). | same timings | result JSON `stats` |
| Change % | `((m2 - m1) / m1) * 100` vs baseline mean. Docs: "Regression: Change > 15% AND Z-score > 2.0." | current + baseline `stats.mean` | `benchmarks/infrastructure/compare.py` (code default `threshold_pct=10.0`); `benchmarks/benchmarks.md` |
| Sigma (Z) | `(current_mean - base_mean) / base_stddev`; "how many standard deviations away current run is from baseline" | current mean + baseline mean/stddev | `benchmarks/infrastructure/compare.py` `calc_z_score` |
| Status `REGRESSION` / `NOISE` / `IMPROVED` / `OK` / `NEW` | Fail if `delta_pct > threshold` **and** `abs(z) > 2.0`; else noise/ok; missing name is NEW. | paired benchmark names | `benchmarks/infrastructure/compare.py` |
| Jaccard similarity (speed only) | `SemanticAnalyzer.calculate_similarity(..., method="jaccard")`; assert `0.0 <= result <= 1.0`. Not a published IR metric. | two raw strings | `benchmarks/core_processing/test_extraction.py` `test_similarity_calculation` |
| NER presence checks | Weak type/string checks (`"Apple"`+`ORG`, `PERSON`, `GPE`/`LOC`, `DATE`) after spaCy extract. | raw text + predicted `Entity` list | `benchmarks/core_processing/test_extraction.py` `test_ner_ml_real_performance` |
| MRR | Issue: `MRR = (1/\|Q\|) × Σ_q (1 / rank_q)` — "Mean Reciprocal Rank". | gold ranked lists + predictions | **not in recovered tree**; specified in issue #571 (German Credit) and #574 (filtered KGC) |
| nDCG@10 | Issue: `nDCG@10 = Σ_i (rel_i / log2(i+1)) / ideal_DCG`. | gold relevance grades + ranked preds | **not in recovered tree**; #571 CUAD, #573 hybrid alpha |
| Graph lift | Issue: `nDCG@10(graph-assisted) − nDCG@10(BM25-flat)` / hybrid minus pure endpoints. | two nDCG runs | **not in recovered tree**; #571, #573 |
| Causal precision / recall | Issue: intersection of retrieved vs `gold_ancestors` over retrieved / gold. | gold ancestor sets + retrieved ids | **not in recovered tree**; #571 ATOMIC 2020 |
| Influence recall@D / spurious rate | Issue: found∩gold / \|gold\| at depth D; false positives / found. | gold influenced-decision sets | **not in recovered tree**; #571 |
| Clause-level F1 / FNR | Issue: harmonic P/R on clauses; `FNR = FN / (FN + TP)` **"Hard gate metric."** | gold clause/violation labels + preds | **not in recovered tree**; #571 LEDGAR/CUAD |
| Pairwise F1 / B-Cubed P/R | Issue: pair-level harmonic F1; cluster purity / completeness vs `gold_cluster(e)`. | gold duplicate clusters + predicted clusters | **not in recovered tree**; #574 DBLP-ACM etc. |
| Hits@1 / Hits@10 (filtered) | Issue: fraction of queries with the correct triple in top-1 / top-10. | gold triples + ranked candidates | **not in recovered tree**; #574 FB15k-237/WN18RR |
| Macro-F1 / Micro-F1 | Issue: unweighted mean F1 across relation types; instance-weighted F1. | gold relation labels + preds | **not in recovered tree**; #574 SemEval 2010 |
| Entity span F1 | Issue: "overlap between predicted and gold entity boundaries". | gold spans + predicted spans | **not in recovered tree**; #574 NYT10 |
| DocRED Ign-F1 / Re-DocRED F1 | Issue: F1 excluding train-seen inter-sentence relations; revised-label F1. | gold doc-level triples + preds | **not in recovered tree**; #574 |
| REBEL end-to-end F1 | Issue: exact-match triple F1: "subject, relation, and object must all be correct." | gold `(s,r,o)` + predicted triples | **not in recovered tree**; #574 |
| Detection F1 | Issue: harmonic P/R of conflict detection. | gold conflict pairs + preds | **not in recovered tree**; #574 WikiContradict |
| gap count / overlap count | Issue: revision pairs with `valid_until[v] < valid_from[v+1]` / `>`; must be 0. | ordered revision windows | **not in recovered tree**; #572 |
| W3C PROV-O SPARQL violations | Issue: count of integrity queries with non-empty result; hard gate = 0. | provenance RDF + SPARQL suite | **not in recovered tree**; #572 |
| alpha=0.5 hard gate | Issue: hybrid nDCG@10 must beat alpha 0.0 **and** 1.0. | nDCG at three alphas | **not in recovered tree**; #573 |

## Result/report shape

Runner (`benchmarks/benchmarks_runner.py`) shells pytest with
`--benchmark-only --benchmark-json=benchmarks/results/run_{YYYYMMDD}_{HH}_{MM}_{SS}.json`.
It does **not** emit a custom schema. Compare reads that pytest-benchmark JSON
(`benchmarks/infrastructure/compare.py`). Human markdown
`benchmarks/benchmark_results.md` is a separate hand-written table (ops/sec,
mean/min/max ms, stddev, Status ✅/⏭️), not generated by the runner.

Emitted JSON (pytest-benchmark **5.2.3**), cited from
`benchmarks/results/run_20260207_14_53_36.json` (391961 bytes, 135
`benchmarks` rows). Sibling `run_20260207_14_52_38.json` is an **empty blob**
(size 0, git sha `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`).
`run_20260207_15_19_53.json` is a second populated run (314466 bytes).
**No `baseline.json`** in the snapshot. Docs tell operators to
`cp …/run_latest.json …/baseline.json` (`benchmarks/benchmarks.md`) — that
filename is also not in the tree.

Top-level fields:

```
{
  "machine_info": { node, processor, machine, python_compiler,
                    python_implementation, python_implementation_version,
                    python_version, python_build, release, system, cpu{...} },
  "commit_info":  { id, time, author_time, dirty, project, branch },
  "datetime":     "<ISO-8601>",
  "version":      "5.2.3",
  "benchmarks": [ { ... } ]
}
```

Each `benchmarks[]` item:

```
{
  "group":      "<str or null>",
  "name":       "<function[param]>",
  "fullname":   "benchmarks/<dir>/<file>.py::<name>",
  "params":     { <param>: <value> } | null,
  "param":      "<display>",
  "extra_info": null,          // unused in this run
  "options":    { disable_gc, timer, min_rounds, max_time, min_time, warmup },
  "stats": {
    min, max, mean, stddev, rounds, median, iqr, q1, q3,
    iqr_outliers, stddev_outliers, outliers, ld15iqr, hd15iqr,
    ops, total, data[/* rounds floats */], iterations
  }
}
```

Compare table columns (not written to JSON): `Benchmark`, `Change %`,
`Sigma (Z)`, `Status`. Exit 1 on any `REGRESSION` when `--strict` is passed
to the runner. Compare's Python default threshold is **10%**, while
`benchmarks/benchmarks.md` documents **15%**.

CSV: none in the recovered tree.

Adjacent, **not this repo**: open PR #1090 (`pkupt/semantica` sha
`49cf5b1df79d9e125eb2e8202e5fed25de28e547`) defines in-tree dataclasses
`EvalMetric {score, passed, meta}`, `CaseResult {case_id, status, metrics, details}`,
`EvalSummary {total, passed, failed, errors, pass_rate, cases}` and evaluators
`exact_match`, `regex_match`, `numeric_range`, `temporal_range`, `length_range`,
`keyword_check`, `levenshtein`, `rouge`, `llm_as_judge`, `decision_scores`.
`main` still ships `semantica/evals/__init__.py` as `"Coming Soon"`. T3 does
not treat #1090 as the relocated suite.

## Gold-label conventions

**Recovered suite: no gold sets.** There is no `datasets/` directory, no
`fixtures/` directory, no `fixtures/schema/` JSON Schema at snapshot
`b42fbd978fba0086c693751d13ece9dcc8fd2922`. `benchmarks.md` uses "gold standard"
to mean the **previous timing JSON** (`baseline.json`), not labeled spans or
triples.

Synthetic structures used only to keep timed calls from crashing:

- **Entity (char spans on a Python `str`, not UTF-16 CanonicalText):**
  `Entity(text=..., label="ORG", start_char=..., end_char=..., confidence=0.98, metadata={...})`
  with `medium_text[e.start_char:e.end_char] == e.text`
  (`benchmarks/core_processing/test_extraction.py`). Labels seen: `ORG`,
  `PERSON`, `GPE`/`LOC`, `DATE`, `UNKNOWN`. The "expected" list is **injected
  via `patch` of `get_entity_method`** then asserted back — not an external gold
  file.
- **Conflict/merge dicts:** `{id, name, type, confidence, properties, relationships:[{source, target, type}]}`
  (`benchmarks/quality_assurance/test_conflicts.py`). All 100 rows share
  `id="e_1"` to force merge work.
- **ER clusters / dirty relationships:** generated in-process by
  `generate_entity_cluster` / `generate_relationship_dataset`
  (`benchmarks/quality_assurance/test_deduplication.py`). Thresholds
  (`similarity_threshold=0.8`, `"threshold": 0.85`) are **speed-test knobs**,
  not published baselines.
- **Triples:** `SimpleTriplet(subject="http://gandhara.org/entity/{i}", predicate="http://gandhara.org/relation/knows", object="http://example.org/entity/{i+1}")`
  (`benchmarks/storage/test_triplet_storage.py`). No gold graph to score
  against; asserts are counts (`len(graph) >= 1000`, SPARQL `bindings == 50`).
- **Chunks:** `SlidingWindowChunker(chunk_size=500, overlap=50)` then
  `assert len(result) > 0` — **no span gold**
  (`benchmarks/input_layer/test_splitting.py`).

**#570–#575 issue text (specified, not in recovered files)** would have used:
gold precedent pairs (German Credit), clause annotations (CUAD/LEDGAR), causal
triples (ATOMIC 2020 / e-CARE), gold ancestor / influenced-decision sets,
bitemporal revision windows, ER pair/cluster labels (DBLP-ACM, …), filtered
KGC triples (FB15k-237, WN18RR), relation labels + **entity spans** (SemEval
2010, NYT10, DocRED, REBEL), contradiction pairs (WikiContradict), W3C PROV-O
positive/negative entailment tests, ERASER token rationales. Epic Rule 5:
quality F1/MRR/recall/precision/accuracy "must be measured by calling a real
Semantica module API against a real downloaded public dataset" and
"Synthetic fixtures … never as the primary signal for a quality metric"
(issue #570). That rule was not implemented in the extracted tree.

## What our EvalReport should borrow (T3 ruling: metric names only)

- **Entity span F1** (issue #574, NYT10: "overlap between predicted and gold entity boundaries") → **EvalReport** metric on **Entity** + **CanonicalText spans**. Name only; do not import their datasets as W1 gold.
- **REBEL end-to-end triple F1 / Macro-F1** (issue #574: subject, relation, and object must all be correct) → **EvalReport** metric on **Statement**.
- **Pairwise F1 + B-Cubed P/R** (issue #574 vs `gold_cluster(e)`) → **EvalReport** metric on **Entity** (cluster identity, not span-less string match).

### Rejected observations (not adopted; recorded for the atlas only, per T3)

T3 limits adoption to the three metric names above. The following shapes were observed in the recovered harness and are NOT EvalReport requirements. Note `commit_info.id` is a code revision, not a corpus or gold-set hash.

- (rejected) **`commit_info.id` + `datetime` (result JSON)** → **EvalReport** corpus-hash / gold-version slot (replay identity). Bind a report to a tree; do not copy `machine_info.node`.
- (rejected) **Per-row `name` / `fullname` + `stats.{mean,ops,min,max,stddev}`** → **EvalReport** `per-metric results` and `budgets observed` (latency/throughput as budgets, not correctness).
- (rejected) **`Entity.start_char` / `end_char` / `text` / `label` / `confidence`** (`test_extraction.py`) → **Entity** surface forms + **CanonicalText spans** (re-ground offsets as UTF-16 against CanonicalText; their fixture uses Python-str indices).
- (rejected) **`SimpleTriplet` `{subject, predicate, object}` IRIs** (`test_triplet_storage.py`) and relationship `{source, target, type}` → **Statement** (RdfTerm slots, not plain strings).
- (rejected) **Conflict dicts `{id, type, confidence, properties, relationships}`** (`test_conflicts.py`) → **EvidenceBatch / EvidenceClaim** (observed claims with branded confidence; keep conflicts as separate claims, do not fold via `MERGE_ALL` / `KEEP_HIGHEST_CONFIDENCE`).

## What we should NOT borrow

Max 5.

- **`stats.ops` / mean latency as semantic quality.** `benchmarks.md` is a "Performance Benchmark Suite"; isolation principle is "Use of mocks to ensure benchmarks measure algorithm logic." That is not G-entity/G-relation correctness.
- **"Gold standard" = previous `baseline.json` timings** (`benchmarks.md` "Updating Baseline"). Rewards self-agreement with last night's clock, not labeled spans.
- **Mocked NER that injects `expected_entities` then asserts them** (`test_ner_ml_wrapper_overhead`). Rewards self-agreement; the patch *is* the prediction.
- **Chunk/split tests with `assert len(result) > 0` and no gold spans** (`test_splitting.py`). Metrics that assume no spans fail CanonicalText / C0.
- **Issue-text F1/MRR thresholds as shipped gold, and the #573 alpha=0.5 hard gate.** Those tracks never landed in the 56 extracted files (LFS test still skips missing dirs; PR #580 unmerged). Copying CUAD/LEDGAR/FB15k numbers into EvalReport would invent a corpus T3 forbids changing.

## Verdict for T3

No. The relocated sidecar is **not fetchable** (both claimed URLs 404; absent from the org list), and the last committed tree it extracted (`b42fbd978fba0086c693751d13ece9dcc8fd2922`, PR #607's 56 files) is a pytest-benchmark throughput harness whose runner writes pytest-benchmark 5.2.3 JSON (`machine_info` / `commit_info` / `benchmarks[].stats.{min,mean,stddev,ops,…}`) and whose compare step treats a prior timing file as "Gold standard JSON" (`benchmarks/infrastructure/compare.py`, `benchmarks/benchmarks.md`). It does **not** ship G-structure, G-entity, G-relation, or G-entailment gold: no `datasets/`, no `fixtures/`, NER spans are synthetic `start_char`/`end_char` on a mocked extractor (`benchmarks/core_processing/test_extraction.py`), triples are generated IRIs (`benchmarks/storage/test_triplet_storage.py`), and split tests assert only non-empty chunks (`benchmarks/input_layer/test_splitting.py`). The #570–#575 quality vocabulary (MRR, nDCG@10, entity span F1, triple F1, B-Cubed, PROV-O violation count, FNR≤0.05) exists only in issue bodies and unmerged PR #580; `test_git_lfs_pointers.py` still skips because those module-track directories were never created. That does not amend the workload contract's gold sets. Optional later: reuse *names* (entity span F1, exact-match triple F1, B-Cubed) on **our** gold, and reuse `commit_info`-style run binding on EvalReport — naming and replay, not their corpora.
