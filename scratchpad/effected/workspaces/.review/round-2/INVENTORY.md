# Workspaces — round-2 merged inventory

Read **12 seats**: `part-1`–`part-4`, each with `grok.md`, `sol.md` and `fable.md`; read every adjacent `BRIEF.md` and `BRIEF.grok3.md`. The fable reports are the documented independent Grok medium fallback. Seat ids include the part because numbering restarts.

**Required: 29 · Backlog: 1 · Codemod: 0 · Rejected: 0 · Groups: 9.** The 38 submitted records are deduplicated by defect; broad schema-model findings are partitioned by independent owning surfaces to meet the six-source-file limit, retaining every contributing seat id.

Merged under the entire operator revision block, D1–D20 and sections 12.4/12.5/14. Seats reviewed `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11` against pinned oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. The checkout is `@lab/effected-2`; workspaces source/tests match the seat commit. Read step-2/laws history and diffs; no required item labels a forced change unforced. The current allowlist has **zero workspaces entries**, so no `allow-*` items are added. r01 accounts for the live sibling-lane HashMap boundary.

`required.json` assigns every source/test file once; dependent composite schemas integrate after their owners. Ledger, README Port notes and added-export bookkeeping remain central. No tests or gates were run. Later vitest runs use `--maxWorkers=2`, one at a time; module-wide coverage uses `beep-heavy --slot-only`.

## Required

### r01 — Remove the remaining native Map backing escape at the lockfile boundary.

- file: scratchpad/effected/workspaces/LockfileReader.ts:323
- class: law   severity: required
- standard: D5/D11; standards/effect-laws-v1.md law 6; Grilling 2026-10-09 native-collection replacement ruling.
- evidence: The reviewed source builds MutableHashMap<string, string> but passes names.backing, a native Map; seats identify the constructor-only native-runtime detector gap. The caller is unchanged since 60fcfb5. The live sibling-lane diff now makes Lockfile.withImporterNames accept HashMap.HashMap<string, string> and use HashMap.get, so a workspaces-only fix is available.
- failure: A native collection escapes domain code and the caller no longer matches the sibling lane's Effect-collection boundary.
- fix: Build the importer-name table as HashMap (or convert the iterable MutableHashMap with HashMap.fromIterable) and pass that Effect collection. Remove .backing and its compatibility comment; preserve empty-name fallback and importer/name order. Use the live sibling HashMap boundary; do not edit lockfiles or any repo configuration.
- seats: part-1/grok-2-1, part-1/fable-2-1
- group: g3

### r02 — Preserve an own __proto__ catalog in subprocess hook replay.

- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:697
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; layerSubprocess's equivalence contract.
- evidence: Sol executed the exact REPLAY_SCRIPT with an identity hook and seed {"__proto__":{"effect":"^4.0.0"},"named":{"foo":"^1"}}: subprocess output retained only named, while layerFrom retained both. The pinned oracle reproduced the subprocess loss. catalogs[name] = {...entries} on {} invokes the inherited __proto__ setter; parent normalization already uses own-key-safe R.fromEntries.
- failure: Switching replay layers silently drops a valid named catalog and changes dependency resolution.
- fix: Construct the child catalog record with an own-key-safe entries operation such as Object.fromEntries inside the standalone script, retaining per-catalog copies and declaration order. Add a regression through the actual subprocess with an own __proto__ seed and a normal-name control. Supply upstream-bug evidence to central bookkeeping; no ledger or Port-notes writes in this group.
- seats: part-1/grok-2-2, part-1/sol-2-1
- group: g1

### r03 — Derive declared manager membership from PackageManagerName.

