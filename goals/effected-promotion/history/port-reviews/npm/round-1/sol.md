### sol-1-1
- file: scratchpad/effected/npm/Manifest.ts:112
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `Manifest`’s documented preservation of arbitrary non-dependency fields.   evidence: A read-only probe decoded `{"name":"p","__proto__":{"marker":1}}` through `Manifest.decode` and called `toRecord()`. Input keys were `["name","__proto__"]`; output keys were `["name"]`. The pinned oracle produced the same loss. Assignment to `rest[key]` uses an ordinary object and invokes the inherited `__proto__` setter.
- failure: A valid own manifest field silently disappears during a decode/encode round trip. The tolerant manifest model does not preserve all unknown fields as promised.
- fix: Accumulate unknown fields with a prototype-safe record operation that creates own data properties. Add this round-trip regression and record the repair as an `upstream-bug` deviation under section 14.

### sol-1-2
- file: scratchpad/test/npm/WorkspaceResolver.test.ts:107
- class: test   severity: required
- standard: D9; EFFECTED_PORT_GOAL section 11.1, “No test … weakened”; operator-approved `deliberatelyInvalid<T>` exception to D15.   evidence: The pinned upstream test calls `DependencyResolutionError.make({ …, reason: "bogus" as never })` and asserts that construction throws. The port calls `S.decodeUnknownResult(DependencyResolutionError)` instead and never invokes `.make`.
- failure: The constructor-rejection assertion has been replaced with a different boundary assertion. This test would remain green if `.make` stopped validating `reason`, while the original oracle test would fail. This is S1 oracle preservation, independently of the deferred test-canon migration.
- fix: Restore the `.make` assertion using the approved module-local `deliberatelyInvalid<T>` helper for the invalid reason. Keep the decoder assertion as an additional test if desired.

### sol-1-3
- file: scratchpad/effected/npm/RegistryCredential.ts:105
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1; AGENTS.md Code Laws; D11.   evidence: `basicCredentialFromPair("a:b", Redacted.make("c"))` synchronously throws `InvalidBasicAuthUsernameError`. Replacing `RangeError` with a tagged error changes the thrown value but leaves the failure as a side effect.
- failure: An expected validation failure escapes the function synchronously. Calling it while constructing an Effect can throw before an Effect exists; calling it inside a generator produces a defect rather than a typed failure.
- fix: Return a typed Effect for credential construction and fail with `InvalidBasicAuthUsernameError` when the username contains `:`. Record the law-driven synchronous API deviation and adjust the existing invalid-username test.

### sol-1-4
- file: scratchpad/effected/npm/RegistryCredential.ts:35
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5/D11.   evidence: `TokenCredential` and `BasicCredential` are plain data interfaces, with `RegistryCredential` maintained as a parallel type union. Other representable data/config models remain interfaces: `PublishOutcome`, `DryRunOutcome`, `PackOptions`, and `PublishOptions` in PackagePublish.ts; `RegistryTarget`, `SeededVersion`, and `RegistrySeed` in NpmRegistry.ts; `DefaultCacheDirectoryOptions` in PackageManagerCache.ts.
- failure: These models have no schema source of truth for runtime decoding, derived guards, annotations, or arbitraries. They are payload/config shapes, outside the permitted service-contract and type-level-only exceptions.
- fix: Define boundary-compatible schemas for these shapes and derive the existing exported type names from them. Preserve optional-versus-explicit-`undefined` behavior and leave the actual service interfaces as interfaces.

### sol-1-5
- file: scratchpad/effected/npm/DependencySection.ts:24
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; standards/effect-first-development.md EF-12b/EF-35; D5.   evidence: Named, annotation-bearing literal domains use `S.Literals`: `DependencyKind`, `DependencyField`, `RegistryKind`, `CachingPackageManager`, and `PackageManagerPinName`. `DependencyProtocol` is a handwritten literal type; `IntegrityAlgorithm` repeats its literals in a separate guard schema.
- failure: The named domain vocabulary bypasses the required `LiteralKit` construction, and the protocol/algorithm types have separately maintained runtime or branching representations.
- fix: Use annotated `LiteralKit` values for the named domains and derive their same-name types and guards. Preserve existing literal order and the `.literals` surfaces consumed by the port.

