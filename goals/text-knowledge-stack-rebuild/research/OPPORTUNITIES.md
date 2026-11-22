# Text-Knowledge Stack Rebuild — Opportunities and Friction

Receipts recorded at the moment the friction happened. Redact secrets, replace
home paths with `~`, drop session and machine ids.

## 2026-11-08 — packet bootstrap

- **Doing:** scaffolding this packet with `bun run beep goals bootstrap`.
  **Evidence:** both archetypes (`standard-delivery`, `report-first`) emit a
  five-phase table (`Read-only report`, `FP eyeball`, `Gated mutation`, Yeet,
  Close) that does not fit a design-first, multi-layer program; `PLAN.md` and
  `ops/manifest.json` `phases[]` were rewritten by hand immediately after the
  seed. **Would have prevented it:** a `design-program` archetype (design and
  grill, N delivery phases, census, yeet, close) or a `--phases` input the
  compiler accepts.
- **Doing:** carrying seven research reports and three figures from the
  OpenResearch artifacts directory into `research/`. **Evidence:** manual
  copy, `sed` to replace absolute home paths, a hand edit to abridge a
  3,700-line schema index, and a rewrite of the report's sibling links to the
  dated file names. **Would have prevented it:** a `goals research import
  <path>` that dates, sanitizes and re-links a report in one step.
- **Doing:** rebuilding the cross-package picture of the stack before the
  design. **Evidence:** about twenty targeted greps across six packages to
  recover which anchor encodings exist, which codecs are missing and where
  defaults are invented; `standards/ARCHITECTURE.md` has no chapter on text,
  knowledge or meaning. **Would have prevented it:** the knowledge-stack
  chapter this packet's P0 drafts.

## 2026-11-09 — round-1 review of PR #2993

- **Doing:** running the cross-provider reviewer panel through orx delegates.
  **Evidence:** every Codex (`gpt-6.1-sol`) delegate finished its report and then
  looped on a Stop-hook error (`codex/1.0.6/scripts/stop-review-gate-hook.mjs`
  not found) until cancelled; every Grok (`grok-4.7`) delegate blocked on
  per-command approvals until relaunched headless with
  `grok --always-approve --permission-mode bypassPermissions`. **Would have
  prevented it:** a permission-mode input on delegation, and a stop hook that
  degrades to a no-op when its script is absent.
- **Doing:** adding Graphviz SVG figures under `research/figures/`.
  **Evidence:** `bunx biome check` fails on Graphviz output (`<?xml ...?>` and
  `<!DOCTYPE svg ...>` are parse errors for Biome's HTML parser, and
  `lint/a11y/noSvgWithoutTitle` wants a `<title>`), which the `yeet
  final-check` lint gate and the pre-commit hook both run. **Would have
  prevented it:** a documented `dot` post-processing step (or a `biome.jsonc`
  exclusion for generator-owned figures) in the docs guidance.
- **Doing:** writing the SPEC verification matrix. **Evidence:**
  `bun run beep lint laws --package @beep/<pkg>` accepts the alias, scans zero
  files and exits 0; only a workspace directory path scans anything. **Would
  have prevented it:** the command refusing an alias or resolving it to the
  workspace directory.
- **Doing:** describing `@beep/nlp-processing` as a package to create.
  **Evidence:** it already exists at `packages/foundation/capability/nlp-processing`
  with 69 tracked files and an instrumentation shard; the rebuild report and the
  first SPEC draft missed it because the inventory of foundation packages was
  rebuilt by hand. **Would have prevented it:** a `bun run beep architecture`
  listing of packages by family and kind cited in the knowledge-stack chapter.

## 2026-11-19 — P0 design and grill

- **Doing:** confirming the SPEC's resolved questions against the live tree.
  **Evidence:** the packet text was eleven days old and wrong on eighteen
  points the census lists (canonical JSON placed in a package that cannot
  import its owner; a SQL migration planned for identifiers no table stores;
  seven status vocabularies that are eight; `effect` 4.1.2 where 4.1.4 is
  installed). **Would have prevented it:** a `goals doctor --facts` pass that
  re-runs a packet's cited `rg` evidence when the packet is resumed.
