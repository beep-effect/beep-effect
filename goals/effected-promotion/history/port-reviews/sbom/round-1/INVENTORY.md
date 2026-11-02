# sbom — round-1 merged inventory

Read all three seats: `grok.md` (7 records), `sol.md` (10), `fable.md` (12), and their shared `BRIEF.md`; no part-N directories are present. Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`. Counts after deduplication and clause-level classification: **Required 10 · Backlog 10 · Codemod 3 · Rejected 1 · Groups 2**.

Binding inputs: the entire top operator revision block (including both 2026-10-09 rulings), D1–D20, §12.4–12.5 and §14 of `scratchpad/EFFECTED_PORT_GOAL.md`. The brief reports green gates at the reviewed commit; retained required findings identify a gate gap or an unscanned standard. No audit or implementation was run for this merge. `standards/effect-laws.allowlist.jsonc` contains **zero entries for `scratchpad/effected/sbom/**`**, so no `allow-<n>` findings are added.

One defect has one record, with all contributing seat IDs. Composite seat records are split only where their independently fixable clauses have different dispositions or write owners: `fable-1-8` into r4/r8, `fable-1-7` into r9/b9, `fable-1-12` into r10/b10, and `grok-1-7` into deferred test work and x1. Law-forced bookkeeping is consolidated by systemic class. Schema AST field metadata is required by operator step 4; export prose/carriers and test-canon changes remain deferred to S2/S3. No seat demonstrates an unforced upstream divergence that must be restored.

Required groups own disjoint surfaces: g1 owns 3 source files and 4 tests (literal domains, NTIA constraints, signer metadata/thunk); g2 owns 4 source files and 4 tests (serialization, digest, input schemas, provenance metadata). Every spanning required finding is wholly owned by one group. Existing tests listed in `required.json` are the permitted fix/regression surfaces; retain their oracle assertions except narrowly law-forced retargets. No group owns root manifests, lockfiles, repository config, `PORT_LEDGER.json`, README Port notes, sibling modules or the generic runner.

## Required

### r1

- file: scratchpad/effected/sbom/Sbom.ts:67
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; effect-first-development EF-38; D9.
- evidence: generate uses [...input.components].sort((a, b) => a.name.localeCompare(b.name)). sol identifies the checker's identifier-only receiver and hotspot restrictions; fable confirms spread receivers are not scanned and upstream Sbom.test.ts:42 pins alpha/zulu ordering.
- failure: Native array sorting survives a green gate despite the explicit law.
- fix: Use effect/Array A.sort with an explicit Order preserving localeCompare: Order.mapInput(Order.make<string>((a, b) => Str.localeCompare(b)(a)), (component: Component) => component.name), with Str from effect/String. Preserve stable ordering and upstream assertions; do not substitute Order.String.
- seats: sol-1-1, fable-1-1

### r2

- file: scratchpad/effected/sbom/SbomDocument.ts:34; scratchpad/effected/sbom/SbomDocument.ts:53; scratchpad/effected/sbom/NtiaReport.ts:32; scratchpad/effected/sbom/SigstoreSigner.ts:47
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; AGENTS.md Code Laws; EF-12b; D5.
- evidence: ComponentType, ExternalReferenceType, NtiaElementId and SigningErrorKind are named, exported, reused, annotation-bearing S.Literals domains. The four-law gate does not check this constructor distinction.
- failure: Named domains use the anonymous-union constructor and lack the mandated LiteralKit representation.
- fix: Replace all four S.Literals constructors with LiteralKit from @beep/schema/LiteralKit. Preserve members, names, derived types and identity annotation pipes; do not add as const. If dependency-reachability assertions change because of this law-required import, retarget only those assertions; central codemod records the deviation.
- seats: grok-1-3, sol-1-2, fable-1-2

### r3

- file: scratchpad/effected/sbom/InTotoStatement.ts:106
- class: schema   severity: required
- standard: Operator step 4; D5; effect-first-development EF-12.
- evidence: Sha256Digest extends the checked, branded S.String without $I.annoteSchema. Both seats' read-only runtime probes report absent AST annotations while neighboring exported schemas have identity metadata.
- failure: The exported digest schema has no canonical identity; the required identity pass missed it.
- fix: Apply $I.annoteSchema("Sha256Digest", { description: "A SHA-256 digest as 64 lowercase hexadecimal characters, without an algorithm prefix." }) to the base schema before the existing statics. Preserve the brand, accepted strings and upstream pattern assertion.
- seats: sol-1-3, fable-1-4

### r4

- file: scratchpad/effected/sbom/SlsaProvenance.ts:58
- class: schema   severity: required
- standard: Operator step 4: annotations on fields and schemas.
- evidence: Only outer fields have annotateKey. workflow.ref/repository/path, workflow itself, github and its four claim fields, resolvedDependencies[].uri/digest, builder.id and metadata.invocationId retain comments but lack field AST metadata.
- failure: The pre-review field-annotation pass is incomplete. This is schema AST metadata required by step 4, rather than deferred JSDoc carrier conversion.
- fix: Add meaningful annotateKey({ description }) metadata from the existing descriptions to these nested fields and containers. Preserve source prose, schema shapes and decoding behavior.
- seats: sol-1-4, fable-1-8

### r5

- file: scratchpad/effected/sbom/Sbom.ts:21; scratchpad/effected/sbom/InTotoStatement.ts:160; scratchpad/effected/sbom/SbomMetadataSource.ts:63; scratchpad/effected/sbom/SlsaProvenance.ts:122
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md §5; effect-first-development EF-33; D11.
- evidence: SbomInput, SbomJsonOptions, InTotoStatementInput, InTotoSubjectInput, SbomMetadataOptions, ComponentInput, CopyrightYears and GitHubWorkflowProvenance remain handwritten property-shape interfaces. These are representable data, not service contracts; the four-law gate does not enforce schema-first declarations.
- failure: Public input and configuration data have no schema source of truth.
- fix: Define identity-annotated structural schemas and derive the existing public type names from them in their four owning files. Preserve structural assignability, readonly shapes and explicit-undefined optional semantics; keep function boundaries unchanged and add no new input validation. Added-export bookkeeping belongs to the central codemod.
- seats: sol-1-5

### r6

- file: scratchpad/effected/sbom/Sbom.ts:91; scratchpad/effected/sbom/InTotoStatement.ts:254
- class: effect-idiom   severity: required
- standard: effect-first-development EF-19 and its schema-first rules; D11; D9.
- evidence: Both public serializers call JSON.stringify. sol explains that preferSchemaOverJson examines Effect contexts, so these synchronous functions escape the green diagnostic.
- failure: Public JSON boundaries bypass the required Schema codec path.
- fix: Encode the existing assembled wire objects using S.fromJsonString and the appropriate synchronous Result codec. Preserve key order, SBOM space default 2, statement default 0, caller indentation behavior and the open predicate contract. Preserve successful bytes and upstream assertions; law-forced failure changes are recorded centrally, without assigning README or ledger writes.
- seats: sol-1-6

### r7

- file: scratchpad/effected/sbom/InTotoStatement.ts:107
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; D11.
- evidence: Sha256Digest.isValid repeats SHA256_RE.test(normalizeDigest(value)) while parseResult already uses S.is(Sha256Digest)(normalized). fable's probe shows agreement on tested lowercase and uppercase inputs; no gate checks this duplicated domain guard.
- failure: The named digest constraint has a second predicate independent of its schema.
- fix: Derive the call-time guard from the schema: static isValid = (value: string): boolean => S.is(Sha256Digest)(normalizeDigest(value)). Keep normalization and all accepted/rejected inputs unchanged.
- seats: fable-1-5

### r8

- file: scratchpad/effected/sbom/SigstoreSigner.ts:180
- class: schema   severity: required
- standard: Operator step 4: annotations on fields and schemas.
- evidence: UnstubbedSigstoreSignerError uses { message: S.String }; fable identifies it as the module's sole error field missing annotateKey, and the source confirms the bare field.
- failure: The error's field metadata was omitted from the required annotation pass.
- fix: Add a meaningful description with S.String.annotateKey on message. Preserve the error tag, payload and message text. This is the file-local error-field portion of fable-1-8; provenance-field metadata is r4.
- seats: fable-1-8

### r9

- file: scratchpad/effected/sbom/SigstoreSigner.ts:245
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 21; effect-first-development tersest-helper rule and checklist 40; D11.
- evidence: sign: overrides.sign ?? (() => unstubbed()) is a trivial wrapper around an in-scope () => never. fable shows the wrapper survives the green terse-effect checker and the direct thunk remains assignable.
- failure: A behavior-neutral direct-helper law fix remains in production source. A demonstrated gate miss qualifies under D11 despite the seat's backlog label.
- fix: Replace the fallback wrapper with sign: overrides.sign ?? unstubbed. Preserve override selection and the existing unstubbed typed error. The separate test identity-lambda portion is deferred as b9.
- seats: fable-1-7

### r10

- file: scratchpad/effected/sbom/NtiaReport.ts:71; scratchpad/effected/sbom/NtiaReport.ts:97
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; D11; D9.
- evidence: The reused present helper manually trims and rejects empty strings; uniqueIdentifier manually checks purl?.startsWith("pkg:"). fable supplies the concrete schema-and-derived-guard replacement; the gate does not check constraint modeling.
- failure: Reused and named NTIA domain constraints remain ad-hoc predicates. The explicit law makes this required despite the seat's backlog label.
- fix: Model trimmed non-empty and pkg:-prefix constraints as local schemas with built-in checks and derived S.is guards. Preserve trimming, undefined handling, returned values and all upstream NTIA results. Do not tighten Component.purl acceptance or add public input validation. The independent vcs Option-chain suggestion is b10.
- seats: fable-1-12

## Backlog

### b1

- file: scratchpad/effected/sbom/IdentityToken.ts:29; scratchpad/effected/sbom/SbomMetadataSource.ts:55; module export JSDoc
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; §10.2; deferred S2.
- evidence: Exported documentation retains @remarks/@example/@public, lacks canonical @category/@since, and runtime exports such as IdentityTokenError lack titled Examples.
- failure: The module has not completed the scheduled JSDoc/docgen pass.
- fix: During S2 preserve upstream prose, convert carriers to titled Example and Details/Gotchas sections, add categories and @since 0.0.0, and provide meaningful compilable Examples for value exports.
- seats: grok-1-5, sol-1-8

### b2

- file: scratchpad/effected/sbom/README.md:199; scratchpad/effected/PORT_LEDGER.json; scratchpad/effected/audit.ts
- class: docs   severity: backlog
- standard: §10.3, §13; D3/D4; deferred S2; outside the port's write surface.
- evidence: Attribution contains source scan hits rather than vendored notices; Dependency backlog says None although the ledger lists @sigstore/bundle and @sigstore/sign with replacement: null.
- failure: Documentation misstates attribution/dependency work. Both reports request central Port-notes/ledger bookkeeping, and fable also requests an out-of-surface runner change.
- fix: Central documentation/deviation tooling should replace spurious attribution hits with None if no real notice exists, record the two sigstore dependencies and promotion replacement candidates, and correct the scanner to identify actual notices. Module fix groups must not edit README Port notes, the ledger or the runner. Reason: outside the port's write surface; also deferred S2.
- seats: grok-1-4, fable-1-9

### b3

- file: scratchpad/effected/sbom/README.md:3; scratchpad/effected/sbom/README.md:33
- class: docs   severity: backlog
- standard: §10.3; effect-laws-v1 law 2 for Markdown imports; deferred S2.
- evidence: Upstream badges, stability and Install sections remain. Samples import @effected/sbom and the root effect barrel.
- failure: The README still documents the npm package and its samples violate the per-module import convention.
- fix: During S2 remove release/install boilerplate, adapt examples to the lab entry and dedicated effect/* imports, and preserve Why/API/fidelity prose. Do not assign Port-notes changes to a module lane.
- seats: grok-1-6, fable-1-10

### b4

- file: scratchpad/test/sbom/InTotoStatement.test.ts:34; scratchpad/test/sbom/**
- class: test   severity: backlog
- standard: D10; §11.4; deferred S3.
- evidence: sol's search finds no Arbitrary, property calls or fcRuns; retained digest/document/statement/bundle/provenance cases are example-based. grok reports the same missing schema round-trip floor.
- failure: The scheduled property floor is absent.
- fix: During S3 add Arbitrary.schema encode/decode round trips and applicable parser/formatter normalization, idempotence and fidelity properties using fcRuns. Retain all oracle assertions.
- seats: grok-1-7, sol-1-9

### b5

- file: scratchpad/test/sbom/Sbom.test.ts:44; scratchpad/test/sbom/conformance.test.ts:174
- class: test   severity: backlog
- standard: §11.2; goals/effect-vitest-canon/SPEC.md; deferred S3.
- evidence: grok identifies retained plain-it suites, node:fs fixture reads and noncanonical Option/Result assertion forms. Upstream assertions have been retained.
- failure: The deferred general test-canon migration remains incomplete; no weakened oracle assertion is demonstrated.
- fix: During S3 use it.effect where bodies return Effects, migrate Option/Result assertions to canon helpers and address fixture IO under that pass while retaining every assertion. Native test collections are b7; property work is b4. Do not follow the superseded environment-failure instruction rejected as x1.
- seats: grok-1-7

### b6

- file: scratchpad/test/sbom/SigstoreSigner.test.ts:96
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14; deferred S3.
- evidence: signWith provides SigstoreSigner.layerWith per test at line 103; that constructor is Layer.effect, not a pure succeed/mock stub.
- failure: Effectful test-layer setup is rebuilt per test instead of using the runner-owned fixture.
- fix: During S3 use isolated it.layer blocks for distinct signer/witness/identity scenarios, consuming the service from the test context and preserving scenario isolation.
- seats: sol-1-10

### b7

- file: scratchpad/test/sbom/reachability.test.ts:178; scratchpad/test/sbom/conformance.test.ts:267; scratchpad/test/sbom/reachability.test.ts:139
- class: test   severity: backlog
- standard: §16; §11.1/11.2; deferred S3.
- evidence: Retained tests use new Set for declared/known names and native sort on reachable-import arrays. Tests are outside the current law gate scope.
- failure: Test-native forms remain for the scheduled canon pass, with no runtime behavior defect shown.
- fix: During S3 replace test Sets with HashSet.fromIterable/has and native sorts with A.sort plus Order.String, keeping every membership and ordering assertion.
- seats: grok-1-7, fable-1-11

### b8

- file: scratchpad/effected/sbom/NtiaReport.ts:143
- class: effect-idiom   severity: backlog
- standard: AGENTS.md helper preference; D11.
- evidence: parseTimestamp(stamped)._tag === "Success" uses a raw Result discriminant. fable confirms the timestamp decoder preserves behavior on tested ISO, loose, numeric and garbage strings; only repository preference/precedent is cited for this choice.
- failure: No bug or violated specific mandatory discriminant rule is demonstrated; the guard choice is a style improvement outside D11's required bar.
- fix: When next touching this path, replace the discriminant comparison with Result.isSuccess(parseTimestamp(stamped)), preserving undefined handling.
- seats: fable-1-6

### b9

- file: scratchpad/test/sbom/SigstoreSigner.test.ts:37
- class: test   severity: backlog
- standard: effect-laws-v1 law 21; deferred S3 test-canon pass.
- evidence: Result.getOrThrowWith(Sha256Digest.parseResult(HEX), (error) => error) repeats the identity helper.
- failure: The test uses a redundant assertion/setup callback; source terse-helper work is separately required as r9.
- fix: During S3 use identity imported from effect/Function as the error mapper without changing the assertion/setup behavior.
- seats: fable-1-7

### b10

- file: scratchpad/effected/sbom/SbomMetadataSource.ts:137
- class: effect-idiom   severity: backlog
- standard: Effect helper preference; D11.
- evidence: The vcs lookup uses pkg.repository === undefined ? O.none<string>() : pkg.repository.browseUrl. fable proposes an equivalent Option chain but cites no mandatory rule or observed defect for this expression.
- failure: A behavior-neutral preference outside D11; the separate named NTIA constraint violation is required as r10.
- fix: When next touching the lookup, use O.fromNullable(pkg.repository).pipe(O.flatMap((repository) => repository.browseUrl)), preserving absence and reference order.
- seats: fable-1-12

## Handled by the deviation codemod

### c1

- file: scratchpad/effected/sbom/SigstoreSigner.ts:67; scratchpad/effected/sbom/IdentityToken.ts:87; scratchpad/effected/sbom/SigstoreSigner.ts:218; scratchpad/test/sbom/reachability.test.ts:109
- class: law   severity: codemod (not required)
- standard: D5; operator step 4; later 2026-10-09 per-module/per-class deviation codemod ruling.
- evidence: Identity-derived error identifiers and both service keys replace upstream names/keys. grok cites observable error name/Cause rendering; fable identifies identity/import reachability assertion retargets at lines 109,112,132–136,150–153. README says Deviations None and ledger deviations is empty.
- failure: Law-forced identity differences need central bookkeeping; the reports request recording, not restoration of incorrect identity code.
- fix: Central codemod emits one sbom identity-keys deviation listing schema/error/service sites, any identity-derived JSON Schema keys, and adjusted upstream reachability tests. Retain the mandated identities; assign no ledger or README Port-notes edits to these groups.
- seats: grok-1-1, fable-1-3

### c2

- file: scratchpad/effected/sbom/SbomDocument.ts:175
- class: law   severity: codemod (not required)
- standard: schema-number diagnostic; D9/§14; later 2026-10-09 per-module/per-class deviation codemod ruling.
- evidence: Upstream Schema.Number accepts non-finite versions; lab S.Finite rejects them. sol's differential probe reports 1 Success/Success and NaN, Infinity, -Infinity Success/Failure; grok confirms schema-number is enabled at error.
- failure: The required finite-number replacement changes accepted input and needs a central deviation record.
- fix: Retain S.Finite. Central codemod records the sbom S.Number-to-S.Finite class, sites, exact forcing diagnostic and the adjusted non-finite-input oracle assertions.
- seats: grok-1-2, sol-1-7, fable-1-3

### c3

- file: scratchpad/effected/sbom/SigstoreSigner.ts:177
- class: law   severity: codemod (not required)
- standard: effect-laws-v1 law 7; D9/§14; later 2026-10-09 per-module/per-class deviation codemod ruling.
- evidence: makeTest's unstubbed path now throws UnstubbedSigstoreSignerError instead of native Error; name/_tag differ while the upstream /not stubbed/ message assertion at SigstoreSigner.test.ts:264 still passes.
- failure: The law-required native-error replacement needs bookkeeping; no seat shows the replacement itself is wrong.
- fix: Retain the tagged error. Central codemod records one sbom tagged-error deviation with the site and relevant upstream error assertions; do not assign ledger or README Port-notes writes.
- seats: grok-1-1, sol-1-7, fable-1-3

## Rejected

### x1

- file: scratchpad/test/sbom/reachability.test.ts; scratchpad/effected/TESTS_NOT_PASSING.md
- class: test   severity: rejected (not required)
- standard: Later Grilling, 2026-10-09 environment-failure ruling.
- evidence: grok-1-7 ends its proposed S3 fix by directing that environment-bound reachability failures be left recorded and failing until a ruling is applied. The later binding ruling already requires fixing environmental failures, explicitly including sbom's sibling import.
- failure: This disposition would defer a failure the operator has already ordered repaired; it is the rejected clause of a composite finding, not a rejection of its valid S3 backlog portions.
- fix: Reject this clause and follow the later ruling in the centrally coordinated environment-repair work; TESTS_NOT_PASSING.md is outside this inventory's fix-lane surface.
- seats: grok-1-7
- rejection: Contradicts the later operator ruling requiring repair of environmental failures, including sbom's sibling import.
