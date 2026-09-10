# Runner deadline correction

Started 2026-09-09. Implements the Root-authorized raw diagnostic harness, source-only watchdog timing seam, sampling/arming correction and deterministic aggregate deadline proof. Existing failure/timing evidence is immutable. Ownership is limited to the paths enumerated in this dispatch; no Git or delegation. Production clock, body TestEnv, timeouts, floors and public barrels remain fixed.

## Harness and first implementation evidence

All 883 protected inputs matched Root's role-index handoff before editing. Graft callers (`--depth all --no-refresh`) found instrumentMethods -> internal runtime -> public Vitest; targeted live source/barrel reads confirmed the existing factory and source-only test export precedent. The root/barrel and all detector files remain frozen.

The single harness-only Bun 1.4.1 diagnostic exited 0 (one passing parent, eleven name-filtered registrations), wall 4.104s. Its raw child error was an actual FastCheck failure after two generated trials, seed 4242, path 1:0, counterexample [1], Shrunk 1; the nested cause was TestHang. Public signal hooks recorded no abort. Raw reporter, phase, JSON and process files are retained under the new private harness-bun-children directory. This does not establish the original package trigger or supersede its failed receipt.

The first focused source compile correctly rejected the newly two-argument internal instrumentMethods with TS377101 missingPipeableSignature. Added proper public dual overloads; no diagnostic suppression. The first controlled Node attempt failed three parents because missing raw-report files obscured a child collection failure. Corrected the harness to retain child artifacts before optional diagnostic reads, including collection failure; assertions remain intact. A single retained follow-up isolates that collection failure. An apparent configuration conflict is under verification: the frozen generated `@beep/test-utils/*` alias rewrites `@beep/test-utils/test/Vitest` to `src/test/Vitest`, while the authorized source-only entry is `src/test/Vitest.test-kit.ts`. No aliases/configuration were changed.

Lookup-only friction: one rg command included nonexistent `packages/tooling/repo-cli/package.json` (actual path is `packages/tooling/tool/cli/package.json`); two guessed prior receipt names did not exist, then the private directory listing identified `input-hashes.json` and `final-recheck.json`. These reads changed no inputs.

The retained collection result confirms `Cannot find package '@beep/test-utils/test/Vitest'`, zero child tests. This is an integration blocker in frozen alias configuration, not a deadline failure. The source-only constructor and instrumentation compile cleanly after adding the dual signature. To validate the independent implementation without editing frozen global configuration, the following candidate-only diagnostic uses a NEW private Vitest config extending the unchanged package config with exactly the authorized source export alias. The owned harness is temporarily pointed at that private config; it will be restored before final-byte proofs. This is explicit diagnostic evidence, never a substitute for the required unchanged-config package proof. Root must project the explicit test alias through its owned alias/config route for normal runs.

## Deterministic behavior and negative controls

With the candidate-only explicit alias, the real public registration/fast-check fixture now passes all three parent contract checks under Node. The original aggregate keeps timeout 180ms, seed 4242 and fcRuns(4), intentionally fails at logical 155ms after three generated trials, shrinks to [1], preserves its last log, releases all three trial scopes, and emits exactly one lifecycle. The body's ordinary monotonic TestClock stays at zero while the separate watchdog TestClock advances.

The setup regression consumes 40ms synchronously in the start logger and another 10ms in the body before the watchdog branch starts; the actual timer receives the remaining 105ms and the lifecycle ends at logical 155ms. The companion case consumes all 155ms before arming and never enters its body. Both fail the actual property on its first generated trial and shrink normally with the stored deadline. The watchdog checks expiry before starting the race, then reads monotonic NOW again in the watchdog branch itself because raceFirst starts the body first. Non-property budgets and the winner policy are preserved.

