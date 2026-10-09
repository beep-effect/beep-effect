# package-json — round-1 inventory

Seats read: `grok.md`, `sol.md`, `fable.md`, and their shared `BRIEF.md` in this directory; no part-N reports exist. The brief pins review commit `3fa5876691901fccf3d1cd29e9324564df134b56` and oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. All 27 seat records are accounted for; all four module allowlist entries are added below.

REQUIRED: 29  BACKLOG: 8  CODEMOD: 2  REJECTED: 1  GROUPS: 4

Binding precedence: the complete operator revision/rulings/later grilling block, D1–D20, sections 12.4–12.5 and 14. Duplicate defects retain every contributing seat id. Independent sites in multi-file reports have suffixed ids so worker ownership remains disjoint; counts reflect those actionable site records. Green-gate misses are explained in the records. S2/S3 work stays backlog. Unforced trace and internal-helper changes are promoted to required under the later restoration ruling.

Write ownership is in `required.json`: g1 has 4 source files, g2 has 4, g3 has 4, g4 has 3. `PackageFields.test.ts` is a new focused test surface for schema identity in Package.ts; g1 owns the existing Package.test.ts rendering regressions. Workers may run other suites read-only but may write only their group's files/tests. No group owns root package.json, bun.lock, repo configs, the allowlist, PORT_LEDGER.json or README Port notes. Central bookkeeping owns allowlist removal and law/upstream-bug/added-export records. No implementation or gate rerun is performed by this inventory merge.

## Required

### fable-1-1

- file: scratchpad/effected/package-json/EntryPoint.ts:183-191
- class: bug   severity: required
- standard: D9, D11; Dual-Arity Inventory Contract; later grilling: restore unforced upstream shapes.
- evidence: All three seats independently show overlapping manifest/options bags. Sol's Bun probe: an empty options bag returns an object; invoking it throws TypeError. Grok's conditions-only manifest returns a function instead of upstream Success("index.js"). Fable additionally verifies resolveEntryPoint(undefined) returns a function instead of the upstream throw. EntryPoint.test.ts:23-29 locks the added pipe form.
- failure: The public overload lies about its return type for overlapping object inputs, and the added dispatch changes existing upstream calls.
- fix: Restore the pinned oracle's plain data-first resolveEntryPoint(manifest, options?) signature and body; remove dual dispatch and overloads, including zero-argument currying. Restore upstream test lines and remove the added pipeable-form test at EntryPoint.test.ts:23-29; retain direct-call oracle assertions and add a conditions-extension manifest regression. Do not retain Sol's proposed zero-argument form or add another curried API in this fix.
- seats: grok-1-1, sol-1-1, fable-1-1

### sol-1-2

- file: scratchpad/effected/package-json/internal/format.ts:169-205
- class: bug   severity: required
- standard: D9; section 14 verified upstream-bug exception; unknown-key fidelity contract.
- evidence: Sol probes both lab and pinned oracle with {"name":"my-pkg","version":"1.0.0","__proto__":{"x":1}}: sorted toJsonString drops the own __proto__ key, unsorted rendering preserves it. Both sortKeys and sortMapEntries assign into {}. Package.test.ts:174 stops at wire encoding before sorting.
- failure: Default rendering silently loses a valid unknown key; nested sorted maps share the inherited prototype-setter defect.
- fix: Build both sorted records with R.fromEntries from ordered entries, preserving __proto__ as an own data property. Extend Package.test.ts through default toJsonString and add a nested sorted-map case in Format.test.ts. Supply the upstream-bug probe and adjusted test references to central deviation bookkeeping; do not edit the ledger or README Port notes.
- seats: sol-1-2

### fable-1-2

- file: scratchpad/effected/package-json/internal/format.ts:171,197-199
- class: law   severity: required
- standard: Effect Laws Short Law 10; EF-38; D11.
- evidence: Four native sorts survive: R.keys(value).sort(byCodePoint), known.sort, restPublic.sort, restPrivate.sort. NoNativeRuntime.ts:463 gates native-sort detection on inHotspotScope; this file is outside that scope, explaining the green gate miss.
- failure: Canonical sorting uses forbidden native in-place Array.prototype.sort.
- fix: Replace all four calls with A.sort and explicit Order values. Preserve the code-unit key comparator and numeric known-key index ordering; consume the returned sorted copies when assembling R.fromEntries. Retain byte-for-byte formatter expectations.
- seats: fable-1-2