- file: scratchpad/effected/workspaces/PackageManagerName.ts:650
- class: schema   severity: required
- standard: D5/D11; standards/effect-laws-v1.md law 17; EF-12b.
- evidence: The declared-name branch repeats pnpm/npm/yarn/bun with an OR chain beside the named LiteralKit at :47. Both seats establish equivalence with S.is(PackageManagerName) for the current four literals; LiteralKit.is is per member. No gate enforces this local predicate derivation.
- failure: Manager membership has a second source of truth that can ignore a future schema literal.
- fix: Use S.is(PackageManagerName)(name) in this branch; preserve the runtime ternary, devEngines-first evidence selection and current accepted/rejected names.
- seats: part-1/grok-2-3, part-1/fable-2-2
- group: g3

### r04 — Make importer provenance construction linear in relationships.

- file: scratchpad/effected/workspaces/DuplicateCheck.ts:413
- class: perf   severity: required
- standard: D11, algorithmic-class win; distinct from round-1 b12 (queue shifting).
- evidence: For I importers with one distinct non-workspace root apiece, every importer visits every importerRoots entry and calls paths.includes. Sol's read-only counts were 10,000/40,000/160,000 for 100/200/400 importers, demonstrating Θ(I²) membership work for I relationships. The oracle has the same nesting; this is not a claimed timing regression.
- failure: Even an empty duplicate report pays quadratic provenance work on a sparse, linear-size input/output.
- fix: Record importer-to-instance pairs during root resolution, or retain importer-keyed roots and walk only the matching list. Reduce the provenance pass to O(I + R) while preserving importer order, existing record deduplication and every report value. Add a sparse-input regression for provenance and ordering.
- seats: part-1/grok-2-4, part-1/sol-2-2
- group: g2

### r05 — Give ReplayPayload canonical schema and field identity metadata.

- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:760
- class: schema   severity: required
- standard: Operator revision step 4; D5/D11; standards/effect-first-development.md EF-12.
- evidence: ReplayPayload is a named bare S.Union of success/failure S.Structs; ok/config/name/message/stack lack annotation metadata. Sol's exact-expression probe returned protocolAnnotations: null and an anonymous anyOf with no title/description or definitions. This metadata requirement is not established by the green gates.
- failure: The subprocess protocol remains an anonymous schema boundary after the identity migration.
- fix: Annotate ReplayPayload with $I.annoteSchema("ReplayPayload", ...) and annotate ok, config, name, message and stack fields with identity/meaning metadata. Preserve wire shapes, optionality, strict envelope behavior and tolerant config decoding.
- seats: part-1/grok-2-5, part-1/sol-2-3
- group: g1

### r06 — Preserve cause stacks in all three remaining error schemas.

- file: scratchpad/effected/workspaces/PackedInstall.ts:286; scratchpad/effected/workspaces/WorkspaceDiscovery.ts:95; scratchpad/effected/workspaces/WorkspacePackage.ts:135
- class: schema   severity: required
- standard: D11; standards/effect-first-development.md cause-carrying error requirement (S.Defect({ includeStack: true }), :1091).
- evidence: PackedInstallError uses S.optionalKey(S.Defect()); WorkspaceDiscoveryError and WorkspaceManifestError use S.Defect(). Sol encoded Error("original") causes and obtained only name/message, with stackPresent false; the includeStack control retained stack. Round-1 r01 repaired three different schemas. No gate checks the option.
- failure: Encoding these packing/discovery/manifest errors drops the originating stack.
- fix: Pass { includeStack: true } to all three Defect schemas, retaining each annotation and optionality. Add an encode assertion for each schema that compares the encoded cause stack with the originating Error stack. This is a correction to the schemas themselves, not a bookkeeping-only finding.
- seats: part-2/grok-2-1, part-2/sol-2-3, part-2/fable-2-1, part-3/sol-2-2, part-3/fable-2-2, part-3/fable-2-3
- group: g4

### r07 — Keep absolute link targets distinct from workspace-relative paths.

