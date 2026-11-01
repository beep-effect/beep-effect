# npm — round-1 merged review inventory

Seats read: `grok.md`, `sol.md`, `fable.md` and their shared `BRIEF.md` in this directory; no `part-N` reports are present. Brief review commit: `3fa5876691901fccf3d1cd29e9324564df134b56`; pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts: **Required 38 · Backlog 10 · Codemod 4 · Rejected 0 · Groups 6**. Two npm allowlist entries are included, one finding per entry, with kind `object-method`.

Binding basis: the complete operator revision/rulings/grilling block, D1–D20, sections 12.4–12.5 and 14. The later rulings override earlier preservation/allowlist rules. Evidence below is attributed to the seats; no full gate rerun is claimed. Only this inventory and `required.json` are written.

Overlapping seat findings are deduped by defect. Omnibus reports covering independently fixable occurrences in different files are normalized into per-file records where needed for the six-source-file group limit; each occurrence has one owner. `fable-1-16` denotes the report's unnumbered `NpmExecutor.ts:104` heading between findings 15 and 17. Mixed code/bookkeeping findings are split so code defects remain required and recording fragments go to the codemod. Schema-model fixes preserve structural external compatibility; internal schemas may back existing type-only exports without forcing new barrel values.

Groups in `required.json` own every assigned source/test file at most once. Cross-group use of newly implemented symbols is resolved when the fix wave is integrated; it grants no overlapping writes. The central ledger, Port notes, allowlist registry and repo configuration are outside all group assignments.

## Required

### npm-1

- file: scratchpad/effected/npm/Manifest.ts:109
- class: bug   severity: required
- standard: D9; section 14, verified upstream bug; Manifest unknown-field preservation contract
- evidence: The seat probe decoded {"name":"p","__proto__":{"marker":1}}: input own keys were ["name","__proto__"], but toRecord() returned only ["name"]. The pinned oracle loses the same key. The live decode loop assigns rest[key] = value to an ordinary object (lines 103-109).
- failure: An own non-dependency field invokes the inherited __proto__ setter and disappears during round-trip.
- fix: Build the unknown-field record from collected entries with effect/Record.fromEntries, preserving own __proto__ data and typed-field precedence. Add the exact unknown-field round-trip regression to Manifest.test.ts. Supply the upstream-bug evidence to the central deviation codemod; do not edit the ledger or Port notes.
- seats: sol-1-1
- group: g3

### npm-2

- file: scratchpad/test/npm/WorkspaceResolver.test.ts:107
- class: law   severity: required
- standard: D9; section 11.1; section 16; 2026-10-09 deliberatelyInvalid ruling
- evidence: Oracle __test__/WorkspaceResolver.test.ts:99-103 calls DependencyResolutionError.make with reason: "bogus" as never and expects construction to throw. The port instead calls decodeUnknownResult and never invokes .make; no npm deliberatelyInvalid.ts exists.
- failure: The oracle constructor-rejection test was weakened to a different boundary; it cannot detect loss of constructor validation.
- fix: Add scratchpad/test/npm/deliberatelyInvalid.ts with the single approved generic unknown-to-T cast. Restore the upstream .make assertion and invalid reason using deliberatelyInvalid<"mechanism" | "no-version">("bogus"). Preserve the decoder assertion only as an additional test.
- seats: sol-1-2, fable-1-12
- group: g3

### npm-3

- file: scratchpad/effected/npm/RegistryCredential.ts:97
- class: bug   severity: required
- standard: D9; section 14; later 2026-10-09 ruling on unforced lab divergence
- evidence: The pinned oracle exposes one (username, password) function. The port adds a password-first overload and dual(2) at lines 97-100. The seat cites no forcing law or diagnostic; a one-argument call now returns a function instead of entering the body.
- failure: A new curried accepted-input shape was added without an allowed cause.
- fix: Remove the data-last overload and dual wrapper; restore the upstream two-argument calling convention and any oracle test lines rewritten solely for currying. Coordinate with npm-4: EF-1 forces a typed Effect result, so restoring the calling convention does not restore the forbidden synchronous throw.
- seats: grok-1-2
- group: g2

### npm-4

- file: scratchpad/effected/npm/RegistryCredential.ts:105
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-1; D11
- evidence: basicCredentialFromPair("a:b", Redacted.make("c")) synchronously throws InvalidBasicAuthUsernameError; EF-1 explicitly requires typed Effect results for fallible logic and forbids throwing in production domain logic.
- failure: Expected username validation can escape before an Effect exists, or become a defect inside a generator.
- fix: Keep the upstream two-argument calling convention, return Effect.Effect<BasicCredential, InvalidBasicAuthUsernameError>, and use Effect.fail for colon-bearing usernames. Adapt PackagePublish.test.ts success and rejection calls to execute the Effect, preserving the existing assertions. This API deviation is law:EF-1; central bookkeeping only.
- seats: sol-1-3
- group: g2

### npm-5

