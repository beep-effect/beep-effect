# templates — round-2 merged inventory

Seats read: `grok.md` (2 findings), `sol.md` (3 findings), `fable.md` (13 findings), and their shared `BRIEF.md`. Recursive discovery found no part directories or additional seat/brief files. Reviewed commit: `a12bef261998d2ad92153dada46373be06950692`; oracle: the brief's pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` templates snapshot. Live checkout: `@lab/effected-2`, inspected HEAD `2f515ae2519cc72223c94917019bf7ebfe92a4a5`; the templates source/test diff from the reviewed commit is empty.

**Required: 8 · Backlog: 6 · Handled by the deviation codemod: 2 · Rejected: 0 · Groups: 3.** All 18 submitted findings are accounted for in 16 merged records. `sol-2-1`/`fable-2-1` and `grok-2-2`/`fable-2-4` are the two duplicate pairs.

Binding basis: the entire top operator-revision block (including both 2026-10-09 rulings), D1–D20, sections 12.4/12.5 and 14, and this merge request. Documentation/JSDoc and coverage/vitest-canon records are backlog as explicitly requested, irrespective of the brief's claimed S2/S3 green gates. Attribute **check** metadata is a schema-law obligation, not JSDoc. The retained test's native Set is required because section 16 explicitly forbids it and the green native-runtime gate excludes tests.

The current `standards/effect-laws.allowlist.jsonc` has **zero** entries for `scratchpad/effected/templates/**`; consequently there are no new `allow-<n>` records. The historical round-1 WeakMap entry is already removed. The owner-cache replacement has a newly demonstrated copy defect (`fable-2-3`), so its repair stays required; the withdrawn WeakMap is not restored.

Provenance was checked using file-scoped `git log --format=%h:%s` and the preserved pre-squash history via `--all`, then step-2/S1/round-1/S3 diffs: `7f67982f77`, `a8bd60176f`, `d41afb2870`, `c1f8e8c657`, `37513ce1d6`. The upstream outcome/result shapes were replaced to satisfy schema laws; matcher ownership follows the operator ruling; the unsafe outcome cast was removed by step 2 and its unreachable guard subsequently simplified under section 11.3. These reports establish no unforced divergence warranting an upstream-shape restoration. No scratch-copy compiler probe, test run, coverage run, ledger command or implementation fix was performed. Measurements below are attributed to the seats.

`required.json` assigns only module source/test surfaces: **g1** owns four source files and the behavioral/performance regression tests; **g2** owns attribute checks and `SectionAttributes.test.ts`; **g3** owns only the retained property test's native collection replacement. No file overlaps and no group exceeds six source files. New upstream-bug recording and all law-forced export/deviation bookkeeping remain central integration work; no group owns the root manifest, lockfile, repo config, port ledger or README Port notes.

## Required

### grok-2-1

- file: scratchpad/effected/templates/SectionDialect.ts:354
- class: bug   severity: required
- standard: D9; section 14; render/scanner round-trip contract; the accepted round-1 document-leading BOM repair.
- evidence: containsMarker runs the document matcher on section.content. The absolute-offset BOM alternative in compileMatchers succeeds at offset 1 for content "\uFEFF# --- BEGIN tool MANAGED SECTION ---", so render returns markerInContent. In the resulting document that BOM would be inside a section, where the same alternative cannot match. The pinned oracle anchors only at ^ and permits this content; the accepted BOM deviation addresses document-leading parsing, not content rejection.
- failure: Valid content beginning with BOM plus a marker-shaped line is falsely refused by render/reconcile even though scanning the embedded content would preserve it.
- fix: In containsMarker, match against "\n" + text so the absolute-document-offset BOM alternative cannot fire; retain multiline ^ matching for real marker lines and keep scan/compileMatchers document-leading BOM support. Add render/parse/reconcile regressions for BOM-prefixed content and retain the document-leading BOM cases in SectionDialect.test.ts and SectionDocument.test.ts.
- seats: grok-2-1

### grok-2-2

- file: scratchpad/effected/templates/internal/attributes.ts:51; scratchpad/effected/templates/internal/attributes.ts:79
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18; standards/effect-first-development.md EF-12c; reusable-check metadata standard.
- evidence: AttributeName and AttributeValue each call S.isPattern without check annotations. Schema-level $I.annote supplies schema metadata, not the check identifier/title/description/message. SectionKey and Delimiter already demonstrate the required annotated pattern checks. The four green S1 laws do not enforce this reusable-check metadata requirement.
- failure: Exported, reused attribute grammars emit the generic regex issue instead of an identified, user-facing decode failure.
- fix: Supply composer-derived identifier, title, description and a user-facing message to each S.isPattern check. Preserve both regexes exactly, including AttributeName JavaScript dollar-anchor acceptance; do not add the u flag. Keep SectionAttributes.test.ts acceptance assertions and add focused check-metadata/decode-message assertions there.
- seats: grok-2-2, fable-2-4