- file: scratchpad/effected/workspaces/PeerCheck.ts:345
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; uncovered links retain unresolvedEdge.
- evidence: Sol's pinned-oracle/lab probe changed a root edge to link:/packages/a and supplied /repo/packages/a as relativePath packages/a with a react peer. Both reported the internal manifest's missing react and no unresolvedEdge. The repaired link:../packages/a control remained unresolved. Normalization removes the leading slash.
- failure: An external absolute link is attributed to an unrelated workspace manifest and presented as verified.
- fix: Preserve absolute-path identity during normalization so it cannot match a relative manifest key; unmatched absolute targets remain uncovered with unresolvedEdge. Add the absolute-target regression and retain the existing leading-.. controls; central bookkeeping records the verified upstream-bug.
- seats: part-2/sol-2-1
- group: g5

### r08 — Keep TrackingTag.forVersion total for an invalid supplied package name.

- file: scratchpad/effected/workspaces/ReleaseTag.ts:257
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; documented total, never-throwing contract.
- evidence: Sol's lab and pinned-oracle probes returned v1/v1.2 for forVersion("1.2.3", {}) but threw Schema validation failed for {packageName:""}, including precision: major. The options type accepts a string while TrackingTag.fields.packageName rejects this value.
- failure: A valid version with type-correct options synchronously throws instead of producing the total API's result.
- fix: Check a supplied packageName with the existing field schema before constructing aliases and return [] if it is unrepresentable. Add empty-name, omitted-name and valid-name controls; preserve the existing numeric checks and route upstream-bug bookkeeping centrally.
- seats: part-2/sol-2-2
- group: g6

### r09 — Schema-own packed-install configuration, preflight and plan payloads.

- file: scratchpad/effected/workspaces/PackedInstall.ts:71; scratchpad/effected/workspaces/PackedInstall.ts:87; scratchpad/effected/workspaces/PackedInstall.ts:297; scratchpad/effected/workspaces/PackedInstall.ts:361; scratchpad/effected/workspaces/PackedInstall.ts:822; scratchpad/effected/workspaces/PackedInstall.ts:836; scratchpad/effected/workspaces/PackedInstall.ts:850; scratchpad/effected/workspaces/internal/packedInstallPlan.ts:160; scratchpad/effected/workspaces/internal/packedInstallPlan.ts:312
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data). Laws 19/20 for named finite cases.
- evidence: Sol identifies type-only PackSource, PackedInstallClosureOptions, BinCommandOptions, BinProvenance, PackedInstallPreflightOptions, PackedInstallPreflight and PackedInstallGate, plus ConsumerInput/PackedManifest in the internal plan. Inspection confirms representable data fields, including the run/skip/fail action domain; existing Replacement/ClosurePlan conversions do not cover them. Export probes find no runtime schemas.
- failure: These configuration/results and plan payloads retain independent erased models instead of executable schema sources.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Use a named LiteralKit for gate actions and preserve PackSource's string-or-directory shape. Keep stream-bearing/operation-bearing contracts outside this finding. This combines the packed-plan portion of part-4/sol-2-4 with part-2/sol-2-4.
- seats: part-2/sol-2-4, part-4/sol-2-4 (packed-plan portion)
- group: g4

### r10 — Schema-own peer options, traversal payloads and verdict variants.

- file: scratchpad/effected/workspaces/PeerCheck.ts:142; scratchpad/effected/workspaces/PeerCheck.ts:323; scratchpad/effected/workspaces/PeerCheck.ts:362; scratchpad/effected/workspaces/PeerCheck.ts:634; scratchpad/effected/workspaces/PeerCheck.ts:645
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data). EF-13; laws 17/20.
- evidence: PeerCheckOptions, Walk, LinkEdge, Verdict and JoinedVerdict remain handwritten data declarations. Verdict has satisfied/unsatisfied/unjudged payloads; JoinedVerdict is the wanted-bearing variant. Constituent package, parent, rules and reason schemas exist; these are not service or overload contracts.
- failure: The repeatedly constructed/matched peer state machine and its inputs lack schema-owned payloads and variants.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Define schema-backed verdict variants reusing component schemas; keep discriminator strings, null fields, unresolved-link coverage and all peer-judgment behavior.
- seats: part-2/sol-2-5
- group: g5