- file: scratchpad/effected/npm/RegistryCredential.ts:35
- class: schema   severity: required
- standard: schema-first-development-prompt Pattern 1; effect-first-development EF-33; law 20; D5/D11
- evidence: TokenCredential and BasicCredential are interfaces containing kind and Redacted<string>; RegistryCredential is a separately maintained type union. NpmRegistry.authorizationHeader branches on credential.kind.
- failure: Pure credential data lacks executable schemas, identity metadata and derived guards; it is not a service-contract exception.
- fix: Define identity-annotated boundary-compatible schemas for token/basic credentials using S.Redacted(S.String) and a discriminator-specific union; derive the existing same-name types. Preserve structural inputs and redaction, and construct the basic result through its schema. Existing type-only barrel exports can stay type-only; any added public runtime export is centrally inventoried.
- seats: sol-1-4, fable-1-13
- group: g2

### npm-6

- file: scratchpad/effected/npm/PackagePublish.ts:105
- class: schema   severity: required
- standard: schema-first-development-prompt Pattern 1; effect-first-development EF-33; D5/D11
- evidence: PublishOutcome, DryRunOutcome, PackOptions and PublishOptions are exported data/config interfaces (lines 105, 125, 143, 153), distinct from the service interface PackagePublishShape.
- failure: Representable payload/config models have no schema source of truth.
- fix: Introduce annotated boundary-compatible schemas and derive the existing type names. Preserve optional-versus-explicit-undefined semantics and existing inputs; keep PackagePublishShape as a service interface. Normalize finite outcome cases internally if needed, preserving the public outcome shape.
- seats: sol-1-4, fable-1-25
- group: g2

### npm-7

- file: scratchpad/effected/npm/NpmRegistry.ts:38
- class: schema   severity: required
- standard: schema-first-development-prompt Pattern 1; effect-first-development EF-33; D5/D11
- evidence: RegistryTarget (:38), SeededVersion (:394) and RegistrySeed (:414) are representable data/config interfaces; RegistrySeed contains registry/package/version dictionaries and optional distTags.
- failure: Registry boundary and seed data have no annotated executable schema contract.
- fix: Define annotated schemas and derive these existing types, retaining nested record contents, Redacted credential types, and optional-versus-explicit-undefined inputs. Keep NpmRegistryShape as the service interface and avoid gratuitous public shape changes.
- seats: sol-1-4, fable-1-25
- group: g2

### npm-8

- file: scratchpad/effected/npm/PackageManagerCache.ts:48
- class: schema   severity: required
- standard: schema-first-development-prompt Pattern 1; effect-first-development EF-33; D5/D11
- evidence: DefaultCacheDirectoryOptions is an exported data/config interface rather than a service contract.
- failure: The options payload has no schema source of truth or identity annotations.
- fix: Define an identity-annotated boundary-compatible options schema and derive DefaultCacheDirectoryOptions, preserving optional values and the current default-directory behavior.
- seats: sol-1-4, fable-1-25
- group: g4

### npm-9

- file: scratchpad/effected/npm/DependencySection.ts:24
- class: schema   severity: required
- standard: effect-laws-v1 law 19; effect-first-development EF-12b/EF-35; D5
- evidence: DependencyKind (:24) and DependencyField (:39) are named annotated S.Literals schemas. Manifest uses DependencyField.literals; KIND_TO_FIELD/FIELD_TO_KIND consume the named domains. The four green laws do not enforce LiteralKit construction.
- failure: Two named domains bypass the required kit vocabulary.
- fix: Replace both schemas with annotated LiteralKit values from @beep/schema/LiteralKit. Preserve literal order, .literals, same-name types, field mappings and decoded string values.
- seats: grok-1-4, sol-1-5, fable-1-5, fable-1-6
- group: g1

### npm-10

- file: scratchpad/effected/npm/RegistryKind.ts:19
- class: schema   severity: required
- standard: effect-laws-v1 law 19; D5
- evidence: RegistryKind is a named annotated S.Literals(["npm","github-packages","jsr","custom"]) domain, used in two four-way label dispatches.
- failure: The reusable registry vocabulary lacks its required LiteralKit construction.
- fix: Use the annotated LiteralKit with the same literal order and outputs. Kit dispatch can replace duplicated dispatch lists when behavior remains identical.
- seats: grok-1-4, sol-1-5, fable-1-9
- group: g1

### npm-11

- file: scratchpad/effected/npm/PackageManagerCache.ts:34
- class: schema   severity: required
- standard: effect-laws-v1 law 19; D5
- evidence: CachingPackageManager is a named annotated S.Literals domain with npm, pnpm, yarn-classic, yarn-berry and bun; defaultDirectory dispatches on that domain.
- failure: The reusable manager vocabulary bypasses LiteralKit.
- fix: Use an annotated LiteralKit retaining the exact literal order, same-name type and directory results.
- seats: grok-1-4, sol-1-5, fable-1-7
- group: g4

### npm-12