### sol-1-3-package-name

- file: scratchpad/effected/package-json/PackageName.ts:45,64,128
- class: schema   severity: required
- standard: D5; operator step 4; schema-first Documentation and Annotation Review.
- evidence: All three have schema.ast.annotations === undefined in Sol's runtime inspection; the source lacks owning-file annoteSchema calls.
- failure: ScopedPackageName, UnscopedPackageName and PackageName lack their required Beep schema identity despite the completed identity phase; the green gates missed these exported values.
- fix: Apply the owning $I.annoteSchema to ScopedPackageName, UnscopedPackageName and PackageName without changing accepted inputs or encoded shapes. In PackageName.ts annotate the union used by the operator-required S.Opaque class and preserve classification statics. Verify runtime identity metadata in the owning group's tests.
- seats: sol-1-3

### sol-1-3-license

- file: scratchpad/effected/package-json/License.ts:61
- class: schema   severity: required
- standard: D5; operator step 4; schema-first Documentation and Annotation Review.
- evidence: Sol's runtime inspection finds schema.ast.annotations === undefined; the branded schema has no module identity.
- failure: SpdxLicense lack their required Beep schema identity despite the completed identity phase; the green gates missed these exported values.
- fix: Apply the owning $I.annoteSchema to SpdxLicense without changing accepted inputs or encoded shapes. In PackageName.ts annotate the union used by the operator-required S.Opaque class and preserve classification statics. Verify runtime identity metadata in the owning group's tests.
- seats: sol-1-3

### sol-1-3-package-fields

- file: scratchpad/effected/package-json/Package.ts:51,63,90,98
- class: schema   severity: required
- standard: D5; operator step 4; schema-first Documentation and Annotation Review.
- evidence: The two records have no annotations; the map codecs carry only Effect built-in HashMap metadata. BinField has the expected identifier/schemaId/IRI/CURIE and is the control.
- failure: DependencyMapField, StringMapField, PublishConfigField and PeerDependenciesMetaField lack their required Beep schema identity despite the completed identity phase; the green gates missed these exported values.
- fix: Apply the owning $I.annoteSchema to DependencyMapField, StringMapField, PublishConfigField and PeerDependenciesMetaField without changing accepted inputs or encoded shapes. In PackageName.ts annotate the union used by the operator-required S.Opaque class and preserve classification statics. Verify runtime identity metadata in the owning group's tests.
- seats: sol-1-3

### sol-1-4-license

- file: scratchpad/effected/package-json/License.ts:63
- class: schema   severity: required
- standard: Effect Laws Short Law 18; schema-first Precision carries invariants; D11.
- evidence: Sol inspects SpdxLicense.ast.checks and PackageManagerRange.fields.range.ast.checks: reusable Filter annotations are undefined. Source confirms S.makeFilter lacks identifier, title and description; enclosing schema/field annotations do not supply check metadata.
- failure: The SPDX filter lacks mandatory reusable-check metadata; the green gate did not enforce it.
- fix: Add stable identifier, meaningful title and description to the SPDX filter check, retaining its predicate and user-facing failure message. Verify the check annotations without broadening validation.
- seats: sol-1-4

### sol-1-4-range

- file: scratchpad/effected/package-json/PackageManagerRange.ts:77
- class: schema   severity: required
- standard: Effect Laws Short Law 18; schema-first Precision carries invariants; D11.
- evidence: Sol inspects SpdxLicense.ast.checks and PackageManagerRange.fields.range.ast.checks: reusable Filter annotations are undefined. Source confirms S.makeFilter lacks identifier, title and description; enclosing schema/field annotations do not supply check metadata.
- failure: The SemVerRangeString filter lacks mandatory reusable-check metadata; the green gate did not enforce it.
- fix: Add stable identifier, meaningful title and description to the SemVerRangeString filter check, retaining its predicate and user-facing failure message. Verify the check annotations without broadening validation.
- seats: sol-1-4

### sol-1-5-lenient