### sol-2-1

- file: scratchpad/effected/templates/internal/reconcile.ts:263
- class: bug   severity: required
- standard: D9; section 14 verified upstream-bug exception; ManagedSection BOM preservation and SectionDocument byte-preservation contracts.
- evidence: Both seats identify output.trim() === "" as the destructive branch. Sol reports probes of lab and pinned oracle for "\uFEFF", "\uFEFF\n", and " \t\n": reconciliation starts directly with BEGIN and loses the original text. Fable independently reports BOM loss for BOM plus zero, one or two blank lines, and verifies its upstream reconcile.ts against the pinned oracle. trim removes U+FEFF as well as whitespace.
- failure: First insertion into a BOM-only or whitespace-only document permanently deletes existing bytes; ManagedSection.sync then writes that result.
- fix: Use the empty-document branch only for the actually empty string. When any original bytes exist, preserve the complete prefix, including BOM and whitespace, and add only the necessary separators before the appended block. Do not use the Fable trim-and-rebuild variant, which still discards whitespace. Add BOM-only, BOM-plus-whitespace and whitespace-only insertion/fixed-point regressions in SectionDocument.reconcile.test.ts; broaden SectionDocument.property.test.ts to exercise empty/blank prefixes. Integration records the verified upstream bug centrally under section 14.
- seats: sol-2-1, fable-2-1

### sol-2-2

- file: scratchpad/effected/templates/SectionDialect.ts:330
- class: bug   severity: required
- standard: D9; D10 formatter fidelity; section 14 verified upstream-bug exception; successful-render round-trip contract.
- evidence: Sol reports the same lab and pinned-oracle probe: rendering id.section("a\r") with LF succeeds, parsing recovers "a", and check returns Drifted. CRLF rendering instead recovers "a\r" and is UpToDate. The trailing content CR joins the emitted LF into CRLF, which scan strips as the boundary. SectionDialect.property.test.ts removes all CR from its generated content and therefore misses this case.
- failure: Successful LF rendering silently loses a trailing bare CR and causes identical subsequent reconciliation to keep reporting Updated.
- fix: Refuse LF rendering when normalized content ends in a bare CR, with a dedicated typed SectionRenderError reason and exhaustive message handling. Retain faithful CRLF rendering. Add LF-refusal, CRLF-fidelity and reconcile-no-write regressions in SectionDialect.test.ts and SectionDocument.test.ts; extend SectionDialect.property.test.ts to cover the bare-CR boundary without weakening existing fidelity assertions. Integration records the demonstrated upstream-bug deviation centrally.
- seats: sol-2-2

### sol-2-3

- file: scratchpad/effected/templates/SectionDialect.ts:445; scratchpad/effected/templates/internal/scan.ts:243
- class: perf   severity: required
- standard: D11 algorithmic-class criterion; section 14 upstream-bug exception; SectionDialect.matchers linear-scanning contract.
- evidence: For "# --- BEGIN tool MANAGED SECTION x" + " ".repeat(n) + "!", the lazy attribute capture advances through the whitespace run and its following GAP consumes/backtracks across the remaining suffix at each position: Theta(n^2) total work. Sol reports three-call averages for 4,000/8,000/16,000 spaces: lab 2.81/9.86/39.21 ms; pinned oracle 3.38/12.87/50.35 ms; every result false. These are seat-reported measurements, not a new run, and establish an inherited hotspot rather than a lab slowdown.
- failure: Malformed marker-like input makes document parsing and marker-injection checks quadratic before the single-pass attribute parser runs.
- fix: Recognize closing-rule and optional-comment-suffix boundaries with a deterministic linear scan, then send the single extracted attribute run through parseAttributeRun. Share the recognition behavior between containsMarker and internal/scan collectHits, preserving quoted --- values, trailing whitespace, capture/offset behavior, first-style priority and malformed-marker handling. Keep helper changes in the existing owned SectionDialect.ts/internal/scan.ts surface. Add adversarial scaling/work-bound and grammar regressions in SectionDialect.test.ts and internal/scan.coverage.test.ts. Integration records the algorithmic upstream-bug repair centrally.
- seats: sol-2-3

### fable-2-2

