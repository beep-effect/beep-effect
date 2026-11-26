# Text-Knowledge Stack Rebuild — Opportunities and Friction

Receipts recorded at the moment the friction happened. Redact secrets, replace
home paths with `~`, drop session and machine ids.

## 2026-11-23 — P4 historical admission refusal boundaries

- **Doing:** reviewing selected-time admission views before commit 4. **Evidence:**
  GroundingInvalid occurs before occurrence membership can be established, while stale
  source resolution occurs after membership. Treating both as historical admitted stance
  would let a malformed receipt claim a stance it never earned. Remove the former from
  the stance-preserving refusal set and assert unresolved stance for a malformed receipt.
  **Would have prevented it:** a refusal-stage distinction in the selected-view test table.

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

- **Doing:** replaying final-head fallow health with an explicit base ref.
  **Evidence:** the wrapper recorded origin/main in its envelope but omitted it
  from the native health invocation. It reported 47 findings in untouched files,
  while audit attributed zero introduced findings. The wrapper now forwards the
  requested base through Fallow's changed-since option; the existing baseline
  and all complexity thresholds remain in force for changed files.
  **Would have prevented it:** a health argument-contract assertion that the
  envelope's declared base also reaches the native command.


### P4 design inventory buffer, 2026-11-22

While enumerating test existence for the P4 maps, the Node child-process default buffer
refused `rg --files packages apps` with `ENOBUFS`. No data was changed. Restricting the
search to `--glob '*.test.ts'` and setting an explicit bounded output buffer completed
the inventory. A test-file-only discovery recipe would have prevented the interruption.

## 2026-11-23 — P4 frozen format construction

- **Doing:** freezing the evidence and ledger encodings with today's codecs before P4 changes.
  **Evidence:** the current evidence converter rejects an empty quote, repairs a mismatched UTF-16
  width, and retains an oversized nonempty quote through its legacy fallback. A first fixture
  assertion incorrectly expected all three reads to succeed. The frozen test now asserts each
  actual result. **Would have prevented it:** an explicit accepted/refused matrix beside the legacy
  stored-span schema and fixture generation through the exact encoded-side schema.
- **Doing:** constructing semantica frozen nested ledger payloads from the existing hosted batches.
  **Evidence:** decoding a decoded batch as wire input fails at model.dimension because its optional
  fields are Options in memory. Encoding through EvidenceBatch/ExtractOutcome first preserves the
  wire shape. **Would have prevented it:** a reusable fixture-writing boundary that takes decoded
  schema values and always uses their declared codec.
- **Doing:** running the P4 commit-1 package test gates serially at nice 19.
  **Evidence:** one use-cases test process ended with exit 143 before reporting results; its direct
  retry passed 419 tests. No cause is established. Full law-practice server tests then passed
  298 files (1,719 tests, one skip) plus four boundary tests in about 280 seconds.
  **Would have prevented it:** durable per-command exit and termination-attribution receipts.
- **Doing:** running the full semantica test gate after adding the frozen ledger codec test.
  **Evidence:** 169 tests passed, including the new freeze test; the unchanged C0Slice live-to-replay
  test hit its 29,750 ms watchdog. Retrying the package at one worker attributes shared-resource
  contention without changing production code or the test's deadline.
  **Would have prevented it:** scheduling the native live-to-replay case within a measured worker
  budget rather than the default package fan-out.
- **Doing:** applying S31 to the frozen-format test harnesses.
  **Evidence:** effect-vitest initially reported per-test layer provisions and native filesystem
  candidates. The tests now share bounded it.layer hooks and assert that each fixture's real path
  remains inside the owning checkout before hashing its raw bytes. Scoped detection reports
  introduced=0. Two existing KB filesystem layer hooks also needed explicit timeout budgets.
  **Would have prevented it:** a canonical frozen-byte fixture test recipe with layer lifetime,
  package dependency and on-disk provenance assertions included from the start.