- file: scratchpad/effected/package-json/LenientManifest.ts:46-59
- class: schema   severity: required
- standard: AGENTS.md schema-first domain models; schema-first Schema owns pure data; D11.
- evidence: A public LenientFieldIssue interface independently repeats field/expected/value from LenientFieldIssueSchema. The barrel currently exports only its type. These are pure domain data, not a service or overload contract; the green gates missed the parallel models.
- failure: The issue model has two independently maintained structural definitions.
- fix: Make the existing structural schema the annotated exported LenientFieldIssue value and derive its same-name type. Use that schema in LenientManifest.issues and re-export the value from index.ts while preserving the type and plain-object construction contract. Restore no unrelated oracle behavior; added-export bookkeeping goes to the central codemod.
- seats: sol-1-5

### sol-1-5-rule-failure

- file: scratchpad/effected/package-json/PackageValidator.ts:24-29
- class: schema   severity: required
- standard: AGENTS.md schema-first domain models; schema-first Schema owns pure data; D11.
- evidence: RuleFailure is only a public interface containing message and Option<string> path; no runtime schema owns this reusable domain record. The green gates missed the absent model.
- failure: Rule-failure data has no runtime schema from which its type can be derived.
- fix: Add an identity-annotated structural RuleFailure schema with message and S.Option(S.String) path; derive the same-name type and re-export its value from index.ts. Preserve callers' current plain-object failure values. Route added-export bookkeeping to the central codemod.
- seats: sol-1-5

### sol-1-6-format-boundary

- file: scratchpad/effected/package-json/PackageJsonFormat.ts:215
- class: effect-idiom   severity: required
- standard: EF-3 and EF-19 schema JSON codecs; D11.
- evidence: formatToString parses with JSON.parse inside try/catch. These direct production calls remain despite the green diagnostic/law gates; EF-3 expressly includes synchronous non-throwing Result/Option codecs.
- failure: The format-boundary JSON path bypasses the required schema codec.
- fix: Use synchronous S.fromJsonString(S.Unknown) Result decoding and map failures to PackageJsonSyntaxError. Keep the not-an-object branch, formatting bytes and synchronous Result signature. Remove native reparsing used to recover SyntaxError causes in modify and PackageJsonFile.readJson; map the schema issue into the existing tagged boundary errors. Where the codec cannot retain native cause identity, treat that as a law-forced deviation for central recording.
- seats: sol-1-6

### sol-1-6-lenient-boundary

- file: scratchpad/effected/package-json/LenientManifest.ts:290
- class: effect-idiom   severity: required
- standard: EF-3 and EF-19 schema JSON codecs; D11.
- evidence: parseResult parses with JSON.parse inside try/catch. These direct production calls remain despite the green diagnostic/law gates; EF-3 expressly includes synchronous non-throwing Result/Option codecs.
- failure: The lenient-boundary JSON path bypasses the required schema codec.
- fix: Use synchronous S.fromJsonString(S.Unknown) Result decoding, preserve not-an-object and sifting behavior, and map failures to PackageJsonSyntaxError. Preserve the Result API. Any unavoidable loss of native SyntaxError cause is a law-forced deviation for central recording.
- seats: sol-1-6

### sol-1-6-render

- file: scratchpad/effected/package-json/internal/format.ts:322
- class: effect-idiom   severity: required
- standard: EF-3 and EF-19 schema JSON codecs; D11.
- evidence: renderJson directly calls JSON.stringify(record, null, options.indent). These direct production calls remain despite the green diagnostic/law gates; EF-3 expressly includes synchronous non-throwing Result/Option codecs.
- failure: The render JSON path bypasses the required schema codec.
- fix: Use a synchronous schema JSON encoder with the space option matching options.indent. Preserve JSON bytes, ordering, newline and plain string return type on valid manifest records; respect upstream invalid-value failure behavior where the codec permits it and identify unavoidable law-forced differences for central recording.
- seats: sol-1-6

### sol-1-6-person

