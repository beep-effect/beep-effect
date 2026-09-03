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