- file: scratchpad/effected/npm/PackageManagerPin.ts:92
- class: schema   severity: required
- standard: effect-laws-v1 laws 17/19; effect-first-development EF-35; D5
- evidence: PackageManagerPinName is a named S.Literals domain at :92; isPinName independently repeats npm/pnpm/yarn/bun comparisons at :102-103 and is used by parseResult.
- failure: The named domain bypasses the kit and has a second source of truth for acceptance.
- fix: Define the annotated LiteralKit in the same order and replace isPinName with S.is(PackageManagerPinName), preserving parse acceptance and existing pin representations.
- seats: grok-1-4, sol-1-5, sol-1-9, fable-1-8
- group: g1

### npm-13

- file: scratchpad/effected/npm/IntegrityHash.ts:51
- class: schema   severity: required
- standard: effect-laws-v1 law 19; schema-first-development-prompt Pattern 1; D5
- evidence: IntegrityAlgorithm is a five-literal type union; isIntegrityAlgorithm separately repeats those literals in S.is(S.Literals(...)) at :53.
- failure: A named algorithm vocabulary is duplicated between a public type and an anonymous guard schema.
- fix: Define the identity-annotated IntegrityAlgorithm LiteralKit, derive its same-name type and guard, and expose its runtime value through index.ts. Keep the five literals and algorithmOf results identical. Added-export bookkeeping belongs to the codemod.
- seats: sol-1-5, fable-1-10
- group: g1

### npm-14

- file: scratchpad/effected/npm/DependencySpecifier.ts:57
- class: schema   severity: required
- standard: effect-laws-v1 law 19; effect-first-development EF-12b/EF-35; D5
- evidence: DependencyProtocol is an eleven-literal public type union, returned by protocolOf, without a named runtime schema.
- failure: The protocol vocabulary is maintained outside the required schema/kit source of truth.
- fix: Create an annotated LiteralKit in upstream order (range, tag, git, url, npm, file, link, portal, catalog, workspace, unknown), derive the same-name type and export the value from index.ts. Preserve classification outputs; leave export bookkeeping to the codemod.
- seats: sol-1-5, fable-1-11
- group: g1

### npm-15

- file: scratchpad/effected/npm/IntegrityHash.ts:136; scratchpad/effected/npm/DependencySpecifier.ts:384
- class: schema   severity: required
- standard: effect-first-development EF-12; D5 identity step
- evidence: The seat runtime inspection found ast.annotations === undefined on IntegrityHash, CorepackIntegrityHash, SriIntegrityHash and DependencySpecifier. Their branded/restricted schema building blocks are unannotated.
- failure: Four exported schemas lack their own namespaced identity and meaningful schema metadata.
- fix: Annotate each underlying schema with a distinct $I identity and description before defining the S.Opaque classes required by allow-1/allow-2. Preserve branded string behavior and codec wiring; retarget only object-identity assertions made obsolete by the operator-approved representation.
- seats: sol-1-6
- group: g1

### npm-16

- file: scratchpad/effected/npm/IntegrityHash.ts:215
- class: schema   severity: required
- standard: schema-first-development-prompt same-name runtime type rule for non-class schemas; D11
- evidence: SriIntegrityHash is an exported non-class schema value without a same-name type alias. sol-1-7 also names IntegrityHash, CorepackIntegrityHash and DependencySpecifier; those augmented values become named S.Opaque classes under allow-1/allow-2, so their non-class-alias complaint is discharged by those replacements.
- failure: The remaining non-class SriIntegrityHash schema omits its same-name derived type companion.
- fix: Add export type SriIntegrityHash = typeof SriIntegrityHash.Type, retaining IntegrityHashBrand. Existing value re-exports carry the merged type. Do not add type aliases that conflict with the named S.Opaque classes required by allow-1/allow-2; the central codemod records actual added types.
- seats: sol-1-7
- group: g1

### npm-17

- file: scratchpad/effected/npm/IntegrityHash.ts:138; scratchpad/effected/npm/DependencySpecifier.ts:386; scratchpad/effected/npm/PackageManagerPin.ts:111
- class: schema   severity: required
- standard: effect-laws-v1 law 18; effect-first-development EF-12c
- evidence: Reusable filters at IntegrityHash.ts:138/169/175, DependencySpecifier.ts:386 and PackageManagerPin.ts:111 lack annotation arguments; the seat inspected an undefined annotation in IntegrityHash.ast.checks.
- failure: Reusable checks omit identifier/title/description even where the owning schema has annotations.
- fix: Provide $I-derived identifiers, titles and descriptions for each reusable check, including replacements introduced by npm-18. Preserve predicates and user-facing rejection messages.
- seats: sol-1-8
- group: g1

### npm-18

