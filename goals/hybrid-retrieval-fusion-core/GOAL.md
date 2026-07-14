# GOAL: deliver deterministic hybrid retrieval fusion

Repo root is the current `beep-effect` checkout. Use repo-relative paths.

Outcome: one fixture-driven `@beep/nlp-processing` seam accepts semantic,
lexical FTS, literal, and optional graph ranked channels and emits stable,
span-bearing candidate evidence with weighted-RRF contribution diagnostics;
`ClaimGate` remains the only admission path.

Read first:

- `goals/hybrid-retrieval-fusion-core/README.md`
- `goals/hybrid-retrieval-fusion-core/SPEC.md`
- `goals/hybrid-retrieval-fusion-core/PLAN.md`
- `goals/hybrid-retrieval-fusion-core/ops/manifest.json`
- `goals/hybrid-retrieval-fusion-core/research/SOURCES.md`
- `AGENTS.md`, `CLAUDE.md`, and standards named by the spec

Scope:

- In: live symbol/topology audit; migration parity for the sibling-checkout
  `RrfScorer.ts` and test; ranked-channel/result schemas; weighted RRF;
  empty-channel renormalization; deterministic literal tier/floor and ties;
  duplicate-ID contribution accounting; verified `TextAnchor` preservation;
  diagnostics; focused tests and ClaimGate-boundary proof.
- Out: storage/projection extensions, live encoders, ingestion, semantic
  evidence dedup, citation BFS/producers, model mixing/calibration, BM25 naming
  for `ts_rank_cd`, new external dependencies, `@beep/retrieval`, satellite
  scaffolds, package sources outside the ratified placement, and
  `goals/INDEX.md`.

Workflow:

1. Preserve unrelated worktree changes and inspect the source exploration.
2. Execute P0 before creating implementation symbols: search live source and
   barrels, audit package topology, and record reuse versus net-new placement.
3. Inventory and behaviorally migrate
   `../beep-effect4/packages/knowledge/server/src/GraphRAG/RrfScorer.ts` and its
   test. Establish parity for every prior test before extending behavior.
4. Implement the smallest schema-first/Effect-first fusion surface in
   `@beep/nlp-processing`; reuse `TextAnchor` and admission contracts.
5. Prove configured/effective channel weights, one-based `k=60` components, and
   each named weighted contribution sum exactly to the fused score.
6. Run the ratified fixtures: empty channel, fuzzy consensus versus exact
   phrase, duplicate IDs, stable equal-score ties, and pre-verified anchor.
7. Prove the result is candidate/evidence only, cannot encode admission, and
   still requires `ClaimGate`.
8. Keep vector/encoder/dedup/citation satellites queued. At P3, write a
   reflection and drive the PR to mergeable through Yeet.

Acceptance:

- [ ] Every prior scorer test has passing behavioral parity.
- [ ] Every ratified fixture and optional graph contract passes deterministically.
- [ ] Contributions are exposed and sum to each fused score.
- [ ] Output preserves spans and cannot bypass `ClaimGate`.
- [ ] Focused package/repo/Yeet proof passes with no unrelated churn.

Verification:

```sh
test "$(wc -m < goals/hybrid-retrieval-fusion-core/GOAL.md)" -le 4000
jq . goals/hybrid-retrieval-fusion-core/ops/manifest.json
git diff --check -- goals/hybrid-retrieval-fusion-core
```

Stop before widening into a satellite, a new package, external dependency,
public contract beyond the spec, or weakened admission. Done only when the PR
is mergeable through Yeet or a blocker is reported with file/command evidence.
