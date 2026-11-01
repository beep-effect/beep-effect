### sol-1-1
- file: scratchpad/effected/sbom/Sbom.ts:67
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 10; `standards/effect-first-development.md` EF-38; D9.   evidence: `generate` calls `[...input.components].sort(...)`. The native-runtime gate misses this call: its `getMemberCall` rejects receivers that are not identifiers, and its native-sort check additionally requires a hotspot path; `scratchpad/effected/sbom/**` is outside the configured extra-check hotspots.
- failure: Component ordering still uses the explicitly forbidden native array sort despite the green law gate.
- fix: Use `A.sort(input.components, Order.make((a, b) => a.name.localeCompare(b.name)))`. Preserve the existing `localeCompare` comparator so the replacement retains upstream ordering.

### sol-1-2
- file: scratchpad/effected/sbom/SbomDocument.ts:34
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b; D5.   evidence: `ComponentType` and `ExternalReferenceType` at `SbomDocument.ts:53`, `NtiaElementId` at `NtiaReport.ts:32`, and `SigningErrorKind` at `SigstoreSigner.ts:47` are named, reused, annotation-bearing literal domains built with `S.Literals`. The four-law gate checks imports, Effect functions, terse helpers, and native runtime operations; it does not enforce this schema-constructor distinction.
- failure: These domains use the constructor reserved for anonymous inline unions rather than the required `LiteralKit` domain representation.
- fix: Replace these four `S.Literals([...])` constructors with `LiteralKit([...])`, retaining their members, identity annotations, exported names, and derived types.

### sol-1-3
- file: scratchpad/effected/sbom/InTotoStatement.ts:106
- class: schema   severity: required
- standard: Operator step 4 in `scratchpad/EFFECTED_PORT_GOAL.md`; D5; `standards/effect-first-development.md` EF-12.   evidence: `Sha256Digest` extends the checked and branded string schema without applying `$I.annoteSchema(...)`. A read-only runtime probe prints `digest annotations undefined` for `Sha256Digest.ast.annotations`; neighboring exported schemas carry identity annotations.
- failure: The exported digest schema has no canonical identity or meaningful schema annotation metadata, leaving the required identity pass incomplete.
- fix: Apply `$I.annoteSchema("Sha256Digest", { description: ... })` to the base schema before extending it with the existing statics. Preserve the brand and accepted digest strings.

### sol-1-4
- file: scratchpad/effected/sbom/SlsaProvenance.ts:58
- class: schema   severity: required
- standard: Operator step 4 in `scratchpad/EFFECTED_PORT_GOAL.md`, requiring annotations on fields and schemas.   evidence: Only outer provenance fields receive `annotateKey`. Nested fields remain bare: `workflow.ref/repository/path`, the four `github` claim fields, resolved-dependency `uri/digest`, `builder.id`, and `metadata.invocationId`. Their source comments are not schema annotations.
- failure: The nested provenance fields lack the required field metadata in their schema ASTs; the identity pass annotated only the outer level.
- fix: Add meaningful `annotateKey({ description: ... })` metadata to the existing nested fields, including the `workflow` and `github` fields. Keep their shapes and decoding behavior unchanged.

### sol-1-5
- file: scratchpad/effected/sbom/Sbom.ts:21
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33.   evidence: Representable data payloads remain handwritten interfaces: `SbomInput`, `SbomJsonOptions`, `InTotoStatementInput`, `InTotoSubjectInput`, `SbomMetadataOptions`, `ComponentInput`, `CopyrightYears`, and `GitHubWorkflowProvenance`. These are ordinary property shapes, rather than service contracts or complex type-level utilities. The four-law gate does not check schema-first domain declarations.
- failure: These public input and configuration shapes have no schema source of truth from which their types, guards, and tooling can be derived.
- fix: Define annotated structural schemas and derive the existing type names from them. Preserve current structural assignability and explicit-`undefined` optional-field semantics; leave the existing function boundaries unchanged so this conversion does not introduce new validation behavior.