- file: scratchpad/effected/npm/IntegrityHash.ts:65; scratchpad/effected/npm/DependencySpecifier.ts:181
- class: schema   severity: required
- standard: effect-laws-v1 law 17; effect-first-development EF-35
- evidence: isSri/isCorepack/isYarnChecksum test regexes directly, and schemas are subsequently built around them. DependencySpecifier maintains named protocol/string validators in the same helper-first pattern.
- failure: Named string constraints and guards are maintained outside the schema source of truth.
- fix: Define annotated string constraints using equivalent built-in schema checks, derive the named guards with S.is and compose aggregate schemas from them. Preserve the grammar and rejection behavior; the pin-name instance is deduped into npm-12.
- seats: sol-1-9
- group: g1

### npm-19

- file: scratchpad/effected/npm/NpmRegistry.ts:116
- class: schema   severity: required
- standard: effect-laws-v1 law 20; effect-first-development EF-13; law 19 for named reason vocabulary
- evidence: A seat probe constructed { kind: "decode", package: "p", registry: "r", status: 404 }; kind is transport/status/decode while status and cause are independent optional fields.
- failure: RegistryReadError permits irrelevant case payloads and does not narrow case-specific fields to an internal validated variant.
- fix: Represent transport/status/decode as discriminator-specific annotated schema members. Preserve public tags and external compatibility through a facade/transform; normalize to a case-specific internal model before branching. Any law-forced stricter input must have its adjusted upstream assertions identified for the central codemod.
- seats: sol-1-10
- group: g2

### npm-20

- file: scratchpad/effected/npm/PublishError.ts:28
- class: schema   severity: required
- standard: effect-laws-v1 law 20; effect-first-development EF-13; law 19 for named reason vocabulary
- evidence: PublishError has a kind discriminator with independently optional case-specific payload fields, the same optional-bag pattern as RegistryReadError.
- failure: PublishError permits irrelevant case payloads and does not narrow case-specific fields to an internal validated variant.
- fix: Model the publish error cases with annotated discriminator-specific members and preserve public tags and boundary compatibility through a facade/transform. Any law-forced stricter input must have its adjusted upstream assertions identified for the central codemod.
- seats: sol-1-10
- group: g2

### npm-21

- file: scratchpad/effected/npm/PackageTarball.ts:43
- class: schema   severity: required
- standard: effect-laws-v1 law 20; effect-first-development EF-13; law 19 for named reason vocabulary
- evidence: TarballError has a reason discriminator with independently optional payload fields; fail at :110 also repeats all five reason literals in its parameter type.
- failure: TarballError permits irrelevant case payloads and does not narrow case-specific fields to an internal validated variant.
- fix: Use one named LiteralKit reason domain and discriminator-specific annotated members; derive fail's reason type from that domain. Preserve the public tag, reason values and external compatibility through a facade/transform. Any law-forced stricter input must have its adjusted upstream assertions identified for the central codemod.
- seats: sol-1-10, fable-1-18
- group: g3

### npm-22

- file: scratchpad/effected/npm/NpmRegistry.ts:125
- class: schema   severity: required
- standard: effect-first-development tagged-error template: cause fields explicitly use S.Defect({ includeStack: true })
- evidence: The report names plain S.Defect() in RegistryReadError. Its encode probe for PublishError and RegistryReadError with Error("probe") returned only name/message, dropping the stack.
- failure: Cause serialization omits the originating stack required by the error-schema contract.
- fix: Use S.Defect({ includeStack: true }) in RegistryReadError cause fields, preserving existing optionality. Add or adapt a focused encode assertion in this group's corresponding tests; identify the law-driven wire change for central bookkeeping.
- seats: sol-1-11
- group: g2

### npm-23

- file: scratchpad/effected/npm/PublishError.ts:38
- class: schema   severity: required
- standard: effect-first-development tagged-error template: cause fields explicitly use S.Defect({ includeStack: true })
- evidence: The report names plain S.Defect() in PublishError. Its encode probe for PublishError and RegistryReadError with Error("probe") returned only name/message, dropping the stack.
- failure: Cause serialization omits the originating stack required by the error-schema contract.
- fix: Use S.Defect({ includeStack: true }) in PublishError cause fields, preserving existing optionality. Add or adapt a focused encode assertion in this group's corresponding tests; identify the law-driven wire change for central bookkeeping.
- seats: sol-1-11
- group: g2

### npm-24

- file: scratchpad/effected/npm/PackageTarball.ts:55
- class: schema   severity: required
- standard: effect-first-development tagged-error template: cause fields explicitly use S.Defect({ includeStack: true })
- evidence: The report names plain S.Defect() in TarballError. Its encode probe for PublishError and RegistryReadError with Error("probe") returned only name/message, dropping the stack.
- failure: Cause serialization omits the originating stack required by the error-schema contract.
- fix: Use S.Defect({ includeStack: true }) in TarballError cause fields, preserving existing optionality. Add or adapt a focused encode assertion in this group's corresponding tests; identify the law-driven wire change for central bookkeeping.
- seats: sol-1-11
- group: g3

### npm-25

