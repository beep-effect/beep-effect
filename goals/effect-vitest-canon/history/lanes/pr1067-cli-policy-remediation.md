# PR1067 CLI policy remediation

Bounded hosted schema-compilation and coverage repair. Root owns canonical artifacts, baseline decisions, integration and package/full proof. Prior remediation evidence remains unchanged.

## Progress

Applied module-level compilers at all thirteen hosted sites: two test guards replace eleven inline uses, the scanner retains its package metadata schema and hoists its JSON decoder, and policy hoists its rule-ID guard. Initial actual Oxlint (including `beep/no-inline-schema-compile: error`) and focused compiler pass. The two hosted missing-JSDoc diagnostics belong to test-utils and remain outside this lane.

Initial focused coverage: 105/105 tests passed, Policy and Store branches 100%. The existing key's absent-symbol path is covered. During that run an external edit replaced the unreachable `A.last(Str.split(...))` Option fallback with `A.lastNonEmpty`; this lane did not edit Lint.schemas.ts. `external-schema-delta.diff` retains that exact delta. The pinned String.split contract guarantees NonEmptyArray (reference String.ts:444–450); Array.lastNonEmpty is defined at Array.ts:1152. Final validation will use and verify the externally updated schema hash. The earlier async ownership question is superseded by that external correction; no schema ownership is assumed.

Added further bounded scanner tests for missing-baseline rejection, baseline pin mismatch and support-only EV003 filtering, plus inventory read-error classification. Private temporary fixture artifacts do not touch the canonical baseline/census. Baseline adoption, whole-file floors and full package coverage remain Root-owned. Graft retrieval refreshed its own graph automatically (9 changed files) and estimated 31,265 tokens saved; no graph init/build command was run.
## Stable handoff — 2026-09-09

All thirteen hosted inline-schema compilation sites are repaired without changing their schemas, constraints or validation arguments. The final four focused suites pass **108/108 tests**. The assertion ledger preserves all **242 prior assertion expressions** (233 original plus 9 preceding path assertions), with explicit correspondence for the eleven guard rewrites, and adds **29** assertions: **271 total**. No prior test, assertion, negative fixture, timeout, skip or property floor was removed or weakened. `final-guard-correspondence.json` records the exact original/new assertion expressions, schemas and arguments; `final-assertion-ledger.json` retains the complete comparison.

New tests exercise canonical keys without symbols and unusual valid ordinal strings; package metadata read/decode errors; graph remediation-class rejection; missing/corrupt/unreadable inventory; ownership-preserving JSONL handling; default empty discovery; missing/mismatched baselines; and support-only EV003 filtering. Scanner tests inject zero or one discovery input through the existing service seam. They do not run a full scanner or write canonical artifacts.

The final focused Node coverage proves execution of every canonical-key statement/function, including the missing-symbol fallback (2 calls). Root's externally authored nonempty-array correction removes the impossible ordinal fallback; this lane preserved it and the JSDoc edits. The focused schema file still reports functions 75%, lines 94.91%, statements 95.08% because unrelated schema-first helpers at 587/654/656 are outside these four suites. This is not proof of the full-file 100% ratchet: Root must combine the new tests with its full coverage run. No floor or baseline identity changed here.

Focused branch coverage: Policy **7/7**, Store **10/10**, Scan **39/41**. Scanner's remaining paths are census/write modes, not exercised in this bounded lane. Policy retains a defensive exhaustive-map fallback; no synthetic mocking was added to manufacture that unreachable path. Detectors and Syntax were not edited. New-source baseline adoption and all remaining aggregate coverage judgments stay with Root.

The first 108-test attempt failed because the new pin-mismatch fixture supplied structural encoded data instead of JSON text. It was corrected using a module-level JSON encoder while retaining the intended error assertion. Failed receipts remain retained. The final validation below ran on stable bytes and each receipt reports zero input drift.

| Final focused check | Exit | Log SHA256 |
| --- | ---: | --- |
| final-biome-receipt | 0 | `081fd2923e5717a6371a9bbd9b4746ed63235b8dce6b0d33bbca5e4e12cbf946` |
| final-compiler-receipt | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| final-coverage-receipt | 0 | `da9230dd722c2f80fb8118c22d127bed461fcf7214d2858a6557fb5f0aade3f5` |
| final-fallow-dupes-receipt | 0 | `a9728eb8720ffafc5e581530a303f3eefedbe1b7e154f4ce7dd8ee58b0b1c996` |
| final-fallow-health-receipt | 1 | `3db15a70e1ef42cc841da59e1f722237ec45e4a9f745f88a5ebea3ff5b9dd0cc` |
| final-oxlint-receipt | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Compiler covers the façade, imported source and four tests using inherited Effect diagnostics. Read-only Oxlint uses the actual root `beep/no-inline-schema-compile` error rule. Read-only Biome checks ten files. Exact argv, cwd, wall time and before/after hashes are in `final-*-receipt.json` and `final-commands.txt`. Node coverage ran on Node 24.20.0; it is focused proof, not a package verification.

Bounded Fallow duplication reports zero clone groups. Isolated Fallow health exits 1 with 57 CRAP-only estimates (`coverage_tier: none`); no cognitive/cyclomatic excess was reported (observed maxima 8/10). Its copied scope lacks the full dependency/test graph and warns that node_modules is absent. This is a qualified structural check, not a green hosted health proof or a waiver. Root retains aggregate validation.

Changed files and final SHA256:

| File | SHA256 |
| --- | --- |
| `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts` | `3ba40ea75cdf1a9bc76a8ed8e294915e0c87fb98d0515fd5646a4e47663c093b` |
| `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts` | `5cb5bbe0c9674d4919ac41cf9330c3b7956bb80c4a1117f3bda1e31263fdd871` |
| `packages/tooling/tool/cli/test/effect-vitest-store.test.ts` | `5358ebd34d1f45b39deb67b3a2215645fd31b51427be9e9ee06c74591c846c66` |
| `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestPolicy.ts` | `dfd17cb5c2a8f83551f58ddd5501817baf0441246d9062ff0924499b1e1be7cc` |
| `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts` | `5f79a04b4afbef85fe9e4ea5833760ed8ade83462c0b85bf7c97942019386810` |

`after-hashes.json` includes the complete observed source/config/artifact identities; `after/` retains all twelve source/test snapshots, with `owned.diff` separate from `external-schema-delta.diff`. Final validation protected all twenty observed inputs, including the frozen graph, façade/schema, runtime manifests, aliases, canonical inventory and census. No unexpected final-validation or handoff drift occurred. The only non-owned source delta from this lane's start is the separately observed schema correction. Prior remediation report/evidence were read-only; no test-utils source was edited.

Private evidence: `~/.cache/beep/effect-vitest-canon/pr1067-resume/cli-policy-remediation/manifest.json`. This handoff does not grant package/hosted acceptance, baseline adoption, publication, phase completion or migration authorization.
