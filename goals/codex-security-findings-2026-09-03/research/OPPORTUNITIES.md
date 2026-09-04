# Opportunities

## 2026-09-03 — Output limits did not automatically bound staging work

- **What I was doing:** Addressing the first review pass after the twelve
  security remediations and their focused regressions were published.
- **Evidence:** PR #949 review identified that the Markdown node counter and
  person-match discovery bounded their final counts but could still enqueue or
  materialize an attacker-sized input before rejecting it. The same pass found
  that individually bounded patent ranges could exceed the intended aggregate
  budget before deduplication, and that the worker JSON ceiling omitted its
  framing newline. Exact-head CI then rejected a direct `node:fs`/`async`
  implementation at the Effect compiler boundary and reported the corrected
  Markdown queue helper one point above the Fallow cognitive-complexity limit.
  The following exact-head unit run also showed that an adversarial child-array
  fixture threw during schema construction, before reaching the bounded reader
  the test intended to prove.
- **What would have prevented it:** Security-boundary reviews should separately
  account for source enumeration, intermediate staging, aggregate expansion,
  final retained output, and wire framing. Boundary tests should make data just
  beyond the decision point unreadable, not merely assert the final error.
  Resource-bound implementations in the CLI should begin from Effect platform
  services and be kept below the repository complexity envelope before review;
  adversarial fixtures must bypass earlier eager constructors only at the
  explicit trust boundary under test.

## 2026-09-03 — Runtime-root rollout prose described an older predecessor

- **What I was doing:** Reviewing the operational handoff for the move to the
  home-backed coordination root.
- **Evidence:** PR #949 review compared the immediate parent revision and found
  that it coordinated below `/tmp`, while the hard-cutover prose told operators
  only to drain `/run/user/<uid>`.
- **What would have prevented it:** Migration instructions should be checked
  against the immediate parent revision and name every concrete legacy root;
  older historical roots can be listed in addition, but cannot replace the
  direct predecessor in the drain procedure.

## 2026-09-03 — Coverage fixtures bypassed the hardened sandbox contract

- **What I was doing:** Repairing the exact-head Coverage Regression failure
  after the review fixes were published to PR #949.
- **Evidence:** The Markdown coverage shard showed that `Array.filter` read an
  adversarial child slot beyond the 10,000-node decision boundary before the
  queue limit ran. The repo-cli shard showed that the mail-restoration fixtures
  still modeled bind-mounted host output and a directly invoked bubblewrap
  process, while the hardened engine now requires a user-scope memory cgroup
  and publishes successful quota-limited output only through a validated tar
  handoff. The stale fixture therefore invoked the host `systemd-run` and could
  not produce terminal mail evidence in CI.
- **What would have prevented it:** Hostile collection tests must assert that
  the first out-of-budget slot is never read. Process-boundary fixtures must
  model every security-relevant wrapper and publication boundary—including
  cgroup launch, private output staging, success-only handoff, and the absence
  of failed partial publication—rather than only translating bind paths.

## 2026-09-03 — Process-heavy restoration tests inherited global concurrency

- **What I was doing:** Following the replacement exact-head Coverage
  Regression run after repairing the restoration sandbox fixtures.
- **Evidence:** Property Laws and the ordinary mail-restoration cases passed,
  but five resume, tamper, and aggregate-acceptance cases reached Vitest's
  five-minute per-test ceiling. The repository test configuration runs tests
  globally concurrent; the affected cases each provision process wrappers,
  stream a tar handoff, and exercise durable restoration state. The isolated
  slice-acceptance case completed in seconds, confirming contention rather
  than a stuck production operation. The first scheduler annotation used
  Vitest's deprecated `.sequential` chain; exact-head Lint Policy required the
  supported `{ concurrent: false }` option instead, and exact-head typechecking
  confirmed that the Effect-aware test wrapper exposes the same option only as
  the test call's third argument.
- **What would have prevented it:** Suites that create real child-process
  pipelines or repeatedly mutate durable lifecycle fixtures should declare
  sequential execution explicitly. A fixture change that adds another
  security boundary should trigger a concurrency audit in addition to its
  functional assertions, using the option-based Vitest scheduler API enforced
  by repository lint policy.

