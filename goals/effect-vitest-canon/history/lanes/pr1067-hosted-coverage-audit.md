# Hosted coverage attribution

Read-only attribution in progress. Production sources and the live Root coverage proof remain untouched.

## Finding and confidence

The evidence points to a **Node-version/thread execArgv incompatibility at child worker construction**, not an instrumented watchdog failure. The inherited-worker-ID contamination hypothesis is not established. No source fix or environment scrub was made.

Root's filtered coverage was already terminal when inspected: exit 0, 76.905 seconds, accepted=true, sourceDrift=[], baselineUnchanged=true. All seven runner acceptance hashes matched before the bounded probes and still match at handoff. The original hosted failure is retained and is not erased by Root's successful local coverage.

The hosted job actually used **Node 22.22.3**, proved by log lines 405/493/507 and the feature probe at line 783. Installed local Node is 24.20.0; Bun is 1.4.2. Hosted Vitest is 4.1.11. This difference is causal-relevant: `vitest.shared.ts:203–206` supplies `--js-float16array` only under Node <24 without Bun. The comment at 196–202 explicitly describes that option as intended for forked workers. The runner fixture hardcodes **threads**, loading that same canonical config. Vitest passes project.config.execArgv into the selected ThreadsPoolWorker without filtering this V8 flag.

**Proven:** local Node worker construction rejects the exact flag with `ERR_WORKER_INVALID_EXEC_ARGV` before a worker exists. The failure is independent of the two tested Vitest worker identity variables. The actual hosted source path selects that flag for Node 22 and feeds it to the threads constructor. Hosted children report zero suites/tests and teardown fails because no thread exists.

**High-confidence inference, not an exact hosted reproduction:** the rejected flag is the original hosted startup trigger. The raw log does not preserve its exception code, and Node 22.22.3 is not installed locally. No install/network operation was authorized or attempted. Other hidden startup triggers cannot be conclusively excluded from a secondary teardown message alone. Resource pressure and the Vitest5 peer mismatch are not assigned as causes.

## Invocation and earliest underlying boundary

Hosted lines 872–879 run `bun run ... ci lane coverage --affected --base origin/main --summarize`, then `bun run coverage -- --concurrency=3 --affected --summarize`. Planning falls back to full coverage with ten weighted shards, aggregate Vitest worker cap eleven and a prebuild. The test-utils task at line 9851 is `bunx vitest run --coverage --fileParallelism=true --maxWorkers=1`; line 9866 confirms V8 coverage. This is contextual invocation evidence, not permission to reproduce the full job.

The child command (`test/Vitest.runtime.test.ts:136–158`) uses the parent's process.execPath, the installed Vitest entrypoint, the copied real fixture, `--pool=threads`, the package root, JSON plus public diagnostic reporters, and result output. It does not pass `--coverage`. It inherits environment via extendEnv=true, overriding only the fixture mode, BEEP_TEST_TRACE and CI; ordinary cases explicitly set CI=false even inside hosted CI. The package's shared configuration still detects Node 22 and assigns the worker flag regardless of that CI override.

The earliest observed failing child is watchdog at hosted lines 10164–10180. Its actual field contains the escaped child output: failure in ThreadsPoolWorker.thread → off → PoolRunner.stop, followed by JSON with zero total suites, zero total tests, empty testResults and success=true. The later termination timeout is a cleanup failure, not the test's watchdog deadline. Seven embedded child JSON summaries were decoded privately; all contain zero suites/tests and empty results. The success=true field is vacuous when no tasks were collected/executed and cannot count as a passing child test.

Installed Vitest source `dist/chunks/cli-api.CnMVyzaz.js` explains the ordering:

- 3730–3734 merges project.config.execArgv into task worker options.
- 3227–3235 assigns `_thread` only after `new Worker(entrypoint, { env, execArgv, ... })` constructs successfully.
- 2957–2973 marks STARTING and calls worker.start before attaching listeners; a constructor exception leaves the thread unset.
- 3519–3552 handles the failed start and later schedules stop. The resolver rejection is consumed by a catch that only records a tracing exception, so the original cause need not appear in the public child JSON/terminal output.
- 3025 calls worker.off during stop; 3252 throws the observed “torn down or never initialized” error if `_thread` is unset. That secondary exception prevents normal cleanup and explains the later termination timeout.

The public per-test diagnostic reporter has no completed test case from which to report the original startup error. No BEEP_VITEST phase/raw-error line appears in the retained test-utils hosted excerpt. Thus no evidence shows an instrumented body, property trial, lifecycle or watchdog was reached. Parent assertions about TestHang, names and last logs fail downstream of startup.

## Environment hypothesis and bounded execution