- file: scratchpad/effected/npm/Manifest.ts:44
- class: schema   severity: required
- standard: effect-first-development tagged-error template: cause fields explicitly use S.Defect({ includeStack: true })
- evidence: The report names plain S.Defect() in ManifestDecodeError. Its encode probe for PublishError and RegistryReadError with Error("probe") returned only name/message, dropping the stack.
- failure: Cause serialization omits the originating stack required by the error-schema contract.
- fix: Use S.Defect({ includeStack: true }) in ManifestDecodeError cause fields, preserving existing optionality. Add or adapt a focused encode assertion in this group's corresponding tests; identify the law-driven wire change for central bookkeeping.
- seats: sol-1-11
- group: g3

### npm-26

- file: scratchpad/effected/npm/CatalogAssemblyError.ts:54
- class: schema   severity: required
- standard: effect-first-development tagged-error template: cause fields explicitly use S.Defect({ includeStack: true })
- evidence: The report names plain S.Defect() in CatalogAssemblyError. Its encode probe for PublishError and RegistryReadError with Error("probe") returned only name/message, dropping the stack.
- failure: Cause serialization omits the originating stack required by the error-schema contract.
- fix: Use S.Defect({ includeStack: true }) in CatalogAssemblyError cause fields, preserving existing optionality. Add or adapt a focused encode assertion in this group's corresponding tests; identify the law-driven wire change for central bookkeeping.
- seats: sol-1-11
- group: g3

### npm-27

- file: scratchpad/effected/npm/WorkspaceResolver.ts:79
- class: schema   severity: required
- standard: effect-first-development tagged-error template: cause fields explicitly use S.Defect({ includeStack: true })
- evidence: The report names plain S.Defect() in DependencyResolutionError. Its encode probe for PublishError and RegistryReadError with Error("probe") returned only name/message, dropping the stack.
- failure: Cause serialization omits the originating stack required by the error-schema contract.
- fix: Use S.Defect({ includeStack: true }) in DependencyResolutionError cause fields, preserving existing optionality. Add or adapt a focused encode assertion in this group's corresponding tests; identify the law-driven wire change for central bookkeeping.
- seats: sol-1-11
- group: g3

### npm-28

- file: scratchpad/effected/npm/CatalogAssemblyError.ts:20
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; AGENTS.md Code Laws; D11
- evidence: The summarization path calls text.trim() directly. EF-5 explicitly covers direct native string helpers; the four reported green laws do not enforce these methods.
- failure: Domain logic retains the prohibited direct native string-helper form.
- fix: Use equivalent effect/String helpers with the same trimming, grammar and indexing behavior. Preserve the upstream test assertions.
- seats: sol-1-12
- group: g3

### npm-29

- file: scratchpad/effected/npm/PublishError.ts:43
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; AGENTS.md Code Laws; D11
- evidence: The message path calls output.trim() directly. EF-5 explicitly covers direct native string helpers; the four reported green laws do not enforce these methods.
- failure: Domain logic retains the prohibited direct native string-helper form.
- fix: Use equivalent effect/String helpers with the same trimming, grammar and indexing behavior. Preserve the upstream test assertions.
- seats: sol-1-12
- group: g2

### npm-30

- file: scratchpad/effected/npm/DependencySpecifier.ts:124
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; AGENTS.md Code Laws; D11
- evidence: Named protocol/string parsing repeatedly calls startsWith, slice and trim directly. EF-5 explicitly covers direct native string helpers; the four reported green laws do not enforce these methods.
- failure: Domain logic retains the prohibited direct native string-helper form.
- fix: Use equivalent effect/String helpers with the same trimming, grammar and indexing behavior. Preserve the upstream test assertions.
- seats: sol-1-12
- group: g1

### npm-31

- file: scratchpad/effected/npm/PackageManagerPin.ts:221
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; AGENTS.md Code Laws; D11
- evidence: The pin parser calls input.slice at :221 and slices the remaining text at :225/:229/:241. EF-5 explicitly covers direct native string helpers; the four reported green laws do not enforce these methods.
- failure: Domain logic retains the prohibited direct native string-helper form.
- fix: Use equivalent effect/String helpers with the same trimming, grammar and indexing behavior. Preserve the upstream test assertions.
- seats: sol-1-12
- group: g1

### npm-32

- file: scratchpad/effected/npm/PackagePublish.ts:271
- class: effect-idiom   severity: required
- standard: effect-laws-v1 laws 13/21; D11
- evidence: parsePackJson decodes S.fromJsonString(S.Unknown) and then PackJson with identical PublishError mapError steps at :272-278; one S.fromJsonString(PackJson) codec expresses the same transformation.
- failure: A single JSON-to-pack transformation is split into two schemas and duplicate boundary mappings.
- fix: Use S.fromJsonString around the existing PackJson union and one decode/mapError, preserving accepted JSON forms and later result selection. Remove PackJsonString. Keep the native-JSON cause-class bookkeeping in codemod-3.
- seats: fable-1-4
- group: g2

### npm-33

