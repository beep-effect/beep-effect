# TsconfigSync main e7b source-forward disposition

## 1. Outcome and exact scope

**No new qualification or implementation is warranted.** Main e7b expands the existing D1 WorkspaceDescriptor presence cluster from two to three independent Boolean facts. The existing named raw mode tuple remains D1 with 8/8 legal requests, and the separate project/owner-presence cluster remains D1 with 4/4 supported pairs. Propose three same-ID metadata refreshes, zero new IDs, zero qualified designs, and zero source changes. A descriptor clone or its local discovery values do not require a duplicate inventory record.

This native P2 audit binds root HEAD `a942d7dab3a962963912247d4699b7986bcb9c03`, origin/main `e7b7d03e61bd5cddd74e89bb03ae10dbe06e067b`, and inventory SHA-256 `fc4a37c261318d37cc276315d7014c61410277c7802b38806b72ae3a9437fc13` (751 records; 145 qualified, 606 disqualified). The prior main is `284294ee24177f13f6d3a763c5d987206d351c51`. All four changed TsconfigSync files, all seven current module files, full prior/current tests, source/barrels/consumers, governance, dependencies, and current/old inventory artifacts are frozen. Actual provenance remains the retained parent-confirmed native `gpt-6-astra` / `xhigh` launch.

Source abbreviations below are exact frozen files under `before/packages/tooling/tool/cli/src/commands/TsconfigSync/`: **S** schemas, **P** plan, **C** command, **V** service, **R** render, **E** errors, with the `TsconfigSync.` filename prefix and `.ts` suffix. **T** is `before/packages/tooling/tool/cli/test/tsconfig-sync.test.ts`. All original lines remain available in `before/`; `main284/` preserves the previous source/test bytes. SHA-256 maps and ref equality checks are in the binding JSON files. This bounded source-forward audit does not replace a Grok census, dry round, or independent P3 review.

## 2. Complete owners and cardinality

`WorkspaceDescriptor` is now declared at S958–974. Its complete payload is packageName/absoluteDir/relativeDir strings, required `ownerTsconfigPath:string|undefined`, required `hasProjectTsconfig`, new required `hasCheckTsconfig`, required `hasDocgenConfig`, and optional rootAliasTarget/wildcardAliasTarget strings-or-undefined plus optional subpathAliasTargets string record-or-undefined. It has exactly **three actual Boolean members**. Its class inheritance adds no Boolean data field. Optional owner/alias presence is not silently counted as another Boolean or normalized away.

Discovery P286–375 obtains project presence from tsconfig paths at P299 and independently probes `tsconfig.check.json` and `docgen.json` at P313–318; probe errors fall back to false exactly as written. `collectTsConfigPaths` (repo-utils TsConfig.ts51–84) scans `tsconfig*.json` and does not require a project file. A valid package can independently contain or omit each of the three files. The eight file-presence triples are therefore legitimate observation states, not just schema-permitted abstractions. Check-only and docgen-only workspace layouts are not rejected by discovery. The new check planner skips missing prerequisites, while docgen presence remains independent. `static-contract-matrices.json` enumerates the unexecuted source-derived witnesses: **8 representable / 8 legal**.

The existing project/owner cluster remains separate. `chooseOwnerTsconfig` P248–260 prefers tsconfig.build.json, otherwise tsconfig.json, otherwise undefined. Discovery supports neither; a build owner without tsconfig.json; and project plus owner. Current public documentation S1091–1100 explicitly constructs project=true, check=true, docgen=true, owner=undefined and gives it to the exported sorter S1106–1111, which reads relativeDir only. This positive constructor/consumer evidence survives the new field and defeats an invariant inferred solely from discovery. It preserves all **4/4 project/owner-presence pairs**. The unrelated illustrative `S.is` snippet at S950–952 is not used as evidence; the complete `.make` example is the binding public contract.

`TsconfigSyncModeFlags` S441 is still the complete exported readonly [check:boolean,dryRun:boolean,write:boolean] tuple. C19 constructs an actual value satisfying it. It is eligible as an owner independently of the function-parameter exclusion, but is D1 because all **8/8 raw triples** are supported. The exact table is:

