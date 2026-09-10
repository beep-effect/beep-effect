# PR #1067 historical delta completion

Status: in progress.

Scope: offline reconciliation of retained pre-resumption 7417-to-7580 rows and 1075-to-1101 census inputs. This does not approve current final canonical writes, timing acceptance, Grok review, or phase completion. Live sources and other lanes' work are outside this report.

- Started bounded read-only attribution; outputs restricted to this report and `~/.cache/beep/effect-vitest-canon/pr1067-resume/historical-delta-completion/`.

- Verified both accepted payload hashes, all 419 current and 391 known historical source snapshots, 1,799 retained node/statement preimages, and exact source-hunk reconstruction. No live source comparison was performed.
- Rejected 11 unsafe coordinate correspondences, including crossed property schemas; completed context-based and individually reviewed replacements without transferring reasons or waivers.
- Completed row/census coverage. Eight evidence blockers remain; terminal findings follow.

## Terminal result

Status: bounded offline reconciliation complete **with eight evidence blockers**. Every retained row and all 419 affected census paths have machine-readable classifications. This is completion of the **PRE-RESUMPTION immutable 7417-to7580 reconciliation**, not a claim that the repaired PR's final source or canonical artifacts are accepted.

Private artifacts: `~/.cache/beep/effect-vitest-canon/pr1067-resume/historical-delta-completion/`.

| Coverage | Result |
| --- | --- |
| Historical / then-current rows | 7,417 / 7,580 |
| Unclassified rows / duplicate assignments | 0 / 0 |
| Exact full-payload pairs | 3,311 |
| Stable membership; only id/line/endLine changes | 3,288 |
| Expression/context pairs | 816: 800 verified coordinate/context pairs, 11 unique context repairs, 5 individually reviewed renamed-test pairs |
| Explicit cross-rule replacement | 1: EV001 runtime boundary → EV009 live test |
| Removed candidate | 1: Number test raw Vitest import replaced by `@effect/vitest` |
| Introduced candidates | 164 |
| Unexplained row losses / unresolved row classifications | 0 / 0 |
| Affected row files / census paths | 353 / 419 |
| Census additions / changes / removals | 26 / 393 / 0 |
| Unclassified census paths | 0 |
| Outstanding evidence blockers | 8 |

The arithmetic is exact: 6,599 + 816 + 1 + 1 = 7,417 historical rows; 6,599 + 816 + 1 + 164 = 7,580 then-current rows. Independently recomputed ID deltas remain 4,069 added, 3,906 removed, and 200 changed; these are not counts of newly introduced semantic findings.

`rows-classified.json` retains complete before/after payloads, presence-aware field differences, exact omitted-field lists and structural views alongside full rows. Changed-expression pairs retain verified node and enclosing statement text, labels and expression diffs. `files-and-census-classified.json` provides all affected paths, exact source hunks, imports, added/removed declaration names, census metadata, source identities, provenance categories and row references. Structural equality never means full-payload equality. No prior reason, acceptance, or waiver transfers automatically.

## Attribution findings

The partial source mapper preserved leading tokens but sometimes crossed test boundaries. Eleven correspondences were rejected before classification. In chat schema parity, the old `AttachmentRejection` property had been paired with `ComposerFeatures`; exact property-schema and context matching restores both properties. Five decoder assertion changes in Contradiction/HTML tests retain their precise named test contexts while replacing inline/local decoders with hoisted schema-specific helpers. The paired expressions and file declarations document those substitutions.

Scheduler journal tests now include enqueue/withdrawal events, v3 attribution and nonce/branch/checkout assertions. The interrupted waiter test replaces a fixed sleep with repeat/timeout waiting. Two retained journal assertions and two runtime calls were reviewed under explicit renamed-test mappings. The atomic-reap test changes from `it` + `Effect.runPromise` to `it.live` + `Effect.gen`: this removes EV001 and introduces EV009, rather than preserving one identity.