- file: scratchpad/effected/npm/index.ts:78
- class: law   severity: required
- standard: D2; .patterns/error-handling.md public typed-error contract
- evidence: RegistryCredential.ts exports InvalidBasicAuthUsernameError, used by barrel-exported basicCredentialFromPair, but index.ts:78-84 does not re-export the error.
- failure: A public-entry consumer cannot name the public credential error. This is a missing code export, beyond merely recording an added export.
- fix: Re-export InvalidBasicAuthUsernameError from the RegistryCredential block in index.ts. Added exports/ledger/Port notes are handled centrally; no bookkeeping file is assigned to this group.
- seats: grok-1-1, fable-1-2
- group: g1

### npm-34

- file: scratchpad/effected/npm/ReleaseAgeGate.ts:70
- class: schema   severity: required
- standard: D9; later 2026-10-09 unforced-divergence ruling; effect-tsgo schemaNumber finite-check exemption
- evidence: AgeMinutes is S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isFinite()); S.Finite already supplies the finite check. The report identifies duplicate issues for Infinity, while the oracle Number.check(nonnegative, finite) already rejects it and is exempt from schemaNumber.
- failure: The replacement itself changes failure issues by applying the finite constraint twice; this is more than recording a forced Number-to-Finite change.
- fix: Restore the exempt upstream S.Number.check(S.isGreaterThanOrEqualTo(0), S.isFinite()) composition and any test lines changed solely for the redundant replacement. Preserve the original order of checks. S2 owns the associated comment adaptation.
- seats: fable-1-14
- group: g6

### npm-35

- file: scratchpad/effected/npm/NpmExecutor.ts:12
- class: effect-idiom   severity: required
- standard: D9; later 2026-10-09 unforced-divergence ruling; law 22 permits Effect.fnUntraced
- evidence: The extracted command helper uses Effect.fn("command"); oracle NpmExecutor#command:130-144 used inline Effect.gen without a span.
- failure: The lab adds a named trace span even though the effect-fn law can be met without that observable addition.
- fix: Use Effect.fnUntraced for the extracted helper, preserving the required function idiom and upstream tracing behavior. Restore any oracle assertions rewritten for the new span; do not merely rename and record it.
- seats: fable-1-15
- group: g5

### npm-36

- file: scratchpad/effected/npm/PackagePublish.ts:234
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; AGENTS.md Effect helper preference; D11
- evidence: hex builds an array then calls native map/padStart/join. The report cites effect/encoding/Hex.encode with the same lowercase two-digit byte representation.
- failure: A domain encoder uses direct native array/string helpers despite an equivalent Effect encoding primitive; this is a cited idiom violation, not a measured-performance claim.
- fix: Use effect/encoding/Hex.encode for the digest and delete hex. Preserve the upstream packed-tarball SHA-256 expected bytes in PackagePublish.test.ts.
- seats: fable-1-17
- group: g2

### allow-1

- file: scratchpad/effected/npm/DependencySpecifier.ts
- class: law   severity: required
- standard: beep-laws/no-native-runtime; later 2026-10-09 schema-statics ruling
- evidence: Allowlist entry: file scratchpad/effected/npm/DependencySpecifier.ts, kind object-method; reason: Object.assign attaches statics to the branded schema whose decoder captured it. Live attachment is at :420.
- failure: The operator removed this exception: native schema-static attachment must be replaced.
- fix: Replace Object.assign augmentation with an S.Opaque class exposing explicit static members and the annotated branded schema. Wire decode and FromString to the new public schema consistently; retain branded-string behavior and all upstream statics. Retarget affected schema-representation/identity assertions in DependencySpecifier.test.ts. No Object.defineProperties workaround; central codemod removes the exception and records the deviation.
- seats: allowlist:EFFECTED-NPM-SCHEMA-STATICS
- group: g1
- kind: object-method

### allow-2

- file: scratchpad/effected/npm/IntegrityHash.ts
- class: law   severity: required
- standard: beep-laws/no-native-runtime; later 2026-10-09 schema-statics ruling
- evidence: Allowlist entry: file scratchpad/effected/npm/IntegrityHash.ts, kind object-method; reason: Object.assign attaches statics to branded schemas used by conversion codecs. Live attachments are at :158 and :480.
- failure: The operator removed this exception: both native static attachments must be replaced.
- fix: Use S.Opaque classes with explicit static members for augmented integrity schemas, with coherent codec/decoder wiring and identity annotations. Retain upstream names, branded strings and conversion behavior. Retarget schema-identity assertions in IntegrityHash.test.ts and PackageManagerPin.test.ts to the new representation. No Object.defineProperties workaround; central codemod removes the exception and records the deviation.
- seats: allowlist:EFFECTED-NPM-SCHEMA-STATICS
- group: g1
- kind: object-method

## Backlog

### backlog-1

- file: scratchpad/effected/npm/README.md:274
- class: docs   severity: backlog
- standard: D4; S2 pending
- evidence: Attribution contains a leaked DependencySection.ts:10 grep/comment fragment about KIND_TO_FIELD.
- failure: The attribution list contains a source-comment fragment.
- fix: Delete the leaked bullet during S2, leaving Port-notes bookkeeping to the central codemod.
- seats: grok-1-5, fable-1-19
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-2