| check | dryRun | write | selected mode |
| --- | --- | --- | --- |
| false | false | false | sync |
| false | false | true | sync |
| false | true | false | dry-run |
| false | true | true | dry-run |
| true | false | false | check |
| true | false | true | check |
| true | true | false | check |
| true | true | true | check |

The exported precedence predicates S459/476/493 explicitly allow the lower-priority slots; C18–30 takes the first matching mode and defaults to sync. All parser defaults stay independently false (C52–72), and no conflict error is introduced. Successful mode output cardinality does not establish illegal raw requests. Service failures for drift, filtering, dependency cycles, or file/parse errors do not turn a supported raw tuple into an incoherent state.

`declaration-audit.json` lists all 23 schema classes and the named tuple, including complete fields. Each of the three run-option variants S495–526 has one Boolean (`verbose`) plus mode and optional filter. Each of six change variants and six planned-file variants S620–815 has only strings; the planned form also has content. All three result variants S866–897 contain a mode tag, `changedFiles:S.Finite` number, and zero-Boolean changes. The reference/path subset schemas S1015–1083 contain optional unknown/path data or arrays/records, no typed Boolean members. Unknown payloads are not Boolean declarations. No class adds a custom inherited Boolean pair.

The newly added two class variants (S664 and S788) both have zero Boolean fields. The new planned-content HashMap V132–134 contains string/string entries. The method-valued plan facade P1222–1235 has no Boolean data fields. Three error classes E29/77/125 contain finite numbers, strings, or nested string arrays and methods; TaggedError inheritance adds no Boolean pair. Counters and predicates are not Boolean owners. C52–74 parser descriptors and anonymous handler flags remain excluded; C77–81 constructs resolved mode/verbose/filter with one Boolean, not the raw tuple plus verbose. The unchanged JSONC helper/driver settings and unrelated imported domain families are preserved outside this bounded source delta.

## 3. Exact upstream changes and producer path

C changes only command descriptions to mention check-overlay references; C18–102 behavior is otherwise identical to main284. S adds CHECK_TSCONFIG_FILENAME at49, a `package-check-references` section member at595, its public-change class S664–673, planned-content class S788–800, both union entries S709/839, the descriptor field S965, and the complete constructor example's new member S1097. Existing literal mode and raw tuple semantics are unchanged.

P313–318 adds the check file probe and P369 passes it into the actual descriptor constructor, alongside all existing owner/alias fields. No alias defaults or payload coercions change. P1006–1050 is the new single-workspace overlay planner. P1078–1094 iterates an owner/filter-selected workspace array and appends only Some changes. The new planner is a method on exported `TsconfigSyncPlan` at P1225; source JSDoc examples mentioning a direct named export do not override the actual exported object surface.

V130–142 constructs a HashMap from already planned package canonical changes (`filePath`, `content`), then appends check-overlay changes before planning docgen. Thus an overlay uses this run's canonical content rather than lagging behind the disk by one sync. The actual canonical file is `ownerTsconfigPath` (which may be tsconfig.build.json); P1020 has a tsconfig.json fallback. The preliminary public planner filter P744–772 rejects owner-undefined workspaces from its working set, and an explicit filter matching none returns the existing TsconfigSyncFilterError. It does not invalidate that descriptor for other public consumers.

After that filter, P1010–1012 returns None if project or check presence is false. It then chooses planned canonical content or reads disk (P1023–1026), decodes both reference subsets, extracts ordered string paths, compares lists, and preserves a no-change None result. The guard is applicability selection over independent file facts, not an implication that check must imply project. `hasDocgenConfig` is inspected separately at P1120. Neither missing file triggers a new Boolean coherence error.

Existing root-reference planning P465–495 uses project presence and the lab exclusion; alias planning P578–687 reads alias payloads; target filtering/reference planning P744–994 uses the optional owner; docgen planning P1110–1154 reads docgen presence and full package/path fields. All remain readers of the same complete descriptor. Sorting S1106–1111 consumes relativeDir independently of the file facts. No additional runtime descriptor constructor was located outside P363; the documented constructor is retained as public input evidence, not erased because it is not that runtime writer.

## 4. Public surfaces, every consumer, and payload fidelity

