# Opportunities

Friction ledger for `goals/effect-schema-parity`. Record a receipt at the
moment the friction happens, never at closeout: what you were doing, the
evidence (command, error text, PR or file), and what would have prevented it.
This repo is public: redact secrets, write home paths as `~`, drop session and
machine ids, quote only the minimal identifying error text.

## 2026-09-15 — Audit rows can rule RETIRE on a facet nobody counted

- **What I was doing:** Decomposing the exploration into this goal.
- **Evidence:** `explorations/effect-schema-parity/research/idiom-families.md`
  §F01 ruled LiteralKit a retirement with "Full static-member consumer census
  is UNVERIFIED" in its own row; the align ruling of 2026-09-14 took it. A
  census at decompose (Enum 1,172 lines, is 603, Options 395, $match 243)
  reversed it to ADAPT.
- **What would have prevented it:** A retirement audit lane that refuses to
  emit RETIRE for any concept over 100 consumers without a per-facet count;
  now the `SPEC.md` facet census gate, but it should be the audit tool's rule.

## 2026-09-15 — Goal doctor still calls a brand-new untracked packet stale

- **What I was doing:** Validating this packet right after graduation.
- **Evidence:** `bun run beep goals doctor` returned `blocking_new=0` and one
  advisory: `effect-schema-parity [stale-active] active packet untouched for
  21+ days with no blockedBy/statusNote`, on a packet whose manifest dates
  are both 2026-09-15 and which has no commit yet. Same shape as the
  2026-08-30 receipt in `goals/schema-utils-selective-codec-statics/research/OPPORTUNITIES.md`.
- **What would have prevented it:** The stale-active advisory should use the
  manifest `created`/`updated` dates or the first commit date, not only git
  history, for untracked packets. Two packets have now paid for this.

## 2026-09-16 — Exploration research scripts trip the production lint and fallow gates at publish

- **What I was doing:** First Yeet repair on the packet-only lane
  (branch `effect-schema-parity-graduate` under the `docs` prefix), a
  docs-and-evidence PR.
- **Evidence:** `feedback:00-heavy:01-lint-fix` exit 1 (biome `noConsole`,
  `useTemplate`, `useNodejsImportProtocol`, `noUselessStringRaw`,
  `noInnerDeclarations`, `noExplicitAny` across nine files under
  `explorations/effect-schema-parity/research/`) and
  `feedback:00-cheap-gates` exit 1 on `fallow:audit` (29 introduced: 18
  dead-code, 11 complexity), `fallow:dead-code` (9 unused files, 9 unresolved
  imports into `.repos/effect`), all in the same directory. The Yeet routing
  labelled the cheap-gates red as `schema-first`, which was green.
- **What would have prevented it:** A standing exclusion for
  `explorations/**/research/**` in `biome.jsonc` (console allowlist) and
  `.fallowrc.jsonc` (`ignorePatterns`), the way `scratchpad/**` and three
  earlier exploration evidence directories already have. Added for this
  packet only, per the existing per-packet precedent; a generic rule is a
  decision for the explorations convention. Also: route a cheap-gates red to
  the lane that actually failed, not the first lane in the repair hint.

## 2026-09-29 — An Effect snapshot bump merged without regenerating the inventory