- file: scratchpad/effected/npm/README.md:3
- class: docs   severity: backlog
- standard: D4; section 10.3; law 2; S2 pending
- evidence: Upstream badges, plugin/stability text and Install remain; examples use @effected/npm and root effect imports at :49-203.
- failure: The README teaches upstream installation/imports and retains forbidden example imports.
- fix: During S2 apply the prescribed lab README adaptation and rewrite examples to the lab path and dedicated Effect imports. The added-export-record fragment of sol-1-15 is deduped into codemod-4.
- seats: sol-1-15, fable-1-20
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-3

- file: scratchpad/effected/npm/index.ts:1
- class: docs   severity: backlog
- standard: D4; sections 10.1/10.2; S2 pending
- evidence: Oracle src/index.ts:1-14 explains resolver contracts, no-op layers, typed errors, consumer implementations and Manifest; the port begins with imports.
- failure: The module overview prose was dropped.
- fix: Carry the oracle overview into the correct documentation carrier during S2, preserving its substance and adapting import paths; do not introduce an @module tag.
- seats: sol-1-14, fable-1-21
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-4

- file: scratchpad/effected/npm/CatalogResolver.ts:38; scratchpad/effected/npm/RegistryCredential.ts:9; scratchpad/effected/npm/ReleaseAgeGate.ts:160
- class: jsdoc   severity: backlog
- standard: JSDoc documentation law; section 10.2; S2 pending
- evidence: Public blocks retain @example/@remarks and lack canonical tags/examples; the new credential error has converted carriers beside upstream ones. PartialReleaseAgeGate prose still says it does not constrain ageMinutes despite S.Finite.
- failure: Documentation carriers and the finite-age explanation need the deferred S2 pass.
- fix: Convert carried prose to titled Examples and prescribed metadata; update the finite-age/combination remarks to the actual schema. Do not perform ledger/Port-note recording here.
- seats: sol-1-13, fable-1-22, fable-1-3, fable-1-14
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-5

- file: scratchpad/test/npm/DependencySpecifier.test.ts:102
- class: test   severity: backlog
- standard: effect-vitest-canon D5; section 11.2; S3 pending
- evidence: Option assertions test isSome/isNone booleans or compare containers; registry/publish tests contain similar variant-only assertions.
- failure: Tests lack canonical variant-and-payload assertions.
- fix: During S3 use assertSome/assertNone and Result/Exit helpers with expected payloads/Causes, preserving oracle meaning.
- seats: sol-1-16
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-6

- file: scratchpad/test/npm/PackageTarball.test.ts:69; scratchpad/test/npm/PackagePublish.test.ts:65
- class: test   severity: backlog
- standard: effect-vitest-canon D14; section 11.2; S3 pending
- evidence: scenario and the publish wrapper provide effectful fixture layers per call with Effect.provide.
- failure: Effectful acquisition/scope ownership has not been migrated to it.layer.
- fix: During S3 move effectful fixtures to it.layer; retain per-test provision for pure stubs.
- seats: sol-1-17
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-7

- file: scratchpad/test/npm/IntegrityHash.test.ts:1
- class: test   severity: backlog
- standard: D10; section 11.4; S3 pending
- evidence: The seat searched all npm tests and found no property-test calls, Arbitrary imports or fcRuns usage.
- failure: Generated schema/codec round-trip and parser/formatter fidelity/idempotence properties are missing.
- fix: During S3 add the canonical Arbitrary.schema/fcRuns properties while retaining all oracle suites. The specific manifest bug regression is already required under npm-1.
- seats: sol-1-18
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-8

- file: scratchpad/effected/npm/NpmExecutor.ts:104; scratchpad/effected/npm/PackagePublish.ts:358
- class: effect-idiom   severity: backlog
- standard: D11; law 21 helper preference
- evidence: Adjacent O.getSomesStruct spreads each contain one key in executor construction and publish outcome assembly. The report calls this cosmetic and shows no bug or performance regression.
- failure: Equivalent spreads could be expressed in fewer helper calls; no required failure is established.
- fix: Optionally collapse adjacent calls into one heterogeneous struct per site when this code is next touched; backlog under D11.
- seats: fable-1-16
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-9

- file: scratchpad/test/npm/CatalogResolver.test.ts:30; scratchpad/test/npm/Manifest.test.ts:110; scratchpad/test/npm/reachability.test.ts:102
- class: test   severity: backlog
- standard: D5; section 11.2; S3 pending; laws exclude tests by default
- evidence: Test doubles use nested native Maps, and reachability collects filenames in a Set; the report explicitly notes the source law gate excludes tests.
- failure: Test fixture/collection idioms remain to be migrated, without a reported source-domain bug.
- fix: During S3 use HashMap fixtures with Option lookup and a HashSet for reachability; retain the original fixture behavior and assertions.
- seats: fable-1-23
- disposition: deferred S2/S3 or outside D11; excluded from required.json