- file: scratchpad/effected/package-json/Person.ts:67
- class: effect-idiom   severity: required
- standard: EF-3 and EF-19 schema JSON codecs; D11.
- evidence: sameRest compares JSON.stringify(a ?? {}) to JSON.stringify(b ?? {}). These direct production calls remain despite the green diagnostic/law gates; EF-3 expressly includes synchronous non-throwing Result/Option codecs.
- failure: The person JSON path bypasses the required schema codec.
- fix: Use synchronous schema JSON encoding for the rest-value comparison, preserving key-order-sensitive wire replay and nullish-to-empty-record behavior. Do not replace it with structural equality that changes the fidelity predicate; retain current failure behavior where possible and route unavoidable codec differences centrally.
- seats: sol-1-6

### sol-1-6-repository

- file: scratchpad/effected/package-json/Repository.ts:119
- class: effect-idiom   severity: required
- standard: EF-3 and EF-19 schema JSON codecs; D11.
- evidence: sameRest compares JSON.stringify(a ?? {}) to JSON.stringify(b ?? {}). These direct production calls remain despite the green diagnostic/law gates; EF-3 expressly includes synchronous non-throwing Result/Option codecs.
- failure: The repository JSON path bypasses the required schema codec.
- fix: Use synchronous schema JSON encoding for the Repository/Bugs rest-value comparison, preserving key-order-sensitive replay and nullish-to-empty-record behavior. Keep both wire-fidelity predicates; record unavoidable codec differences centrally.
- seats: sol-1-6

### sol-1-6-entrypoint

- file: scratchpad/effected/package-json/EntryPoint.ts:60
- class: effect-idiom   severity: required
- standard: EF-3 and EF-19 schema JSON codecs; D11.
- evidence: UnresolvedEntryPointError.message uses JSON.stringify(this.conditions ?? []). These direct production calls remain despite the green diagnostic/law gates; EF-3 expressly includes synchronous non-throwing Result/Option codecs.
- failure: The entrypoint JSON path bypasses the required schema codec.
- fix: Use synchronous schema JSON encoding for the conditions array; preserve the exact successful message text, including quoting, order and the empty-array default.
- seats: sol-1-6

### fable-1-5

- file: scratchpad/effected/package-json/LenientManifest.ts:69-70
- class: law   severity: required
- standard: Effect Laws Short Law 21; AGENTS.md direct helper refs; D11.
- evidence: isString and isBoolean are trivial lambdas forwarding to P.isString and P.isBoolean, whose signatures already match exactly. The reported terse-effect gate is green and misses Predicate guard wrappers.
- failure: Two redundant wrappers violate the direct-helper rule.
- fix: Use const isString = P.isString and const isBoolean = P.isBoolean, or direct refs at their call sites, without changing guard behavior.
- seats: fable-1-5

### fable-1-7

- file: scratchpad/effected/package-json/PackageValidator.ts:189,199
- class: effect-idiom   severity: required
- standard: Later grilling: restore unforced upstream shape; D9. Short Law 22 requires fn for direct generator returns, not this forwarding lambda.
- evidence: runRules already has the PackageValidator.validate span at line 148. The lab wraps both layer validate forwarders in a second identically named Effect.fn. The pinned oracle uses plain (pkg) => runRules(pkg, rules) in both places.
- failure: Each validation opens two identical nested spans; no law or diagnostic forced the outer wrapper.
- fix: Restore the two pinned-oracle plain forwarding lambdas and keep runRules' existing traced generator. Restore any upstream test lines rewritten solely for the outer wrappers; the report identifies none. Do not change the upstream inner span to fnUntraced as an alternative.
- seats: fable-1-7

### fable-1-8

- file: scratchpad/effected/package-json/PackageManager.ts:127
- class: effect-idiom   severity: required
- standard: Later grilling: restore unforced upstream shape; D9; Short Law 22.
- evidence: The pinned oracle SchemaTransformation decode is a plain non-generator arrow. The lab adds Effect.fn("decode") around that arrow, introducing an unqualified span on every decode.
- failure: An unforced wrapper changes the upstream trace surface.
- fix: Restore the pinned-oracle plain decode arrow with its existing Effect result and error logic. Restore upstream test lines changed solely for this wrapper if any; none are identified. Renaming the span or retaining fnUntraced is not the ruling's requested restoration.
- seats: fable-1-8

### fable-1-11

