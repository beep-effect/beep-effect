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
