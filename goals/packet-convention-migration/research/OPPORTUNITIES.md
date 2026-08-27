# Opportunities — friction receipts

## 2026-08-26 — Semantic delta rejects an uncommitted command addition without naming the dirty-tree cause

- **What happened:** full `bun run beep yeet verify` reached
  `knowledge semantic-delta` after the migration added two Goals subcommands.
  The lane failed with `Static command surface provenance does not match the
  current-checkout command tree.` A direct comparison of the statically
  derived working-tree command graph with the live graph found no difference.
  The mismatch was between the committed HEAD archive, which did not yet
  contain the new commands, and the dirty live checkout.
- **Evidence:** `bun run beep knowledge semantic-delta` reported the mismatch;
  the source-only `KnowledgeCommandSurface.buildStaticCommandTree` projection
  and the live `rootCommand` projection compared equal in the same checkout.
- **What would have prevented it:** when the CLI surface is dirty, either
  derive the semantic-delta HEAD-side static tree from the working tree or
  report that exact-head proof must follow a commit. Include the first command
  path that differs so a real parser drift remains distinguishable.
- **Disposition:** tooling fix — keep the fail-closed parity check, but make
  dirty-worktree attribution explicit.
- **Owner:** knowledge semantic-delta maintainers.

## 2026-08-26 — Named lint lane is parsed as a nonexistent Turbo task

- **What happened:** `bun run beep lint native-runtime`, used as a targeted
  acceptance check, launched the complete 26-step lint coordinator and also
  passed `native-runtime` to Turbo as a task name. The native-runtime policy
  lane itself passed, but the coordinator failed because no Turbo task with
  that name exists.
- **Evidence:** the run reported `lint:native-runtime: done` with zero errors,
  then failed the separate command `bunx turbo run lint ... native-runtime`
  with `Could not find task native-runtime in project`.
- **What would have prevented it:** either expose a documented targeted
  `beep lint native-runtime` subcommand or reject positional lane names before
  starting the full lint coordinator and print the canonical direct command.
- **Disposition:** tooling ergonomics — no source repair was needed for the
  migration, and the canonical full Yeet proof remains authoritative.
- **Owner:** repo-cli lint coordinator maintainers.

## 2026-08-26 — Green happy-path proof did not exercise rollback ownership

- **What happened:** the initial exact-head Yeet proof and focused migration
  tests were green, but the read-only quality panel found that a fleet rollback
  could remove a stream or overwrite manifest bytes created by another writer
  after preflight.
- **Evidence:** round-two findings `QG-001` and `QRL-R2-ERR-004` identified
  unconditional restoration from every planned snapshot. The repaired suite
  now injects a manifest edit during atomic promotion and proves that rollback
  preserves the foreign bytes while returning a visible conflict.
- **What would have prevented it:** mutation-campaign templates should require
  failure injection at each promotion boundary, a successful-mutation ledger,
  expected-byte ownership checks, and an observable cleanup-failure test before
  the first full proof.
- **Disposition:** implementation and test-law improvement applied in this
  packet; candidate for a reusable mutation-campaign checklist.
- **Owner:** repo-cli mutation authors and quality-review workflow maintainers.

## 2026-08-27 — Review-fix proof omits the blocking Fallow audit

- **What happened:** the review-fix tier passed build, check, Effect test-law
  checks, lint, 2,346 unit tests, and full docgen, but the subsequent full
  publication stopped on three introduced complexity findings and one local
  duplication group from `fallow audit`.
- **Evidence:** `bun run beep yeet publish --amend --no-edit --pr` failed its
  `fallow:audit` cheap gate; after extracting inventory reads, migration
  snapshots, promotion, rollback, and report validation into focused helpers,
  `bun run beep quality fallow audit --check --quiet` reported zero introduced
  findings.
- **What would have prevented it:** include the new-only Fallow audit in the
  review-fix tier, or print it as an explicit required pre-publication command
  when changed files are within Fallow's pilot scope.
- **Disposition:** implementation simplified in this packet; tier-composition
  improvement remains for the Yeet quality workflow.
- **Owner:** Yeet review-fix tier maintainers.

## 2026-08-27 — Local publish proof omits the hosted coverage ratchet

- **What happened:** the exact-head local publication proof passed 2,346 unit
  tests, Effect test laws, and every local quality lane, but the hosted
  `Heavy / Coverage Regression` check rejected reduced coverage in
  `Explore/Check.ts` after the fleet-lint integration.
- **Evidence:** hosted run `33042895609`, job `98420264729`, reported branch,
  function, line, and statement regressions for `Explore/Check.ts`. A focused
  fleet-graph command test restored that file to 100 percent across all four
  measures.
- **What would have prevented it:** include the affected coverage ratchet in
  the local publication proof whenever changed packages have a committed
  coverage floor, or name it as an explicit hosted-only gate before push.
- **Disposition:** focused coverage added in this packet; local/hosted proof
  parity remains a Yeet workflow improvement.
- **Owner:** Yeet proof-planning and coverage-ratchet maintainers.

## 2026-08-27 — Multi-file focused coverage overflows during result merge

- **What happened:** a focused Vitest invocation covering the exploration check
  and convention-migration suites completed test execution but overflowed the
  v8-coverage range-tree merger before it could report results.
- **Evidence:** the two-file coverage command failed in
  `@bcoe/v8-coverage`'s `mergeRangeTrees` with `Maximum call stack size
  exceeded`; running each coverage target independently avoids the merge path.
- **What would have prevented it:** make the focused coverage wrapper isolate
  files before aggregating summaries, or detect this merger failure and print
  the independent-invocation fallback.
- **Disposition:** tooling ergonomics — verify both suites independently; no
  product source repair is implied by the merger failure.
- **Owner:** Vitest coverage-lane maintainers.

## 2026-08-27 — Yeet repair rewrites unchanged upstream source

- **What happened:** after rebasing onto the latest `main`, `bun run beep yeet
  repair` applied safe terse-Effect rewrites to an unchanged Semantica source
  file outside this PR's packet-migration scope.
- **Evidence:** the repair left `apps/labs/semantica/src/layers/EvaluatorLive.ts`
  dirty with six helper-reference simplifications even though the branch had no
  patch for that file; the rewrite was restored before publication.
- **What would have prevented it:** scope write-mode repair laws to the branch
  delta, or park and restore rewrites that are byte-identical to the current
  base before the repair starts.
- **Disposition:** workflow fix — keep unrelated upstream cleanup out of this
  PR and publish only the packet receipt.
- **Owner:** Yeet repair-scope maintainers.