### r11 — Schema-own tag formatting, tracking options and VersionCore.

- file: scratchpad/effected/workspaces/ReleaseTag.ts:58; scratchpad/effected/workspaces/ReleaseTag.ts:80; scratchpad/effected/workspaces/ReleaseTag.ts:128
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data).
- evidence: TagFormatOptions, TrackingTagOptions and VersionCore remain interfaces of strings/numbers/booleans and finite precision. Sol's export probe finds no public options schema; the earlier TagClassification conversion does not cover them.
- failure: Tag options and parsed-version payloads remain erased sources of truth.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Keep VersionCore module-local and preserve version parsing and alias construction.
- seats: part-2/sol-2-6
- group: g6

### r12 — Schema-own scanner options and lexical source payloads.

- file: scratchpad/effected/workspaces/SourceBoundary.ts:93; scratchpad/effected/workspaces/SourceBoundary.ts:270; scratchpad/effected/workspaces/internal/sourceText.ts:32; scratchpad/effected/workspaces/internal/sourceText.ts:49
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data).
- evidence: ScanOptions/ReferenceOptions contain representable strings, arrays, BoundaryRule values and optional waiver mappings. SourceLiteral/LexedSource contain offsets, raw strings and literals. All remain interfaces and the options export probe finds no schema; BoundaryRule/BoundaryFixture's round-1 conversions do not cover these.
- failure: Scanner configuration and lexical payloads are maintained independently of executable boundary schemas.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Reuse BoundaryRule and OffenceRule; preserve optional waiver keys, raw source text, original UTF-16 offsets, code-view lengths and defaults. This includes the lexer-model portion of part-4/sol-2-4.
- seats: part-2/sol-2-7, part-4/sol-2-4 (lexer-model portion)
- group: g7

### r13 — Derive detection options from the shared fixedGroups schema.

- file: scratchpad/effected/workspaces/VersioningStrategy.ts:110
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data).
- evidence: VersioningDetectOptions remains an interface duplicating the optional nested-string-array fixedGroups shape already owned by ClassifyOptions at :92. Sol's export probe finds no runtime value.
- failure: Detection and classification duplicate the lockstep-group configuration contract.
- fix: Derive an annotated VersioningDetectOptions schema by picking fixedGroups from ClassifyOptions, derive its same-name type and preserve optionality and detect behavior. Reuse the existing contract without new defaults or rejection.
- seats: part-2/sol-2-8
- group: g6

### r14 — Annotate the reusable SemVer pattern check itself.

- file: scratchpad/effected/workspaces/ReleaseTag.ts:94
- class: schema   severity: required
- standard: D11; standards/effect-laws-v1.md law 18; EF-12c; schema-first Pattern 2.
- evidence: VersionText uses S.isPattern without its metadata argument. Its enclosing schema annotation does not annotate the filter; the seat cites the Effect AST behavior and the packages-only schema lint scope. The check is shared by versionCore/classifyTag.
- failure: The reusable check lacks identifier, title and description despite its containing schema's identity.
- fix: Pass check metadata with identifier $I`VersionTextPattern`, title "SemVer text", and a description of complete SemVer prerelease/build validity to S.isPattern. Preserve the regex and accepted inputs.
- seats: part-2/fable-2-2
- group: g6

### r15 — Preserve own __proto__ environment variables during scrubbing and layering.

- file: scratchpad/effected/workspaces/PackedInstall.ts:710; scratchpad/effected/workspaces/internal/packedInstallPlan.ts:77
- class: bug   severity: required
- standard: D9/D11 and section 14, upstream-bug; BinCommandOptions.env explicit-entry-wins contract; Effect Record.assignProperty own-key semantics.
- evidence: Both loops use ordinary assignment on {} after R.toEntries, which includes a computed/JSON own __proto__ key. Assigning its string value invokes the inherited setter and defines no own variable. The oracle's layeredEnv has the same defect, and the native-runtime detector does not flag ordinary assignment.
- failure: scrubEnv and command/runBin environment construction lose an explicitly supplied environment variable.
- fix: Use R.assignProperty in both copy loops, preserving undefined removal and scrub precedence. Add an own __proto__ scrubEnv assertion and a command environment layering/removal regression alongside existing scrub controls. Route verified upstream-bug bookkeeping centrally.
- seats: part-2/fable-2-3
- group: g4