### sol-1-6
- file: scratchpad/effected/npm/IntegrityHash.ts:136
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; AGENTS.md schema-annotation law; D5 and the completed identity step.   evidence: Read-only runtime inspection returned `ast.annotations === undefined` for `IntegrityHash`, `CorepackIntegrityHash`, `SriIntegrityHash`, and `DependencySpecifier`. Their underlying branded/restricted schemas never receive `$I.annote(...)` or `$I.annoteSchema(...)`.
- failure: Four exported schemas remain without the namespaced identity and meaningful schema metadata required by the identity step. Annotating their associated error classes does not annotate these schema values.
- fix: Annotate the underlying schema building blocks before attaching statics, with distinct identities and descriptions for each exported schema. Preserve the schema-object identities relied on by the existing integrity tests.

### sol-1-7
- file: scratchpad/effected/npm/IntegrityHash.ts:158
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md “Schema owns pure data”: non-class schemas export a same-name runtime type; schema-first-development skill Fast Rules; D11.   evidence: `IntegrityHash`, `CorepackIntegrityHash`, `SriIntegrityHash`, and `DependencySpecifier` are exported non-class schema values without corresponding same-name type aliases. `IntegrityHashBrand` and `DependencySpecifierBrand` exist under different names.
- failure: These public schema values omit the required same-name type companion, unlike the literal schemas elsewhere in this module.
- fix: Add `export type Name = typeof Name.Type` for each schema, retain the upstream brand aliases, and list the added type exports in Port notes.

### sol-1-8
- file: scratchpad/effected/npm/IntegrityHash.ts:138
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18; standards/effect-first-development.md EF-12c; D11.   evidence: The reusable filters at IntegrityHash.ts:138, :169, and :175 have no annotation argument. The same omission occurs at DependencySpecifier.ts:386 and PackageManagerPin.ts:111. Runtime inspection of `IntegrityHash.ast.checks` returned an undefined annotation entry.
- failure: Reusable domain checks carry only rejection text, omitting the required check identifier, title, and description. Schema-level or field-level descriptions do not supply the missing filter metadata.
- fix: Add `$I`-based identifiers, titles, and descriptions to each reusable `S.makeFilter`, preserving its predicate and user-facing rejection message.

### sol-1-9
- file: scratchpad/effected/npm/IntegrityHash.ts:65
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-35; AGENTS.md derived-guard law.   evidence: `isSri`, `isCorepack`, and `isYarnChecksum` directly test regular expressions; the schemas are subsequently built around those predicates. DependencySpecifier.ts maintains similar named protocol/string validators. PackageManagerPin.ts:102 independently repeats the four values already represented by `PackageManagerPinName`.
- failure: Named domain constraints and guards remain separately maintained helpers instead of deriving from schema definitions. In particular, changing the pin-name schema does not change its handwritten guard.
- fix: Define the named string constraints with built-in schema checks, derive the guards through `S.is`, and compose the aggregate schemas from those constraints. Replace `isPinName` with the guard derived from its literal domain.

### sol-1-10
- file: scratchpad/effected/npm/NpmRegistry.ts:116
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 20; standards/effect-first-development.md EF-13; standards/ARCHITECTURE.md finite-variant contract.   evidence: `RegistryReadError` combines `kind: "transport" | "status" | "decode"` with independently optional `status` and `cause`. A read-only probe successfully constructed `{ kind: "decode", package: "p", registry: "r", status: 404 }`. `PublishError` and `TarballError` use the same case-specific optional-field-bag pattern.
- failure: The schema does not express which payload belongs to which failure case. Irrelevant fields are accepted, and narrowing the discriminator leaves case-specific fields optional. No internal discriminated model normalizes these bags before message branching.
- fix: Model the failure cases as discriminator-specific schema members, using the required literal-domain/tagged-union construction. Preserve the public tags and boundary compatibility through a facade or transformation; record any stricter accepted-input changes under section 14.

### sol-1-11
- file: scratchpad/effected/npm/PublishError.ts:38
- class: schema   severity: required
- standard: standards/effect-first-development.md tagged-error template: cause fields explicitly use `S.Defect({ includeStack: true })`; effect-first-development skill law 8.   evidence: A read-only `S.encodeUnknownResult(PublishError)` probe with an `Error("probe")` cause produced only `{ name: "Error", message: "probe" }`, dropping its stack. RegistryReadError produced the same result. Plain `S.Defect()` also occurs in TarballError, ManifestDecodeError, CatalogAssemblyError, and DependencyResolutionError.
- failure: Serialized cause-carrying errors lose the originating stack, contrary to the explicit error-schema contract.
- fix: Use `S.Defect({ includeStack: true })` at these cause fields, preserving their existing optionality.