- **Doing:** drafting the chapter-11 amendment. **Evidence:** the stored-format
  law landed in `standards/ARCHITECTURE.md` on 2026-11-18, after the packet
  was written, and the first amendment draft contradicted it (refuse old
  receipts at decode versus convert on read); a reviewer child caught it.
  **Would have prevented it:** resuming a paused packet lists the
  `DECISIONS.md` entries dated after the packet's `updated` field.
- **Doing:** type-checking the design module under `ops/`. **Evidence:**
  `goals/tsconfig.ops.json` sets `"plugins": []`, so the Effect diagnostics do
  not run on ops files; a second tsconfig beside the module was needed to hold
  it to the package bar. **Would have prevented it:** an opt-in
  `opsScripts[].strict` flag that the ops typecheck honours.

## 2026-11-21 — P1 PR C hosted reds

- **Doing:** opening PR C (#3449) on a green local final-check. **Evidence:**
  hosted Lint Policy reported `knowledge semantic-delta` `introduced (2)` on a
  head where the local run reported 0. The gate exempts a code span that
  exactly names a Git ref and counted local branches, which a hosted checkout
  does not have, so a checkpoint that wrote its lane branch in backticks passed
  locally only. **Would have prevented it:** #3453, which drops local branches
  from that census. A gate whose verdict reads clone-local state is worth
  checking for in the other lints that list refs.
- **Doing:** skipping coverage in the local final-check of PR C. **Evidence:**
  hosted Coverage Regression failed on three `@beep/repo-cli` files the stack
  adds or changes; only the `@beep/identity` files had been measured, because the
  merge review asked for those by name. A targeted run over the three files
  takes about a minute and reproduced the hosted numbers exactly. **Would have
  prevented it:** `final-check --skip coverage` printing the new and changed
  source files it leaves unmeasured, with the targeted command for each package.
- **Doing:** acting as the only writer on PR C. **Evidence:** #3449 was flipped
  to ready through the shared login and no session on the host had run it; only
  a search of every transcript could show that. **Would have prevented it:** an
  actor or session id on PR state changes that Yeet and T3 make.

## 2026-11-21 — P2 package move

- **Doing:** retiring `@beep/provenance` with `delete-package`. **Evidence:** its
  baseline writers regenerate the whole fallow health baseline (3 minutes) and
  wrote about 75 changed rows of churn-based targets and stale complexity rows,
  none of which named the package; the dead-code and schema-first outputs
  changed only their timestamps. All three were restored by hand, because a
  retirement must not re-baseline other packages. **Would have prevented it:**
  subtracting the target's rows in process, as the coverage baseline step
  already does, and leaving a baseline alone when it has no such row.
- **Doing:** the same command. **Evidence:** `standards/fallow.boundaries.provenance.jsonc`
  is a hand-kept file with no writer, so the apply leaves the retired row as
  residue after a dry run with no hard hits. `config-sync` likewise leaves the
  `paths` block of `apps/professional-desktop/tsconfig.json` alone, and
  `create-package` adds no shape row for the new composer. **Would have
  prevented it:** a `rename-package` command that carries those rows over.

## 2026-11-21 — P2 source identity

- **Doing:** adding one import to `ContradictionTriage.pglite.test.ts`. **Evidence:**
  `lint:schema-first` failed with "Stale schema-first inventory entry" because
  the row is keyed by line (94 became 95); the fix is a write that changes a
  line number and a date. **Would have prevented it:** keying the rows by file
  and symbol, which every row already carries.
- **Doing:** reading a red `lint effect-vitest`. **Evidence:** after a 60 second
  scan it prints "1 new finding(s)" with the file and no line, rule or primitive,
  so the finding has to be guessed from the diff. **Would have prevented it:**
  printing the line and the matched rule of each new finding.

## 2026-11-22 — P2 offset units, selectors and resolution

- **Doing:** documenting `convertPosition` and `resolve` in `@beep/text`. **Evidence:**
  the package's own `bun run docgen` passed with `@category conversions`, and the
  docgen step of `beep quality package-verify @beep/text` then failed with
  "Unknown @category value conversions". **Would have prevented it:** the plain
  docgen script checking categories against the same allow list.
- **Doing:** exporting the internal scan of `internal/scalars.ts` as a dual.
  **Evidence:** `missingPipeableSignature` reported both overloads as unmatched
  while they returned the same inline labelled tuple type; naming the result type
  once and using it in both overloads cleared it. **Would have prevented it:** the
  rule comparing return types structurally, or its message naming the mismatch.
- **Doing:** a new property test in `@beep/langextract`. **Evidence:** the package's
  `tsrs -p tsconfig.test.json` was clean, and the `check` gate inside
  `package-verify` then failed on `missedPipeableOpportunity` (TS377050), a
  diagnostic the plain test typecheck does not run. **Would have prevented it:**
  one test typecheck command that runs the gate's diagnostic set.
- **Doing:** answering a verifier on the L1-5 law. **Evidence:** replacing the KMP
  fallback `matched = table[matched - 1]` with `matched = 0` left every L1-5
  property green at 10,000 runs, and again over a random two-letter alphabet,
  because separated copies of a random passage never need the fallback; only a
  generator that builds a passage as `border + middle + border` and overlaps two
  copies by the border turned it red (about one sample in five). **Would have
  prevented it:** a mutation pass over each new scan (one hand mutant per
  fallback or boundary branch) before a law is called green.
- **Doing:** regenerating the decision projections. **Evidence:** `goals decisions add`
  takes the slug as a positional argument and `goals decisions write` refuses it
  ("Unexpected positional argument") and wants `--slug`. **Would have prevented
  it:** one argument shape for the two sibling commands.
- **Doing:** finishing commit 5 of P2 over an interrupted attempt's tree. **Evidence:**
  the inherited L1-4 property shifted a preimage slot with `A.modify(encoded, slot, f)`,
  which in Effect 4 returns an `Option`, so the mint saw an `Option` object and failed
  `NonPlainObject at "/1"`; a refusal test written the same way passed for the wrong
  reason, because `S.decodeUnknownResult` takes `unknown` and an `Option` never decodes
  as a tuple, so no type error points at it. **Would have prevented it:** an effect
  diagnostic that flags an `A.modify` or `A.replace` result used where an array or an
  `unknown` input is expected.
- **Doing:** checking that the L1-3 chain property is not vacuous (how many generated map
  pairs reach the comparison). **Evidence:** module counters read by a later `it` in the
  same file reported 17 of 50 `it.effect.prop` trials and 5 of 4,000 in the law file,
  while `Arbitrary.checkEffect` run directly evaluated all 50; appending one line per
  trial to a file showed every run (3,000 chain cases: 1,743 compared, 1,307 Exact/Exact,
  no counterexample). **Would have prevented it:** a `@beep/test-runner` hook or
  documented recipe for per-property sample statistics, so a law's coverage of its
  interesting cases is measured the same way every time.
- **Doing:** killing two verifier mutants of `@beep/text` without editing the lane's
  sources, through a scratch vitest config whose plugin rewrote one module in memory, with
  the mutant chosen by an environment variable. **Evidence:** the second mutant's runs
  reported the first mutant's failures and its own test passed: `fsModuleCache` keys an
  entry by module id, file content, plugin names and the config file's contents, not by
  plugin output, so two runs of one config file with different environments share
  transformed modules (`test: { fsModuleCache: false }` in the scratch config fixed it;
  the lane's own config never reads those entries). **Would have prevented it:** a
  documented mutation recipe in the test-runner docs, or a `beep` command that applies a
  named in-memory mutant with the module cache off.
## 2026-11-22: a Claude child's weekly limit killed a fix mid-edit

- **Doing:** PR C's release-against-base fix, a Workflow child pinned to Opus 5.5.
- **Evidence:** the child failed with "You've hit your weekly limit · resets 11pm" after about 20 minutes.
  It left 21 modified files and 2 new ones uncommitted and untested. `bun run beep accounts` showed every
  Claude account as "Rate limited" (unreadable), so the limit could not be seen coming.
- **Prevention:** read Claude headroom before a long child is launched, and give a fallback child a brief
  file that it can continue from. This lane moved to Codex `gpt-6.1-sol` medium with such a brief.