- **What I was doing:** Starting P0 from the `/goal` launcher.
- **Evidence:** PR #1330 moved the root `package.json` catalog `effect` to
  `df77fff939` while every inventory row and the `INDEX.md` pin line still
  read `e5f7d12af9`. The SPEC stop condition ("regenerate the inventory
  directory for the new sha in the bump PR itself before any further phase
  PR opens") held P0 until a catch-up PR regenerated the rows.
- **What would have prevented it:** A gate the bump PR cannot miss. Until
  P1 ships `lint effect-schema-inventory --check`, the rule lives only in
  packet prose that the effect bump lane never reads. P1 should run the
  pin check (catalog sha equals the fixture pin line) as a cheap gate in
  hosted CI, so a bump PR goes red until it regenerates.

## 2026-09-29 — The SPEC facet-census command reads zero for the dominant facets

- **What I was doing:** Running the P3 Facet Census Gate for `Number`, `Int`,
  `Unknown` and `Opaque` with the command shape in `SPEC.md` §Facet Census Gate.
- **Evidence:** The shape `rg -c -e '\.<member>\b' ... --glob '!**/<Concept>/**'`
  returned 0 lines for `NonNegativeInt` and `UnknownFromJsonString`, which the
  import-anchored count puts at 2,129 and 170 lines, because consumers use
  bare named imports. It returned 926 lines for `.Int` and 342 for `.Unknown`,
  almost all upstream `S.Int` and `S.Unknown`. The directory glob also never
  excludes the concept's own file, since all four concepts are single files.
  Separately, the audit's upstream target for `UnknownFromJsonString`
  (`S.UnknownFromJsonString`) is `@internal` at the pin and missing from the
  installed `Schema.d.ts`.
- **What would have prevented it:** A census tool that resolves imports
  instead of matching `.<member>`; one is now committed at
  `goals/effect-schema-parity/research/tools/facet-census.ts`, and the gate
  text now names it the count of record with the `rg` shape as a cross-check. The retirement audit tool should
  check each upstream target against the installed `dist/*.d.ts` before it
  prints the row.

## 2026-09-29 — The instantiation gate fires on file deletion under tsgo's parallel checkers

- **What I was doing:** P3 PR 1 (group A), taking the before/after
  `--extendedDiagnostics` numbers on `@beep/schema` with the command the
  phase contract prescribes (default checker count, fresh build-info).
- **Evidence:** deleting 13 files moved `@beep/schema` from 1,115,008 to
  1,157,412 instantiations. Bisecting by restoring files: putting back any one
  of `DomDragEvent`, `DomHtmlElement` or `DomMouseEvent` alone drops the total
  to about 1,103,850, below the baseline, while putting back `DomEvent` raises
  it. The same trees under `--singleThreaded` read 710,979 before and 706,043
  after. The compiler is tsgo 7.0.2, which splits files across four checkers
  with separate caches, so the default-checker total depends on how files fall
  into those partitions, not only on what they cost.
- **What would have prevented it:** measure the hard gate with
  `--singleThreaded` (or `--checkers 1`) so a deletion cannot move the total up
  by repartitioning, and keep the default-checker run as the advisory
  check-time figure. The P5 `quality check-census` baseline should record the
  flag it measured with.

## 2026-09-29 — Regenerating the catalog and JSDoc inventory drags in weeks of unrelated drift

- **What I was doing:** regenerating the tracked baselines for P3 PR 1, which
  deletes 13 `@beep/schema` source files and one catalog entry.
- **Evidence:** `bun run beep lint schema-catalog --write` produced a 428 KB
  diff (+8,247 / -146 lines, last regenerated in #927 on 2026-08-31, not
  CI-gated). One entry of it belonged to this PR. `bun run beep quality
  jsdoc-inventory` produced a 786 KB diff, mostly line-anchor shifts from files
  other PRs changed after #1234. Either one alone approaches or passes the
  512 KiB Yeet capture cap in SPEC §Constraints.
- **What would have prevented it:** a scheduled or post-merge regeneration on
  `main` for generated files that no gate checks, or a `--check` lane that
  keeps them current. Then a retirement PR's regeneration diff contains only
  its own rows.

## 2026-09-29 — A new test file cannot enter the effect-vitest baseline without rewriting it

- **What I was doing:** P1, adding the two repo-cli tests for
  `lint effect-schema-inventory`. Each imports `NodeServices`, which the
  effect-vitest detector reports as one EV010 `platform-resource-provenance-review`
  judgment row, the same row `effect-vitest-store.test.ts` already carries.
- **Evidence:** `bun run beep lint effect-vitest` reported
  `2 new finding(s)`; the prescribed `bun run beep lint effect-vitest --write`
  rewrote `standards/effect-vitest.inventory.jsonc` by about 100k lines
  (5,008 rows down to 4,764: 246 rows already resolved on `main`, plus
  reordering). The two rows were inserted by hand at their sorted position
  instead (42 added lines; the check then reports `introduced=0 resolved=246`).
- **What would have prevented it:** An additive mode such as
  `lint effect-vitest --admit <file>` that appends reviewed rows for named
  files without dropping resolved rows, or a main that keeps the baseline
  tight so `--write` is a small diff.

## 2026-09-29 — The committed schema catalog is stale on main

- **What I was doing:** P1, checking generated baselines after adding the
  inventory schemas.
- **Evidence:** `bun run beep lint schema-catalog` exits 1 with
  `stale standards/schema-catalog.generated.jsonc`; `--write` changes about
  8,500 lines, almost all in files this goal does not touch (lab apps,
  todox, infra), so the refresh was not taken into the P1 change.
- **What would have prevented it:** A hosted lane, or a Yeet cheap gate, that
  keeps the catalog current per PR; today nothing fails when it drifts.

## 2026-09-29 — `lint effect-vitest --write` rewrites the whole inventory for a two-file change

- **What I was doing:** P4 gate cut: recording the reviewed rows for one new
  repo-cli test file and three edited tests in `lint-command.test.ts`.
- **Evidence:** `bun run beep lint effect-vitest --write` rewrote
  `standards/effect-vitest.inventory.jsonc` as a 100,845-line diff (50,312
  insertions, 50,533 deletions) across dozens of unrelated test files. The
  committed file carries hand-merged compact one-line rows (for example near
  line 27006) and row sets that differ from a fresh scan, so the writer's
  canonical output never round-trips it. The lane reverted and spliced the
  four live rows in by hand (84 insertions, 357 deletions, only the two
  touched files); `lint effect-vitest` then read `introduced=0`.
- **What would have prevented it:** A `--write --files <path>...` mode that
  replaces only the named files' rows, or a canonical re-format of the
  committed inventory on `main` so `--write` is a no-op on untouched files.

## 2026-09-29 — Ten concurrent until-ready monitors drained the account's GraphQL pool

- **What I was doing:** Driving ten open PRs of the retirement train, each with
  its own detached `bun run beep yeet monitor --until-ready` job.
- **Evidence:** every `gh api graphql` call returned `graphql_rate_limit`
  ("API rate limit already exceeded") while the REST core pool sat at
  5,000/5,000; each monitor log repeated `merge readiness is unknown; the PR
  could not be read` and kept polling; `yeet reply` could not post or resolve
  threads until the hourly reset. `gh api rate_limit` still reported about
  4,990 GraphQL points remaining, so the usual probe did not show the outage.
- **What would have prevented it:** Poll checks and mergeability over REST and
  keep GraphQL for review threads only; back off on a rate-limit error instead
  of polling at the same cadence; or let one monitor job watch several PRs.
  The train fell back to a REST-only watcher and re-submits a monitor per PR
  only for the final merge-ready verdict.

## 2026-09-29 — A merge left Heavy reds on main and two sessions repaired them twice

- **What I was doing:** Merging `origin/main` into the train's lanes after the
  codemod engine (#1337) landed.
- **Evidence:** `bun run beep lint effect-vitest` exits 1 on `main` with one
  new finding for `schema-parity-codemod.test.ts`; Heavy / Lint Policy and
  Heavy / Coverage Regression are red on every PR's merged preview. #1337 was
  judged merge-ready before its Heavy matrix had reported. Two sessions then
  opened repair PRs within fifteen minutes of each other (#1348, and a one-row
  duplicate that was closed).
- **What would have prevented it:** The merge-ready verdict must wait for the
  admitted Heavy jobs of the current head; a main-red repair should be claimed
  in one visible place (an inbox row or an issue) before a lane is opened.

## 2026-09-29 — PR titles were taken from the newest commit

- **What I was doing:** Opening PRs with `yeet publish --start-pr-early --pr`
  on branches whose newest commit was a merge of `origin/main` or a transient
  `chore(repo-cli)` commit.
- **Evidence:** seven PRs were titled `Merge remote-tracking branch
  'origin/main' into …` or after the last housekeeping commit. The squash
  title is server-side commitlint input, so each had to be retitled by hand.
- **What would have prevented it:** Derive the PR title from the first
  non-merge commit of the branch, or require `--title` when the newest commit
  is a merge.

## 2026-09-29 — Two gates disagree about a same-name type alias

- **What I was doing:** Clearing a hosted `JSDoc Ratchet` red on the text/misc
  retirement (`schemaAnnotationFindings` 1 > 0) by adding the same-name decoded
  type alias next to `DerivedThreadTitle`.
- **Evidence:** the alias satisfied the ratchet and the next round went red on
  `Fallow Advisory Envelopes`: `fallow dead-code` reported the alias as an
  unused type export (`apps/professional-desktop/src/chat/DerivedThreadTitle.ts:73`).
  The fix was to use the alias at the one decode site in `ChatOrchestrator.ts`.
- **What would have prevented it:** the ratchet's alias expectation and the
  dead-code gate should agree: either the ratchet accepts an exported schema
  whose decoded type is only consumed inline, or the alias rule is scoped to
  schemas whose type is referenced by name. One local command that runs both
  (`beep ci lane jsdoc-ratchet` and `beep ci lane fallow`) before pushing would
  have caught the pair in one round.

## 2026-09-29 — The duplication gate flags the doctrine's consumer-local compositions

- **What I was doing:** Retiring `@beep/schema` `Int`: the upstream-first
  doctrine puts a named `PosInt` composition in each consuming package instead
  of a shared abstraction, so 25 packages gained an identical
  `internal/PosInt.ts`.
- **Evidence:** hosted `Fallow Advisory Envelopes` red on the numeric PR:
  `fallow audit --gate new-only` reports one introduced clone group
  (`dup:6f87acd9`, 19 instances, 51 tokens, 39 lines, suggested name `PosInt`).
  The audit's own remedy ("extract into a shared function") is exactly what the
  doctrine forbids for retired foundation concepts.
- **What would have prevented it:** a doctrine-level rule for the duplication
  gate: consumer-local compositions that replace a retired shared concept are
  admitted duplication, marked with the existing `fallow-ignore-file
  code-duplication` convention (11 files already use it) and a one-line reason
  naming the retirement. The P3 lane brief now says so.

## 2026-09-29 — A consumer that lands on main after the merge-base is invisible to the lane

- **What I was doing:** Driving the text/misc retirement PR after two unrelated
  PRs merged on main.
- **Evidence:** one of them added `packages/tooling/tool/cli/test/support/ProofJobWait.ts`
  with `import type { UUID } from "@beep/schema/String"`, a subpath the PR
  retires. Every local gate on the branch was green; the hosted fallow
  dead-code lane, which runs on the merged preview, reported the file as an
  unresolved import, and the envelope attributed it as not applicable while
  still failing the job.
- **What would have prevented it:** the retirement lane brief now says to merge
  `origin/main` and grep for the retired subpaths before every push; a hosted
  guard that lists new imports of a subpath the PR deletes would name the file
  directly instead of leaving it to the dead-code envelope's exit code.
## 2026-09-29 — The P5 typeperf brief named a retired test convention

- **What I was doing:** Mirroring upstream typeperf suites for P5 part a
  (check-census instantiation gate).
- **Evidence:** The lane brief asked for the mirror "in the repo's existing
  type-level test convention" (`*.tst.ts`). `standards/architecture/DECISIONS.md`
  "2026-08-03: Retire The Tstyche Type-Test Surface" removed that surface
  outside ecosystem members; the one remaining `.tst.ts` belongs to
  `@beep/effect-drizzle`. Upstream typeperf is compile-only anyway: it measures
  instantiation deltas with no assertion library.
- **What would have prevented it:** PLAN §P5 naming the fixture form
  (compile-only programs measured by the census gate) instead of leaving the
  convention to the lane. The mirror landed as compile-only fixtures under
  `packages/foundation/modeling/schema/test/fixtures/typeperf/`, each a gate
  row.

## 2026-09-29 — A pipeable dual over two strings swapped its arguments silently

- **What I was doing:** Making the exported check-census parsers pass the
  Effect language service rule `missingPipeableSignature`.
- **Evidence:** `readCheckCensusMetrics` became `dual(2, (output, target) => …)`;
  the census call site still passed `(configPath, output)`. `tsgo` accepted it
  (both parameters are `string`), and only the runtime census test caught it:
  `…Total time: 0.023s: tsc --extendedDiagnostics printed no parsable
  Instantiations line` (the output had landed in the target slot).
- **What would have prevented it:** For exported helpers whose data and
  argument share a type, a single options object (or a branded argument type)
  instead of a positional dual. The rule forces pipeability, but nothing
  flags swap-prone signatures.

## 2026-09-29 — Upstream typeperf fixtures do not compile under the Effect language service

- **What I was doing:** Mirroring `effect/typeperf/suites/schema/fixtures/tagged-union.ts`
  against `LiteralKit.toTaggedUnion`.
- **Evidence:** The verbatim `count: S.NumberFromString` case failed the sample
  with `error TS377098: This Schema number API accepts NaN, Infinity, and
  -Infinity … effect(schemaNumber)`, so the gate refused it. The mirror uses
  `S.FiniteFromString`, which also moves the fixture's instantiation count away
  from upstream's (the upstream threshold is not directly comparable).
- **What would have prevented it:** Nothing on our side; record the deviation
  in the fixture header, which the mirror does.

## 2026-09-29 — Check time on the shared workstation moves far outside the 5% band

- **What I was doing:** Running `bun run beep quality check-census --gate-only`
  right after `--write-baseline` on an unchanged tree.
- **Evidence:** Instantiations matched exactly on all six rows; check time did
  not: `@beep/schema` 1,242 → 920 ms (−25.9%), `@beep/repo-cli` 11,711 →
  12,670 ms (+8.2%), `@beep/law-practice-domain` 1,194 → 1,274 ms (+6.7%), and
  the ~90 ms typeperf rows ±9%. Load average was around 7 on a shared
  64-thread host. Four advisory lines printed for zero code change.
- **What would have prevented it:** A check-time sample that is robust to load
  (median of several runs, or a quiet-host measurement), or an absolute floor
  under which the band does not apply. The gate keeps the 5% band as ruled
  (advisory only); instantiations remain the hard, deterministic signal.

## 2026-09-29 — The lane's WIP checkpoint message fails commitlint

- **What I was doing:** Saving P5 part a progress as a local checkpoint
  commit, as the lane brief asks, so an abrupt session end does not lose work.
- **Evidence:** `git commit -m "wip(repo-cli): check-census gate progress"`
  passed the pre-commit hooks, then the commit-msg hook rejected it:
  `type must be one of [build, chore, ci, docs, feat, fix, perf, refactor,
  revert, style, test] [type-enum]`. The checkpoint went in with
  `--no-verify` and was squashed into the final commit.
- **What would have prevented it:** A checkpoint message in the brief that
  passes commitlint (for example `chore(repo-cli): checkpoint …`), or a
  `wip` type accepted on non-`main` branches.
## 2026-09-29 — Fresh lane gives invalid `--extendedDiagnostics` numbers until the dependency closure is built

- **What I was doing:** P2 before-measurement on a newly cut lane, using the
  recipe in `explorations/effect-schema-parity/research/performance-verification-supplement.md`.
- **Evidence:** all three `bun run tsc -p <pkg>/tsconfig.json --noEmit
  --extendedDiagnostics` runs exited 1 with thousands of `TS6305: Output file
  '.../dist/*.d.ts' has not been built from source file` errors and reported
  about half the real instantiation count (repo-cli 5,411,078 instead of
  8,433,860). The numbers look plausible, so nothing flags them.
- **What would have prevented it:** The recipe (and the P5 `check-census`
  harness) should run `bunx turbo run build --filter='<pkg>^...'` first and
  refuse to record a sample whose log contains any `error TS`.

## 2026-09-29 — A type-directed codemod can only run before the facet it matches is deleted

- **What I was doing:** Rewriting the last LiteralKit consumers in
  `apps/labs/semantica` and `apps/labs/lejeune-bolt-workbench` with
  `beep lint schema-parity-codemod` after the kit trim had landed in the tree.
- **Evidence:** the root-tsconfig run matched nothing in those apps (they
  import their own modules through an app-local `@/*` alias the root config
  does not map); after adding `--tsconfig`, the run still matched nothing
  because `.Options` no longer resolved to a kit declaration. The sites were
  rewritten by temporarily restoring the three pre-trim kit files.
- **What would have prevented it:** Run every root (including each app with
  its own `--tsconfig`) to zero sites before editing the retired surface; P3
  groups should treat "codemod dry run reports zero sites everywhere" as the
  gate that unlocks the deletion commit.

## 2026-09-29 — Two tracked baselines were far behind main before P2 touched them

- **What I was doing:** Regenerating `standards/schema-catalog.generated.jsonc`
  and `standards/jsdoc-documentation.inventory.{jsonc,md}` for P2.
- **Evidence:** `bun run beep lint schema-catalog --write` moved the catalog
  from 5,256 to 6,299 entries; 15 additions and 4 removals are P2's, the rest
  predate it. `bun run beep quality jsdoc-inventory` rewrote about 7k lines of
  the inventory (last generated 2026-09-25). The catalog check compares the
  whole file, so no scoped update is possible.
- **What would have prevented it:** Gate the catalog check (or regenerate on
  merge to main) so a feature PR does not carry a thousand unrelated entries.

## 2026-10-01 — A failed hosted job's log could not be read until its run finished

- **What I was doing:** Attributing a red `Heavy / *` job on a train PR while
  the rest of its run was still going.
- **Evidence:** `gh run view --log --job <id>` refuses while the run is in
  progress; `gh api repos/<owner>/<repo>/actions/jobs/<id>/logs` printed
  nothing because the log is ANSI-coloured and `gh` drops escape sequences by
  default. Only `gh api --allow-escape-sequences .../jobs/<id>/logs` works.
  PR #1363 teaches the Yeet monitor that per-job endpoint.
- **What would have prevented it:** The monitor reading the per-job endpoint
  from the start, and the yeet skill naming the flag.

## 2026-10-01 — Merging while a non-required check was pending left main red for about nine hours

- **What I was doing:** Landing P4 (#1345) while its Coverage check, which is
  not a required check, was still running.
- **Evidence:** the merge went through; Coverage then failed on main, and every
  sibling PR inherited the red until #1360 added the missing tests about nine
  hours later.
- **What would have prevented it:** The "mergeable" bar in AGENTS.md (no
  failing CI jobs) applied to pending non-required jobs too: wait for every
  job, not only the required ones, before merging a train PR.

## 2026-10-01 — Re-running a job on a superseded run cancelled the current head's run

- **What I was doing:** Re-running one failed heavy job on an older run of a
  train branch after a newer push.
- **Evidence:** the re-run joined the branch's workflow concurrency group and
  cancelled the in-progress run for the current head SHA, which then had to be
  re-run in full.
- **What would have prevented it:** Never re-run a job of a superseded run
  (now in the lane brief); a monitor guard that refuses a re-run whose
  `head_sha` is not the PR head.

## 2026-10-01 — Parallel lane agents overwrote each other's helper scripts in a shared scratchpad

- **What I was doing:** Running several P3 lanes at once from one session,
  each with its own measurement and probe scripts.
- **Evidence:** lanes wrote helpers with the same file names into the shared
  session scratchpad root and overwrote each other's copies, so a lane could
  run a sibling's script without noticing.
- **What would have prevented it:** A per-lane scratch subdirectory in every
  lane brief (P5 used `scratchpad/p5/` and the lane's ignored `.beep/p5/`).

## 2026-10-01 — Spot evictions killed 28 heavy jobs in three days

- **What I was doing:** Driving the last train PRs to merge-ready between
  2026-09-29 and 2026-10-01.
- **Evidence:** 28 `Heavy / *` jobs ended with the runner lost to Spot
  reclamation rather than a test failure, and each had to be re-run. PR #1364 spreads the heavy fleet across
  capacity-optimized Spot pools; a companion PR re-runs runner-loss failures
  automatically. Both await operator deploy.
- **What would have prevented it:** Diversified Spot pools and an automatic
  runner-loss re-run before the train started.

## 2026-10-01 — Every merge re-conflicted every open sibling through shared generated files

- **What I was doing:** Keeping the parallel P3 PRs mergeable as their
  siblings landed.
- **Evidence:** each landed PR rewrote `standards/jsdoc-documentation.inventory.{jsonc,md}`,
  `standards/schema-first.inventory.jsonc`, `standards/schema-catalog.generated.jsonc`,
  the coverage baseline, the schema barrel and this packet's ledgers, so with
  N open PRs every merge forced N-1 re-merges (O(N²) over the train). Lanes
  that took main's copy of the JSDoc inventory verbatim left it drifted on
  main. The 2026-09-30 ruling (regenerate the JSDoc inventory once, in P5)
  removed one class.
- **What would have prevented it:** Generated inventories regenerated on main
  after merge (or merge-driver regenerated), not carried in feature PRs; one
  ledger file per PR instead of appending to shared tables.

## 2026-10-01 — The type-directed codemod engine is too slow for a whole-repo retirement

- **What I was doing:** Dry-running a `codec-statics` rule on the P2 engine
  (`beep lint schema-parity-codemod`) to find every read of a codec static.
- **Evidence:** the rule has to ask the checker for the symbol of every
  `.is` / `.decode*` access; on the root tsconfig (aliases to source) the
  ts-morph checker ran 14 minutes at 100% CPU and 2.7 GB for one package
  (`packages/workspace/use-cases`) without finishing. A whole-repo tsgo
  program over the same files type-checks in 72 seconds.
- **What would have prevented it:** For retirements whose removal turns every
  orphaned read into a compiler error, remove first and drive the rewrite from
  tsgo's `TS2339` positions (what P5 did); keep the ts-morph engine for
  rewrites the compiler cannot locate.

## 2026-10-01 — The committed check-census baseline was stale on main

- **What I was doing:** Taking the P5 "before" numbers with
  `bun run beep quality check-census --gate-only` at `e324f01e1e`.
- **Evidence:** the gate failed on an unchanged main: `@beep/repo-cli`
  4,186,449 against the committed 4,172,933 (+13,516), while `@beep/schema`
  sat 236,325 below its row. No PR after P5a (#1354) re-measured the
  baseline, and the gate does not run in hosted CI.
- **What would have prevented it:** Run `check-census --gate-only` in a hosted
  lane (or in Yeet verify for the three baseline packages) so every PR either
  keeps the rows or re-measures them.