- file: scratchpad/effected/templates/SectionDocument.ts:431
- class: bug   severity: required
- standard: D9; remove separator-collapse contract; accepted round-1 BOM parsing repair.
- evidence: Fable reports remove on BOM + first block + "\nfooter\n" returns "\uFEFF\n\nfooter\n", versus "footer\n" without BOM. The repaired scanner sets found.start to 1; before is then the BOM, and the nonempty-before/nonempty-after branch inserts two line breaks. The upstream rejected this input as orphanedEnd, so the broken path was introduced by the lab repair.
- failure: Removing the first section of a BOM document leaves two leading blank lines that later operations retain.
- fix: Treat the leading BOM separately from the surrounding textual prefix. Strip only separator line breaks around the removed span, then prepend the preserved BOM to every return branch. A BOM by itself must not select the two-sided separator branch. Add BOM-plus-footer, BOM-only remainder and repeated sync/remove regressions in SectionDocument.test.ts, preserving the existing non-BOM behavior.
- seats: fable-2-2

### fable-2-3

- file: scratchpad/effected/templates/SectionDialect.ts:396
- class: bug   severity: required
- standard: D9; operator owner-local matcher-cache ruling; Effect S.Class prototype-preserving copy support.
- evidence: Fable reports an installed-immer produce copy remains instanceof SectionDialect but matchers/render throw TypeError: Cannot access invalid private field. Effect S.Class declares the immerable marker; its normal decode path reconstructs the owner and is unaffected. The pinned oracle WeakMap misses on the copy and recompiles successfully. History c1f8e8c657 introduced #compiledMatchers specifically to satisfy the owner-cache ruling.
- failure: A supported prototype-preserving dialect copy lacks the private-field brand, turning marker access, rendering and parsing into an untyped defect.
- fix: In matchers(), use the ergonomic private-brand check: return #compiledMatchers in this ? this.#compiledMatchers : this.compileMatchers(). Genuine owners retain their cached arrays; unbranded copies compile with their own fields without a global/native cache. Add a prototype-preserving-copy regression to SectionDialect.test.ts that proves render and containsMarker work, while retaining owner reuse, isolation and wire-form tests. Use existing available copy machinery; do not require a root dependency/config edit.
- seats: fable-2-3

### fable-2-13

- file: scratchpad/test/templates/SectionDocument.prop.test.ts:32
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md section 16 native Set/Map ban; D5; D11 law violation; green-gate exception for excluded test paths.
- evidence: The retained property arbitrary creates new Set<string>() and calls seen.has/seen.add at lines 32-40. This is source-confirmed, upstream-carried code. The native-runtime gate excludes tests, so its reported green state does not enforce this explicit port-wide prohibition.
- failure: The module still uses a native Set in its identity-deduplication property after the operator withdrew native collection exceptions.
- fix: Import effect/MutableHashSet and replace allocation/has/add with MutableHashSet.empty<string>(), MutableHashSet.has and MutableHashSet.add. Preserve string-key uniqueness, generated declaration order and every upstream property assertion. Record the native-runtime class update centrally; no source-file or configuration change is needed.
- seats: fable-2-13

## Backlog

### fable-2-5

- file: scratchpad/effected/templates/internal/attributes.ts:35; scratchpad/effected/templates/internal/scan.ts:70; scratchpad/effected/templates/internal/scan.ts:98
- class: jsdoc   severity: backlog
- standard: JSDoc lead-description rubric; explicit merge-request deferral of docs/JSDoc to backlog.
- evidence: AttributeName, ScanFailure and ScanResult leads describe dollar-anchor, required-key and discriminant review decisions rather than the symbols. Presence-only docgen cannot evaluate lead usefulness.
- failure: Hover text teaches implementation/review history rather than attribute grammar and scanner result purpose.
- fix: During documentation work, rewrite useful domain leads and retain compatibility notes in Details. Preserve the exact grammar and required undefined-capable key contract; metadata repair grok-2-2 is independently required.
- seats: fable-2-5

### fable-2-6

- file: scratchpad/effected/templates/SectionOutcome.ts:20
- class: docs   severity: backlog
- standard: Section 10.1 carried rationale; JSDoc observable examples; merge-request documentation deferral.
- evidence: The oracle explains why Updated carries both sides even for pure line reorderings; the lab drops that rationale. Examples test $is against undefined rather than constructing/matching outcomes, and Details/Example carriers omit separating blank lines.
- failure: Carried rationale and useful outcome examples are incomplete.
- fix: Restore the reordering rationale, show actual variant construction and $match with expected results, and add the required carrier spacing during documentation work.
- seats: fable-2-6

### fable-2-9

- file: scratchpad/effected/templates/README.md:12
- class: docs   severity: backlog
- standard: Sections 10.1/10.3 adapted README requirements; merge-request documentation deferral.
- evidence: The lab README retains the upstream package-exports claim that @effected packages expose import-only conditions and require fails with ERR_PACKAGE_PATH_NOT_EXPORTED, though this lab module has no published package exports map.
- failure: The adapted README describes packaging behavior that does not apply to the path-imported lab module.
- fix: During documentation work, remove the upstream packaging paragraph or describe the lab ESM .ts path imports. Do not change package manifests or config.
- seats: fable-2-9

