# @beep/file-processing — P1 source audit digest

Root-reviewed P1 inventory; P2 remains gated.

Reviewed all 4 assigned census files, with 16 human rows: 5 review proposals and 11 coverage rows. Lens counts: resource 4, flake 4, property 4, observability 4. Severity: 11 info, 5 minor. 76 mechanical candidates remain open and unchanged.

Top files (four rows each; source-order tie, maximum ten):

- `packages/foundation/capability/file-processing/test/FileProcessing.test.ts`: four lens rows, 2 review proposals; test, full lines 1–387.
- `packages/foundation/capability/file-processing/test/PathSafety.test.ts`: four lens rows, 2 review proposals; test, full lines 1–255.
- `packages/foundation/capability/file-processing/test/SourceText.test.ts`: four lens rows, 1 review proposals; test, full lines 1–182.
- `packages/foundation/capability/file-processing/test/TaggedError.equivalence.test.ts`: four lens rows, 0 review proposals; test, full lines 1–65.

FileProcessing serviceLayer uses a synthetic engine plus BunCrypto, not a real PST parser. Its private wrapper builds/scopes the layer per use. PathSafety provides Bun filesystem/path per test and acquires each temporary root in the inner scope. Native symlink, permission, rename and cleanup behavior must remain; MemoryFS substitution would erase the security subject. No measured layer-sharing speedup is available. SourceText and error equivalence are pure values.

Review proposals:

- `L-PROP-04` `FileProcessing.test.ts:161`: The artifact/operation round-trip law compares full SourceArtifact re-encoding, but only operationKind for decoded ExtractFileOperation and ProcessFileOperation. A decoder that discards preference/exportChildren/operationId/source data while retaining the literal tag passes those two checks. Add production-schema equivalence or complete re-encoding equality for each operation, retaining all existing ID/tag checks and fcRuns(50).
- `L-OBS-01` `FileProcessing.test.ts:157`: Eight manual generated checks throw assertions or nested runSync failures inside callbacks and retain only result._tag; JSON-codec equality and path containment failures need their exact generated values. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and all existing fcRuns(50) calls while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.
- `L-RES-04` `PathSafety.test.ts:23`: Keep real filesystem and Path services for symlink containment, mode 0600, atomic promotion and cleanup. Each temp root is scoped within its test and instrumented services delegate to native fs; MemoryFS would remove the subject. Preserve per-test roots and finalizers when reviewing outer layer reuse. This is a documented native-boundary review, not a request to acquire new resources.
- `L-OBS-03` `PathSafety.test.ts:227`: The POSIX-only backslash case returns successfully before any assertion when path.sep is not /. Use an explicit platform skip/registration condition with a visible reason while preserving the complete POSIX body; a reported pass should not be mistaken for execution of that security subject on another platform. This audit does not rerun it.
- `L-OBS-01` `SourceText.test.ts:132`: The relational property throws expect in a direct native callback; the later generation-link property retains only result._tag. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and both fcRuns(50) calls while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.

Completed Root baseline: 27 passed, zero failed in the retained attempt; whole command 5.765937726 seconds, reporter span 5403.964111 ms (different boundaries). All assigned test files are represented. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. The inherited normal concurrency is enabled. No command or history collection was rerun. The single passing baseline does not prove coverage, package acceptance, absence of rare races or successful execution of conditional platform branches.

Hosted evidence: 3 mapped production coverage-ratchet observations across 1 jobs. SourceText.schema.ts functions 87.5, lines/statements 93.75 were below 100 in the retained job. These are not unique flakes or causal introduced/inherited attribution. Campaign evidence covers 527 failed runs, with 21 unavailable logs and one unresolved cause. Timings are complete: 139 first attempts, 132 full-file-representation baselines, four configured subsets and three failures. Known failed cohorts elsewhere remain failures.

Proposed internal P2 order: scope → assertions → property → flake → observability. First preserve native subjects and test-local state; then retain all matcher operands/polarity, strengthen only the evidenced oracles, validate scheduling risks, and add precise failure context. All existing floors and hostile-input bounds remain. This lane authorizes no P2 work or waiver, and leaves the 90 inherited-main ratchet additions untouched.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; the adopted graph has 100 entries. Vitest 4.1.11 is the accepted timing runtime, not a claim that it satisfies rc113’s Vitest 5 peer declaration. Read receipts, source excerpts, complete rows, strict decoder results and input/output hashes are retained privately. Root has accepted these package rows.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