The CI security provider remains `provideScopedLayer(NodeServices.layer)` while its test changes from workflow-YAML assertions to isolated job-environment scenarios. Other introduced contexts cover CLI scaffolding, projections, scheduler compatibility, artifact generation, worktree removal, and filesystem conformance/characterization. Exact labels, candidate expressions, helper contexts and source edits are in the ledgers.

Of 164 introduced rows, 75 occur in added census paths, 83 in added named contexts, three in exact new expression hunks, and three require explicit context analysis: a new malformed-worktree `it.live`; an unchanged raw Vitest import newly accompanied by `import { pipe } from "effect"`; and an additional Freshbooks `layer(AuthLayer(expiredToken))` invocation for cancellation/persistence behavior. The last case increases the exact invocation count by one; it is not justified merely by file movement.

## Census and evidence limits

The retained census is 1,075 → 1,101, ending at 991 tests and 110 support files. All 393 changed entries change bytes; 368 change line counts. No retained owner or kind changes occur. Current snapshot byte counts and logical line counts agree for all 419 affected paths. All then-current support rows emit only EV003. These checks establish retained output consistency; they do not independently re-run detector predicates or prove absence of every possible false negative.

All 26 additions are individually recorded, including filesystem promotion tests, new main tests/support, the runner seam, and generated declarations. The literal `**/test/**/*.ts` discovery includes `dist/test/*.d.ts`; generated declarations were not excluded. Of 28 paths without known historical source bytes, 26 are census additions. The other two already existed:

- `packages/tooling/tool/cli/dist/test/Quality.test-kit.d.ts`
- `packages/tooling/tool/cli/dist/test/SharedInternals.test-kit.d.ts`

Their missing historical source bytes are **two blockers**, not proof that those paths are new or semantically unchanged.

Five further blockers expose different historical cohorts. Retained historical census bytes/lines versus accepted historical snapshot bytes/lines are:

| Path (package-relative) | Census | Accepted snapshot |
| --- | --- | --- |
| test-utils `test/Vitest.runtime.test.ts` | 11,946 / 264 | 13,150 / 287 |
| repo-cli `test/effect-vitest-contract.test.ts` | 7,793 / 190 | 14,768 / 325 |
| repo-cli `test/effect-vitest-detectors.test.ts` | 13,468 / 324 | 38,975 / 881 |
| repo-cli `test/effect-vitest-primitives.test.ts` | 17,730 / 413 | 19,911 / 447 |
| repo-cli `test/effect-vitest-store.test.ts` | 2,550 / 60 | 2,618 / 60 |

The accepted snapshots pass their declared hashes. These mismatches therefore remain explicit census-to-source cohort proof gaps, not alleged snapshot drift. No historical baseline was rewritten.

The retained implementation comparison records eight unchanged detector/graph source hashes and an unchanged primitives manifest. Its artifact identity is verified, but those implementation source bytes are not present in the supplied affected-source snapshot tree. `Lint.errors.ts` has differing retained hashes; without its two snapshots, independently checking its semantic effect is impossible within the supplied inputs. That is the **eighth blocker**. `implementation-assessment.json` distinguishes hash-receipt evidence from directly verified source bytes.

## Integrity and handoff

Recomputed historical payload SHA-256: `cf19e201b7a2bca2c100e21bbaff59b78a92a622a04e11c0970cea4e4a8b772c`.

Recomputed then-current payload SHA-256: `8a065f795274868f33d0eae90d313c158f57e47f50475350b5a1dd7f68769d0f`.

`inputs-before.json` and `inputs-after.json` cover only retained files actually read. Current preview JSONL payloads equal the retained then-current row array. Retained scope and input before/after JSONs agree. All 954 used artifacts covered by the original pre-pause hash inventory match it. This does not revalidate paths in the mutating worktree named by those historical inventories.