Installed platform NodeChildProcessSpawner.ts:120–121 merges the parent's process.env with explicit child env when extendEnv=true. Worker identity variables can therefore reach the child CLI. Installed Vitest init.k9zZ9sLh.js:216–217 sets VITEST_POOL_ID and VITEST_WORKER_ID from its start message, and later updates the worker id for execution. ThreadsPoolWorker does not choose its constructor flags based on these identity variables. No exact hosted values for these variables are present in the job log; their inheritance is source-derived, not a captured CI environment dump.

Only explicitly safe runtime variable names were inventoried locally: CI, VITEST, VITEST_MODE, VITEST_POOL_ID, VITEST_WORKER_ID and NODE_ENV. No secrets were queried, printed or injected. The probe supplies a minimal known environment matching the ordinary child overrides; representative worker IDs 1/1 are a counterfactual, not a claim about the hosted values. Genuine user environment/configuration was not cleared in any production path.

After Root's terminal status and matching source hashes, a private worker-construction probe used the same public Node Worker boundary called by installed Vitest. It executes only a private worker that posts an initialized marker; it does not run all tests, alter the pool, change timeouts or manufacture a TestHang.

| Runtime | Explicit flag | Worker IDs absent | Worker IDs 1/1 |
| --- | --- | --- | --- |
| Node 24.20.0 | none | Initialized | Initialized |
| Node 24.20.0 | --js-float16array | ERR_WORKER_INVALID_EXEC_ARGV before initialization | Same error before initialization |
| Bun 1.4.2 | none | Initialized | Initialized |
| Bun 1.4.2 | --js-float16array | Initialized | Initialized |

This is a minimal native boundary characterization, **not an exact Node22/CI/full-fixture reproduction**. The probe uses the exact suspect flag as data because canonical Node24 configuration correctly omits it. The preliminary one-line Node probe also returned the same code; its result is superseded only as evidence detail by the fully retained paired probe, not hidden. Every constructed worker was terminated and awaited. No package suite, coverage command or build ran in this lane.

## Bounded next step for Root

Do not approve a worker-ID environment scrub on this evidence: it does not address explicit invalid execArgv. Preserve genuine user configuration and all fixture/deadline/property contracts.

The smallest decisive next diagnostic is an authorized Node 22.22.3 child-startup probe recording the public worker constructor error and resolved execArgv, then one real existing fixture. It should first confirm the predicted ERR_WORKER_INVALID_EXEC_ARGV, without switching pools or increasing timeouts. If Root then authorizes a local compatibility fix, investigate whether launching the child process with the required Node22 V8 feature flag and omitting only that explicit worker argument preserves Float16Array availability in its workers. That candidate requires empirical Node22 proof before any source change: blindly stripping the flag can instead remove the Effect-required feature. A runtime upgrade or pool/global-config change is outside the present constraints and is not proposed as an automatic workaround.

No current authorized source edit can be justified as pure environment cleanup from this audit. Root must choose the next narrow compatibility diagnostic/ownership extension; the production runner, fixture, global configuration and installed dependencies remain untouched. The inherited @effect/vitest rc.113 requirement for Vitest >=5 <6 remains a separate support-range qualification, not proof of this trigger.

## Receipts and handoff limits

All commands ran from the requested worktree. Source reads used Graft first (estimated 4,958 tokens saved), then targeted installed/reference/source fallback. No graph refresh occurred. Discovery errors were limited to an initial guessed ChildProcessSpawner filename (resolved to NodeChildProcessSpawner.ts); these were read-only path misses. The report-first write preceded substantive discovery. Root's terminal proof/source-match preconditions were verified before any worker execution.

| Retained probe receipt | Exit | Seconds | Exact command |
| --- | ---: | ---: | --- |
| `node-probe.json` | 0 | 0.052 | `node ~/.cache/beep/effect-vitest-canon/pr1067-resume/hosted-coverage-audit/probe.mjs` |
| `bun-probe.json` | 0 | 0.053 | `bun ~/.cache/beep/effect-vitest-canon/pr1067-resume/hosted-coverage-audit/probe.mjs` |

Each probe receipt contains its command, wall time, terminal exit and raw log hash. Probe exit 0 means the characterization script completed and recorded both construction successes and expected construction failures; it is not a conformance pass. All launched workers/processes exited and were joined.

Private evidence is under `~/.cache/beep/effect-vitest-canon/pr1067-resume/hosted-coverage-audit/`: hosted test-utils raw excerpt, decoded child summaries, source/reference/job/status hashes, before/final acceptance checks, safe variable inventory, probe source, raw logs and terminal receipts. The original full hosted log and Root filtered coverage status remain immutable external inputs, identified by hash. `manifest.json` hashes every owned private artifact and this report. No raw environment dump or secret operation was performed.

Final result: a concrete native startup incompatibility has been demonstrated on installed Node with the exact source-selected flag, explaining the hosted symptom by a strong source chain. Exact hosted Node22 constructor evidence remains the explicit limit. No unproven remedy, global policy change, failure waiver, source repair or phase acceptance is claimed. Root retains production-fix authorization and the final hosted proof judgment.
