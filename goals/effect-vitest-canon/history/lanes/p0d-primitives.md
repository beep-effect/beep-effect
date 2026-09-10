# P0d Pinned Primitives Graph Lane Report

- Status: initialized; implementation not started
- Ownership: P0d primitives graph, schema/loader integration, graph-backed Effect Vitest hints, portable rc.112 fixture, focused tests, and command-produced detector artifacts within the authorized path allowlist
- Model/effort: gpt-daybreak-blue-latest, medium (phase-specific user authorization)

## Activity log

- 2026-09-08: Created this report before implementation. P0c is accepted as complete; its source and verification receipts will be preserved.
- 2026-09-08: P0d is bounded to the pinned `@effect/vitest@4.0.0-rc.112` graph and hint integration. P0e and later migration work are out of scope.
- 2026-09-08: Read SPEC sections 0, 5.3, and 7; PLAN P0d; the authoritative P0c verification; the pinned-source hash receipt; schema-first repository laws; Effect-first laws; and the complete JSDoc pattern. No implementation preceded that review.
- 2026-09-08: Ran `beep architecture --help` and `beep architecture plan --help` under command-scoped Bun 1.4.1. The planner only accepts slice/concept/domain-kind/stage and cannot represent this authorized repo-cli internal role, so no fictional slice was created.
- 2026-09-08: Live reuse search found the existing `EffectVitestPrimitive` class, finding/inventory schema codecs, JSONC `readArtifact`/`formatJsonc` boundary, `EffectVitestLintError`, and P0c rule-policy map. P0d will extend those surfaces instead of duplicating them.

## Early coverage table and ambiguities

The verified snapshot yields the following independently derived coverage units.

| Surface | Units | Coverage method |
| --- | ---: | --- |
| `packages/vitest/src/index.ts` direct declarations | 12 | Syntax declarations: one `vitest` export-star boundary, `API`, the `Vitest` namespace, and nine value exports. |
| `Vitest` declared types/interfaces | 6 | `TestFunction`, `Test`, `Arbitraries`, `Tester`, `MethodsNonLive`, and `Methods`. |
| Declared tester/method properties | 13 | Seven `Tester`, four `MethodsNonLive`, and two `Methods` members; inherited members stay covered at their declaration owner. |
| Named prop/layer option fields | 9 | `fastCheck` plus both namespace layer signatures and the top-level layer options, each anchored where declared. |
| `packages/vitest/src/utils.ts` exports | 21 | Every exported function declaration, including `throwsAsync`. |
| `packages/vitest/README.md` sections | 14 | Every Markdown heading, including the package H1, with ranges ending before the next heading. |
| Charter APIs | 10 | Five `Effect`, two `Logger`, two `TestClock`, and one `Layer` declaration from the pinned tag. |
| Total graph entries | 85 | One entry per coverage unit; coverage tests derive the first six rows from portable pinned source rather than from graph IDs. |

The SPEC kind domain has no `module` variant. `module.@effect/vitest` will
therefore use kind `type` to describe the compile-time export-star surface; it
will record that upstream Vitest names are deliberately covered by the pinned
peer boundary rather than fabricated as direct declarations. The package H1 is
treated as a README section. `Methods` inheritance is described explicitly but
not expanded into duplicate declarations. The two namespace layer signatures
and the top-level layer signature remain separate anchors, including their
distinct options. Compile-only examples for `skip`, `only`, and `fails` will not
be registered or executed as tests.

No graph completeness claim is made before the portable-source comparison and
example compiler are green.

- 2026-09-08: Added the schema-first complete graph document boundary, graph path and codecs, and a dedicated tagged graph error. The graph invariant now rejects tag/version mismatches, duplicate primitive IDs, missing EV001-EV015 replacement coverage, unordered anchors, duplicate per-entry edges, and empty replacement rationale.
- 2026-09-08: Added the graph loader/index role and wired scan output through graph policy validation. The installed package version is now compared with the decoded graph header rather than a second production pin; mismatch guidance explicitly requires regenerated anchors, semantic-diff review, and pin update. Detector identities and evidence remain unchanged while emitted replacement sketches come from graph `whenToUse` text.

## Orchestrator review inbox

The independent source inventory agrees with your 85-unit coverage plan. The
portable index/utils/README/license copies are byte-identical to the tag. One
introduced integration issue is recorded in `../p0d-working-review.md`: a
read-only Biome check on the two copied `.ts` fixtures exits 1 with six errors.
Please preserve their bytes as text data (for example `.ts.txt`), retain original
upstream path/line anchors, and update the fixture loader/provenance mapping.
Do not format upstream source, add lint suppressions or change global config.
Close this review item before final handoff; continue your owned P0d work.