The old calculation was restored temporarily in owned instrumentation only. The final negative control (`final-negative-control`) exited 1: it observed setup-40-completed and setup-155-body/completed, violating the unchanged strengthened assertions. Full raw/JSON/trace evidence and the candidate source are archived. Corrected source was restored byte-for-byte from final-corrected-before-negative.ts. Earlier negative-control evidence is also retained; no failure was erased. A late-success fixture holds timer delivery while advancing monotonic time: its first body legitimately wins raceFirst at 200ms, and the following trial immediately expires the original 155ms deadline. This explicitly characterizes cooperative scheduling rather than introducing a post-success timeout check.

Introduced development failures were attributed and fixed: the setup Logger.layer initially received one logger instead of the rc.112 array contract; Layer.merge of two Logger layers also replaced one CurrentLoggers entry, so the fixture now uses Layer.provideMerge to compose the trace and setup logger. Runtime assertions remained intact. Installed rc.112 source exports UnknownFromJsonString, while the installed emitted declaration lacks it; the diagnostic fixtures now use its exact equivalent fromJsonString(Unknown), supported by both source and declaration. No dependency was edited. A parse-options decoder could not be passed directly to forEach's indexed callback; an explicit one-argument callback fixes that type mismatch. Scope.makeUnsafe replaces an unnecessary runSync of the pure scope constructor.

## Normal-configuration proof and final quality tidy

Both full focused suites ran under Node 24.20.0 and Bun 1.4.1: 37 registrations each; 27 ordinary passes, one expected failure, three alias-blocked failures, two existing skips and four todos. Node wall 93.116s; Bun wall 39.106s. The first actual full package-verify exited 1 in 49.011s: audit failed, docgen passed, 70 ordinary passes + one expected failure + three failures + nine skips + four todos = 87 registrations across ten files. Every failed child is a zero-test collection failure resolving the authorized source-only alias; none is a new deadline-trigger observation. The original Root failed proof remains separately immutable.

The structural AST comparison confirms all 120 previous assertion calls, literal registration names, timeout/seed assignments and fcRuns calls remain. There are 154 assertion calls afterward. Its first printer-text comparison falsely distinguished a formatter-added trailing comma in an unchanged expected array; the retained structural comparison checks node kinds, literal/identifier values and children instead and passes without changing the assertion.

Final Oxlint exposed one introduced no-inline-schema-compile warning in the raw-error decoder. Hoisted that decoder to module scope. The test-seam JSDoc now states the exact named null publish export instead of implying that it closes every inherited wildcard route. Root's pre-existing `./*` publish wildcard can still name emitted `test/Vitest.test-kit.js` by its role filename; the explicitly authorized `./test/Vitest: null` does not block that alternative. A source package-resolution probe confirms both source aliases resolve, with internal guards still null. No additional export guard or files exclusion was written because only the two named entries were authorized. Root should decide a publish `./test/*: null` guard before claiming complete publication isolation. This is distinct from the observed Vitest alias blocker.

A final proof set follows this owned quality/doc tidy so the handoff reports exact final bytes. It retains the expected alias failures rather than treating private-config success as integration acceptance. One guarded edit script initially failed to match Biome's layout before writing any file; its two dependent command-spec reads consequently failed. The corrected edit matched the live block; no source was partially overwritten.

## Additional Node parent timeout and harness correction

The subsequent exact-byte Node focused suite retained a fourth failure: the existing trace-gating parent timed out at its unchanged 30,000ms limit (reported 30,035ms). The verbose reporter preserves the actual timeout message; JSON again contains its registration stack. Three completed trace-success children passed, with child test durations about 3.8–7.3ms; the fourth child did not reach the old success-path artifact copy. The full run took 132.596s. This proves a parent timeout during sequential fixture launches, not why startup consumed that time. The matching Bun run had only the three alias failures. No host-only attribution or timeout increase is made.

