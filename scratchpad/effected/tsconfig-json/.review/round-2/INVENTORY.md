# tsconfig-json — round-2 merged inventory

Seats read: `grok.md` (grok-2-1–2), `sol.md` (sol-2-1–2), and `fable.md` (fable-2-1–4), plus `BRIEF.md` and the third-seat `BRIEF.grok3.md`. No part-N directories/reports exist. The fable filename carries the separate grok-4.7 medium fallback seat. Eight seat records become six distinct findings after two duplicate pairs are merged.

Counts: **Required 5; Backlog 1; Codemod 0; Rejected 0; Groups 3**.

The briefs name `a12bef261998d2ad92153dada46373be06950692`; the inspected checkout is `@lab/effected-2` at `d859bbb583cb93239781137b5c7aa0637141ed19`, rather than the requested `@lab/effected`. The module source/test trees have no diff from the brief commit. No branch change was made. Binding precedence is the complete top operator revision block (including both 2026-10-09 rulings/grilling), D1–D20, sections 12.5 and 14, and this merge task’s explicit classification/write-surface rules. The task’s instruction to defer docs, JSDoc, coverage and vitest-canon findings governs this inventory even though the brief and S3 commit claim those gates green. Reported green gates were not rerun or independently certified.

`standards/effect-laws.allowlist.jsonc` contains **zero entries** for `scratchpad/effected/tsconfig-json/**`; no synthetic `allow-<n>` findings are needed. Round-1 inventory and the module’s ledger deviations were read for closure/provenance only. None of these six findings is a bookkeeping-only request or a repetition of an already-fixed defect. The four fallback defects were introduced after round 1 in `7fb13acdc3`; their recorded coverage deviations do not override the operator’s prohibition on unforced divergence.

## Required

Groups own non-overlapping write surfaces; each owns one source file. Tests listed here and in required.json are the fix’s test ownership. Do not edit the existing deliberatelyInvalid helper; import and use it for wrong-input regressions. No group owns the ledger, README Port notes, root package.json, bun.lock, or repo configuration. Preserve law/diagnostic-forced adaptations while restoring unforced runtime behavior and any upstream test lines rewritten by it. The four fallback records share an S3 origin, but have distinct failing branches; the multiple path-transform sites in fable-2-3 are merged under their common helper/root cause.

| Group | Source ownership | Test ownership | Findings |
| --- | --- | --- | --- |
| g1 | `PortableTsconfig.ts` | `PortableTsconfig.test.ts`, `PortableTsconfig.property.test.ts` | `sol-2-1` |
| g2 | `TsEnumCodec.ts` | `TsEnumCodec.test.ts` | `fable-2-1`, `fable-2-2` |
| g3 | `ResolvedTsconfig.ts` | `ResolvedTsconfig.test.ts` | `fable-2-3`, `fable-2-4` |

### sol-2-1
- file: scratchpad/effected/tsconfig-json/PortableTsconfig.ts:204
- class: schema   severity: required
- standard: D5 and D11; standards/schema-first-development-prompt.md, Core Modeling Contract / Precision carries invariants.   evidence: Both seats identify compilerOptions: S.Record(S.String, S.Unknown). Sol reports S.is returning true for empty options, reversed flags, and an outDir-bearing record, and successful decoding of the reversed flags. The live source at lines 200–207 confirms the broad schema; make at lines 263–273 copies PRESERVED_OPTIONS and then forces composite: false and noEmit: true. The pinned oracle make has the same projection. PortableTsconfig.property.test.ts:22 round-trips the unconstrained schema, so a green property gate does not enforce these domain invariants.
- failure: Decoding an external document can successfully produce portable options with missing/reversed flags or machine-specific paths, unlike make. This is a defect in the law-forced new model, rather than a request to record its addition.
- fix: Define an identity-annotated nested options schema from the preserved CompilerOptions fields, optional types, and required noEmit: S.Literal(true) / composite: S.Literal(false). Exclude nonportable fields from decoded and encoded output while retaining make as the upstream projection. Add boundary assertions for missing/reversed flags and exclusion of outDir/typeRoots; adapt the schema-derived round-trip and projection properties to the precise shape without weakening them.
- seats: grok-2-1, sol-2-1

### fable-2-1
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:358
- class: bug   severity: required
- standard: D9, section 14, and the later operator ruling to restore unforced lab changes.   evidence: The pinned oracle src/TsEnumCodec.ts:308–313 updates a copied value only when Option.isSome(encoded). The current line 358 calls O.getOrThrow, so target: "es9999" reaches None and throws. git log identifies 7fb13acdc3 (effected-port S3); its diff replaces the isSome fallback with getOrThrow. The mechanical law commit 03bf79d41b retains the isSome branch, and S1 2ef54156d6 only replaces native lookup tables with MutableHashMap. The ledger labels the later removal coverage-only and says no behaviour change; that assertion is disproved by this input. TsEnumCodec.test.ts:197–202 explicitly documents hand-built options bypassing schema validation.
- failure: encodeCompilerOptions({ target: "es9999" }) throws where the upstream oracle returns the unchanged string. Neither the typed signature nor the recorded coverage claim establishes a law/diagnostic requirement for this removal.
- fix: Restore const encoded = encode(family, value) and update result[key] only when O.isSome(encoded), preserving the original copied string on None. Retain the diagnostic/law-forced schema-derived types, Effect imports, and lookup collections. Restore any upstream test lines rewritten for this unforced change and add a passthrough regression using the existing deliberatelyInvalid helper; this S3 diff did not rewrite the upstream TsEnumCodec.test.ts.
- seats: fable-2-1

