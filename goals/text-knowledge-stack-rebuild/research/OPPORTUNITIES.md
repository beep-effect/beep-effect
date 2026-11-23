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

## 2026-11-22: a dependent's type check read stale declarations of a changed package

- **Doing:** commit 7, moving `CitationMentionId` from `cm1:` to `cm2:` in law-practice-domain and
  type-checking law-practice-server against it.
- **Evidence:** `bunx tsrs -p packages/law-practice/server/tsconfig.check.json --noEmit` reported
  `` Argument of type '`cm2:${string}`' is not assignable to parameter of type '`cm1:${string}`' `` until
  `bunx tsrs -b packages/law-practice/domain/tsconfig.json` rewrote the domain's declaration output; the
  server project reads the referenced project's emitted `.d.ts`, not its source.
- **Prevention:** a `beep` check of one package that rebuilds the stale declarations of its changed
  workspace references first (or warns that they are older than their sources).

## 2026-11-22: the trustgraph verify script was already broken before its evidence import moved

- **Doing:** commit 9, giving goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts a local schema for
  the frozen evidence artifact before `rdf/src/Evidence.ts` is deleted, then running the script as the
  design's gate asks.
- **Evidence:** `bun goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts` exits 1 with
  `Expected @beep/rdf/prov/ProvRecord at ["records"][6]`: the live `ProvBundle` no longer decodes the frozen
  `beep-effect-documentation-seed.provenance.json`, whose record 6 is `{ activity, entity }`. A probe that
  decodes the same file with the untouched `Prov.ts` fails the same way, so the break predates P2. The
  local evidence schema decodes all three anchors and the dataset decodes; the evidence decode is never
  reached in the script because the provenance decode runs first. `rerun.verify` names the script, and no
  typecheck or test runs it.
- **Prevention:** a gate that runs each reference goal's `rerun.verify` (or at least decodes its frozen
  artifacts) whenever a schema it imports changes.

## 2026-11-22: `lint schema-catalog --write` given a directory reports a write and writes nothing

- **Doing:** commit 10, regenerating the `@beep/party-domain` schema-catalog shard after renaming the party
  `OccurrenceId` and replacing `TextSpan`.
- **Evidence:** `bun run beep lint schema-catalog --write packages/party/domain/src` printed
  `[schema-catalog] wrote @beep/party-domain` and `entries=147 shards=1`, but the shard kept the `TextSpan`
  and `OccurrenceId` rows. The same command with the two changed `.ts` files as arguments rewrote the shard.
- **Prevention:** the command expands a directory argument to the sources under it, or refuses a path that
  names no source file instead of reporting a write.

## 2026-11-22: `config-sync` writes a root tsconfig that biome then reformats

- **Doing:** commit 11, adding the `./Md.anchors` subpath to `@beep/md` and running `bun run config-sync`
  for its alias.
- **Evidence:** the sync appended the alias after `@beep/text/*` and rewrote that neighbouring one-line
  array as three lines; `bunx biome check tsconfig.json` then failed with `Formatter would have printed
  the following content`. `config-sync:check` reported no drift both before and after `biome --write`.
- **Prevention:** the sync formats the file it writes (or runs biome on it), so a lane does not carry a
  formatter-only hunk in a generated file.

## 2026-11-22: a cache-baseline review reason becomes delete-package residue

- **Doing:** the P2 final gate, `bun run beep delete-package @beep/provenance --allow-stale-packets --check`.
- **Evidence:** exit 1 with `[check] authored-references: residue` on chapter 16, the glossary and 22
  files under `standards/cache-baseline/`. `bun run beep cache baseline` copies the request's
  `review.reason` into every subject file it stamps, and the commit-13 reason spelled the retired
  package name, so the record of a retirement became residue of it.
- **Prevention:** `cache baseline` refuses (or warns on) a request whose review reason names a package
  that is not in the task graph, and the retirement runbook says to describe a retired package without
  its name in any live file.