## Orchestrator semantic review checkpoint

The first draft covers all 85 independent anchors, but the detailed review in
`../p0d-working-review.md` identifies runtime-invalid synchronous Schema prop
examples, literal property-run floors, incorrect EV006 family hints, a false
`each` callback arity claim, and templated guidance missing the pinned gotchas.
The orchestrator is deliberately interrupting this same lane to deliver the
concrete review before final example/coverage fixtures become acceptance.
This is an intentional review boundary, not an implementation handoff.

## Working-review correction ledger

- 2026-09-08: Resumed after the intentional semantic-review SIGINT. The prior direct compiler exit 0 did not validate graph decoding, example compilation, or runtime property behavior; no acceptance claim is carried forward.
- 2026-09-08: Read the complete P0d working review, SPEC 1.2/1.3 and locked D5/D6/D7/D14 semantics, the P0a grounding summaries, the independent 75-unit source inventory, and the ten-charter proof. Corrections accepted: portable upstream TypeScript moves to byte-identical text data; synchronous prop uses FastCheck rather than Schema; property examples preserve `fcRuns` floors and assert values; EV006 hints become graph-derived by assertion family; `each` documents its one-case callback; layer/live/TestClock/flaky guidance records the pinned runtime distinctions rather than templates.
- 2026-09-08: The current graph is still provisional. Schema decoding presently stops at the standalone `layer` entry because its empty-edge rationale does not begin with the required reason prefix; this will be corrected in graph content without weakening the invariant.
- 2026-09-08: Closed the fixture-lint packaging defect by retaining the exact pinned `index.ts` and `utils.ts` bytes as `index.ts.txt` and `utils.ts.txt`; provenance and the parser map those data files back to their original upstream paths. The upstream README and LICENSE remain byte-identical.
- 2026-09-08: Replaced repeated template guidance with entry-specific rc.112 use/non-use rules and gotchas. The graph now records one-build-per-layer-block, separate inner test scopes, shared TestClock/TestConsole, nested forked memo maps, live-without-TestEnv, TestClock.withLive's installed-TestClock precondition, D6 reason/follow-up requirements, and D5 assertion families.
- 2026-09-08: Corrected property examples and runtime proof: synchronous `prop` uses FastCheck Arbitraries; effect `prop` uses Schema; explicit run counts use `fastCheck: fcRuns(10)`; callbacks make assertions; `each` documents case-only arguments. Corrected the independently detected `Vitest.MethodsNonLive.prop.option.fastCheck` end anchor from 138 to 137.
- 2026-09-08: Focused primitive suite under Bun 1.4.1 and Vitest threads pool passed 8/8 in 4.39 s (process 5.52 s). It executed both property modes, derived and matched all 85 source/README/charter anchors, compiled every graph example, rejected missing/malformed/unknown-policy cases, rendered all six Option/Result/Exit EV006 alternatives from graph edges, and proved a changed graph hint changes output without changing finding identity.

## Additional EV005 review guard

The first correction pass moves EV005 exclusively to Result helpers. Please
read the added EV005 section in `../p0d-working-review.md`: SPEC 7 explicitly
retains Effect.result-to-Effect.exit plus Exit assertion helpers as the outcome
migration. Keep that route and corresponding graph edges; genuine Result values
can still use Result helpers, including EV006. Do not alter detector algorithms
or imply retaining an incidental result wrapper is the only remedy.

- 2026-09-08: Accepted the additional EV005 guard before final verification. EV005 now keeps the SPEC 7 migration from `Effect.result` to `Effect.exit` and graph-backed `assertExitSuccess`/`assertExitFailure` guidance. Genuine Result assertions remain EV006 candidates; a focused regression asserts both the family boundary and unchanged finding identity.
- 2026-09-08: Final-handoff ownership correction accepted. The out-of-scope import prefilter previously added to `EffectVitestDetectors.ts` was inverted by the orchestrator after the writer exited; its restored SHA matches the completed P0c proof and will not be edited in this continuation. The only remaining source edits are the authorized `live`, `it.live`, and `TestClock.withLive` guidance prose; scanner/writer artifacts and timing now remain orchestrator-owned.
- 2026-09-08: Final focused source/routing run passed 62/62 across all four `effect-vitest*.test.ts` files plus the lint subcommand allowlist (5 files, exit 0, 10.81 s Vitest / 14.3 s process). The exact cheap-gates planning assertion passed 1/1 separately. A broader combined diagnostic had 17 inherited `quality-tasks` failures in temp-repository Git scenarios; the lane does not alter those scenarios and did not treat that broad failure as acceptance.
- 2026-09-08: Direct Effect compiler check passed after narrowing lens rule IDs through the schema-derived EV guard. Package docgen initially exposed an invalid dual-codec JSDoc call, which was corrected; the rerun passed with 229 modules and 1,536 compiled examples (exit 0, 18.2 s).
- 2026-09-08: Added explicit installed-pin mismatch proof. The primitives suite now passes 10/10, including the rc.112 runtime property distinction, EV005 Exit route, six-family EV006 guidance, malformed/missing graph cases, independently derived 85 anchors, all graph examples, changed-hint propagation, and the actionable pin-mismatch procedure.
- 2026-09-08: First exact public writer completed in 8.9 s process / 6,961.6 ms scan, and its immediate repeat completed in 8.0 s / 6,023.3 ms. Both reported 1,073 files and 5,013 findings; all 123 generated artifact hashes were identical. A final refresh follows the last focused-test addition.