### sol-1-6
- file: scratchpad/effected/sbom/Sbom.ts:91
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-19; D11.   evidence: `Sbom.toJson` directly calls `JSON.stringify`; `InTotoStatement.toJson` does likewise at `InTotoStatement.ts:254`. The green `preferSchemaOverJson` diagnostic misses both: its implementation checks JSON calls inside Effect contexts, while these serializers are synchronous functions outside those contexts.
- failure: Both public JSON serialization boundaries bypass the required Schema codec path.
- fix: Encode the existing assembled wire objects through `S.fromJsonString(...)`, retaining their key order and the current indentation defaults (`2` for SBOMs, `0` for statements). Preserve the open predicate contract. Register any law-forced change to serialization failures under section 14.

### sol-1-7
- file: scratchpad/effected/sbom/SbomDocument.ts:175
- class: law   severity: required
- standard: D9 and `scratchpad/EFFECTED_PORT_GOAL.md` §14, behavior deviation protocol.   evidence: A read-only differential probe against the pinned oracle produces:
  `1 oracle=Success port=Success`;
  `NaN oracle=Success port=Failure`;
  `Infinity oracle=Success port=Failure`;
  `-Infinity oracle=Success port=Failure`.
  The oracle uses `Schema.Number`; the port uses `S.Finite`. Another observable change at `SigstoreSigner.ts:184` replaces the oracle’s native `Error` with `UnstubbedSigstoreSignerError`, changing its name and adding `_tag`. At the reviewed commit, README “Deviations” is `None` and the SBOM ledger’s `deviations` array is empty.
- failure: The port changes accepted inputs and observable error identity without completing the binding deviation protocol. The finite-number and typed-error laws explain the changes, but the changes have no registered causes or cited adjusted oracle tests.
- fix: Retain the law-required implementations and register both deviations with their exact rule IDs, before/after behavior, and the smallest corresponding oracle-test adjustments. Add the same entries to README “Port notes → Deviations”.

### sol-1-8
- file: scratchpad/effected/sbom/IdentityToken.ts:29
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` hard requirements, carrier policy, and kind-split Example law; operator deferral of S2.   evidence: Export documentation throughout the module retains forbidden `@remarks` and `@example` carriers and omits canonical `@category` and `@since 0.0.0` tags. Runtime exports such as `IdentityTokenError` also lack the required titled Example.
- failure: The module does not yet satisfy the deferred JSDoc-law/docgen acceptance surface.
- fix: During S2, convert the existing prose to the canonical section grammar, add categories and version tags, and supply meaningful compilable Examples for value exports. Preserve the upstream documentation bodies.

### sol-1-9
- file: scratchpad/test/sbom/InTotoStatement.test.ts:34
- class: test   severity: backlog
- standard: D10, property floor; operator deferral of S3.   evidence: Searching the pinned `scratchpad/test/sbom/**` surface for `Arbitrary`, property-test calls, and `fcRuns` returns no matches. The digest, document, statement, bundle, and provenance suites contain example-based cases but no schema round-trip or parser/formatter properties.
- failure: The retained oracle tests do not satisfy the deferred property-testing floor for exported schemas and parsing/formatting APIs.
- fix: During S3, add schema encode/decode round-trip properties and applicable digest-normalization and serialization fidelity/idempotence properties, using the canonical property runner and `fcRuns`. Retain the existing oracle cases.

### sol-1-10
- file: scratchpad/test/sbom/SigstoreSigner.test.ts:96
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14; operator deferral of S3.   evidence: `signWith` builds `SigstoreSigner.layerWith(options)` through per-test `Effect.provide` at line 103. `layerWith` is a `Layer.effect` constructor (`SigstoreSigner.ts:228`), rather than a pure `Layer.succeed` or `Layer.mock` stub.
- failure: The signer tests rebuild an effectful service layer inside each test instead of using the runner-owned layer fixture required by the deferred test canon.
- fix: During S3, move the effectful signer-layer setup into appropriately isolated `it.layer` blocks for the distinct signer, witness, and identity scenarios, and consume the service from the test context.

REQUIRED: 7
BACKLOG: 3