`terminal-verification.json` records final input/output checks and unexpected drift; `outputs-manifest.json` hashes every new report/artifact/script except itself; `outputs-manifest.sha256` closes that non-self-referential chain. The terminal report hash is recorded in both terminal verification and the output manifest.

Ongoing PR repair source changes require a later small delta review. This result grants no current canonical-write approval, timing acceptance, Grok review closure, aggregate proof acceptance, or phase completion. The eight evidence blockers remain for Root; the old partial report and artifacts were preserved.

## Evidence supplement — 2026-09-09

**Supplement complete: six original proof gaps resolved; two historical input-record limitations retained.** None of these eight items remains, by itself, a blocker to evaluating a new complete source-bound baseline. This is not canonical-write approval. The earlier eight-blocker conclusion above remains unchanged as the dated finding from the evidence then available.

Scope remains the **pre-resumption 7,417 → 7,580 cohort**, not the currently repaired source. New receipts are under `~/.cache/beep/effect-vitest-canon/pr1067-resume/historical-delta-supplement-review/`. The original report prefix and all previous private outputs are preserved.

### Disposition of each original blocker

| Original path | Supplement disposition |
| --- | --- |
| test-utils `test/Vitest.runtime.test.ts` | Resolved: exact older census preimage and intervening accepted runner-test changes verified |
| repo-cli `test/effect-vitest-contract.test.ts` | Resolved: exact older preimage and occurrence/exception contract additions verified |
| repo-cli `test/effect-vitest-detectors.test.ts` | Resolved: exact older preimage and detector regression fixture additions verified |
| repo-cli `test/effect-vitest-primitives.test.ts` | Resolved: exact older preimage and graph/clock/timeout coverage additions verified |
| repo-cli `test/effect-vitest-store.test.ts` | Resolved: exact older preimage; only an assertion diagnostic message changed |
| repo-cli `src/commands/Lint/Lint.errors.ts` | Resolved: both declared hashes have exact bytes; change is an unrelated overlay error addition |
| repo-cli `dist/test/Quality.test-kit.d.ts` | Retained: historical hash/source absent; no retained finding loss or exception transfer |
| repo-cli `dist/test/SharedInternals.test-kit.d.ts` | Retained: historical hash/source absent; no retained finding loss or exception transfer |

`blocker-dispositions.json` records each original item, proof pointer, scope and residual limitation. It does not alter the old blocker ledger.

### Implementation evidence

All 20 recovered implementation/graph copies match their supplement manifest and the original `implementation-comparison.json` hashes. Eight TypeScript implementation files and the primitives graph are byte-identical across this cohort. Recovery labels are not the identity proof; the copied bytes and matching declared hashes are.

The complete `Lint.errors.ts` diff is one insertion: `TsconfigOverlayReadError`, its tagged message schema, `new` constructor, `mapError`, and documentation. All earlier text, imports and the existing `EffectVitestLintError` remain exact. The retained scan imports `EffectVitestLintError`; none of the other supplied implementation files refers to the new overlay class. This changes the module's exported error surface for overlay failures, but no Effect Vitest finding emission, identity, graph hydration or exception-preservation logic. This is static output-effect attribution, not an execution, initialization-performance or timing claim. Full diff and reference evidence are retained.

### Five intentional input cohorts

The original `p0f-round1-corpus/manifest.json` hashes to `eac5a3b2770af59ae3abcea745e284d936b56e460f5a5b311e511e6d36b8b39c`. For each of the five files, the recovered older copy equals the original corpus copy and its recorded source/snapshot/seal hashes. Its bytes and lines also agree with the older census. The later private-candidate copies match their accepted provenance hashes. These are source comparisons, not byte-count guesses.

The committed 1,075-path census is dated P0e evidence. The private P0f 7,417-row candidate follows accepted detector/runner fixes while canonical regeneration was pending. The five differing metadata records therefore compare **different intentional source cohorts**; they must never be described as one byte-identical snapshot. The 7,580-row/1,101-file preview is a third, independently source-bound cohort.