- file: scratchpad/effected/package-json/internal/format.ts:255-266,298-324
- class: effect-idiom   severity: required
- standard: Later grilling: restore unforced upstream shape; D9; Dual-Arity Inventory Contract applies to real public helper APIs.
- evidence: Pinned oracle resolveIndent and renderJson are plain two-parameter functions. Lab adds dual(2) overloads. These are internal-module helpers, absent from the public barrel, and all reported consumers call data-first; no public combinator requirement forces added currying.
- failure: Internal helper call shapes diverge without a law, diagnostic or ruling; partial resolveIndent calls return a function rather than the upstream value.
- fix: Restore both pinned-oracle two-parameter function shapes and delete unused dual imports/overloads. Keep the independent required schema-JSON and sorting repairs. Restore any upstream test lines rewritten solely for currying; the report identifies none.
- seats: fable-1-11

### fable-1-12-repository

- file: scratchpad/effected/package-json/Repository.ts:265-276
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws: prefer Effect helper modules over native helpers; D11 cited effect-idiom violation.
- evidence: Fable identifies surviving native array helpers: segments.map/filter/some/join. The prefer-effect-array diagnostic is off, explaining why the green gate did not enforce this preference.
- failure: Domain array operations use native helpers despite available equivalent Effect helpers.
- fix: Replace the cited operations with A.map, A.filter, A.some and A.join from effect/Array, preserving callbacks, order, short-circuiting and results. This is a behavior-preserving idiom fix; keep existing upstream assertions.
- seats: fable-1-12

### fable-1-12-lenient

- file: scratchpad/effected/package-json/LenientManifest.ts:74-79
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws: prefer Effect helper modules over native helpers; D11 cited effect-idiom violation.
- evidence: Fable identifies surviving native array helpers: R.values(value).every and the array .every guards. The prefer-effect-array diagnostic is off, explaining why the green gate did not enforce this preference.
- failure: Domain array operations use native helpers despite available equivalent Effect helpers.
- fix: Replace the cited operations with A.every from effect/Array, preserving callbacks, order, short-circuiting and results. This is a behavior-preserving idiom fix; keep existing upstream assertions.
- seats: fable-1-12

### fable-1-12-entrypoint

- file: scratchpad/effected/package-json/EntryPoint.ts:101
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws: prefer Effect helper modules over native helpers; D11 cited effect-idiom violation.
- evidence: Fable identifies surviving native array helpers: keys.some in isRootConditions. The prefer-effect-array diagnostic is off, explaining why the green gate did not enforce this preference.
- failure: Domain array operations use native helpers despite available equivalent Effect helpers.
- fix: Replace the cited operations with A.some from effect/Array, preserving callbacks, order, short-circuiting and results. This is a behavior-preserving idiom fix; keep existing upstream assertions.
- seats: fable-1-12

### fable-1-12-validator

- file: scratchpad/effected/package-json/PackageValidator.ts:63,105
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws: prefer Effect helper modules over native helpers; D11 cited effect-idiom violation.
- evidence: Fable identifies surviving native array helpers: failures.map, the rendered lines.join, and the default-rule array .some. The prefer-effect-array diagnostic is off, explaining why the green gate did not enforce this preference.
- failure: Domain array operations use native helpers despite available equivalent Effect helpers.
- fix: Replace the cited operations with A.map, A.join and A.some from effect/Array, preserving callbacks, order, short-circuiting and results. This is a behavior-preserving idiom fix; keep existing upstream assertions.
- seats: fable-1-12

### fable-1-12-funding

- file: scratchpad/effected/package-json/Funding.ts:226
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws: prefer Effect helper modules over native helpers; D11 cited effect-idiom violation.
- evidence: Fable identifies surviving native array helpers: entries.map(encodeEntry). The prefer-effect-array diagnostic is off, explaining why the green gate did not enforce this preference.
- failure: Domain array operations use native helpers despite available equivalent Effect helpers.
- fix: Replace the cited operations with A.map from effect/Array, preserving callbacks, order, short-circuiting and results. This is a behavior-preserving idiom fix; keep existing upstream assertions.
- seats: fable-1-12

### allow-1