### fable-2-2
- file: scratchpad/effected/tsconfig-json/TsEnumCodec.ts:364
- class: bug   severity: required
- standard: D9, section 14, and the later operator restore ruling; preserve D15-safe implementations.   evidence: The pinned oracle src/TsEnumCodec.ts:316–318 reads source.lib and maps only string entries through normalization. The current line 364 normalizes every entry; normalizeLibReference at line 230 calls slice. Commit 7fb13acdc3 changes source.lib to options.lib and deletes P.isString. Law commit 03bf79d41b and S1 2ef54156d6 retain the guarded mapping. The ledger calls this fallback unreachable, but hand-built { lib: [1] } bypasses decoding just as the retained test comment allows. decodeCompilerOptions still preserves non-string entries at line 384.
- failure: A non-string lib element produces TypeError rather than the oracle’s unchanged element; normal string filename encoding is unaffected. This is independent of the enum-lookup None defect.
- fix: Restore the upstream source.lib read and guarded mapping: normalize and wrap only P.isString entries, passing other entries through unchanged. Keep the cast-free result construction and law-forced public types. Restore any upstream test lines rewritten for this unforced change and add a mixed string/non-string regression through deliberatelyInvalid in TsEnumCodec.test.ts; the S3 diff did not rewrite that upstream test file.
- seats: fable-2-2

### fable-2-3
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:163; scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:168–170
- class: bug   severity: required
- standard: D9, section 14, and the later operator restore ruling.   evidence: Pinned oracle src/ResolvedTsconfig.ts:151–160 guards each typeRoots/rootDirs element with typeof string and guards each paths value with Array.isArray before mapping guarded elements. Current lines 163 and 168–170 map unconditionally. Commit 8c0a95cc38 (step 2) removes casts but retains these guards; law commit 03bf79d41b converts them to P.isString/A.isArray; S1 2ef54156d6 also retains them. Commit 7fb13acdc3 (S3) deletes the guards, and the ledger claims those branches were unreachable. The public helpers do not decode their arguments; startsWithConfigDir calls slice, and a non-array paths value has no map.
- failure: absolutize/substituteConfigDir throw on non-string path-list elements, non-array paths values, or non-string paths-array elements that the oracle preserves. The path-list and paths-record sites are one lost forward-tolerance defect in transformCompilerOptionPaths.
- fix: Restore the upstream per-entry P.isString checks for typeRoots/rootDirs and restore A.isArray plus per-entry P.isString inside the paths rebuildRecord callback. Preserve non-string/non-array values unchanged and retain law/diagnostic-forced cast-free copies and Effect helpers. Restore any rewritten upstream test lines and add focused regressions covering both public transforms in ResolvedTsconfig.test.ts using the existing deliberatelyInvalid helper; S3 did not rewrite that upstream test file.
- seats: fable-2-3

### fable-2-4
- file: scratchpad/effected/tsconfig-json/ResolvedTsconfig.ts:332
- class: bug   severity: required
- standard: D9, section 14, and the later operator restore ruling.   evidence: Pinned oracle src/ResolvedTsconfig.ts:313–316 substitutes only string excludeDirectories/excludeFiles entries. Current line 332 uses value.map(substitute), which reaches slice on non-strings. Step-2 8c0a95cc38 preserves this guard while removing assertions; 03bf79d41b expresses it with P.isString/A.isArray, and S1 retains it. Commit 7fb13acdc3 deletes it for coverage, despite the ledger’s unreachable/no-behaviour-change assertion. This separate watchOptions helper is not fixed by repairing transformCompilerOptionPaths.
- failure: substituteConfigDir throws TypeError on a non-string watch-exclude element where upstream preserves it. The upstream files/include/exclude arrays did not have this guard and are outside this repair.
- fix: Restore value.map(entry => P.isString(entry) ? substitute(entry) : entry) for both watch exclude lists. Retain cast-free typed copies, current representation and Effect helpers. Restore any rewritten upstream test lines and add mixed string/non-string watch-exclude regressions in ResolvedTsconfig.test.ts via deliberatelyInvalid; S3 did not rewrite that upstream test file.
- seats: fable-2-4

## Backlog

### sol-2-2
- file: scratchpad/test/tsconfig-json/CompilerOptionsFromProgrammatic.test.ts:74, 81, 88, 111
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md, Choose assertions by value, not by tester; effect-vitest-canon D5; section 11.2. Deferred under the operator’s inventory instruction for vitest-canon/coverage work.   evidence: Grok and Sol identify three Effect.mapError(() => "decode failed") sites and one Result.mapError sentinel site. The live test lines confirm all four. Sol reports that mapping an unrelated failure yields the same asserted sentinel. The assertion helpers are present, so the supplied green detectors miss loss of the original error payload.
- failure: A decoder failure for the wrong field or diagnostic satisfies the same assertion. This is an assertion-quality/canon finding, not evidence of an actual production decoder bug.
- fix: During the deferred canon work preserve the decoder error, project its schema issues with the standard formatter if useful, and assert independently expected paths/messages at all four sites. In particular distinguish rejection of jsx: 9999 from the valid target: 12.
- seats: grok-2-2, sol-2-2

## Handled by the deviation codemod

None. The seats did not raise bookkeeping-only findings. Existing law-forced identities, finite-number schemas, tagged errors, exports and native-runtime representation changes remain centrally recorded; they are not restoration targets. The portable-schema finding challenges the new model’s correctness, and the S3 fallback removals were not law/diagnostic-forced, so neither belongs here.

## Rejected

None. All eight seat records contain evidence and a concrete fix; none merely repeats a green-gate-enforced syntactic violation or contradicts an operator ruling. The duplicate pairs are merged into sol-2-1 and sol-2-2, with both seat ids retained, rather than counted as rejections. The test assertion finding is reclassified to backlog as directed.