### backlog-10

- file: scratchpad/test/npm/NpmRegistry.test.ts:1; scratchpad/test/npm/PackageTarball.test.ts:1; scratchpad/test/npm/PackagePublish.test.ts:1; scratchpad/test/npm/reachability.test.ts:1
- class: tsgo   severity: backlog
- standard: S3 pending; repo lint:tsgo-rules directive policy
- evidence: These four tests contain skip-file diagnostics for strictEffectProvide, nodeBuiltinImport and/or asyncFunction. The report notes 232 such lines lab-wide and proposes a lab-wide policy decision.
- failure: The test-rule enforcement claim is qualified by directives; repo policy remediation cannot be assigned to this module.
- fix: Module-local test-canon replacements belong to S3. Any proposed repo-wide directive policy or checker/config change is backlog because it is outside the port's write surface; never assign root configuration to a group.
- seats: fable-1-24
- disposition: deferred S2/S3 or outside D11; excluded from required.json

## Handled by the deviation codemod

### codemod-1

- file: scratchpad/effected/npm/RegistryCredential.ts:105; scratchpad/effected/npm/NpmRegistry.ts:383; scratchpad/effected/npm/PackagePublish.ts:452
- class: law   severity: backlog
- standard: D9; section 14; later 2026-10-09 per-module/per-class deviation codemod ruling
- evidence: RangeError became InvalidBasicAuthUsernameError and native Error die defects became UnstubbedRegistryMethodError/UnstubbedPublishMethodError. PackagePublish.test.ts:650 changed the expected error class; ledger deviations and README Deviations are empty.
- failure: The law-forced tagged-error systemic change is not recorded.
- fix: The central codemod records one npm tagged-errors class with all sites and adjusted upstream assertions. Keep the typed error replacement; npm-4 separately fixes the expected-failure channel. No group edits the ledger or Port notes.
- seats: grok-1-1, fable-1-1
- disposition: central per-module, per-class codemod; excluded from required.json

### codemod-2

- file: scratchpad/effected/npm/ReleaseAgeGate.ts:52; scratchpad/effected/npm/PackagePublish.ts:49; scratchpad/effected/npm/NpmRegistry.ts:123; scratchpad/effected/npm/PublishError.ts:34; scratchpad/effected/npm/PackageTarball.ts:49
- class: schema   severity: backlog
- standard: D9; section 14; later 2026-10-09 S.Finite systemic-class ruling
- evidence: Optional Number fields became Finite in PackagePublish sizes/counts (:49-51, :93/:95/:97), registry status, publish exitCode, tarball status and PartialReleaseAgeGate.ageMinutes; the record is absent.
- failure: Non-finite accepted-input changes forced by schemaNumber are unrecorded.
- fix: The central codemod records one npm finite-number class listing every site and adjusted tests, or no adjusted test where none changed. Keep forced S.Finite fields. The already-finite AgeMinutes duplicate-check defect is required under npm-34, and stale explanatory prose is backlog-4.
- seats: grok-1-3, fable-1-3
- disposition: central per-module, per-class codemod; excluded from required.json

### codemod-3

- file: scratchpad/effected/npm/PackagePublish.ts:271
- class: law   severity: backlog
- standard: D9; section 14; later 2026-10-09 native-runtime systemic-class codemod ruling; preferSchemaOverJson
- evidence: The JSON.parse-to-schema-codec rewrite changes malformed-JSON PublishError.cause from SyntaxError to SchemaError; PackagePublish.test.ts:375 checks only kind.
- failure: The forced native-JSON replacement cause-class change is unrecorded.
- fix: Include the JSON parsing/cause replacement in the central per-module native-runtime deviation record. The transformation consolidation itself is separately required as npm-32.
- seats: fable-1-4
- disposition: central per-module, per-class codemod; excluded from required.json

### codemod-4

- file: scratchpad/effected/npm/index.ts; scratchpad/effected/npm/RegistryCredential.ts; scratchpad/effected/npm/IntegrityHash.ts; scratchpad/effected/npm/DependencySpecifier.ts
- class: law   severity: backlog
- standard: D2; later 2026-10-09 exportsAdded codemod ruling
- evidence: Seat fixes request Added exports/exportsAdded records for the new credential error, schema type companions, literal-domain values and schema-backed data values; current records say None/empty.
- failure: Added-export bookkeeping has not been regenerated.
- fix: The central codemod inventories actual final additions in exportsAdded and README Port notes once the code wave is integrated. This record assigns no source/export change: required code fixes, including the missing error re-export, stay in their required records.
- seats: grok-1-1, fable-1-2, sol-1-7, fable-1-10, fable-1-11, fable-1-13, sol-1-15, fable-1-25
- disposition: central per-module, per-class codemod; excluded from required.json

## Rejected

None. No complete seat finding lacked evidence/a concrete fix, contradicted an operator ruling, or merely repeated an enforced green gate without a demonstrated gap. Redundant reports are merged above, not counted as rejected.