## Final wording review and independent example proof

The orchestrator independently typechecked all 85 graph examples with zero
diagnostics; a negative control correctly reports TS2322, so semantic checking
is real. The additional EV005 correction is observed and closed. Please close
the final wording section in `../p0d-working-review.md`: OS/network I/O alone
is not sufficient for it.live under D7, and TestClock.withLive requires an
installed TestClock rather than an unconditional ban based on outer tester name.
No new algorithm or scope change is requested.

## Final narrow handoff

- Status: implementation complete and ready for orchestrator acceptance; final artifact regeneration, timing, and mandatory package verification remain pending with the orchestrator.
- Ownership correction: the orchestrator restored `EffectVitestDetectors.ts` to the authoritative P0c SHA `1d7d95e0ac15008810e76ce5575b4bedb4e91ed41ac991ee54d283560455c858`. This continuation preserved that restoration and made no source, test, fixture, or generated-artifact edits.
- Final graph prose: updated only `live`, `it.live`, and `TestClock.withLive`. Both live testers now require an actual live Clock/Console or unmanaged-wall-clock need; ordinary filesystem, OS, and network I/O instead require explicit platform-service provision. `TestClock.withLive` is now described by its installed-TestClock capability: default live/exclude-test-services environments lack it, explicit provision may supply it, and the D7 watchdog warning remains.
- Focused command: `PATH=~/.local/share/mise/installs/bun/1.4.1/bin:$PATH bunx --bun vitest run packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts --pool=threads`.
- Focused result: exit 0; 1 file passed, 10 tests passed; Vitest duration 4.15 s and process wall time 5.4 s. This revalidated all 85 independently derived anchors, graph decoding/invariants, example compilation and runtime property registration, graph-backed EV005/EV006 hints, changed-hint propagation, and pin-mismatch behavior after the prose edits.

### Supporting evidence retained from the completed implementation

- Graph: 85 entries spanning 75 independently derived `@effect/vitest` export/member/option/utils/README units and 10 exact charter declarations, with all EV001-EV015 policy IDs resolved. The header pins `@effect/vitest` `4.0.0-rc.112`, tag `@effect/vitest@4.0.0-rc.112`, and commit `2600f62f4532026928454dcea8d1c48557b3f942`.
- Portable provenance: `index.ts.txt`, `utils.ts.txt`, README, and LICENSE were byte-verified against the pinned source; original tag paths and line anchors remain in the graph while upstream TypeScript is stored as lint-safe text data.
- Semantics: synchronous property examples use FastCheck, effect/live properties may use Schema, explicit run counts use `fcRuns`, `each` documents its case-only callback, EV005 retains the Effect.result-to-Effect.exit route, and EV006 exposes applicable None/Some/Result/Exit alternatives through graph edges.
- Earlier final focused source/routing proof passed 63/63 across the four Effect Vitest suites and lint subcommand allowlist; the cheap-gate planning assertion passed 1/1 separately.
- Static/documentation proof passed with Bun-routed Effect tsgo `7.0.2+effect-tsgo.0.39.1`, changed-file Biome, and package docgen over 229 modules and 1,536 compiled JSDoc examples. The package-script Node launcher itself failed with the recorded managed-sandbox `spawnSync .../node EPERM`; the same Effect compiler invoked through Bun passed.
- Exact public writer evidence before the final prose-only edit included deterministic 123-artifact pairs and 1,073 files / 5,013 findings. Measured writer/default runs included both sub-10-second and slower receipts; no cause is inferred for the variation. The final prose changes affect rendered hints, so those generated artifacts must be refreshed by the orchestrator rather than treated as current.
- Starting-census reconciliation was 1,072 paths / 5,012 findings to 1,073 paths (968 test, 105 support) / 5,013 findings, with 139 owners. The sole path addition was the authored `effect-vitest-primitives.test.ts`; its platform-node service fixture contributes the additional EV010 judgment row. Previously generated D9 declarations remain included rather than hidden.