- **Doing:** running the blocking pre-commit comment-law gate on the assigned revised-design base.
  **Evidence:** `bun run beep laws comments --check --base 6a3805a8767` exits 1 with
  `Unknown subcommand "comments" for "beep-cli laws"`. No comment-law implementation is present in
  this lane's Laws command tree. The required introduced=0 receipt cannot be produced on this base.
  **Would have prevented it:** carrying the comment-law prerequisite into the supplied stack base
  before assigning a blocking gate. No substitute receipt or gate bypass is claimed.
  **Owning-lane ruling:** the P3/P2/PR-C base predates the comment-law tool and policy. Use the
  staged zero-context diff proxy before each P4 commit; it must print no added line comment or
  non-JSDoc block comment. Do not import the tool. The owning lane runs the authoritative gate
  after merging main and before publication. The proxy does not claim an authoritative receipt.
- **Doing:** reading every package test-typecheck result rather than trusting the command exit.
  **Evidence:** the wrapper returned zero while its JSON receipt recorded exitCode=1, including
  Effect diagnostics for a node:crypto import, broad S.Number, typed-input unknown decoding and
  yielding inside an assertion argument. Direct Schema codec callbacks also accepted an optional
  parser-options argument where Effect.forEach supplies a numeric index. These were corrected to
  Effect Digest, existing field schemas, typed codecs, bound values and unary callbacks.
  **Would have prevented it:** making package-test-typecheck propagate its recorded exit code and
  providing a checked codec/forEach example in the fixture recipe.
- **Doing:** committing the P4 frozen semantica ledger payloads without changing their source bytes.
  **Evidence:** the pre-commit secret scanner flagged nine cacheKey occurrences that are the same
  public content digests already permitted for the P3 frozen baseline. The existing exact-value,
  exact-field, exact-detector policy now also names the P4 ledger fixture. Its six values stay fixed;
  a scanner boundary test checks changed values, wrong paths and another token detector.
  **Would have prevented it:** treating nested frozen ledger payloads as part of the original
  synthetic cache-digest fixture closure. No standards exception inventory changes.

## 2026-11-23 — P4 signal declaration boundary

- **Doing:** re-proving commit 2 after moving Measurement to schema. **Evidence:**
  seven-package verification reproduced TS2527 at Claim.model.ts:189 because the
  exported union referenced private nominal measurement cases. Downstream audits
  failed at the same declaration boundary. **Would have prevented it:** declaration
  emit on the new shared leaf before the importer package fan-out. Export the
  documented nominal cases so generated declarations can name their brands.

## 2026-11-23 — P4 generic codecs and no-op identity

- **Doing:** implementing immutable claim arrows and assessment updates. **Evidence:**
  the first test-typecheck receipt exposed inference loss through a whole generic
  factory return type; infer the core codec directly and reuse the record ingredients.
  Runtime refusal tests also showed schema case constructors copy nested records.
  Return typed refusal values with the original record reference, retaining the
  schema-derived union contract. **Would have prevented it:** a generic encoded-id
  binding fixture plus an identity assertion in the canonical update recipe.

- **Doing:** running the P4 commit-3 docgen gate. **Evidence:** one wrapper
  failed to spawn docgen and another attempt exited 130 without a diagnostic.
  A direct docgen run then exposed two example type errors: concatenated hash
  strings widened past the required template-literal type. Explicit synthetic
  hash literals fix the examples; the earlier interruption causes remain unknown.
  **Would have prevented it:** preserving subprocess causes and compiling examples
  during the first local edit loop.

### P4 review repair: prefix validation and historical stance proof

- Doing: reproduce the independent review of commits 2–4 and repair all three findings.
- Evidence: the original L4-3 suite passed all five tests after replacing the production parent
  traversal with an empty traversal. The revised production-path suite rejects that mutant.
  New L4-1 and L4-4 regressions reproduced invalid-prefix acceptance and selected-source denial
  erasing admitted stance. Their corresponding mutants now fail.
- Prevention: generate graphs from minted records and append through the public arrow; keep
  historical admission verification separate from selected eligibility. Historical binding
  evidence requires explicit trusted ports and cannot be reconstructed by schema decoding.
- Gate friction: the first package audit caught TS2322 because negating the empty-array guard did
  not narrow violations to a nonempty tuple. Use the positive nonempty guard before constructing
  the refusal. The inbox rejected `--observed` for that audit row; acknowledge the repaired row
  with the fix commit after successful package verification.
- Additional gate feedback: the Effect diagnostic rejected yielded codec calls nested as arguments;
  named the encoded value first. Oxlint rejected inline admission codec construction; hoisted it
  to module scope. Effect-vitest rejected checking Option internals; used assertNone. No inventory
  or allowlist was expanded.