## 2026-11-22: "fallow inventories are current" was proved on two of the four fallow gates

- **Doing:** verifying commit 13, which said the fallow inventories were current.
- **Evidence:** only `fallow:boundaries:check` and dead-code had run; `fallow:health:check` and
  `fallow:audit:check` each failed with 2 introduced findings (`resolveQuote` cognitive 19, CRAP 37.1;
  `nfkcRewrites` cognitive 10), which the hosted Fallow gate would have reported.
- **Prevention:** the package-verify of a new package runs `fallow health --base` scoped to its files,
  so complexity over the threshold shows up in the commit that adds the function.
## 2026-11-22: the full effect-vitest ratchet names files, not the findings

- **Doing:** PR C's third review round, new tests in two repo-cli test files.
- **Evidence:** `bun run beep lint effect-vitest` printed "3 new finding(s) in 2 file(s)" after a 60 s
  scan, with no line or rule. Only a second run with `--files <path>` for each file printed
  `:768 EV006 hand-rolled-data-assertion`.
- **Prevention:** print each new finding's line and rule in the full-scan summary too, as the scoped
  run does.

## 2026-11-22: `goals decisions write` takes `--slug`, `add` takes a positional slug

- **Doing:** correcting a decision file just written with `goals decisions add <slug>`.
- **Evidence:** `bun run beep goals decisions write text-knowledge-stack-rebuild` failed with
  `Unexpected positional argument`; the same slug is positional for `add`.
- **Prevention:** accept the slug the same way in every `goals decisions` subcommand.

## 2026-11-22: a refusal's remedy text shipped without a test that follows it

- **Doing:** answering a verifier on PR #3449's `nested-move` refusal of `identity rebind`.
- **Evidence:** the remedy "move through a code identity outside both, in two rebinds" was refused
  at its first step with `[target-module-missing]`, because a rebind target must name a module
  file. A test that followed the steps would have shown it; the namespace remedy had one, this did
  not.
- **Prevention:** every refusal whose message prescribes commands gets a test that runs those
  commands and ends with a passing lint, as `L0-3 a namespace is retired by hand` does.

## 2026-11-22: the P2 PR cannot open as a third stack layer

- **Doing:** opening the P2 PR stacked on PR #3449 at content-final, after `yeet final-check`
  passed on 183872d5710.
- **Evidence:** `yeet open --stack-on 3449` refused with `parent-off-trunk: #3449 targets` the
  P1 B branch, `not main; a stack holds 2 layers at most`. The packet's P2 decision planned a
  stack layer on C while B and C are held. It did not say that C is itself a layer on B.
- **Prevention:** a decision that plans a stack layer should check the parent's base first, with
  `gh pr view <n> --json baseRefName`. Or Yeet's stack plan could name the depth limit when a
  packet's held PRs already form a two-layer stack.

## 2026-11-22: the semantica provider cache survives only in the desktop Trash

- **Doing:** freezing today's `bun run canary relation preview` report for P3 commit 1.
- **Evidence:** no checkout has `.beep/semantica/provider-cache`, and no configured
  `SEMANTICA_PROVIDER_CACHE_DIR` exists. The 152 MB cache (4,903 entries) was found only under
  `~/.local/share/Trash/files/` in a retired `beep-effect11` clone, by a whole-disk `find` for one
  cache key. Emptying the Trash would have made the relation-preview gate of commits 1 and 8
  impossible. The three committed cases were copied to `~/.cache/beep/semantica-relation-preview-cache/`.
- **Prevention:** give the provider cache a fixed workstation home outside every clone, set as the
  default of `SEMANTICA_PROVIDER_CACHE_DIR`, and have the lane drain refuse to archive a clone that
  holds the only copy of an untracked cache a gate reads.

## 2026-11-22: `package-test-typecheck` exits 0 over test type errors