- file: scratchpad/effected/package-json/Funding.ts:43,53
- class: law   severity: required
- kind: new-map-set
- standard: Operator later grilling removes every scratchpad/effected allowlist entry; native-runtime ruling for new-map-set.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-PKGJSON-WIRE-PROVENANCE has file scratchpad/effected/package-json/Funding.ts and kind new-map-set. entryWires WeakMap and bareEntries WeakSet store wire and bare-field arity provenance.
- failure: The old allowlist exception leaves a native-runtime site that the operator explicitly requires replacing.
- fix: Move remembered EntryWire and bare-field arity onto owned Funding schema instances. Remove both weak collections and route all read/write/replay decisions through those instance fields. Preserve string/object/array spelling and per-instance fidelity; provenance must not leak into encoded JSON. Retarget Funding.test.ts representation assertions and keep all oracle wire-round-trip assertions. Central bookkeeping owns the allowlist deletion and per-class ledger/README deviation entry; this group edits only its source and tests.
- seats: operator-2026-10-09, allowlist:EFFECTED-PKGJSON-WIRE-PROVENANCE

### allow-2

- file: scratchpad/effected/package-json/PackageName.ts:128
- class: law   severity: required
- kind: object-method
- standard: Operator later grilling removes every scratchpad/effected allowlist entry; native-runtime ruling for object-method.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-PKGJSON-SCHEMA-STATICS has file scratchpad/effected/package-json/PackageName.ts and kind object-method. Object.assign attaches isValid/scope/unscoped/isScoped to the union schema.
- failure: The old allowlist exception leaves a native-runtime site that the operator explicitly requires replacing.
- fix: Replace Object.assign schema augmentation with an S.Opaque class over the annotated package-name union, with static isValid, scope, unscoped and isScoped members. Preserve the upstream export name and value/type roles, validation and classification results. Retarget PackageName.test.ts representation assertions; do not substitute Object.defineProperties. Central bookkeeping owns the allowlist deletion and per-class ledger/README deviation entry; this group edits only its source and tests.
- seats: operator-2026-10-09, allowlist:EFFECTED-PKGJSON-SCHEMA-STATICS

### allow-3

- file: scratchpad/effected/package-json/Person.ts:53
- class: law   severity: required
- kind: new-map-set
- standard: Operator later grilling removes every scratchpad/effected allowlist entry; native-runtime ruling for new-map-set.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-PKGJSON-WIRE-PROVENANCE has file scratchpad/effected/package-json/Person.ts and kind new-map-set. wireForms WeakMap remembers each decoded Person wire value.
- failure: The old allowlist exception leaves a native-runtime site that the operator explicitly requires replacing.
- fix: Store remembered PersonWire on owned Person schema instances, remove wireForms, and update rememberWire and all codecs/replay checks to use the field. Preserve per-instance replay, edited-value fallback and string/object fidelity; exclude provenance from encoded JSON. Retarget Person.test.ts representation assertions while retaining oracle wire-fidelity cases. Central bookkeeping owns the allowlist deletion and per-class ledger/README deviation entry; this group edits only its source and tests.
- seats: operator-2026-10-09, allowlist:EFFECTED-PKGJSON-WIRE-PROVENANCE

### allow-4

- file: scratchpad/effected/package-json/Repository.ts:108-109
- class: law   severity: required
- kind: new-map-set
- standard: Operator later grilling removes every scratchpad/effected allowlist entry; native-runtime ruling for new-map-set.
- evidence: standards/effect-laws.allowlist.jsonc entry EFFECTED-PKGJSON-WIRE-PROVENANCE has file scratchpad/effected/package-json/Repository.ts and kind new-map-set. repositoryWires and bugsWires WeakMaps hold separate Repository and Bugs wire provenance.
- failure: The old allowlist exception leaves a native-runtime site that the operator explicitly requires replacing.
- fix: Store remembered FieldWire on the owned Repository and Bugs schema instances and remove both WeakMaps. Update every decode/encode/replay path; preserve faithful wire order, shorthand spelling and edited-value fallback and exclude provenance from encoded JSON. Retarget Repository.test.ts representation assertions and keep Repository/Bugs oracle cases. Central bookkeeping owns the allowlist deletion and per-class ledger/README deviation entry; this group edits only its source and tests.
- seats: operator-2026-10-09, allowlist:EFFECTED-PKGJSON-WIRE-PROVENANCE