## 2026-09-03 — Aggregate coverage hid changed-file ratchet drops

- **What I was doing:** Running package-scoped coverage for every workspace
  touched by the security batch before publishing another repair head.
- **Evidence:** The langextract and Markdown suites passed every test and kept
  high package-level coverage, but the scoped ratchet still identified three
  uncovered metrics in `Alignment.behavior.ts` and one uncovered branch in
  `Md.safe.ts`. The langextract gaps were impossible `Option.none` and
  duplicate-match helper arms; the Markdown gap was a forged scalar-child
  branch in the new bounded-document walk.
- **What would have prevented it:** Run `bun run coverage
  --filter=<affected-package>` for every touched coverage owner before the
  first push, and treat the command's changed-file comparison—not only its
  aggregate percentage table—as the ratchet proof.

## 2026-09-03 — Stale-base analysis exceeded Yeet's capture limit

- **What I was doing:** Publishing the coverage repair head with `beep yeet
  publish --fast --monitor --allow-stale-base`.
- **Evidence:** Yeet stopped before committing because its stale-base overlap
  check ran `git diff --name-only` from the branch merge base to `origin/main`
  and the output exceeded the repo-run capture limit. The intended three files
  remained staged, and the failure occurred before any push.
- **What would have prevented it:** Stream or bound the stale-base path set
  independently of the generic command-output capture limit, while preserving
  enough structured output to report real overlap conflicts.

## 2026-09-03 — Suite-level serialization did not reach Effect tests

- **What I was doing:** Monitoring the exact-head Coverage Regression job after
  restoring the changed-file coverage floors.
- **Evidence:** The repo-cli coverage task passed 2,833 tests, but six
  process-heavy restoration tests in `corpus-command.test.ts` simultaneously
  exhausted Vitest's five-minute timeout. Two affected suites already declared
  `{ concurrent: false }`; the Effect-aware wrapper requires the option on each
  `it.effect` call to override repository-wide concurrent scheduling. An
  interrupted local package run also showed the existing serialized
  all-family restoration test straddling the default 300-second limit.
- **What would have prevented it:** Apply the supported per-test concurrency
  option whenever an Effect test launches restoration subprocess pipelines,
  and give intentionally exhaustive end-to-end cases an explicit timeout above
  their measured coverage runtime; suite-level scheduling is not sufficient
  proof for the wrapper.

## 2026-09-03 — A successful extractor exit left its stdin sink pending

- **What I was doing:** Investigating the replacement Coverage Regression run
  after process-heavy restoration tests had been serialized.
- **Evidence:** Two same-availability-zone Spot runners were terminated during
  the first exact-head run, obscuring the initial signal. An isolated rerun then
  showed four restoration tests reaching Vitest's five-minute ceiling. Focused
  Effect diagnostics proved that the quota producer and destination `tar`
  processes had exited and every diagnostic stream had drained, while
  `Stream.run` feeding the extractor's stdin remained pending. The same four
  cases passed in seconds after racing that transfer against the extractor exit.
- **What would have prevented it:** A child-process pipeline should treat the
  destination process exit as a completion boundary for its stdin transfer,
  while still checking both process exit codes and propagating any transfer
  failure. Package tests for process handoffs should repeat the operation in one
  Effect test scope so leaked or non-terminating stream fibers are observable.

## 2026-09-03 — A green coverage shard still missed security branches

- **What I was doing:** Monitoring the replacement Coverage Regression run
  after the quota-pipeline deadlock was repaired.
- **Evidence:** All 2,800-plus repo-cli tests passed, but the changed-file
  ratchet rejected uncovered late-stability, worker-evidence, and guarded
  tmpfs-removal paths in three earlier security-batch files. Focused regressions
  raised every affected metric above its committed floor, and a full local
  repo-cli coverage run then passed 145 files and the package ratchet.
- **What would have prevented it:** Every new fail-closed arm needs an explicit
  test for the refusal path, including boundary revalidation and injected I/O
  failure callbacks. Run the full package-scoped coverage command and inspect
  changed-file rows before the first publish of a security batch.