- **Doing:** typechecking the semantica and law-practice server tests for P3 commit 1.
- **Evidence:** `bun run package-test-typecheck` (`beep-cli quality test-tsgo-package`) printed only
  its command line and exited 0, while `.turbo/package-test-typecheck-result.json` recorded
  `"exitCode": 1` with `TS2345` and `TS377188` in `test/Extractor.test.ts`. Read by exit code
  alone, the gate passed a test file that does not compile.
- **Prevention:** have the script exit with the recorded `exitCode` and print the diagnostics it
  stores, or name the artifact as the verdict in its own output.

## 2026-11-22: the instrumentation-catalog hook skips a module directly under `src/`

- **Doing:** P3 commit 3 added `packages/foundation/modeling/text/src/Capture.ts` with the
  `Capture.mint` span. The commit carried the schema-catalog shard but not the instrumentation
  shard, so `beep observability catalog --check` reported `@beep/text.generated.jsonc: stale`.
- **Evidence:** `lefthook run pre-commit --command instrumentation-catalog --file
  packages/foundation/modeling/text/src/Capture.ts --verbose` printed `filtered [ ]` and
  `no files for inspection`, while the same run on `src/internal/scalars.ts` matched. Lefthook's
  default glob matcher needs at least one directory for `**/`, so
  `{apps,packages}/**/src/**/*.{ts,tsx}` never matched `src/<Module>.ts`. Every new top-level module
  in any package had the same gap.
- **Prevention:** the hook's glob is now a list that adds `{apps,packages}/**/src/*.{ts,tsx}`. A
  repo test that runs each `lefthook.yml` glob against one top-level and one nested sample path
  would catch the next pattern of this shape.

## 2026-11-22: `goals decisions add` and `goals decisions write` spell the slug two ways

- **Doing:** recording the two decision files of P3 commit 4, then regenerating their projections.
- **Evidence:** `bun run beep goals decisions add text-knowledge-stack-rebuild ...` takes the slug as a
  positional argument; the follow-up `bun run beep goals decisions write text-knowledge-stack-rebuild`
  failed with `Unexpected positional argument: "text-knowledge-stack-rebuild"` and needs `--slug`.
  In a `set -e` script the second command aborted the run after the files were written.
- **Prevention:** accept the slug positionally in `write` and `check` as `add` does, or accept
  `--slug` in `add`, so one spelling works for the whole family.

## 2026-11-22: schema-first flags a structural view whose schema is module-private

- **Doing:** P3 commit 4 exported `AnnotationDocumentView`, the kind-independent view every
  caller-owned annotation document satisfies.
- **Evidence:** `bun run lint:schema-first` reported `object-struct-schema` for it after the schema was
  made module-private and only `export type AnnotationDocumentView = typeof View.Type` remained. A
  branded `S.Opaque` view is nominal, so no `TextDocument` would satisfy it; the only way through was
  an inventory exception, as for the internal `DocumentEnvelope`.
- **Prevention:** let the rule tell a structural view (a type consumed only as a constraint) from an
  exported data model, or document the exception pattern for generic views beside the D1 rule.

## 2026-11-22: vitest `toEqual` compares a `HashMap`'s trie, not its entries

- **Doing:** P3 commit 5, the `L2-1` and `L2-4` laws over merged and restricted annotation documents.
- **Evidence:** `expect(merged).toEqual(expected)` failed on documents and generation sets that
  `Equal.equals` holds equal (`expected { Object (~effect/HashSet, keyMap) } to deeply equal ...`),
  about one property run in three. `@effect/vitest`'s `addEqualityTesters` registers an empty
  tester list, so `toEqual` walks the internal trie, whose shape depends on how the map was built
  (a union against a decoded copy). The same test passed on its first run, so a green run proved
  nothing.
- **Prevention:** compare Effect collections with `assertEquals` from `@effect/vitest/utils`, and
  have the effect-vitest lint flag `toEqual` whose operands carry a `HashMap` or `HashSet`; or
  register an `Equal.equals` tester in `@beep/test-runner` so `toEqual` means `Equal` for them.