### fable-2-10

- file: scratchpad/effected/templates/SectionOutcome.ts:9; scratchpad/effected/templates/internal/reconcile.ts:47; scratchpad/effected/templates/internal/scan.ts:115
- class: effect-idiom   severity: backlog
- standard: D11 evidence threshold; EF-33 schema authority; round-1 sol-1-5 permits lazy references where needed.
- evidence: The seat identifies S.suspend wrappers on direct imports in an acyclic module graph. Commit c1f8e8c657 added them with the law-required schema authorities. The cited EF-33 requires schemas but does not prohibit these lazy references; the seat demonstrates neither a runtime bug nor a measured/algorithmic performance regression.
- failure: Unnecessary laziness may complicate schema derivation and reading, but no required defect or unforced upstream behavioral divergence is established.
- fix: Consider direct references to the existing schema values after checking initialization order and derivation equivalence. Retain the required schema authorities and compatibility statics; do not restore the upstream type-only/Data-only models.
- seats: fable-2-10

### fable-2-11

- file: scratchpad/test/templates/SectionOutcome.property.test.ts:9
- class: test   severity: backlog
- standard: D10 floor; effect-vitest-canon section 1.5; merge-request coverage/vitest-canon deferral.
- evidence: The seat identifies nine local roundTrips copies; internal copies also compare encode(decode(x)) with the original encoding, while six public-schema copies only compare decoded values using schema equivalence.
- failure: Property helpers duplicate the floor and carry different strengths of assertion.
- fix: During test-canon work, extract one shared helper under scratchpad/test/templates carrying both meaningful assertions and import it across the nine property files. A canon-kit change outside the module is outside the port's write surface and must remain backlog.
- seats: fable-2-11

### fable-2-12

- file: scratchpad/test/templates/fixtures.ts:36
- class: jsdoc   severity: backlog
- standard: Section 10.2 JSDoc carriers; explicit merge-request docs/JSDoc deferral.
- evidence: The test helper retains @remarks and refers to the upstream memfs package in prose. Source-only docgen/rachet coverage does not see that helper. D13 forbids upstream import specifiers, so the prose name alone is not an import-law violation.
- failure: The test helper documentation retains a legacy carrier and stale module naming.
- fix: During documentation work, convert the carrier to Details and name the ported memfs helper/module. Keep changes inside fixtures.ts.
- seats: fable-2-12

## Handled by the deviation codemod

### fable-2-7

- file: scratchpad/effected/templates/README.md:98
- class: docs   severity: backlog
- standard: D2; operator per-module/per-class deviation and exportsAdded codemod ruling.
- evidence: README Added exports says None and the ledger list is empty. The seat inventories added schema/value/type exports, including Eol, SectionReconciliation, ManagedSectionTestError, scanner/reconcile authorities, attribute schemas/guard and the SectionKey type. Step-2/S1 and c1f8e8c657 show these additions are diagnostic/law-required byproducts.
- failure: Central export bookkeeping omits existing law-forced additions; no defect in the additions themselves is shown.
- fix: Have the central codemod derive the added export names, source entries and kinds and fill exportsAdded plus README Added exports. Module fix groups must not edit the ledger or README Port notes.
- seats: fable-2-7

### fable-2-8

- file: scratchpad/effected/templates/README.md:110
- class: docs   severity: backlog
- standard: Section 14 truthful deviation records; D15; section 11.3 unreachable-branch simplification; central deviation-codemod ruling.
- evidence: The seat quotes the ledger type-safety description of a nonempty guard/headNonEmpty, but current ManagedSection.ts:288 uses O.getOrThrow(A.head(outcomes)). The current README more generally says nonempty-array helper. a8bd60176f (effected-port step 2) removed the upstream unsafe outcomes[0] cast by adding the guard; 37513ce1d6 (effected-port S3) simplified that unreachable branch under section 11.3. The new shape is therefore not evidence for restoring the forbidden upstream cast.
- failure: The recorded type-safety implementation is stale; the finding asks only for corrected central bookkeeping, not a demonstrated code failure.
- fix: Regenerate the type-safety deviation description from the actual A.head/O.getOrThrow implementation, retaining the D15 provenance. Do not implement the alternative redesign just to fit the stale text, and do not assign ledger or README Port notes to a fix group.
- seats: fable-2-8

## Rejected

None. No submitted finding lacks evidence or a concrete fix, contradicts an operator ruling, or merely repeats an obligation already proven by an enforcing green gate. The Fable BOM patch variant is not selected because it still drops whitespace; the deduplicated underlying defect remains required with the Sol preservation fix.