### r16 — Keep own replay names in snapshot hook-version projection.

- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:206
- class: bug   severity: required
- standard: D9/D11 and section 14; own-key-safe record ruling; round-1 r30's upstream-bug class.
- evidence: ConfigDependencyHooks now builds replays with R.fromEntries, so __proto__ is an own key and R.toEntries yields it. hookVersionsOf writes its string version into {} with ordinary assignment. A merger read-only Node ESM probe of that exact loop returned throws:false, ownKeys:[], encoded:{}; the seat's claimed TypeError is not supported. The demonstrated key loss still establishes the defect.
- failure: A successful replay named __proto__ disappears from the serializable snapshot hookVersions record.
- fix: Return R.fromEntries of name/replay.version pairs. Add a snapshot regression preserving an own __proto__ replay name and normal names; retain ordering and all replay values. Central bookkeeping records the own-key upstream-bug change. Do not introduce or test the unsupported throwing claim.
- seats: part-3/grok-2-1
- group: g8

### r17 — Derive discovery's dependency-map guard from the owning schema.

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:1078
- class: schema   severity: required
- standard: D5/D11; law 17; EF-12b/EF-35; AGENTS.md schema-derived guards.
- evidence: isStringRecord manually uses P.isObject plus R.values(...).every(P.isString) for four dependency fields. WorkspacePackage.fields.dependencies owns this record; snapshots and WorkspacesSync already use schema-derived guards. Sol's probe confirms equivalence on valid/empty/mixed records, arrays, null and functions; no gate catches this local predicate.
- failure: Discovery maintains a second structural contract that can diverge from decoding and snapshot parsing.
- fix: Use S.is of the existing dependency-field schema (or its underlying record schema when needed for equivalent missing-value handling). Preserve all-or-nothing omission on malformed maps and omitted-map defaults.
- seats: part-3/grok-2-2, part-3/sol-2-3, part-3/fable-2-4
- group: g4

### r18 — Match historical and live Bun top-level catalog assembly.

- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:257
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; WorkspaceSnapshots ref/worktree parity contract; recorded live-reader catalog correction.
- evidence: Sol's scripted-Git probe used array workspaces plus top-level catalog effect:^4.0.0 and catalogs.build.typescript:^6.0.0 with no lockfile: worktree retained both, at(HEAD) returned {}, and catalog: effect resolved Some versus None. bunInlineCatalogs only reads object-workspaces blocks while the repaired live assembler merges top-level then workspaces blocks. Existing parity fixtures cover only nested catalogs.
- failure: An unchanged ref and worktree can resolve catalog dependencies differently; ignored inline values can leave older lockfile values in place.
- fix: Tolerantly normalize top-level catalog/catalogs through CatalogSet.fromBunBlocks, then merge the workspaces-object blocks with workspaces winning. Preserve malformed-input degradation; do not substitute the stricter fromManifestWorkspaces path. Add no-lockfile top-level ref/worktree parity and precedence controls; central bookkeeping owns the deviation.
- seats: part-3/sol-2-1, part-3/fable-2-1
- group: g8

### r19 — Schema-own WorkspaceDiscoveryOptions.

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:267
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data).
- evidence: WorkspaceDiscoveryOptions remains a data-only interface, including cwd, stopAt and discovery configuration. It is separate from the operation-bearing service shape and from the already converted LockfileReaderOptions.
- failure: Discovery configuration still has no runtime schema source of truth.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. This is the discovery-owned portion of the four-options seat finding; preserve lazy cwd and existing discovery/root validation.
- seats: part-3/sol-2-4 (discovery-options portion)
- group: g4

