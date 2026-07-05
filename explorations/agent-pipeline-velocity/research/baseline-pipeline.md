# Baseline: Yeet / Quality / CI Pipeline Anatomy (2026-07-05)

Explorer-agent inventory; facts only. Paths relative to repo root.

## Yeet anatomy (`packages/tooling/tool/cli/src/commands/Yeet/`)

- internal/ = 8,353 LOC: Handler.ts 100KB, Closeout.ts 42KB, QualityIssueIndex.ts 34KB, FallowFeedback.ts 23KB, Status.ts 22KB, Planner.ts 21KB, Verdict.ts 8.8KB.
- Modes (Planner.ts): **repair** = prepare (effect-imports → dual-arity → fallow:boundaries → config-sync → lint:fix → docgen, serial) + affected feedback (build/check/lint/test); **verify** = fallow advisory write + full pre-push proof (tiers: full | review-fix); **publish** = advisory → commit → push → optional monitor (variants pushOnly/startPrEarly/--fast --monitor); **monitor** = `gh pr view` + `gh pr checks --watch`; **closeout** = PR context + review-gate GraphQL.
- **Feedback turbo invocation: `--concurrency=3`** (YEET_TURBO_CONCURRENCY, Planner.ts:154), `--continue=dependencies-successful --summarize --ui=stream`, affected-filtered. Workstation: 32c/64t, 128GB.
- Fallow envelopes: `.beep/fallow/` + `.beep/yeet/fallow-quality-issues.json`; check-mode envelopes from verify can poison next run (known gotcha).

## Prior optimization ledger (`goals/repo-quality-throughput`, PR #215)

rqt-001 duplicate affected feedback removed from verify/publish (−348 tasks); rqt-002 lint:fix clean-tree fast path (~43ms); rqt-003 CI setup timing metadata (+Nix PR skip ~169s); rqt-004 proof-parity-map.md + check-name-baseline.md; rqt-005 docgen manifests (223s → 7.9s on 24-pkg reuse); rqt-006 task-scoped turbo inputs (tstyche.json invalidation 356→13 tasks); rqt-007 repo-exports catalog sharding (100s → 8.15s); rqt-008 test-participation filters (type-test 87→34 tasks); rqt-009 yeet fast-plus-monitor (opt-in); rqt-010 external-tooling prototype gates (oxlint/tsgo/rolldown waived pending isolated proof).

**Named remaining bottlenecks** (implementation-closeout.md): full docgen generation; repo-exports shard rebuild (ts-morph-heavy); sequential repo-cli reuse tests; root type-test replay (turbo no-ops from ^type-test); serial integration no-test probes; setup/cache policy tuning (deferred pending comparable runs).

## turbo.json

- futureFlags: affectedUsingTaskInputs, filterUsingTasks, globalConfiguration.
- Global inputs: .bun-version, .nvmrc, package.json, tsconfig{,.base,.packages}.json. Task-scoped config inputs per rqt-006; `!.beep/**` excluded.
- cache:false — lint:fix, test:integration, coverage, codegen, dev. Remote cache: **push events only** (TURBO_TOKEN/TEAM emptied on PRs — CSF-001, check.yml:95-101).

## CI (`.github/workflows/check.yml`, 754 lines)

- Runners: blacksmith-2vcpu (pr-size, secrets, security, nix, sast) / blacksmith-4vcpu (verify matrix, fallow, build, desktop-ipc).
- Verify matrix: lint, lint-policy (`beep lint policy`, 25m), repo-sanity, check, test-unit (`--unit --types`), test-integration, docgen (affected/full switch), codegen. Lane-gate skips unaffected lanes on PRs. Check workflow wall ≈ 13–14 min.
- Setup action: bun install cache (`~/.bun/install/cache`, key = bun.lock hash) + timing metadata to step summary.
- Existing timing substrate: turbo `--summarize` JSON per task (start/end, cache status local/remote) + `beep ci append-turbo-summary`; fallow per-lane `$SECONDS`; **no yeet phase-duration surface** (AIMetrics is external-metrics only).

## Local/hosted proof gap

yeet verify covers build/check/lint/test (+prepare); hosted CI additionally runs lint-policy, fallow advisory, codegen drift, gitleaks (BASE config), OSV, SAST, repo-sanity. Divergence is the documented source of green-local/red-hosted round trips (rqt-004 map).

## Hooks (lefthook.yml)

pre-commit parallel: biome (staged, fix+stage), eslint jsdoc (tooling scope only), gitleaks --staged, typos — plausibly <10s. commit-msg commitlint. post-merge version-sync. **No pre-push hook** (proof delegated to yeet verify).
