# Portable parameterized runner context

The Graph3D migration reproduced a runner import failure in Chromium:
`NodeAsyncHooks.AsyncLocalStorage is not a constructor`. Before the repair,
the dedicated browser acceptance file failed collection and ran no tests.

The repair removes Node async storage. Vitest's public
`TestRunner.createTaskCollector` expands and names cases through native `.for`;
the collector delegates each registration to the original Effect tester.
The original tester therefore retains layer provisioning, retries, cancellation
and Effect scope ownership. Each callback receives its own public TestContext.
Property-run finalization still uses the existing context-keyed WeakMap.

## Browser acceptance

Vitest 5.0.1 / Playwright Chromium, headless, using the edited runner source:

- Three concurrent native-live cases include duplicate values and await a real
  requestAnimationFrame callback.
- Two concurrent tuple cases preserve the tuple argument unchanged.
- Two concurrent duplicate layer cases yield a named Context service, and the
  afterAll assertion proves the layer finalizer ran once.
- One native Effect property test retains callback context across a yield.
- One expected-failure watchdog case acquires a scoped resource, waits forever,
  and proves its finalizer ran before the suite completes.

Result: eight passed, one expected failure; one file passed (2.30 seconds).
The initial successful eight-case run triggered Vite dependency optimization;
a second run with effect/Predicate explicitly optimized passed without reload.
The expanded nine-case acceptance then passed with watchdog cleanup included.
This is focused browser acceptance, not a root or hosted proof. Browser tests
currently live in the private acceptance fixture; committed package regressions
cover the portable adapter under the configured test runtime.

## Evidence hashes

Private fixture directory: `~/.cache/beep/effect-vitest-canon/runner-browser-acceptance`.
The fixture imports the workspace runner alias and uses the Playwright provider.

- `context.test.ts`: `a8338dcf11691a25a4fc4fca191f2e8f666636d60ee2963e2fcbe758e7311ed9`
- `vitest.config.ts`: `261429a3428775729aa16683dd27c48fff2771d9ab5d767d4f90b311ffb1d210`
- `before.log`: `26ac5943612a9aefb4456b53a6b754988c625de22ac89dad26449cb315e8479d`
- `after-stable.log`: `12f98c5772ba341e5a81474245f6d76880d9153554b384ab6489e08aa68d1838`
- `watchdog.log`: `8a3ddcfffe05fd3e49594e3cb57fa1093613a519df927ecd270baae7a1ce264f`

## Package and consumer integration

Full `bun run beep quality package-verify @beep/test-runner` passed:
audit 14.6 seconds and docgen 3.8 seconds. Configured Node and Bun each passed
three files: 41 passed, five expected failures, three skipped and four todo.

A copy of the Graph3D migration's five renderer tests, changing only its tester
import to the repaired runner, passed in Chromium alongside the context fixture:
13 passed and one expected failure across two files (5.50 seconds). This is
consumer integration evidence, not a claim that Graph3D's migration branch has
already adopted or published the prerequisite.

The first combined run was interrupted by Vite optimizing newly imported graph
renderer dependencies. Explicitly listing those dependencies in the private
config produced a passing run without reload. The initial minimal config hash
above describes the earlier eight/nine-case proof; final config and consumer
fixture hashes follow.

The two new detector candidates were reviewed individually. EV009 preserves the
live tester as the regression subject. EV014 acquires/releases only synchronous
in-memory service/configuration/logger values; no external acquisition requires a
custom hook budget. Both exceptions include reasons in the baseline; other rows
are unchanged. No regression code changed after the green package proof.
Publication and hosted checks remain pending.
No migration observability finding is closed merely by this prerequisite proof.

- Final `vitest.config.ts`: `794f39d4ee4fe22623174592edc57463ec92d325dff05ab551c194e5c83365ec`.
- Final `Graph3D.renderer.test.ts`: `d2fb59071cb8cee120e29663ace9beb2f0d69361135c2c25bbb8194db0b33853`.
- Final `graph3d-integrated-stable.log`: `3b2360326898488d1bedeabcd987e1dca58d2fc296f3654c0f0df5f291e51572`.