- Final focused proof: all 85 tests in 12 files passed under Node/V8. ClaimCore.ts and Admission.ts
  each have 100 percent statements, branches, functions and lines (297 statements, 158 branches,
  55 functions and 264 lines combined). Full package verification passed lint, audit and docgen;
  the package-test-typecheck result records exitCode 0 with empty diagnostics.
- Mutation receipts: the original five-test L4-3 suite survived deleting parent traversal (exit 0).
  The revised six-test suite fails that mutant (exit 1); deleting prefix validation fails L4-1
  (exit 1); coupling historical stance back to selected verification fails three L4-4 tests
  (exit 1). Each temporary mutation was restored before the final package and coverage runs.

### P4 evidence retirement implementation friction

- Doing: locating package decisions before the evidence retirement wave. Evidence: the requested
  `beep decisions for` command exits 1 with `Unknown subcommand decisions` on this layer. Read the
  relevant packet decisions and search package decision paths directly. Prevention: keep the
  always-loaded command recipe synchronized with the checkout's available commands.
- Doing: running focused package tests. Evidence: Bun's misplaced `--cwd` form printed script usage
  with exit 0; an invocation from the repository root entered the root test wrapper instead.
  The owned root invocation was cancelled with exit 130 before tests ran. Prevention: use the tool's
  explicit package working directory and require a Vitest test count, not only process exit 0.
- Doing: migrating evidence fixtures. Evidence: the frozen reader initially changed JSON field order;
  the domain identifier snapshot also changed as expected. Preserve original field ordering in the
  private frozen codecs and update only the derived identifier snapshot, never frozen wire fixtures.
- Gate feedback during row 5: Effect-vitest rejected six boolean Result assertions in new tests.
  Use assertSuccess/assertFailure so the assertions preserve the library's failure information.
  No detector baseline or exception row was added. The schema-first writer removed the retired
  span-generator exception and updated two existing advisory line numbers; its entry count shrank.
- Broad server proof exposed an introduced indirect consumer omitted by the lexical symbol map:
  `PracticeKg.queries.ts` projected root span offsets and quote directly from JSON. Three practice-KG
  tests failed with `Expected number at [0][endChar]` after v2 writes. Apply the same declared
  legacy/v2 SQL coalescing rule to this reader. Prevention: inventory JSON-path readers alongside
  symbol importers before retiring a stored shape.
- The v4 Result assertion helpers compare an expected payload; using them as tag-only assertions
  failed the first broader foundation run. Replaced them with the established Result predicate
  piped to assertTrue. A subsequent syntax error in that test edit was corrected before rerunning.
- Boundary review during row 5 found that decoder fallback could reinterpret a malformed versioned
  payload as untagged legacy data when both field sets were supplied. Version presence now selects
  the current decoder exclusively; malformed/unknown versions refuse instead of being repaired.
  A planted mixed-shape regression covers current-invalid, future and non-string versions.
- The command tool briefly returned repeated runtime-replacement errors. Before restarting the
  audit script, checked owned processes and its expected log files; neither existed, so no audit
  was duplicated. A short retry restored the command route without changing permissions.
- The first tables audit exposed five introduced test-check errors: widened entity/schema-version
  fixture literals, nullable insert fields spread into a selected row, and a missed pipeable codec
  construction. Kept the fixture constrained by EvidenceRow, supplied the required row fields and
  used the schema's pipe form. The exact check then reported 0 errors/0 warnings and five fixed;
  all 50 table tests and the corrective lint/check package verification passed.
- The use-case package audit passed, but docgen exited 130 during example typechecking. The earlyoom
  journal identifies that exact docgen process at the matching failure time. Standalone docgen passed
  without edits; the environment-only inbox acknowledgment records that evidence. Do not disable
  memory protection or restart other agents to make a proof pass.
- Earlyoom also sent SIGTERM to the epistemic-server integration Vitest process; the package audit
  returned 143 after its build, check and 34 regular tests had passed. Package lint/docgen passed.
  The complete integration set passed with one worker (30 tests; two external-Postgres files skipped).
  The environment-only acknowledgment cites the matching journal evidence. Reduced this proof's own
  worker count without changing assertions, services, memory protection or another agent's process.