## Backlog

### sol-1-7

- file: scratchpad/effected/package-json/Repository.ts:169
- class: jsdoc   severity: backlog
- standard: D4; JSDoc law; operator order defers S2.
- evidence: Legacy @remarks/@example carriers, missing category/since metadata and undocumented value-export examples recur across the module; Sol cites Repository as a representative.
- failure: Carried JSDoc has not yet received the S2 law conversion.
- fix: During S2 convert carriers to Details and titled Example sections, preserve prose, add canonical categories/since and useful examples, and validate docgen. This is deferred S2 work, not a round-1 required fix.
- seats: sol-1-7

### sol-1-8

- file: scratchpad/effected/package-json/README.md:3,73-74,286-304
- class: docs   severity: backlog
- standard: D4; section 10.3; operator order defers S2; Port-notes write surface reserved centrally.
- evidence: Sol identifies upstream badges/stability boilerplate and root-effect/@effected imports. Grok and Fable identify the same pasted source-search attribution bullets at 286-304.
- failure: The README still teaches the upstream install surface and contains source-search output in Attribution.
- fix: During S2 adapt the README examples/imports and remove the specified badges/boilerplate. Central bookkeeping must remove the pasted attribution excerpts and retain actual provenance/license notices in Port notes; that portion is outside the port's write surface. Do not assign README Port notes to a fix group.
- seats: grok-1-3, sol-1-8, fable-1-13

### sol-1-9

- file: scratchpad/test/package-json/PackageName.test.ts:69,75
- class: test   severity: backlog
- standard: D10; sections 11.4-11.5; operator order defers S3.
- evidence: Only two it.effect.prop cases exist and test name validation, not encode/decode round trips. The report finds no Arbitrary.schema or fcRuns usage and no parser/formatter fidelity/idempotence properties.
- failure: The module has not met the S3 property floor.
- fix: During S3 add Arbitrary.schema/fcRuns round-trip properties for every exported schema/codec and parser/formatter fidelity and idempotence properties; retain upstream suites.
- seats: sol-1-9

### sol-1-10

- file: scratchpad/test/package-json/Resolve.test.ts:31; scratchpad/test/package-json/PackageJsonFormat.test.ts:147-150,237
- class: test   severity: backlog
- standard: effect-vitest-canon D5; section 11.2; operator order defers S3.
- evidence: Sol cites direct Option comparisons in Resolve.test.ts and integration/PackageJsonFile.int.test.ts:51. Fable adds two plain-it Effect.runSync cases and boolean Option assertions in License, Repository, Person, PackageManagerRange and Dependency tests. These are one deferred canon migration.
- failure: Tests still use legacy Effect execution and Option assertion idioms.
- fix: During S3 migrate the two Effect.runSync tests to it.effect with yield*, and use assertSome/assertNone for Option-value assertions while preserving expected values and deliberate whole-Option equality tests.
- seats: sol-1-10, fable-1-14

### fable-1-6

- file: scratchpad/effected/package-json/PackageJsonFormat.ts:265-271; scratchpad/effected/package-json/PackageJsonFile.ts:238-249
- class: perf   severity: backlog
- standard: D11 performance requires measured regression or algorithmic-class win.
- evidence: Schema decoding fails, then formatToString reparses to recover a native SyntaxError. Fable verifies the final cause is preserved, with two parses and coupling to the formatter; no measured regression is supplied.
- failure: Failing input incurs duplicate parsing; no observable correctness divergence or qualifying performance evidence is shown.
- fix: During later consolidation, share a single Result-based schema JSON boundary and map its failure once, coordinating with sol-1-6-format-boundary. Do not extract Fable's proposed native JSON.parse helper, which conflicts with EF-3/EF-19. Record unavoidable law-forced cause changes centrally. The unmeasured optimization is backlog.
- seats: fable-1-6

### fable-1-9