## 2026-11-22: `annotateKey` on an `S.Opaque` field drops the opaque type

- **Doing:** P3 commit 6, the `OaImport` result schema of `@beep/annotation/rdf/OaCodec`, whose `document` field is the
  caller-owned `OaDocument` and whose `residual` is `@beep/rdf`'s `Dataset`.
- **Evidence:** with `document: OaDocument.annotateKey({ ... })` the field's decoded type became the bare struct, and
  every caller that passed `result.document` on as an `OaDocument` failed with `Property 'brand' is missing in type
  '{ readonly text: SourceTextIdentity; ... }' but required in type 'OaDocument'` (TS2741); the same held for
  `Rdf.Dataset.annotateKey`. `annotateKey` rebuilds the schema from its AST, and an opaque class's rebuild is its
  struct, so the `Self` type is lost. The source module type-checked; only the test that used the result failed.
- **Prevention:** a lint or schema-first rule that flags `annotateKey` on an `S.Opaque` class used as a struct field,
  or an `annotateKey` overload on opaque classes that keeps `Self`; until then, annotate the field's description on
  the opaque class itself and leave the field unannotated.

## 2026-11-22: a scoped `lint schema-catalog --write` reports a shard written that it left stale

- **Doing:** P3 commit 7, refreshing the `@beep/langextract` and `@beep/law-practice-use-cases` schema-catalog shards
  after deleting the langextract range schemas and adding the attempt-log read codec.
- **Evidence:** `bun run beep lint schema-catalog --write packages/foundation/capability/langextract
  packages/law-practice/use-cases` printed `wrote @beep/langextract, @beep/law-practice-use-cases` and changed no
  file; the same command over one source file of each package wrote only the use-cases shard. The check still said
  `stale standards/schema-catalog/@beep/langextract.generated.jsonc` until a repository-wide `--write` rewrote it.
  `observability catalog --write <file>` refreshed the langextract instrumentation shard from one file.
- **Prevention:** make the scoped write resolve directory paths to their owning package and fail when a shard it
  reports as written is still stale; until then, run the unscoped `--write` and read `git status` afterwards.

## 2026-11-22: commit 8 preview vocabulary conflicts with the design

- Work: replay the frozen relation-preview report through the verified annotation handoff.
- Evidence: the offline preview exits 1 with "The E5 preview grounded no relation"; historical aligned relation candidates become `unmapped-predicate` residuals. The frozen report requires 10 grounded relations.
- Cause: design section 5.4 declares six predicates; semantica `src/schema/Evidence.ts` explicitly admits arbitrary non-empty historical predicates for this preview. The full semantica suite, including frozen hosted batches, passes 152 tests but does not catch this conflict.
- Prevention: include the historical replay vocabulary in the design simulation, and assert the actual frozen report before calling the contract settled. Sent the contradiction to the orchestrator for a bounded resolution; no corpus text recorded.

## 2026-11-22: versioned review captures expose an unversioned deterministic Tika scaffold

- Work: run the server standing tests after capture construction.
- Evidence: the review fails with "Office-action review requires a versioned extractor" from the deterministic `apache-tika` scaffold. Its descriptor and both result paths omitted a version.
- Prevention: every text-producing engine should declare its implementation pin before a consumer constructs provenance from it. The orchestrator approved `text-scaffold/1` for this in-process scaffold, with both result paths and a regression test; app/server runtime paths stay separate.

## 2026-11-22: source verification changes timeout-test scheduling under Node

- Work: run langextract coverage under Node/V8 after adding capture verification.
- Evidence: the full coverage run waited in the two TestClock timeout cases; focused handoff coverage completed in under two seconds at 100 percent. The model timeout was scheduled only after the asynchronous source digest completed, while the test advanced the clock immediately after forking.
- Prevention: synchronize on a Deferred from the stub model before advancing TestClock. The tests now wait until generation starts; they keep the real digest service and production timeout.

## 2026-11-22: the alignment cap and the lossless handoff need separate candidate inputs