### r20 — Schema-own root, catalog and snapshot options.

- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:56; scratchpad/effected/workspaces/WorkspaceCatalogs.ts:798; scratchpad/effected/workspaces/WorkspaceSnapshots.ts:104
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data).
- evidence: FindWorkspaceRootOptions, WorkspaceCatalogsOptions and WorkspaceSnapshotsOptions remain interfaces of configuration data (stopAt/maxDepth/cwd and seeded catalogs), separate from adjacent service contracts. The existing LockfileReaderOptions deviation does not exempt them.
- failure: Three public configuration payloads have independent erased contracts.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Preserve root validation, inclusive stopAt, seeded-catalog behavior and lazy cwd. This is the non-discovery portion of part-3/sol-2-4, kept in the group owning all three files.
- seats: part-3/sol-2-4 (root/catalog/snapshot-options portion)
- group: g8

### r21 — Schema-own DependencyDiff and its changed-version payload.

- file: scratchpad/effected/workspaces/WorkspacePackage.ts:93
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data).
- evidence: DependencyDiff is a handwritten payload with added/removed records and a changed record of {from,to}. Inspection confirms plain data and field mutability; the earlier native-record repair did not schema-own this model.
- failure: The public dependency-difference result retains a separate type-only contract.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Preserve mutable plain-record results and from/to meanings; this is the package-owned portion of part-3/sol-2-5.
- seats: part-3/sol-2-5 (dependency-diff portion)
- group: g4

### r22 — Schema-own layering/assembly payloads and share ImporterVersions.

- file: scratchpad/effected/workspaces/WorkspaceLayering.ts:73; scratchpad/effected/workspaces/WorkspaceLayering.ts:159; scratchpad/effected/workspaces/WorkspaceCatalogs.ts:90; scratchpad/effected/workspaces/WorkspaceCatalogs.ts:618; scratchpad/effected/workspaces/WorkspaceSnapshots.ts:274; scratchpad/effected/workspaces/WorkspaceStateSnapshot.ts:202
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data). EF-13/law 20 for Place variants.
- evidence: LayeringGraph, Place, ImporterVersions, Assembled and LockfileRecord remain type-only data models. WorkspaceStateSnapshot separately spells the nested importer record schema at :202. Place is a repeatedly constructed/matched kind union, not a service contract.
- failure: Layering cases and assembly values lack schema owners; importer versions have separate type/runtime definitions.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Define a schema-backed Place union; share the annotated ImporterVersions schema with WorkspaceStateSnapshot while preserving its field optionality and decode defaults. This is the remaining four-file portion of part-3/sol-2-5.
- seats: part-3/sol-2-5 (layering/assembly/importer-versions portion)
- group: g8

### r23 — Match cooked Unicode-escaped identifiers without losing source offsets.

- file: scratchpad/effected/workspaces/internal/sourceText.ts:481; scratchpad/effected/workspaces/internal/sourceText.ts:563
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; references whole-identifier and SourceBoundary global-process/import contracts.
- evidence: Sol's exact-commit/oracle probes miss const p = \u0070rocess and escaped \u0072equire("node:process"), though JavaScript executes them as process/require; process\u0078 is incorrectly reported as process at offsets 6/25 though it executes as processx. The round-1 string-specifier cooking repair did not cook identifier tokens.
- failure: Boundary checks miss real forbidden references/imports and flag longer escaped identifiers falsely.
- fix: Recognize Unicode escapes within identifier tokens and compare cooked whole names in references and callee matching. Retain original UTF-16 offsets and raw source views. Add escaped-process, escaped-suffix/longer-identifier and escaped-require regressions, with member-call and invalid-escape controls.
- seats: part-4/sol-2-1
- group: g7

### r24 — Recognize optional standalone require calls.