- file: scratchpad/effected/package-json/PackageJsonFile.ts:238,254,264
- class: effect-idiom   severity: backlog
- standard: Effect-first span-naming guidance; D11.
- evidence: Three internal generator helpers use unqualified readJson/withPreservedSource/writeText spans; public helpers use PackageJsonFile.*. The generator-to-fn migration is law-forced, unlike the redundant non-generator wrappers in fable-1-7 and fable-1-8.
- failure: Internal trace names are less attributable; no diagnostic, hard naming rule or current functional bug is demonstrated.
- fix: Consider qualifying the three span names or using fnUntraced for internals, preserving the law-required generator wrapper. This trace presentation preference is outside D11 required criteria.
- seats: fable-1-9

### fable-1-10

- file: scratchpad/effected/package-json/EntryPoint.ts:61
- class: effect-idiom   severity: backlog
- standard: Effect Laws Short Law 11; D11.
- evidence: The three-literal reason message uses two Match.when branches plus Match.orElse. Upstream already used a default branch; every current literal gets the intended message.
- failure: A hypothetical future reason could silently inherit the fallback message; no current bug is shown and Law 11 does not require exhaustive matching for this non-tag literal field.
- fix: Optionally name unsupportedExportsForm with Match.when and finish with Match.exhaustive. This future-proofing preference is outside D11 required criteria.
- seats: fable-1-10

### fable-1-4-export

- file: scratchpad/effected/package-json/index.ts:30
- class: effect-idiom   severity: backlog
- standard: D2 superset export rule; D11.
- evidence: JsoncStringifyError appears in the public modify error union but is not re-exported by the package-json barrel. Consumers can import the existing error from the sibling jsonc module; no upstream package-json export is missing.
- failure: A barrel re-export would improve convenience, but D2 allows added exports and does not require every transitive error to be re-exported.
- fix: Optionally add JsoncStringifyError to the existing jsonc re-export; if adopted, the central codemod records exportsAdded. No bug or cited mandatory export rule makes this addition required.
- seats: fable-1-4

## Handled by the deviation codemod

### fable-1-3

- file: scratchpad/effected/package-json/PackageJsonFormat.ts:105
- class: law   severity: backlog
- standard: Operator later grilling: one deviation record per module per systemic class; law:effecttsgo/schema-number.
- evidence: Upstream path uses S.Number; lab uses S.Finite. Fable and Grok confirm NaN/Infinity path segments fail lab construction. README says None and the ledger deviations list is empty.
- failure: The law-forced finite-number accepted-input change lacks its systemic-class record.
- fix: Central deviation codemod records the S.Finite class for PackageJsonModifyError.path, non-finite-input rejection and adjusted upstream tests (none cited). Keep S.Finite. No worker edits PORT_LEDGER.json or README Port notes.
- seats: fable-1-3, grok-1-2 (supporting evidence only)

### fable-1-4-bookkeeping

- file: scratchpad/effected/package-json/PackageJsonFile.ts:187; scratchpad/effected/package-json/PackageJsonFormat.ts:265
- class: law   severity: backlog
- standard: Operator later grilling: tagged-error and added-export bookkeeping is central; D9; law:7 inherited via jsonc deviation 8.
- evidence: JsoncStringifyError is added to PackageJsonFile.modify and inferred by PackageJsonFormat.modify/modifyToString because the lab jsonc modifier exposes a law-forced typed serialization failure. Package-json ledger/Port notes still claim no deviations.
- failure: The inherited law-forced error-channel widening lacks its downstream module record.
- fix: Central deviation codemod records the inherited tagged-error class, affected public methods and adjusted tests (none cited). If the optional index.ts re-export is adopted, record exportsAdded centrally. No required finding to restore the native serialization path; no ledger or Port-notes worker edits.
- seats: fable-1-4

## Rejected

### grok-1-2

- file: scratchpad/effected/package-json/PackageJsonFormat.ts:105
- class: schema   severity: backlog
- standard: Operator later grilling accepts and centrally records S.Finite as a law-forced systemic class.
- evidence: Grok correctly identifies the narrowed path schema but proposes S.Number plus a schemaNumber:off suppression; Fable confirms the same acceptance change and requests its record.
- failure: The proposed remedy would undo a law-forced change instead of applying the operator's recording ruling.
- fix: Keep S.Finite and route its recording to fable-1-3 above. Rejection reason: restoring S.Number with a diagnostic suppression contradicts the operator ruling; this is a rejected remedy, not a second required code defect.
- seats: grok-1-2