Removed unnecessary child platform initialization from the newly introduced diagnostic reporter: it now emits schema-encoded raw records through public Effect Console, and runFixture's existing parent FileSystem service persists them. No native filesystem replacement, log-policy change in production, private API import or suppression was added. This also removes the reporter's strictEffectProvide diagnostic by removing its filesystem layer requirement, not by concealing a provide call. The artifact copy is now an outer test-scope finalizer, registered after the temporary directory allocation so it runs before directory cleanup on success, failure and cancellation. Partial process output and raw records are preserved on cancellation; retention I/O errors remain failures (finalizer defects), never silently ignored. This addresses a concrete evidence-retention gap. It does not prove the original package trigger or the precise cause of the new startup delay.

## Final handoff — 2026-09-09

**The owned deadline correction is implemented and privately verified. Normal integration remains blocked, and package verification is red.** Do not mark this package, phase, or the original failed proof accepted. The three normal-config failures occur before the controlled cases register, because the frozen generated wildcard cannot resolve the specifically authorized source-only test subpath. The temporary diagnostic config is absent from the final harness.

Root's smallest integration step is to project `@beep/test-utils/test/Vitest` to `packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts` through its canonical alias mechanism. Node's package resolver already resolves the named source export correctly. A separate export decision remains: the inherited `./*` wildcard also admits the role-filename route. A publish `./test/*: null` guard would close that route; a source guard with the same pattern would restrict source access to the explicit named entry. Those additional guards were not authorized for this lane. No filename-alias workaround, root/public-barrel change, production environment switch, private Vitest import, timing option, timeout/floor change or skip was substituted.

After Root handles the configuration/export boundaries, run fresh full Node/Bun runner suites and full package-verify, then Root's repo-cli/integration proof. The original 180ms failure's precise trigger remains unknown. The separately observed 30-second parent timeout and all prior failed receipts remain evidence. Removing unnecessary reporter platform initialization and obtaining subsequent passes does not retrospectively prove the source of the earlier startup delay.

### Terminal verification on frozen bytes

| Check | Result | Private receipt/log prefix |
| --- | --- | --- |
| Full runner suites, Node v24.20.0 | Exit 1, 75.471s; 27 passed, 1 expected failure, 3 alias failures, 2 skips, 4 todos; 37 registrations | terminal-runner-node |
| Full runner suites, Bun 1.4.1 | Exit 1, 42.140s; same counts and the same three failures | terminal-runner-bun |
| Full package-verify | Exit 1, 43.870s; audit failed (38.9s), docgen passed (3.2s); 70 passed, 1 expected failure, 3 alias failures, 9 skips, 4 todos; 87 registrations / 10 files | terminal-package-verify |
| Focused source compiler | Exit 0; no diagnostics | terminal-source-check |
| Focused test compiler | Exit 1; two inherited diagnostics | terminal-test-check |
| Copied fixture compiler | Exit 1; eighteen inherited diagnostics; no introduced reporter diagnostic remains | terminal-fixture-check |
| Biome | Exit 0 on owned source/tests and manifest | terminal-biome |
| Oxlint | Exit 0; three inherited namespace-node-import warnings | terminal-oxlint |
| Required export JSDoc/examples | Passed through actual package docgen | terminal-package-verify |
| Structural assertion/name/budget preservation | Exit 0; zero removals | terminal-preservation |

All private evidence is under `~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/`. Every terminal command receipt records zero source drift during execution. The terminal full-runner and package failures are exactly:

- `uses one absolute deadline and one lifecycle for a complete property run`
- `charges setup to the stored property deadline before arming`
- `preserves a late raceFirst success and expires the following property trial`

Each child has a retained zero-registration collection failure resolving `@beep/test-utils/test/Vitest`. None is counted as an executed controlled case in those normal-config attempts. With the private config supplying precisely the authorized alias, the final diagnostic transport passed all three parent contracts under both actual runtimes: `transport-controlled-node` exit 0 (11.847s), `transport-controlled-bun` exit 0 (6.209s). Their four child property results are intentional real fast-check failures. Raw runtime records identify Node 24.20.0 in the Node run and Bun 1.4.1 in the Bun run. Bun's reported Node 26.3.0 compatibility metadata is not the selected Node executable.

