<!-- Imported 2026-11-09 from the operator's machine-local agent-memory knowledge folder (PLAN v2 with pre-registered pass/kill criteria); machine-local paths replaced with descriptions. -->

# Validation plan v2: fast spikes with kill criteria (revised 2026-11-08 after three deep-research reports)

v1 is archived at a machine-local archive. v2 folds in the corrections table from the Opus report (a machine-local knowledge-folder file, "Corrections to the attachments and the brief") and the merged verdicts in the reconciliation report (machine-local). Spike numbers below use the Opus report's S-numbers so the two documents cross-reference.

## Ground rules (unchanged)

- Throwaway repo `the machine-local `memory-spikes` repository`, Bun + TypeScript, nothing lands in beep-effect. Python only where a spike reuses the paper's harness.
- Real local corpora, never synthetic-only: `the operator's Claude auto-memory folder/*.md`, `goals/*/history/reflections`, a machine-local knowledge-folder file, `the operator's Claude session-transcript folder/*/*.jsonl` transcripts, agent-authored Markdown commits in beep-effect.
- Local models only (sentence-transformers MiniLM, bge via ONNX, Qwen2.5-7B-Instruct via ROCm torch or llama.cpp for the cliff rerun).
- Every spike writes `spikes/<S>-<name>/REPORT.md` with the verdict against its kill criterion, the fixture counts, and the command to reproduce. Zero-failure results report the 3/n upper bound, not "0%".
- Hold about 300 fixtures per stratum where a 1% bound matters; 60 total fixtures bound nothing per type.

## Day 1 (three sessions in parallel)

### S1. L0 write boundary (replaces v1 spike 1's serialize step)
Claim: an unchanged tree projects to identical bytes, and an edit changes only the edited block's span.
- Build: micromark + mdast with raw source slices as canonical content; inter-block trivia owned by a node; BOM, line endings and final newline recorded; edits applied as span patches; projection by concatenation, never stringify. Comrak `--sourcepos` as a differential parser.
- Data: 200 agent-authored commits from beep-effect `goals/**/*.md` plus fixtures for frontmatter, CRLF, BOM, duplicate paragraphs, reference links, fenced code, tables, HTML, unknown extensions.
- Base-aware capture: diff each write against the exact exported base (bytes + id map), never the file on disk at write time. A copy gets a new id, a move keeps it, identical-duplicate ambiguity is flagged, never silently matched.
- Pass: 100% byte identity for unchanged trees; changed bytes confined to the edited span in ≥99.9% of replays.
- Kill: any unexplained byte change outside the edited span, or a concurrent insertion read as a deletion.

### S2. Rematch ground truth
Claim: a tiered resolver (handle → op capture → exact hash → clue-anchored similarity → mint with candidate edge) keeps false continuation under 1% and abstains on duplicates.
- Data: synthetic perturbations (split, merge, move+edit, reorder, duplicate, paraphrase), ≥300 per stratum, plus 100 hand-labelled real edits from the S1 commits. Score non-exact blocks only (a do-nothing exact-hash matcher already scores ~94–95% over all blocks).
- Pass: false-continuation upper bound <1% in every stratum; abstention <30% on single-block edits.
- Kill: >5% in any stratum with no fixable clue.

