# Runner hosted policy repair

Bounded owned-source repair in progress. Prior proofs and concurrent CLI work remain preserved.

## Repairs and current evidence

The three Proxy get traps now use Effect Match in the same order: tester skip/only/fails, skipIf/runIf, each, prop, fallback; non-live methods effect, layer, fallback; methods effect, live, layer, fallback. Matching callbacks defer the same Reflect.get and instrument calls, including fallback behavior for other string/symbol keys. No registration, cancellation, lifecycle, finalizer or deadline code changed.

`instrumentEffect` is now `Effect.fnUntraced(function* <A,E,R>(...))`. Its generator body and four positional arguments (last optional) are unchanged. This internal untraced form satisfies the direct-Effect.gen law without adding a named tracing span or changing currying. The two hosted JSDoc locations are message getters in the current source, not arrow callbacks; each now documents its diagnostic meaning and returned text. Error schemas, messages, defaults and exports are unchanged.

Source compiler and Biome pass. The initial combined ESLint --max-warnings=0 command exits 1 solely because the canonical docs configuration does not match the internal instrumentation path. `DocsESLintConfig.ts` 90–92 and 254–271 explicitly exclude tooling src/internal from those profiles. Separate targeted ESLint on Vitest.errors.ts passes with --max-warnings=0. No --no-warn-ignored, alternate configuration, allowlist or suppression was added to manufacture green output.

Native-runtime law check exits 1 with **zero errors and eight warnings**: the preserved Instrumentation WeakMap/Map, VitestRuntime Object.assign, and five CLI EffectVitestSyntax WeakMaps. There are no remaining native switch findings. The Effect-fn law check exits 1 solely for CLI `EffectVitestPolicy.ts:224` callback; the owned instrumentEffect violation is gone. These unowned/reviewed boundaries remain explicit handoff limitations, not waived gates.

The full Node runner suites pass: 42 ordinary passes, four expected failures, two skips, four todo (52 registrations). All pre-existing test and fixture hashes remain unchanged. Bun and full package verification are running sequentially on the final source.

## Greptile Clock claim

The unchanged public example is valid against rc.113. Installed `Clock.ts:189` declares `Clock: Context.Reference<Clock>`. Installed `Context.ts:64` declares Key extends Effect; Service extends Key at line 98; Reference extends Service<never, Shape> at line 485. The immutable rc.113 reference has the same relationships (Clock 189, Context Key 64, Reference 335). Thus this reference is an Effect yielding the default clock with no required environment, not merely an inert tag.

Exact example text was extracted into a private ESM file and compiled with tsgo using a config extending the existing package check config and canonical aliases: exit 0. Two earlier private extraction attempts are retained: an unstripped blank JSDoc star caused parse errors; then a .ts file outside a type=module package was interpreted as CommonJS. Removing only the comment prefix and using .mts supplies the correct ESM context without changing the example's code or compiler policy. These were diagnostic-harness errors, not failures of Clock.Clock typing.

Node and Bun runtime probes both resolve `Effect.runSync(Clock.Clock)` successfully, return the same default reference on repeat resolution, and expose bigint monotonic time and numeric current time. The source-only test-kit file remains byte-identical; no cosmetic alternative or ownership expansion is needed. Full package docgen will provide the normal retained example-validation proof as well.

## Final results and remaining gates

Full `bun run beep quality package-verify @beep/test-utils` exited **0** in **50.691 seconds**. Complete terminal inner summary: `ok audit 45.6s   ok docgen 3.3s`. Successful canonical rendering retains step summaries rather than individual successful child stdout, so no unobserved package-wide count is invented. Normal full docgen validates the unchanged source-only makeIt example. The focused Node runner took 78.301 seconds and Bun took 39.307 seconds; each reports **42 passed, 4 expected fail, 2 skipped, 4 todo (52 registrations), two files passed**. All launched processes have exited and been joined.

Both owned files additionally pass targeted `ESLint --max-warnings=0` under the repository's existing deprecated-apis profile, selected only for that process. This supplements the passing default docs check on Vitest.errors.ts; it does not replace or conceal the documented default-profile mismatch for internal instrumentation. No repository configuration changed. Biome and focused source compilation pass. AST evidence confirms the instrumentEffect generator body is identical and Vitest.errors runtime AST is identical after stripping comments. All test/fixture bytes and the source-only test-kit example remain unchanged, which preserves every assertion, seed, property floor, timeout, skip mode and registration exactly.

The broad native-runtime check remains exit 1 for these unchanged warnings, with **zero errors**:

- `src/internal/VitestInstrumentation.ts:69` WeakMap and `:299` Map: reviewed operational reference-identity boundaries, explicitly excluded from this repair.
- `src/internal/VitestRuntime.ts:40` Object.assign: frozen sibling source.
- CLI `EffectVitestSyntax.ts:158,159,160,347,348` WeakMaps: another package, outside ownership.

The broad effect-fn check remains exit 1 solely for CLI `EffectVitestPolicy.ts:224` callback. These receipts describe the concurrent-source state when checked; no later CLI completion is inferred and no repeated broad check was run to manufacture a pass. Root owns final combined policy proof and disposition. No native-switch or direct-Effect.gen violation remains in the owned implementation. No readiness, hosted-policy acceptance or merge claim follows from package success.