The facade `index.ts`13/20/27/34 reexports command/errors/schemas/service. CLI package.json57/128 exports the facade for source/build; existing wildcard command subpaths remain unchanged. Root registration and alias/package files are frozen and compared to current refs. No new export wiring is required by this proposal. Public constructors and codecs remain usable independently of the discovery/planner implementation.

All known repository call sites were found by the preserved searches across packages/apps/docs. V101 obtains descriptors and passes the complete collection through root/package/overlay/docgen planning. The direct service consumer C83 retains root discovery before mode resolution (C75–76), full filter/verbose payloads, and its typed error/reporting behavior. CreatePackage.command.ts1597–1601 supplies `{mode:"sync",filter:undefined,verbose:false}` and later consumes numeric `changedFiles` in its summary. DeletePackage.command.ts766–768 supplies the same resolved shape and maps failure to the existing post-deletion DomainError. These are one-Boolean options objects, not new request owners. Lint.command.ts100–103 names the existing tagged schema families; it does not construct data owners. The complete consumer source files are frozen; other workers' ownership is preserved.

The public service retains both `syncTsconfigAtRoot(rootDir,options)` and curried `syncTsconfigAtRoot(options)(rootDir)` forms (V80–100, `dual(2,...)`). It checks cycles before planning V101–113. It sorts all planned changes V147 and writes only in sync mode V149–153. It maps each full planned payload to the report shape V155, renders it V156, and only then raises a check-mode drift error V158–162. C84–102 renders drift/filter/cycle error text before the reported-exit path, including cycle details. All orderings and diagnostics remain binding behavior.

`toReportedChange` P1192–1207 explicitly handles all six section variants, including `package-check-references`: it carries filePath/summary/section and deliberately omits internal content, exactly like the other variants. The new planned payload's content remains the complete modified file string through writes, not a reconstructed subset. Result construction V164–184 retains mode, numeric changedFiles, and the full reported changes array. Render R30–65 reports the selected mode, every change's relative path, section and summary, with unchanged no-change messages. No writer/reader migration or count-as-Boolean substitution is proposed.

## 5. Encoded contract and upstream compatibility impact

The new required `hasCheckTsconfig:S.Boolean` is a real **upstream public descriptor schema change**. Main284 descriptor input without that key is not silently defaulted or accepted as false by the current schema; this audit does not claim byte compatibility across that upstream change. The current discovery and documented constructor supply the field. No located application code serializes WorkspaceDescriptor to a persisted manifest, but its exported Schema.Class remains a public codec/constructor contract. Arbitrary publicly accepted owner/alias fields and supported descriptor combinations are not narrowed to one producer's results.

The public section union expands from five to six tags and public result changes can now include `package-check-references`. Existing tags and their field schemas remain intact; downstream exhaustive consumers must recognize the new tag as the current source does. `changedFiles:S.Finite` is a numeric schema with no equality filter tying it to changes.length. Runtime production of a count does not authorize narrowing the codec to that producer or reinterpreting a nonzero count as a Boolean.

Overlay edits use the original text with the shared JSONC modification helper (P1035, internal/cli/Jsonc.ts77–123). Only references are replaced; comments, extends and unrelated compiler options survive according to the existing helper contract and new test assertions. The reference extraction intentionally follows the existing `compareReferencePathsInOrder` P434–439: missing references become an empty list, and only string path entries are used. This is not a claim of verbatim preservation of arbitrary malformed/non-string reference entries. Neither descriptor nor report codecs are used to rewrite whole overlay documents.

The new tests T870–872 assert preservation of the comment and `noEmit:true`; their fixture also contains composite:false and rootDir. Those are configuration payload in test JSON, not new Boolean declarations in the production owner scope. No alternate schema, default, normalizer, wire migration, JSON encoder, or field removal is proposed by this campaign audit. The correct baseline is current main e7b behavior, including its newly added field and tag.

## 6. Guard accounting and evidence gate

Proposed guard deletions, writer migrations, reader migrations, and encoded transformations: **zero**. D1 refreshes are census metadata, not qualified designs needing implementation deletion credit.