The source/test/fixture checks use real private configs extending the existing package tsconfig.check.json. No diagnostic settings, excludes, global config, or policy were weakened. Exact remaining compiler diagnostics:

- Tests: TS377057 for the existing child_process import; TS377049 for the existing Probe service key.
- Fixture: TS377057 ×1 (existing fs import); TS377076 ×2 (existing process.env reads); TS377080 ×1 / TS377072 ×1 (existing delayed-layer Promise/timer); TS2345 ×4 (existing task metadata); TS2339 ×9 (existing collection-union field accesses).
- The earlier reporter strictEffectProvide diagnostic remains in historical logs. It disappeared because the reporter's filesystem layer requirement was removed and persistence moved to the parent's existing service, not because a provide call was hidden or suppressed.

The complete messages and exact source spans are in the terminal compiler logs. Wider private compilation is not green. The package audit reaches the failing test stage; the independent focused lint checks and successful package docgen are separate evidence.

### Assertion and scope preservation

| Invariant | Before / final evidence |
| --- | --- |
| Ordinary helper tests | Vitest.test.ts is byte-identical; all 26 assertion calls, registration forms, expected failure, skips and todos remain. |
| Runtime integration assertions | All 82 prior calls retained; 114 afterward. All prior literal registration names, timeout/seed assignments and fcRuns calls retained. |
| Fixture assertions | All 12 prior calls retained; 14 afterward, adding checks that the body's ordinary monotonic TestClock remains zero. The initial printer-text mismatch was only a formatter-added trailing comma; structural AST comparison passes. |
| Live clock / body environment | VitestInstrumentation.ts:23 retains the same captured live clock. The dependency passes through existing factories; only instrumentation reads/sleeps use it. Public Vitest, TestEnv/TestClock provision, and production logging policy remain unchanged. |
| Stored absolute budget | VitestInstrumentation.ts:193–228 checks expiry after logger setup, then reads NOW inside the watchdog branch before sleeping. The first-trial deadline and budget never reset during later trials/shrinking. The 180ms case still reports 155ms; ordinary non-property relative sleeps are preserved. |
| Identity / lifecycle | The existing reference-identity Map, execution-local AsyncLocalStorage, aroundEach boundaries and finishPropertyRuns lifetime remain. No additional native map/cache was introduced. |
| Setup regression | 40ms in the start logger plus 10ms in synchronous body setup leaves 105ms at timer arming. Both that case and the fully consumed 155ms setup case finish at logical 155ms. The latter never enters its body. Both fail the first actual generated trial and shrink to [1]. |
| Aggregate regression | Public layer registration, actual fast-check, seed 4242 and fcRuns(4), three generated trials with 60ms logical delays, counterexample [1], one shrink, last body log retained, three trial releases and one start/end lifecycle. No manufactured TestHang or FastCheck error. |
| Late success | A first body may win raceFirst after monotonic time advances while timer delivery is held. The next trial immediately expires the original deadline. No post-success timeout conversion was introduced. |
| Diagnostics / cleanup | Public Reporter.onTestCaseResult and TestCase.result().errors preserve name/message/stack/cause independently; TestContext hooks/signal capture abort state/reason and monotonic phases. The original JSON reporter remains. Parent filesystem persistence runs before scoped directory cleanup, including partial observed output on cancellation. Retention I/O failures are not ignored. |

The controlled fixture reuses rc.112 TestClock for sleep/advancement, adding a monotonic offset to model synchronous setup or held timer delivery. Only the watchdog and deliberate trial delay use it. Cooperative JavaScript cannot preempt arbitrary event-loop starvation. Exact rc.112 `packages/effect/src/internal/effect.ts:1535–1579` also waits for loser interruption/finalizers in raceFirst; a finite margin cannot bound arbitrary cleanup or report scheduling. The immutable attribution report retains the installed Vitest timeout-stack and fast-check shrink/reporting source trace. No pinned dependency was patched.