## 2026-09-03 — Auto-merge outran Yeet's strict closeout receipt

- **What I was doing:** Running strict Yeet closeout immediately after the last
  exact-head repository job passed on PR #949.
- **Evidence:** GitHub auto-merged the PR at 14:32:02 UTC, four seconds after
  the workflow reached terminal success. `beep yeet closeout` then rejected the
  operation because the PR was no longer open, even though its exact head,
  terminal checks, review threads, and Greptile result remained immutable and
  queryable.
- **What would have prevented it:** Yeet closeout should accept a just-merged PR
  when the branch head matches the merged PR head and emit a terminal receipt
  from the immutable hosted state instead of requiring an open PR.

## 2026-09-03 — Codex closure list state lagged detail state

- **What I was doing:** Closing and independently auditing the 12 exact captured
  Codex finding IDs after PR #949 merged.
- **Evidence:** The first `Already fixed` submission made the detail page expose
  `Reopen` while the open-list row briefly remained visible and selection moved
  asynchronously. Sorting the Closed view by detection time and reopening each
  captured title proved all 12 exact URL identities, `Reopen` state, and fixed
  reason without relying on the transient list count.
- **What would have prevented it:** A packet-aware browser closeout helper should
  select by captured title, assert the exact URL identity before submission,
  then independently re-audit every ID from the Closed view before emitting a
  sanitized closure ledger.

## Base catch-up ran quality against stale dependencies (2026-09-03)

- **What I was doing:** Preparing the post-merge closure-evidence PR after
  merging the current `origin/main` into the closeout branch.
- **Evidence:** The first `bun run beep yeet repair` used the pre-merge
  dependency installation. It reported eight unexpected tsgo rules and four
  missing-pipeable diagnostics in untouched `effect-drizzle` files. After
  `bun install --frozen-lockfile` installed `@effect/tsgo` 0.39.1, both
  `bun run beep quality tsgo-rules` and the 999-file
  `bun run beep quality test-tsgo` inventory passed. The same repair ran
  repo-wide docgen and failed on three missing examples in
  `scratchpad/jsdoc-hover-lab.ts`, an ignored local file that predates this
  branch and sits outside the packet delta.
- **What would have prevented it:** After a base merge changes the lockfile or
  toolchain catalog, Yeet should require a frozen install before repair. For a
  packet-only branch with no affected workspace package, it should also
  attribute an untouched repo-wide docgen failure to `origin/main` instead of
  presenting it as a branch regression.

## Hosted security audit coupled required CI to npm availability (2026-09-03)

- **What I was doing:** Monitoring the exact-head Repo Sanity gate for the
  post-merge closure-evidence PR.
- **Evidence:** Attempts one and two of Check run `33816590684` passed every
  preceding Repo Sanity sublane, then `bun audit` waited five minutes before
  `registry.npmjs.org` returned HTTP 503. The identical local command reached
  the registry and found no vulnerabilities across 2,332 packages, with only
  the two documented advisory ignores.
- **What would have prevented it:** The hosted audit lane should apply bounded
  retry and backoff to registry 5xx and rate-limit responses, or isolate
  transient registry availability in a retryable required job, while retaining
  fail-closed behavior for actual advisories and malformed responses.

## Yeet repeated the full compiler inventory before an orchestration failure (2026-09-03)

- **What I was doing:** Running canonical full Yeet verification for the
  review-driven retained-packet corrections.
- **Evidence:** The cheap-gates inventory and the inventory nested under
  `quality:check` each checked 999 files across 138 packages and passed. The
  immediately following explicit `quality:check:tsgo-tests` invocation exited
  in four seconds with `Failed to run package-test-typecheck Turbo tasks` and
  no compiler diagnostic. An isolated rerun of the same full inventory passed.
- **What would have prevented it:** Yeet should reuse a successful full-state
  compiler receipt when the input digest is unchanged, or classify and retry a
  Turbo task-launch failure separately from TypeScript diagnostics instead of
  rerunning the same 999-file inventory three times in one proof.