| Guard or branch | Preserve because |
| --- | --- |
| C18–30 and S459/476/493 | Documented total request priority; all eight triples supported |
| P744–772 | Selects owners and applies optional name/path filter; preserves explicit unmatched-filter diagnostic |
| P1010–1012 | Skips missing project/check prerequisites; all observed combinations remain legitimate |
| P1023–1026 | Prefers planned canonical content before disk |
| P1033–1041 | Avoids edits for identical ordered paths or identical resulting text |
| P447 and P1120 | Independent project/root-reference and docgen applicability |
| V107–113 | Dependency cycle errors precede planning |
| V149–162 | Sync-only writes, full rendering, then check drift failure |
| C84–102 | Typed diagnostics and reported-exit behavior |

A new tag carrying file content is already modeled by a class in a tagged union. It does not create parallel Boolean flags. A useful consolidation of planner helpers or mode resolvers would not supply the missing cardinality gap. No E1–E4 qualification is established by this delta. The three existing D1 rows retain IDs/file/symbol/kind/status; their line numbers and exact source notes are refreshed, and only the descriptor presence row gains the new member.

## 7. Tests, dependency proof, and private validation

The prior full Tsconfig test bytes are identical to main284. This audit reuses the sealed prior CLI-family analysis of unchanged tests, reads the complete new fixture/diff and both added tests, and preserves the complete current test. `prior-reuse-checks.json` proves that RunMode and cli-kits test bytes remain identical to the prior sealed evidence. No claim is made that every Tsconfig raw tuple or descriptor triple has an executed test.

New T784–885 covers two same-run edits, check drift count two, public report sections/summary, mirrored reference paths, comment/noEmit preservation, and zero subsequent drift. T887–965 covers an already agreeing overlay and a drifting overlay, one-file check error, exact new report tag/summary, and final reference content. T204–209 is a property test for a test-local reference document schema, **not** a WorkspaceDescriptor or full-result arbitrary round-trip test. T211–239 covers explicit `--write --filter`; existing service tests exercise literal-mode sync/check/dry-run, dependency references, aliases, docgen, labs, filtering and cycles. The complete test file is frozen rather than executed.

The installed Effect version and manifests/lock are frozen. `effect-api-spans.json` reuses 31 exact installed/advisory API spans only after full-file hash equality against the current captured files: Predicate.Tuple slot checking, Option.firstSomeOf order, dual forms, Flag defaults, Schema.Class/TaggedError inheritance, and Command descriptor surfaces. Advisory `.repos/effect` is not substituted for installed code; its differing `Flag.Boolean` spelling remains reference-only. Full current API files are frozen independently. Repository LiteralKit/Option/JSONC helpers and relevant barrels, plus jsonc-parser manifest/declarations, are preserved.

The only executed checks are the packet row validator for three proposals and the private 751-row projection, then artifact/hash consistency checks. All non-target inventory lines remain byte-identical. Qualified count remains 145; disqualified count 606. No product/package tests, cache sync, implementation, package scripts, explicit index/build/restore, model workflow, or ref mutation was run. Required ordinary Graft retrieval automatically refreshed its ignored cache for 12 files and reported approximately 19,197 tokens saved; that permitted side effect has a receipt.

## 8. Integration and family boundary

`proposed-rows.jsonl` replaces exactly `tsconfig-workspace-descriptor-presence`, `tsconfig-sync-mode-flags`, and `tsconfig-workspace-owner-presence`. The private projection shows the combined result while preserving every other row verbatim. Install this full disposition at `data/pre-r32-main-e7b-tsconfig-owner-disposition.md` if the parent integrates these source-forward corrections. No active qualified design exists for these IDs and none is created.

`proposals/family-cli-mode-flags.md` is the full existing canonical body preceded by a bounded current-source binding addendum. Both historical Runners/Tsconfig D1 corrections are already integrated in the current inventory and their active designs are absent; the family currently has zero migrations. The addendum clarifies that completed integration without rewriting historical provenance. It re-audits only Tsconfig, preserving all other family owners and prior dispositions. The unchanged RunMode API is not widened and no excluded anonymous flag parameter is assigned a refactor. The full original family and prior Tsconfig disposition are frozen.

This bundle is private, source-bound native P2 evidence. Parent source hold remains in force until sealing; ending hashes/refs are checked and the durable handoff releases it. No independent P3 approval, current dry-round result, or replacement census credit is claimed. Source, canonical packet, dependencies, refs, generated files, other workers' work, and prior sealed bundles remain unchanged by this worker.