- file: scratchpad/effected/workspaces/internal/sourceText.ts:563
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; importSpecifiers/importsNode contracts.
- evidence: Sol's lab/oracle probe returns no specifiers or offences for require?.("node:process"), although executing it invokes the supplied require once. wordEndingAt reads punctuation before the opening parenthesis rather than the require identifier; documented lexer exclusions do not cover this syntax.
- failure: A valid optional CommonJS call bypasses the import boundary.
- fix: Recognize ?. immediately before the argument parenthesis, then apply existing standalone-callee and whole-literal-argument checks (including the cooked-identifier repair). Add require?.("node:process") regression and preserve exclusion of unrelated member calls/computed arguments.
- seats: part-4/sol-2-2
- group: g7

### r25 — Annotate MaxDepth's reusable lower-bound check.

- file: scratchpad/effected/workspaces/internal/traverse.ts:29
- class: schema   severity: required
- standard: D11; law 18; standards/effect-first-development.md EF-12c.
- evidence: MaxDepth contains bare S.isGreaterThanOrEqualTo(1). Sol inspected the installed check: identifier/title/description all null; expectation/generation/representation metadata and the enclosing schema annotation do not supply check metadata. The round-1 guard conversion introduced the schema, not a metadata waiver.
- failure: The bound shared by sync and Effect enumeration lacks the required check identity and meaning.
- fix: Pass distinct $I.annote metadata with identifier/title/description to S.isGreaterThanOrEqualTo(1); preserve the predicate, numeric range and failure wording. Do not restore the law-forced schema conversion.
- seats: part-4/sol-2-3
- group: g9

### r26 — Schema-own config-dependency fetch, resolution and grammar payloads.

- file: scratchpad/effected/workspaces/internal/configDependencyFetch.ts:107; scratchpad/effected/workspaces/internal/configDependencyFetch.ts:117; scratchpad/effected/workspaces/internal/configDependencyFetch.ts:237; scratchpad/effected/workspaces/internal/configDependencyResolution.ts:71; scratchpad/effected/workspaces/internal/configDependencyResolution.ts:107; scratchpad/effected/workspaces/internal/configDependencySpecGrammar.ts:26
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data). Law 19 for FetchFailureReason.
- evidence: The seat identifies FetchFailureReason/FetchFailure/RegistrySettings, ResolvedPnpmfile/DeclaredEntry and ConfigDependencySpecParts as type-only named data. Inspection confirms concrete fields and tolerant raw version/integrity splitting, not function-bearing contracts. Registry extraction and failure constructors separately maintain their shapes.
- failure: These boundary/intermediate payloads have no executable schema owners.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Use LiteralKit for FetchFailureReason and reuse HookReplaySource. Preserve required path/integrity keys that permit undefined and the intentionally lenient spec split. This is the three-file config-dependency portion of part-4/sol-2-4.
- seats: part-4/sol-2-4 (config-dependency portion)
- group: g1

### r27 — Schema-own sync discovery, enumeration and supporting traversal payloads.

- file: scratchpad/effected/workspaces/WorkspacesSync.ts:165; scratchpad/effected/workspaces/WorkspacesSync.ts:296; scratchpad/effected/workspaces/WorkspacesSync.ts:320; scratchpad/effected/workspaces/WorkspacesSync.ts:392; scratchpad/effected/workspaces/internal/catalogs.ts:32; scratchpad/effected/workspaces/internal/enumerate.ts:37; scratchpad/effected/workspaces/internal/enumerate.ts:79; scratchpad/effected/workspaces/internal/enumerate.ts:91; scratchpad/effected/workspaces/internal/layerRoot.ts:19; scratchpad/effected/workspaces/internal/patterns.ts:53; scratchpad/effected/workspaces/internal/traverse.ts:38; scratchpad/effected/workspaces/internal/traverse.ts:54
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data). Laws 19/20 for finite failure/result cases.
- evidence: SyncDirectoryEntry/WorkspaceDiscoverySkip/ManifestRead/ResolvedEntry, CatalogMisconfiguration, EnumeratedDirectory/EnumerationFailure/EnumerateOptions, LayerRootOptions, PatternReadFailure and TraversalFrame/TraversalStop remain type-only data. Inspection confirms strings/numbers/booleans/records/unknown causes and finite result cases; operation-bearing filesystem contracts are distinct.
- failure: Sync traversal and its failures/configuration lack executable model ownership.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Represent existing result cases with schema unions without adding wire discriminants, reuse existing literal domains, and keep arbitrary cause values as unknown. This is the six-file sync/traversal portion of part-4/sol-2-4.
- seats: part-4/sol-2-4 (sync/traversal portion)
- group: g9

