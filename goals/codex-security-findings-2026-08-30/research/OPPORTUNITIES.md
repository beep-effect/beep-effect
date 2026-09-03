# Opportunities

## 2026-08-30 — browser-QA judge conflicts with published-PR ownership fencing

- Work: launched the documented read-only Codex vision judge against a
  captured browser-QA round on the published security PR checkout.
- Evidence: the companion thread could start but every artifact and image read
  was rejected because the checkout belongs to the publishing session, so it
  could not emit a compliant `qa-inventory/v1` verdict.
- Prevention: allow explicitly read-only QA judge threads to read immutable
  round artifacts owned by the publishing session, or provide an owner-session
  judge mode that does not create a separately fenced repository session.

## 2026-08-30 — browser-QA extraction example uses a retired flag

- Work: extracted the recorded trusted-discard browser scenario after a green
  Playwright capture.
- Evidence: `bun run beep qa extract --round 1` failed with `Unrecognized
  flag: --round`; the installed CLI accepts `--session <round-directory>`.
- Prevention: update the browser-QA skill's extract, judge-pack, and related
  examples from round-number flags to the current session-directory contract,
  or retain a backwards-compatible `--round` alias.

## 2026-08-30 — focused V8 coverage cannot merge the hostile-depth fixture

- Work: measured focused coverage after hardening packet-event identity against
  deeply nested unknown input.
- Evidence: the four-file focused Vitest coverage command reached coverage
  aggregation, then failed while merging V8 ranges with `RangeError: Maximum
  call stack size exceeded`. The canonical full CLI coverage run processed the
  same 20,000-level fixture successfully.
- Prevention: make focused coverage aggregation robust to adversarial nesting,
  or provide a coverage-safe regression harness that preserves the hostile
  input depth without recursively nested V8 range data.

## 2026-08-30 — Yeet continues heavy work after deterministic index drift

- Work: refreshed the branch onto the latest `origin/main`, then ran the
  canonical Yeet repair lane.
- Evidence: cheap preflight reported `bun run beep goals index --check` as
  failed, but Yeet continued through full docgen, build, lint, and the 2,586
  test CLI suite. The sole test failure was the same stale `goals/INDEX.md`
  content; 2,585 tests passed.
- Prevention: stop the heavy feedback phase when a deterministic generated
  artifact check fails, or let repair regenerate the goal index before unit
  tests begin.

## 2026-08-30 — Fallow misses an `import.meta.resolve` dependency edge

- Work: replaced the API docs CDN script with the exact installed Scalar
  standalone browser asset.
- Evidence: Fallow reported `@scalar/api-reference` as an introduced unused
  dependency even though `Docs.routes.ts` resolves its exported asset with
  `import.meta.resolve`. The subsequent security lane rejected that attempted
  dependency-based design, so the branch now reuses Effect's existing bundle
  and carries no detector exception.
- Prevention: teach the dependency analyzer to recognize statically known
  `import.meta.resolve` package specifiers.

## 2026-08-30 — localizing Scalar initially expanded advisory exposure

- Work: replaced a mutable CDN script with an exact local Scalar package.
- Evidence: Yeet's OSV lane rejected the first implementation because the new
  package added four medium or unknown transitive advisories through
  `ts-deepmerge` and `unhead`; Bun's high-severity audit alone remained green.
- Prevention: run the OSV lane immediately after dependency-graph changes, and
  expose Effect's embedded Scalar asset through a supported public API so apps
  do not need either a second Scalar dependency or a resolved internal module.

## 2026-08-30 — package verification cannot isolate touched CLI surfaces

- Work: required `@beep/repo-cli` package handoff after the scheduler, packet
  store, tmpfs reaper, and security-regression changes.
- Evidence: `bun run beep quality package-verify @beep/repo-cli` passed docgen
  but its audit stopped during build on preexisting errors in
  `src/commands/AIMetrics/**` and
  `src/commands/AgentEffectiveness/internal/EvalRecord.ts`. Those paths have no
  diff from `origin/main`; the scoped package check and focused touched-area
  tests pass.
- Prevention: add a package-verification mode that compares a clean
  `origin/main` baseline and reports inherited build failures separately from
  changed-path failures, while still running the full audit when the baseline
  is green.

## 2026-08-30 — dirty-tree coverage undercounts checkout-state branches

- Work: ran the canonical full Yeet proof before publishing the staged
  security remediations.
- Evidence: the coverage ratchet undercounted branches in untouched
  `LaneProofReuse.ts` and `Planner.ts` while the staged checkout was dirty. A
  detached clean-HEAD control run measured both files at their committed
  floors and passed the scoped ratchet.
- Prevention: make checkout-state tests use isolated fixture repositories so
  coverage is independent of whether the operator is proving a staged tree,
  or have pre-publish verification measure the staged virtual tree from a
  clean detached worktree.

## 2026-08-30 — a moving base invalidated the full publish proof late

- Work: ran the clean committed Yeet publish proof for the security batch.
- Evidence: `origin/main` advanced during the 40-minute proof with a merged PR
  that rewrote the same tmpfs janitor and tests. Every completed lane except
  coverage passed, but the branch then required an overlapping merge and a
  second proof. The post-merge janitor suite passed all 28 tests.
- Prevention: snapshot the admitted base for every lane and recheck base
  freshness before starting expensive coverage, or cancel early when a newly
  fetched base overlaps the candidate diff.

## 2026-08-30 — coverage depended on the parent Yeet environment

- Work: reran the canonical exact-base publish proof after incorporating the
  latest `origin/main` test corpus.
- Evidence: all 2,700 repo-cli tests passed under the canonical two-worker
  shard, but the coverage ratchet lost branches in `LaneProofReuse.ts` and
  `Planner.ts` that a standalone run reached only through ambient proof
  variables. The same deficit reproduced on consecutive Yeet runs.
- Prevention: explicitly test default, disabled, and optional proof-planning
  branches with scoped environment overrides so coverage is invariant across
  standalone, CI, and nested Yeet invocations.

## 2026-09-03 — Codex closed-list counts disagreed with exact finding state

- Work: completed the post-merge closure audit for the eleven captured Codex
  security findings.
- Evidence: every exact-ID detail page exposed Reopen and an automatic
  no-longer-detected notice, while the closed-list summary displayed zero of
  zero.
- Prevention: audit packet closure from the exact captured-ID allowlist and
  treat list counts only as navigation metadata, not authoritative state.