### Negative control and private seam evidence

`final-negative-control.ts` changes only the two deadline subtractions back to the earlier sample. No assertion, timeout, floor or registration changes accompany it. `final-negative-control` exited 1 and retained setup-40-completed plus entry/completion of the already-expired 155ms setup body. Corrected source was restored from `final-corrected-before-negative.ts` before subsequent passing controlled proof. The earlier narrower negative-control source/run is retained too. All candidate configs and temporary harness snapshots remain private; none is referenced by final source.

The final transport's trace-gating test passed once under Node (`transport-trace-node`, 15.280s). The terminal full runner runs and package proof have no additional trace-gating failure. That is evidence of the final observed behavior, not a guarantee against all startup delays or an environment waiver.

### Ownership and integrity

Manual repository changes comprise five existing owned files (instrumentation, runtime factory, manifest, runtime parent test, runtime fixture), two new owned files (source-only constructor, reporter template), and this report. Vitest.test.ts was read/snapshotted but unchanged. Manifest comparison confirms exactly the authorized source entry and null publish entry; every other manifest field is unchanged.

`terminal-drift-check.json` confirms no drift from frozen final owned bytes; no unexpected change among 883 protected inputs; no unexpected drift among all 34 accepted input/reference entries; and no remaining scoped fixture directories. Only the five authorized existing files changed in that corpus. All 98 detector tests/source remain within the unchanged protected inputs. Root's prose correction was not regenerated. Root barrel, public Vitest, Vitest.errors, Layer, dependencies/lockfiles, configurations and canonical projections were preserved. No Git commands, agents, publication or merge were performed.

The original failed Root log and receipt still hash to `a5ddad5e22e1e53c446283f0d311cd2a452ff9220e70845e5edaa6046b4f85d4` and `bcbacc11d2835a9cb604ddb8843a3f6745e346d98b6edc6a60ff8551f132dadf`. Before snapshots are in `before/` and `before-hashes.json`; final snapshots are in `terminal-after/` and `terminal-after-hashes.json`; exact diff is `terminal-owned.diff`.

A final report-building script encountered a syntax error before writing this section; it changed no repository source or prior receipt. The report was then appended using a quoted heredoc.

| Owned path under packages/tooling/test-kit/test-utils | Before SHA256 | Final SHA256 |
| --- | --- | --- |
| `src/internal/VitestInstrumentation.ts` | `e35c18716b65829fc16d97b7a2c51c798c0f9b5c0491f16a37b6f88b41e9ae45` | `2b02e7d42666968be37df52ab33c7ab328a3e1874bc631cd74fb9262b3137dd3` |
| `src/internal/VitestRuntime.ts` | `d6bf2efb73eff0dfbf2a74d5d9f1985e079e50470a808a9fbc7df0dd6b98cac4` | `0e982fc1a8343a1ebebd33e257a6602370b418ffb30b486806a63bd51d05ba36` |
| `package.json` | `24403441e545150f1f51e0e2315d9b5ef6226f57fcf0d2a6327349a105f14f0e` | `28e1e4b8da28fd75923c00d8f86967a5c37deb9347c297744e984c9de3806ae9` |
| `test/Vitest.test.ts` | `ba129dc10114183512dbbba2da9451208d91ed5cee65e8cbd02be2c9ad629ef6` | `ba129dc10114183512dbbba2da9451208d91ed5cee65e8cbd02be2c9ad629ef6` |
| `test/Vitest.runtime.test.ts` | `a3b98c62abe7cf95e3f9214ebb343b08a2b6f511d823b0e48b6f72d93fb7cc28` | `cde2425fff3f0a1bcc84238352ed5fd41fb7977ba08b2bf631c01e11eb42275b` |
| `test/fixtures/vitest-instrumentation/runtime.test.ts.txt` | `7e4a5062a8d9beebf43486b0484ac99b82531ba2c819a90f380440540cde30ee` | `3f6a3f0f0ef1afca01584ba21a055da255f17d3e59f738668542d2f110ef959e` |
| `src/test/Vitest.test-kit.ts` | `new` | `97825459b822737e5c7ce0db8c09e9fac4868dccbdf68c47974372ffe0a230e6` |
| `test/fixtures/vitest-instrumentation/diagnostic-reporter.ts.txt` | `new` | `e46ec326f7bb86679af6d431722f7c3b2f8e75ad80f6d057b1cba506d15f812b` |