### sol-1-12
- file: scratchpad/effected/npm/CatalogAssemblyError.ts:20
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md preference for Effect helper modules; D5/D11.   evidence: Domain logic still calls direct native string helpers, including `text.trim()` here, `output.trim()` in PublishError.ts:43, and repeated `startsWith`, `slice`, and `trim` calls in DependencySpecifier.ts and PackageManagerPin.ts.
- failure: The source retains the native string-helper implementation form prohibited by EF-5. These calls remain after the reported green gates and have no recorded exception.
- fix: Replace equivalent operations with `effect/String` helpers, preserving the current grammar, trimming behavior, and missing-index behavior.

### sol-1-13
- file: scratchpad/effected/npm/CatalogResolver.ts:38
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; EFFECTED_PORT_GOAL section 10.2; operator deferral of S2.   evidence: Public blocks retain `@example` and `@remarks` throughout npm. Most owning exports have neither canonical `@category` nor `@since 0.0.0`; numerous value-level exports have no Example.
- failure: The public documentation does not meet the required carrier grammar or export metadata requirements. This remains deferred S2 work.
- fix: Convert the carried prose to the prescribed sections, supply titled compilable Examples and canonical tags, and preserve the upstream explanations and warnings.

### sol-1-14
- file: scratchpad/effected/npm/index.ts:1
- class: docs   severity: backlog
- standard: D4; EFFECTED_PORT_GOAL sections 10.1 and 10.2; operator deferral of S2.   evidence: The pinned upstream index begins with a `@packageDocumentation` block explaining the resolver contracts, their no-op layers, typed errors, consumer-supplied implementations, and Manifest. The port removes the entire block and begins with imports.
- failure: Carried module-level documentation has been dropped, and the barrel lacks its required package-documentation block.
- fix: Restore the upstream module explanation with adapted imports/names, retaining `@packageDocumentation`.

### sol-1-15
- file: scratchpad/effected/npm/README.md:3
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL section 10.3; D4; operator deferral of S2.   evidence: The README retains npm/Node/TypeScript badges, the pre-1.0 stability/plugin block, an Install section, `@effected/npm` example imports, and root-barrel Effect imports. Port notes also say “Added exports: None” despite the added `InvalidBasicAuthUsernameError` export in RegistryCredential.ts.
- failure: The lab README still teaches installation and import paths for the upstream package, and its added-export inventory is incomplete.
- fix: Apply the prescribed lab README adaptation, rewrite retained examples to lab and dedicated Effect imports, and inventory the added export.

### sol-1-16
- file: scratchpad/test/npm/DependencySpecifier.test.ts:102
- class: test   severity: backlog
- standard: effect-vitest-canon SPEC D5; .patterns/testing-patterns.md specialized assertions; EFFECTED_PORT_GOAL section 11.2; operator deferral of S3.   evidence: Option assertions use `assert.isTrue(O.isSome(...))`, `assert.isTrue(O.isNone(...))`, and structural equality against Option containers. Similar conditional/container assertions occur in the registry and publish tests.
- failure: The tests do not use the canonical variant-and-payload assertion helpers. Some Some assertions establish only the variant, without checking the parsed payload.
- fix: Migrate these assertions to `assertSome`, `assertNone`, and the appropriate Result/Exit helpers, supplying expected payloads or Causes.

### sol-1-17
- file: scratchpad/test/npm/PackageTarball.test.ts:69
- class: test   severity: backlog
- standard: effect-vitest-canon SPEC D14; EFFECTED_PORT_GOAL section 11.2; operator deferral of S3.   evidence: `scenario` supplies the effectful PackageTarball layer through per-call `Effect.provide(layer)`. PackagePublish.test.ts:65–68 similarly builds an effectful service layer and exposes a wrapper that provides it for each program.
- failure: Effectful fixture acquisition and scope ownership remain in per-test provision wrappers instead of the required `it.layer` fixture structure.
- fix: Move effectful service fixtures into the appropriate `it.layer` groups; retain per-test provision only for pure stub layers.

### sol-1-18
- file: scratchpad/test/npm/IntegrityHash.test.ts:1
- class: test   severity: backlog
- standard: D10; EFFECTED_PORT_GOAL section 11.4; operator deferral of S3.   evidence: Searching all `scratchpad/test/npm/**` found no property-test calls, `Arbitrary` imports, or `fcRuns` use. The module exports multiple schemas/codecs and parser/formatter surfaces.
- failure: The required generated round-trip, idempotence, and fidelity property floor has not been implemented.
- fix: Add the schema/codec and parser/formatter properties through canonical Effect property tests and `fcRuns`. Keep the existing oracle examples and include the manifest preservation regression from sol-1-1.

REQUIRED: 12
BACKLOG: 6