Installed runtime: Node v24.20.0, Bun 1.4.2, Effect/@effect/vitest 4.0.0-rc.113, Vitest 4.1.11. The inherited adapter peer declaration >=5 <6 remains qualified; these bounded results do not change that declaration.

## PR reply evidence for the Clock example

Suggested factual reply: “At the pinned Effect rc.113 API, Clock.Clock is a Context.Reference<Clock>, whose Reference → Service → Key chain extends Effect. The exact unchanged example compiles with tsgo in ESM context and full package docgen passes. Node 24.20.0 and Bun 1.4.2 both resolve Effect.runSync(Clock.Clock) to the default clock and successfully read its monotonic/current time effects. No source change is necessary for this claim.”

This lane does not post that reply or resolve the review thread. Reference locations, compiler/runtime logs and source hashes are retained for Root to cite. The private extraction errors described above are harness-only and are not represented as evidence against the unchanged example. One exploratory rg used an outdated repo-configs package-family path (exit 2); the actual policy-pack path was then located and inspected. No policy file was edited.

## Source identity and ownership

Only the two authorized source files changed; this report is the only authored repository document. `accepted-source-hashes.json` is the requested final input manifest, not an assertion that Root has already accepted this continuation. It includes the unchanged source-only example, both runner tests and both fixture templates. `before-hashes.json` and the per-file before/after snapshots and diffs retain provenance.

| Owned source | Before SHA256 | Final SHA256 |
| --- | --- | --- |
| `packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts` | `b4f77a8d1269d9e25068a4c3ed86f406bd7dd55ee860924d1e8c2be5354381af` | `31491385226efb4a309337e7876329928d3fd1a475357af371192b1bd05806e0` |
| `packages/tooling/test-kit/test-utils/src/Vitest.errors.ts` | `6e691362f10ddbaa4b1d7c9c10f1f8bf134f4c695aadf90f93c32484755cd974` | `c568bcadc7eb309aca206a712e689723cbaaa0113a80edc94747b90ca65b540b` |

## Commands and terminal receipts

Private prefix: `~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/`. Every receipt stores exact cwd/command, terminal exit, wall time, instrumentation source-before/source-after hash and complete log SHA256. The final accepted-source manifest supplies both owned file identities. All commands ran from the worktree root; runner --root selected canonical package configuration. The private source/example compiler configs extend the existing package check config without diagnostic exclusions. The private node_modules symlink provides ordinary dependency resolution for the external scratch example; no install occurred.

| Receipt | Exit | Seconds | Exact command |
| --- | ---: | ---: | --- |
| `format.json` | 0 | 2.649 | `bunx --no-install biome check --write packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/src/Vitest.errors.ts` |
| `compiler.json` | 0 | 0.657 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/tsconfig.source.json` |
| `eslint.json` | 1 | 3.316 | `bunx --no-install eslint packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/src/Vitest.errors.ts --max-warnings=0` |
| `native-runtime.json` | 1 | 9.640 | `bun run packages/tooling/tool/cli/src/bin.ts -- laws native-runtime --check` |
| `effect-fn.json` | 1 | 6.342 | `bun run packages/tooling/tool/cli/src/bin.ts -- laws effect-fn --check` |
| `node-runners.json` | 0 | 78.301 | `node node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` |
| `example-compiler.json` | 1 | 0.263 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/tsconfig.example.json` |
| `clock-node.json` | 0 | 0.057 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/clock-resolution.ts` |
| `clock-bun.json` | 0 | 0.016 | `bun ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/clock-resolution.ts` |
| `example-compiler-final.json` | 1 | 0.635 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/tsconfig.example-final.json` |
| `eslint-errors.json` | 0 | 2.956 | `bunx --no-install eslint packages/tooling/test-kit/test-utils/src/Vitest.errors.ts --max-warnings=0` |
| `example-compiler-esm.json` | 0 | 0.646 | `bunx --no-install tsgo -p ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/tsconfig.example-esm.json` |
| `bun-runners.json` | 0 | 39.307 | `bun node_modules/vitest/vitest.mjs run --root packages/tooling/test-kit/test-utils test/Vitest.test.ts test/Vitest.runtime.test.ts --reporter=verbose` |
| `structural-proof.json` | 0 | 0.119 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/runner-hosted-policy-fix/structural-proof.cjs` |
| `package-verify.json` | 0 | 50.691 | `bun run beep quality package-verify @beep/test-utils` |
| `eslint-deprecated.json` | 0 | 4.128 | `env BEEP_ESLINT_PROFILE=deprecated-apis bunx --no-install eslint packages/tooling/test-kit/test-utils/src/internal/VitestInstrumentation.ts packages/tooling/test-kit/test-utils/src/Vitest.errors.ts --max-warnings=0` |

No coverage, scanner benchmark, network/dependency operation, Git command, additional agent, baseline writer or suppression ran. The reviewed native identity caches remain unchanged. The package command's normal generated build/inbox effects were not replaced by manual canonical writes. Raw child fixture directories were not separately retained by this invocation's optional evidence setting; complete runner terminal logs and all normal assertions are retained. No extra repeat was launched solely to change evidence presentation.

`manifest.json` hashes all private files (excluding the dependency symlink), the report and final source identities. Graft estimated 4,188 tokens saved for initial retrieval; no graph mutation ran. The source fix is complete within ownership, with remaining broad-policy outcomes explicitly handed to Root.