### Command and artifact index

All validation commands ran from the primary canon worktree through `python3 ~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/run.py <label>`. Each `<label>-receipt.json` records exact argv/cwd, exit, wall and child-tree CPU, major faults, before/after PSI/available memory, safe environment flags, source hashes, and the full log SHA256. The supervisor changes only process-local PATH selection and the test-only evidence sink. No floor flag was overridden.

`command-index.json` contains all 51 executed validation commands, exits, full log hashes and receipt hashes. Unexecuted reserved specs are not proof. `template-format-receipts.json` separately retains the two successful stdin formatter commands. The table below uses hash prefixes for readability; full hashes and literal commands remain in the immutable receipts and index.

| Label | Exit | Wall seconds | Log SHA256 prefix |
| --- | ---: | ---: | --- |
| `arming-private-bun` | 0 | 9.340 | `afcb9666876dcf98` |
| `arming-private-node` | 0 | 16.350 | `cb3be156d6411548` |
| `ast-preservation` | 1 | 0.170 | `2f7e376cfcc03c2b` |
| `ast-preservation-structural` | 0 | 0.160 | `244624b96758c890` |
| `biome-final-format` | 0 | 2.417 | `78f84784b7202e2a` |
| `biome` | 0 | 2.117 | `99ae1beecc89295e` |
| `compile-fixtures` | 1 | 0.763 | `b9aaadb9db889b39` |
| `compile-fixtures-updated` | 1 | 0.692 | `4fe2a0bed7f5a674` |
| `compile-source-dual` | 0 | 1.373 | `e3b0c44298fc1c14` |
| `compile-source` | 1 | 0.689 | `0a42cfdfc99e6a73` |
| `compile-tests` | 1 | 0.699 | `60f0cbbd32f22e40` |
| `controlled-node` | 1 | 16.399 | `b1b87b89d5d1c088` |
| `controlled-node-retained` | 1 | 9.287 | `8c3d4fd47d7bc410` |
| `controlled-private-corrected` | 1 | 12.312 | `a94c9b419bd6785e` |
| `controlled-private-node` | 1 | 12.207 | `9134bda02fb7b24f` |
| `export-resolution` | 0 | 0.017 | `d3b9577c562f41d0` |
| `final-biome` | 0 | 3.593 | `e04630c5c0cb4f4e` |
| `final-fixture-check` | 1 | 1.222 | `760b87a04e17b1f9` |
| `final-negative-control` | 1 | 5.040 | `bb562bf38504cf1e` |
| `final-oxlint` | 0 | 0.290 | `7d1826ad17a9ae8f` |
| `final-runner-bun` | 1 | 39.106 | `3dd6f4e5c0c032dc` |
| `final-runner-node` | 1 | 93.116 | `a731ad091e343a35` |
| `final-source-check` | 0 | 1.723 | `e3b0c44298fc1c14` |
| `final-test-check` | 1 | 1.291 | `b6da04be0f2d522e` |
| `handoff-biome` | 0 | 2.554 | `fd2f76d22fff22b4` |
| `handoff-oxlint` | 0 | 0.270 | `c2398dae993b4ead` |
| `handoff-preservation` | 0 | 0.174 | `244624b96758c890` |
| `handoff-runner-bun` | 1 | 41.712 | `2166d8ae4e6d0c84` |
| `handoff-runner-node` | 1 | 132.596 | `80e8b0e1ade03de5` |
| `handoff-source-check` | 0 | 0.760 | `e3b0c44298fc1c14` |
| `handoff-test-check` | 1 | 0.837 | `b6da04be0f2d522e` |
| `harness-bun` | 0 | 4.104 | `ce04fe3fe370f568` |
| `negative-control` | 1 | 6.219 | `43ca57bae705fb4f` |
| `package-verify` | 1 | 49.011 | `44f4ff3c8e495be6` |
| `setup-private-node` | 0 | 6.194 | `0a3480d451a89af8` |
| `terminal-biome` | 0 | 2.325 | `f54cae86f50baf4a` |
| `terminal-fixture-check` | 1 | 0.692 | `e812870ee6645afa` |
| `terminal-oxlint` | 0 | 0.273 | `c2398dae993b4ead` |
| `terminal-package-verify` | 1 | 43.870 | `b1c690a3804bbeca` |
| `terminal-preservation` | 0 | 0.160 | `244624b96758c890` |
| `terminal-runner-bun` | 1 | 42.140 | `5da057f7a1153d00` |
| `terminal-runner-node` | 1 | 75.471 | `9026100a70308459` |
| `terminal-source-check` | 0 | 0.684 | `e3b0c44298fc1c14` |
| `terminal-test-check` | 1 | 0.707 | `b6da04be0f2d522e` |
| `transport-controlled-bun` | 0 | 6.209 | `8ffa70555e9c55f7` |
| `transport-controlled-node` | 0 | 11.847 | `8afaf7620b09ec98` |
| `transport-fixture-check` | 1 | 0.643 | `e812870ee6645afa` |
| `transport-format` | 0 | 2.295 | `0e67812690e5b1d9` |
| `transport-oxlint` | 0 | 0.239 | `c2398dae993b4ead` |
| `transport-test-check` | 1 | 0.683 | `b6da04be0f2d522e` |
| `transport-trace-node` | 0 | 15.280 | `d62b0fa4329f4bcc` |