### Lane changed paths

- `standards/effect-vitest.primitives.jsonc`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts`
- `packages/tooling/tool/cli/src/commands/Lint/Lint.errors.ts`
- `packages/tooling/tool/cli/src/commands/Lint/index.ts`
- `packages/tooling/tool/cli/src/commands/Lint/EffectVitest.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestPrimitives.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestPolicy.ts`
- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts`
- `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts`
- `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts`
- `packages/tooling/tool/cli/test/fixtures/effect-vitest-rc112/**`
- Command-produced `standards/effect-vitest.inventory.jsonc`, `goals/effect-vitest-canon/ops/inventory/test-files.json`, and `goals/effect-vitest-canon/ops/inventory/detector/**` from the earlier exact writer runs; these require the orchestrator's final refresh after the three prose changes.
- `goals/effect-vitest-canon/history/lanes/p0d-primitives.md`

### Remaining orchestrator acceptance

- Regenerate the baseline, census, and detector rows through the exact public command, repeat it for determinism, and record final scanner/process timing without attributing variation absent evidence.
- Run the default ratchet against the regenerated graph-backed hints.
- Run the mandatory full `@beep/repo-cli` package verification and own any packet/status or publication work.
- P0e and later migration, instrumented-test, and PR-gate work remain out of this lane.

## Package-directory cwd correction

- 2026-09-08: Resumed after the orchestrator's full `@beep/repo-cli` package verification exited 1 in 397.7 s with 2/166 test files failing and 9/3,207 tests failing (164 files and 3,198 tests passed). All nine failures are introduced P0d test-path defects: graph, fixture, tsconfig, and virtual example paths were rooted at `process.cwd()`, so package-audit execution from `packages/tooling/tool/cli` incorrectly resolved the graph beneath that package. Source hashes remained stable, and all other package tests passed. Production behavior and the P0c-verified detector/syntax files remain frozen.
- 2026-09-08: Reused the established module-URL test idiom from nearby repo-cli suites. `effect-vitest-primitives.test.ts` now derives a stable repository root for the checked-in graph, a stable package root for `tsconfig.json` and virtual compiler examples, and a module-relative absolute fixture root. All graph reads and fixture/compiler paths use those roots; there is no cwd mutation, fallback, duplicate production utility, or hidden read failure. `effect-vitest-contract.test.ts` uses the same stable repository root for its graph-backed pin mismatch test.
- 2026-09-08: Acknowledged Yeet inbox row `local-shard-3b0365d20c9b` with a time-bounded waiver because the introduced cwd repair is active while the orchestrator owns the eventual fix SHA and final verification. It was not mislabeled environment-only or wontfix.

### Cwd correction evidence

- Changed-file Biome: `PATH=~/.local/share/mise/installs/bun/1.4.1/bin:$PATH bunx --bun biome check --write packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts packages/tooling/tool/cli/test/effect-vitest-contract.test.ts`; exit 0, 2 files checked, no fixes needed.
- Repository-root suites: `PATH=~/.local/share/mise/installs/bun/1.4.1/bin:$PATH bunx --bun vitest run packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts packages/tooling/tool/cli/test/effect-vitest-contract.test.ts --pool=threads`; exit 0, 2 files passed, 19 tests passed, 6.36 s Vitest / 7.8 s process.
- Package-directory suites, executed with cwd `packages/tooling/tool/cli`: `PATH=~/.local/share/mise/installs/bun/1.4.1/bin:$PATH bunx --bun vitest run test/effect-vitest-primitives.test.ts test/effect-vitest-contract.test.ts --pool=threads`; exit 0, 2 files passed, 19 tests passed, 7.30 s Vitest / 7.8 s process. This reproduces and closes the cwd boundary that failed the full audit.
- Direct Effect compiler: `PATH=~/.local/share/mise/installs/bun/1.4.1/bin:$PATH bun tools/tsgo-shim/tsgo.js -p packages/tooling/tool/cli/tsconfig.check.json`; exit 0, 9.7 s process.

### Cwd correction changed paths

- `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts`
- `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts`
- `goals/effect-vitest-canon/history/lanes/p0d-primitives.md`

### Final handoff state

- The concrete introduced failure is fixed and proven from both invocation directories. No production source, detector, syntax helper, fixture, graph, generated artifact, dependency, configuration, timeout, or property-floor change was made in this correction.
- The orchestrator still owns the mandatory full `@beep/repo-cli` package verification, final graph-backed artifact regeneration/determinism, scanner and wall-time measurements, default ratchet, fix-SHA inbox acknowledgement after publication, and packet status.