# P4 row 5: desktop audit closure

The complete desktop audit found a sidecar-registration fixture still using the legacy span shape;
the symbol-only retirement search had not located its inline JSON. Converting that fixture to v2
restored all 300 regular tests. A first corrective fixture omitted the ReportedConfidence tag;
the decoder caught it, and the corrected tagged fixture passed. Future migration inventories should
include inline decoder inputs in the owning package's full suite.

The same audit's integration Vitest process received earlyoom SIGTERM, confirmed by its exact
command in the journal. Retry the failed integration component with one worker, retaining the
already successful lint, build, check and docgen results; do not repeat the full package audit.

The law-practice server audit took roughly 29 minutes and completed 92 integration tests before
reporting six extractDeadline failures in unchanged citation-regex boundary/case-flag batches.
An exact-case retry in the same Bun runtime passed all six with one worker and unchanged 30-second
extraction and 60-second operation limits. Preserve the successful audit components and retry only
failed batches under lower contention; do not weaken production safety deadlines to green a gate.

# P6 row 0: design packet commit

The P6 design lane wrote three maps and the design under `research/` without running
`bun run beep goals manifest --write`, so `researchReports` drifted by four files until the
implementation lane's row 0 ran it (`researchReports drifts from research/: +4 unlisted`). A design
lane that adds research files should run the manifest writer before it hands off.

# P7 rows 1 to 7: the P6 merge and the writer base

The regenerate merge driver left `ops/manifest.json` marked conflicted with no conflict markers in
the file when the P7 lane merged the P6 head 8dd3c233e66 ("regenerate merge driver left
goals/text-knowledge-stack-rebuild/ops/manifest.json conflicted; regenerate it after Git installs the
merged tree"). Taking the P6 side and re-running `goals manifest --write` and
`goals decisions write` resolved it. The driver could stage its own regenerated output.

On the merged base, four of the seven writer checks that `delete-package` re-runs in write mode
were red, all inherited: `lint schema-first` (seven P4 schemas already reworked by #3540 on `main`
but not yet in the P6 base, plus two P6 schemas in nlp-processing `src/Activity.ts`),
`lint package-scripts --check` (doctest pairs in law-practice domain from P5 and in jsonc from P6),
`fallow:health:baseline:check` and `fallow:dead-code:check` (P4, P5 and P6 findings; one is the
unused `@beep/text` dependency of the nlp package that row 3 deletes). Rows 1 and 3 hold until the
P6 lane merges its base and fixes its own reds. A stack whose top layer runs repo-wide writers needs
each lower layer's writer checks green before the top layer starts, not only at its own exit.

The design's row-7 gate names `bun run beep laws comments`, which this lane's CLI does not have
("Unknown subcommand \"comments\" for \"beep-cli laws\""); it reaches the lane with a later base merge.
## 2026-11-22: a cache re-record took a stale toolchain profile from a copied request

- **Doing:** re-recording the root cache baseline of PR #3439 after its second main merge.
- **Evidence:** the new request was copied from the earlier one and kept
  `"profile": "local-linux-x64-bun1.4.4"`. `.bun-version` and main's root both say 1.4.5.
  `beep cache baseline --request` accepted the stale profile and wrote it, and `cache audit` passed.
  beep-reviewer caught it on the PR ("Merge re-record reverts main's root baseline profile").
- **Prevention:** `cache baseline` could refuse a request whose profile is not the one the
  checkout's `.bun-version` yields, or derive the profile itself when the request omits it.

## 2026-11-23: the goal Stop hook re-fired every few seconds while P3 waited on P2's merge slot

- **Doing:** holding the P3 lane (#3516) until the orchestrator merged P2 (#3511) in a slot the
  CI goals driver ruled on (pin-PR hour, runner burst until 14:39Z).
- **Evidence:** P2 was CLEAN and MERGEABLE with 73 passing checks. The goal Stop hook re-fired more
  than 60 times between 13:48Z and 13:52Z with the same "P2 is OPEN" judgment. The repo forbids
  polling loops for PR waits, and `gh event listen` returned HTTP 403 (event subscriptions not
  enabled), so the only wake signal was the PR watch.
- **Prevention:** the goal hook could accept a recorded external blocker (owner, wake signal,
  earliest time) and stay quiet until that signal fires, instead of judging each idle turn.