Canonical terminal commands (home paths shortened for this public report):

- `'~/.nvm/versions/node/v24.20.0/bin/node' node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose --reporter=json '--outputFile=~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/terminal-runner-node-result.json'` — exit 1.
- `'~/.local/share/mise/installs/bun/1.4.1/bin/bun' node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose --reporter=json '--outputFile=~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/terminal-runner-bun-result.json'` — exit 1.
- `node_modules/.bin/tsgo -p '~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/tsconfig.source.json'` — exit 0.
- `node_modules/.bin/tsgo -p '~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/tsconfig.tests.json'` — exit 1.
- `node_modules/.bin/tsgo -p '~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/tsconfig.fixtures.json'` — exit 1.
- `node_modules/.bin/biome check packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/src/internal/VitestRuntime.ts packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts packages/tooling/test-kit/test-utils/test/Vitest.test.ts packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts packages/tooling/test-kit/test-utils/package.json` — exit 0.
- `node_modules/.bin/oxlint packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/src/internal/VitestRuntime.ts packages/tooling/test-kit/test-utils/src/test/Vitest.test-kit.ts packages/tooling/test-kit/test-utils/test/Vitest.test.ts packages/tooling/test-kit/test-utils/test/Vitest.runtime.test.ts` — exit 0.
- `'~/.local/share/mise/installs/bun/1.4.1/bin/bun' run beep quality package-verify @beep/test-utils` — exit 1.

Additional evidence: the single harness-only Bun diagnostic (`harness-bun-*`), corrected/negative source snapshots, private alias config and temporary-harness snapshots, `transport-controlled-{node,bun}-summary.json`, all `*-children/` snapshots, terminal runner JSON, terminal package log/receipt, runtime-versions.json, terminal drift/reference checks, and unchanged copies of Root acceptance/reference manifests. Earlier failures and timing evidence remain intact.

The final combined manifest, including this report and all owned paths, is `~/.cache/beep/effect-vitest-canon/p0f-round1-runner-deadline-correction/final-manifest.json`.