The exact earlier-to-private changes are:

- **Runtime:** narrower typed subprocess failures, removal of the Array import, `Effect.forEach` with an explicit mode callback at concurrency three, and overlapping property registrations with the same title/callback checked through separate outcomes and cleanup traces.
- **Contract:** v2 occurrence anchors in the exception fixture; tests for named reordering/deletion, ambiguous duplicate refusal, legacy reasons staying open, full-token identity beyond truncated display evidence, significant literal whitespace, and pinned iterative token digest vectors.
- **Detectors:** added public harness alias/modifier/namespace recognition, shadow controls, allocating provider/wrapper provenance, pure-stub controls, clock/cancellation distinctions, platform/CommonJS imports, outcome assertions, transitive helper reachability, scope judgments, compiler-getter avoidance, lexical-cache isolation, role-span ordering and scope-name parity. The old fork/clock-adjust negative becomes an explicit `withLive` negative, with separate fork/cancellation judgment controls. Two assertions gain diagnostic messages.
- **Primitives:** added graph-hydrated standalone timeout and bounded external `TestClock.withLive` alternatives while retaining the virtual-clock default; four existing assertions gain diagnostic messages.
- **Store:** only the diagnostic string on the generated JSONL existence assertion changes; its predicate and store operations remain unchanged.

`five-cohort-proof.json` retains both intervening diffs and all three source identities for every file. This resolves why those five older census records differ; it does not retroactively regenerate that census or change any row classification.

### Two unrecoverable historical declaration inputs

Both paths are present before and after, owned by `@beep/repo-cli`, and classified as support. Quality changes from 3,082 bytes/32 lines to 3,272/34; SharedInternals from 545/15 to 607/16. Each has **zero rows in both complete retained payloads**. Exception status is therefore not applicable: there is no retained row, exception or reason to inherit, remove or silently waive for either path.

The verified then-current declarations contain 27 and nine re-export declarations respectively, plus comments, with no other statements, candidate calls or local resource-wrapper function bodies. The unchanged scan retains only EV003 for support files; the inspected EV003 branches require calls or local resource-bearing wrapper definitions. Their then-current zero-row output is consistent with that source shape. D9 membership still includes both declaration paths.

No historical hash or bytes are available for these two old inputs. Exact old declaration contents, source delta and independent replay of their historical zero-row result remain unprovable. Missing bytes are not zero bytes, unchanged source, or a demonstrated false negative. This limitation is retained permanently in the historical record. It is distinct from an unexplained emitted finding loss and does not prevent independently evaluating a newly captured complete baseline.

### Integrity, residual risks and Root's next checks

All 1,101 immutable then-current source copies independently match the scope's path set, hashes, byte counts and line counts. This closes the retained preview's complete-source coverage question without consulting live sources.

Both original payload hashes remain unchanged. Every full before/after row in the classification ledger still matches the 7,417/7,580 arrays, with identical classification counts, zero unassigned rows and zero duplicate assignments. No reasons, exceptions or judgments were transferred by this supplement.

Root must still bind the **final repaired** detector/graph and all discovered source inputs—including generated support declarations—to a fresh complete result, review the repair delta from this retained cohort, account for any membership/owner/kind and full-payload changes, and explicitly review exception eligibility. New sources can introduce different risks; complete input capture alone does not prove detector completeness or validate judgments. Root retains aggregate proof, timing, adversarial review, canonical publication and phase acceptance.

`inputs-before.json`, `inputs-after.json` and `terminal-verification.json` record identity checks; only the authorized report append is an expected input change. `outputs-manifest.json` hashes the new receipts/scripts, preserved report copy and appended report; its detached SHA-256 closes the manifest chain. The terminal check requires no unexpected input drift and an exact unchanged original report prefix.
