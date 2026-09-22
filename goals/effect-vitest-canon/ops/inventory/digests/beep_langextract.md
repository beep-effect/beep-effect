# @beep/langextract — P1 source audit digest

Root-reviewed P1 inventory; P2 remains gated.

Reviewed all 7 assigned census files, with 28 human rows: 6 review proposals and 22 coverage rows. Lens counts: resource 7, flake 7, property 7, observability 7. Severity: 22 info, 6 minor. 43 mechanical candidates remain open and unchanged.

Top files (four rows each; source-order tie, maximum ten):

- `packages/foundation/capability/langextract/test/Alignment.test.ts`: four lens rows, 2 review proposals; test, full lines 1–532.
- `packages/foundation/capability/langextract/test/Extraction.test.ts`: four lens rows, 1 review proposals; test, full lines 1–230.
- `packages/foundation/capability/langextract/test/Handoff.test.ts`: four lens rows, 0 review proposals; test, full lines 1–71.
- `packages/foundation/capability/langextract/test/Service.test.ts`: four lens rows, 1 review proposals; test, full lines 1–230.
- `packages/foundation/capability/langextract/test/TaggedError.equivalence.test.ts`: four lens rows, 0 review proposals; test, full lines 1–33.
- `packages/foundation/capability/langextract/test/VerifiedSpanHistory.test.ts`: four lens rows, 1 review proposals; test, full lines 1–691.
- `packages/foundation/capability/langextract/test/VerifiedSpanSpike.test.ts`: four lens rows, 1 review proposals; test, full lines 1–443.

Service has four named top-level layer blocks: deterministic model success, two deferred stalled models with default/provided timeout, and missing-policy denial. LanguageModel.make construction is separate from generateText; Effect.never is not executed in setup. The two clock subjects retain fork/adjust/join and their deterministic clocks. History uses real WebCrypto digest behind an injected service and test-local counting Ref, but persistence/restart means in-memory JSON encode/decode rather than disk or database restart. Other subjects are pure string/schema/projection operations. No layer-build speedup or provider execution is claimed.

Review proposals:

- `L-PROP-04` `Alignment.test.ts:371`: The generated maxExtractions law checks only two upper bounds, so an implementation returning [] for every batch passes that property. For the existing schema-valid count/cap domain, add exact length min(candidates.length,maxExtractions) and preserved prefix ordering as supported by alignCandidates, retaining both existing bounds and fcRuns(50). The fixed positive/default-cap tests remain; this is a weak generated oracle, not a claim the whole file is vacuous.
- `L-OBS-01` `Alignment.test.ts:340`: Both alignment generated callbacks throw expect and return true, then project only the Passed tag. Preserve the conditional aligned-span law as conditional; do not require ambiguous text to align. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and both fcRuns(50) calls while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.
- `L-OBS-01` `Extraction.test.ts:85`: Both wire-shape equivalences execute expect after nested runSync inside a direct native callback, hiding structured failure/replay context. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and fcRuns(50) while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.
- `L-PROP-04` `Service.test.ts:224`: The denial test promises no request reaches the provider but asserts only the eventual remote-policy-denied error. A regression that calls generateText before denying could still satisfy that assertion. Add a test-owned call recorder in the injected model and assert zero calls, preserving the typed denial and request unchanged. Current Service.layer.ts:54 guards before :56 generateText; this is missing regression protection, not a demonstrated leak.
- `L-OBS-01` `VerifiedSpanHistory.test.ts:687`: Twenty distinct tampered histories are folded into one A.every Boolean, so a regression reports true/false without identifying the violated invariant. Label each existing tamper case and assert its decode failure independently while retaining all twenty inputs and the real digest subject. Separately preserve fcRuns(25) persisted-failure property through the adapter formatter instead of only _tag. These changes add diagnostic identity, not relaxed rejection.
- `L-OBS-01` `VerifiedSpanSpike.test.ts:394`: The ordered-range callback uses Result.getOrThrow and expect before returning true, then only checks the result tag. Keep both range equivalences and all negative controls. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and fcRuns(50) while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.

Completed Root baseline: 97 passed, zero failed in the retained attempt; whole command 5.916917106 seconds, reporter span 5571.931885 ms (different boundaries). All assigned test files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. The inherited normal concurrency is enabled. No command or history collection was rerun. The single passing baseline does not prove coverage, package acceptance, absence of rare races or successful execution of conditional platform branches.

Hosted evidence: 20 mapped production coverage-ratchet observations across 4 jobs. The observations concern package statements and Alignment, Service, and VerifiedSpan production coverage, including new-file coverage identities and later floor regressions. They are not twenty failing tests. These are not unique flakes or causal introduced/inherited attribution. Campaign evidence covers 527 failed runs, with 21 unavailable logs and one unresolved cause. Timings are complete: 139 first attempts, 132 full-file-representation baselines, four configured subsets and three failures. Known failed cohorts elsewhere remain failures.

Proposed internal P2 order: scope → assertions → property → flake → observability. First preserve native subjects and test-local state; then retain all matcher operands/polarity, strengthen only the evidenced oracles, validate scheduling risks, and add precise failure context. All existing floors and hostile-input bounds remain. This lane authorizes no P2 work or waiver, and leaves the 90 inherited-main ratchet additions untouched.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; the adopted graph has 100 entries. Vitest 4.1.11 is the accepted timing runtime, not a claim that it satisfies rc113’s Vitest 5 peer declaration. Read receipts, source excerpts, complete rows, strict decoder results and input/output hashes are retained privately. Root has accepted these package rows.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