### S5. Attention cliff rerun (one day; settles the 120 figure)
Claim: the ~120-competitor collapse in `run_attention_full.py` is question loss from truncation.
- Build: rerun the paper's script with `max_length=32768`, no `fact_list[:500]`, question before AND after the facts, a token audit asserting the question and target survived, on Qwen2.5-7B-Instruct via ROCm torch (two R9700 32 GB) or llama.cpp.
- Sweep: 0, 50, 100, 150, 200, 300, 500, 1000 competitors; 3 positions; 3 seeds (reduced from the paper's 5 if time-bound).
- Pass (for the paper): a cliff remains near 80–160 facts with the question intact; the number survives for literal lookup on that one model only.
- Kill (for the number): no cliff to 1000, or the cliff tracks the token limit. Either way 120 leaves the design; the result budget stays rival/evidence/token-based and locally calibrated (S6 later).

## Day 2 morning (three sessions in parallel)

### S7. Lure strata: exact checks vs cross-encoder vs both (replaces v1 spike 3)
Claim: the status gate removes stale rivals; it does not remove plausible false candidates; a separate relevance stage does.
- Build: exact record from S1 output; retrieval = SQLite FTS5 + sqlite-vec fused by RRF; arms = RRF, cross-encoder (bge-reranker ONNX), gate, CE+gate, CE+gate+relevance (typed lookup where the query compiles, bounded entailment otherwise). The gate returns typed findings (`supported-by-record`, `stale`, `contradicted`, `unresolved-identity`, `unverifiable`, `occurred-at-span`), never a boolean.
- Data: 100 answerable queries; lures stratified ≥50 each: superseded facts, renamed symbols, near-miss (same entity other attribute, negation, qualifier), absent facts; plus 20 fixture violations the gate claims to prove.
- Pass: gate rejects 100% of fixture violations; CE+gate+relevance cuts lure acceptance ≥50% vs CE alone AND loses ≤2 points of true-answer recall, with abstention reported per stratum.
- Kill: the gate helps only on the superseded and renamed strata (as Opus predicts) and the relevance stage adds nothing; or any arm wins only by abstaining.

### S14 + S15. Per-node rebase vs Loro, and Loro at agent scale (replaces v1 spike 4)
Claim A: per-node CAS plus three-way merge auto-merges most agent writes without a CRDT. Claim B: Loro's movable tree holds up at agent scale.
- S14: trace of 200 sessions over 5,000 nodes; arms A per-node CAS + three-way merge, B Loro, C serial. Pass: A auto-merges ≥95% of conflicting writes with semantic conflict no worse than B and p95 boundary <200 ms → drop the CRDT on agent paths. Kill for A: retry rate >10% or >5% lost intent in 100 samples.
- S15: Loro with 5,000 and 50,000 nodes, 500 peer ids with churn, 100,000 commits; measure cold load, import p95, RSS, handshake size, commit-metadata survival across sync and shallow snapshots; 2–20 peers appending runs of 5–20 paragraphs offline to test sibling interleaving. Pass: cold load <1 s, import p95 <50 ms, no metadata loss, <1% interleaved or a section convention fixes it. Kill: handshake >1 MB and growing with lifetime peers; >5% interleaving with no fix.
- Provenance lives in the fact log, not in commit messages; the "second data structure" kill from v1 is gone because the log IS the design.
- Still run the two-peer rename-vs-link scenario from v1 as a smoke test; the dangling merge is unmeasured as an incident.

### S9 + S10. Observation log vs count, and cheap filters (replaces v1 spike 5)
- S9: 20 transcripts; naive count vs read-excluded count; repeat an old fact N∈{0,2,4,8} then update, with count in rank and in gate; three agents restate a planted false claim verbatim, reworded, typed authoritative. Pass: ≥10% of nodes with count ≥2 lose half their count when reads are excluded (the log is needed); `distinct_lineage_roots` stays 1 in all three restatement arms; count arms lose <5 points update adoption. Kill: <3% change (session-distinct counting suffices) or ≥10 points adoption loss (keep counts out of ranking).
- S10: hash, simhash and deferral gating over the same transcripts; false-suppression sample stratified by pairs differing only in numbers, paths, versions, symbols (identifier tokens go into the fingerprint). Pass: ≥60% removed, <2% false suppression overall and in the identifier stratum. Kill: identifier stratum >5% → near-dup filters flag only, never merge. Gates defer to tier 0, never drop.

## Day 2 afternoon

### S35. Symbol staleness (folded v1 spike 6)
`lat check -- <dir>` (no init needed) plus a tree-sitter normalized-AST span hash recorded at verification, plus scip-typescript; 50 beep-effect commits, 200 labelled symbol edges. Pass: the hash catches ≥50% of labelled drift lat misses with ≤30% false positives; SCIP resolves re-exports. Kill: hash false positives >50%, or <15% of memory nodes cite symbols at all.

### Scoreboard and direction memo
Orchestrator session: collect the REPORT.md files, write [`2026-11-08-validation-scoreboard.md`](./2026-11-08-validation-scoreboard.md) (Day 2 ran on 2026-11-08), and a decision-log entry for beep-effect only if the design survives. The reranker stays in every outcome; the gate is not the last stage; "Loro as the sync substrate" is licensed only if S14's arm A fails.

## Deferred (need a passing day-1/day-2 before they are worth the time)
S3 bypass census across six harnesses; S4 id-surface trial; S6 budget factorial (rivals × duplicates × tokens); S8 dedup at pair-fraction scale (alarm near 10⁻³ at cos≥0.95, calibrated locally); S13 revocation and bitemporal semantics; S19 relay load; S20 search engines; S21 authorization; S28 arrearage channel; S29 router vs search-all; S34 codec conformance; S36 proportional diff; S38 MCP memory binding. Full definitions in the Opus report.

## What a passing scoreboard licenses
- Raw-slice L0 boundary with sidecar identity and tiered resolution as the write boundary; store-side admission as the enforcement point.
- A set-union fact log as authority with Loro (human editing, structure) and per-node rebase (agent paths) as projections, per S14.
- The refined retrieval order with the gate's typed findings and a separate relevance stage.
- An observation log instead of prevalence counts; filters that defer, log and reverse.

## What a failing scoreboard means
- S1 fails → the Markdown surface cannot be lossless at the block level; agents write through an MCP write path only and files become read-only projections.
- S2 fails → similarity rematch is unusable even as last resort; every ambiguous edit mints, lineage is recovered by review.
- S5 shows a real cliff with the question intact → keep a literal-lookup competitor budget for that model class only; everything else unchanged. **Not triggered 2026-11-08:** S5 ran; no cliff to 1000 once the question stays in (175/180 at ~41k tokens). The cliff was question truncation at 4096. See [`2026-11-08-validation-scoreboard.md`](./2026-11-08-validation-scoreboard.md).
- S7 shows the relevance stage adds nothing → the gate stays an admissibility filter and the cross-encoder is the only relevance model.
- S14 arm A fails → Loro on agent paths too, with tentative/admitted states carried in the log. **Withdrawn 2026-11-08:** S14 ran; arm A missed the 95% bar (125/159) but held every contested node with zero silent loss, while Loro corrupted 48/70 of them. The fallback does not follow. See [`2026-11-08-validation-scoreboard.md`](./2026-11-08-validation-scoreboard.md).
- S9 shows counts are harmless → session-distinct counting is enough and the observation log is an audit nicety.