- Work: inspect commit 8 against the handoff count contract.
- Evidence: the existing service case parses two candidates with an alignment cap of one. Passing only the aligner result gives a handoff count of one while diagnostics say two.
- Prevention: keep the attempted prefix and raw skipped tail explicit. By orchestrator ruling, optional `overCap` preserves the latter as `over-extraction-cap` residuals, with no anchor and `alignment: unaligned` meaning no proof. The reason records that alignment was not attempted. The cap test now pins raw fields and matching parsed counts.

## 2026-11-22: lab documentation wrappers intentionally select no source files

- Work: run JSDoc lint for the two touched lab workspaces.
- Evidence: the package wrapper and an explicit invocation using `.oxlintrc.docs.json` report "No files found to lint" because that config excludes `apps/labs/**`; neither lab declares a docgen script.
- Prevention: report that exclusion as an empty selection. For this change the touched lab sources are additionally checked with a temporary copy of the same documentation policy whose lab exclusion is removed; no repository policy is changed.

## 2026-11-22 — P3 Graph position retirement

- **Doing:** migrating Graph spans and running package verification.
  **Evidence:** nlp-processing docgen caught three nested float-span examples
  outside the design's file list. Wink's resolver match also needed an explicit
  Option<Position> result to prevent a generic none from widening inference.
  **Would have prevented it:** a span-constructor search that includes JSDoc,
  plus an explicit result type at the resolver boundary.
- **Doing:** proving the semantica pattern lane after unique-only resolution.
  **Evidence:** C0Slice live and replay digests still agreed, but its fixed digest
  changed when repeated entity surfaces lost their fabricated first-match spans.
  **Would have prevented it:** naming that expected pattern-report change beside
  the design's repeated-surface warning. Hosted frozen batches remain unchanged.
- **Doing:** checking the retained P3 design-module handoff.
  **Evidence:** the root oxlint configuration excludes goals, so a normal
  invocation exits with “No files found to lint.” A temporary configuration
  that removes only this exclusion found a claim-log codec compiled per call;
  it is now hoisted beside its schema at module scope.
  **Would have prevented it:** a supported explicit-files lint mode that reports
  excluded inputs instead of silently leaving them outside the check.
- **Doing:** registering targeted law-practice read-codec coverage through the
  existing additions-only coverage writer.
  **Evidence:** the writer refuses an unselected measured package even when its
  rows were just registered by the preceding small-package run. The exact
  selected set must include every retained summary; all five measured package
  names are now supplied. The law-practice run itself remains file-targeted.
  **Would have prevented it:** the additions-only CLI accepting a summary path
  or filtering its snapshot to the exact selected packages before validation.
- **Doing:** regenerating the P3 JSDoc totals.
  **Evidence:** the full inventory found that the commit-7 exported read codec
  lacked its same-name runtime type alias; package docgen alone had passed.
  The alias and its titled example are now present; the new finding is removed
  rather than admitted into the JSDoc baseline.
  **Would have prevented it:** the package JSDoc gate sharing the inventory's
  schema/value/type parity check.
- **Doing:** proving the L2 cache baseline after inventory regeneration.
  **Evidence:** cache audit reported configuration-drift on the root
  lint:policy-fingerprint computation because the fingerprint was regenerated
  after the review. The final cache review now follows that generator.
  **Would have prevented it:** an explicit generator-order dependency from
  the cache-baseline writer to the policy-fingerprint writer.

- **Doing:** remediating P3's dependency reds and replaying cheap-gates.
  **Evidence:** the generated config and fallow checks passed after the manifest
  fixes, but cache policy reported nine configuration-drift findings for
  law-practice use-cases and Lejeune. The exact dependency edges also belong to
  the reviewed cache projection. The scoped cache review carries all prior
  reviews and grants no qualification.
  **Would have prevented it:** dependency-edit guidance naming tsconfig-sync
  and the reviewed cache projection as one regeneration sequence.