### r28 — Schema-own the ImporterRoots variants.

- file: scratchpad/effected/workspaces/internal/roots.ts:78
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data). EF-13; law 20.
- evidence: ImporterRoots is the handwritten own/dependencies _tag union of ResolvedPackage or an array of packages; rootInstances constructs and consumers discriminate it. The seat identifies this named domain independently of operation-bearing interfaces.
- failure: Importer root cases and payloads have no executable schema source.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Reuse ResolvedPackage and preserve own/dependencies tags, undefined-for-unresolved semantics and importer order. This is the roots portion of part-4/sol-2-4.
- seats: part-4/sol-2-4 (importer-roots portion)
- group: g2

### r29 — Schema-own composite workspace options.

- file: scratchpad/effected/workspaces/Workspaces.ts:53; scratchpad/effected/workspaces/Workspaces.ts:97
- class: schema   severity: required
- standard: D5/D11; standards/effect-first-development.md EF-12b/EF-33; standards/ARCHITECTURE.md Core Principle 5; standards/schema-first-development-prompt.md (Schema owns pure data).
- evidence: WorkspacesOptions extends discovery/lockfile/catalog configuration and WorkspacesGitOptions adds snapshot options; both remain pure data interfaces. The service type union below them is separate and is not included.
- failure: Composite configuration duplicates/extends erased contracts rather than schema values.
- fix: Define IdentityComposer-annotated structural schemas and derive the existing type names from .Type. Preserve plain-object representations, existing tags, mutability, optional keys versus explicit undefined, accepted inputs, tolerant handling, ordering and lazy defaults. Do not add runtime rejection or eagerly resolve defaults; keep service/operation contracts and complex type utilities as TypeScript types. Compose/reuse the owning option schemas; preserve one uniformly forwarded cwd/stopAt concern and snapshot seedCatalogs. This is the facade-options portion of part-4/sol-2-4; imports may depend on sibling groups' schema additions, but edits stay in Workspaces.ts.
- seats: part-4/sol-2-4 (composite-options portion)
- group: g8

## Backlog

### b01 — Avoid taking the whole source suffix for a member lookup.

- file: scratchpad/effected/workspaces/SourceBoundary.ts:352
- class: perf   severity: backlog
- standard: D11 performance evidence threshold; round-1 b12 calibration.
- evidence: memberAfter iterates code.slice(j) but stops after the identifier; the oracle walks in place and codePointAt is available. No timing was taken. V8 may represent slice as a sliced string, so the seat supplies neither a measured regression nor an engine-independent complexity win.
- failure: The implementation may retain a whole-file suffix to read a short member name; material performance impact is unproven.
- fix: Backlog: walk via codePointAt(code, end) and take only code.slice(j, end), with Unicode/member-boundary controls. Do not require a behavior-changing restore: the report does not demonstrate an unforced semantic change.
- seats: part-2/grok-2-2

## Handled by the deviation codemod

None. No seat submitted a finding whose only concrete request was to record an identity-key, S.Finite, tagged-error, added-export or native-runtime replacement deviation. References to central bookkeeping in required fixes do not create extra required write surfaces.

## Rejected

None. All submitted defects supply evidence and a concrete fix; the unmeasured suffix-slice concern is retained as backlog. The unsupported throwing detail in part-3/grok-2-1 is corrected by the read-only probe in r16, while the demonstrated own-key loss is retained as required.
