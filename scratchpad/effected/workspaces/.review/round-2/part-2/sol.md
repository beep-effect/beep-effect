### sol-2-1
- file: scratchpad/effected/workspaces/PeerCheck.ts:345
- class: bug   severity: required
- standard: D9 and §14, verified upstream bug; `PeerCheck.run` requires uncovered link targets to retain `unresolvedEdge`.   evidence: A read-only `bun -e` probe changed the root dependency in `fixtures/peers/linkdeep-root/pnpm-lock.yaml` to `version: link:/packages/a`, then supplied a manifest located at `/repo/packages/a` with `relativePath: "packages/a"` and a `react: "^18.0.0"` peer. Both the reviewed port and pinned oracle returned `unverified: []` and reported that internal manifest’s missing `react` peer. The repaired `link:../packages/a` control correctly returned `unverified: ["unresolvedEdge"]` without a fabricated peer.
- failure: Normalization discards the leading slash, conflating the absolute target `/packages/a` with the workspace-relative target `/repo/packages/a`. An external dependency is attributed to an unrelated internal manifest and presented as verified. This is new absolute-path evidence beyond round-1 r16’s leading-`..` cases.
- fix: Preserve absolute-path identity during link normalization so an absolute target cannot match a relative manifest key. Leave an unmatched absolute target uncovered and retain `unresolvedEdge`; add the absolute-target regression and record the verified upstream-bug deviation.

### sol-2-2
- file: scratchpad/effected/workspaces/ReleaseTag.ts:257
- class: bug   severity: required
- standard: D9 and §14, verified upstream bug; `TrackingTag.forVersion` documents “Total, never throwing” at line 225.   evidence: Read-only probes against both the reviewed port and pinned oracle returned `["v1", "v1.2"]` for `forVersion("1.2.3", {})`, but threw `Schema validation failed` for `forVersion("1.2.3", { packageName: "" })`, including with `precision: "major"`. The public options type accepts that string, while construction rejects it through `TrackingTag.fields.packageName`.
- failure: A valid version and a type-correct options object synchronously abort alias derivation. The numeric checks added for round-1 r19 do not cover this independent constructor failure.
- fix: Check a supplied package name against the existing field schema before constructing aliases and return `[]` when it cannot be represented. Add the empty-name regression with omitted-name and valid-name controls, and record the verified upstream-bug deviation.

### sol-2-3
- file: scratchpad/effected/workspaces/PackedInstall.ts:286
- class: schema   severity: required
- standard: `standards/effect-first-development.md`, cause-carrying error requirement at line 1091: explicitly use `S.Defect({ includeStack: true })`; D11.   evidence: A read-only encoding probe constructed `PackedInstallError` with `cause: new Error("original")`. `S.encodeSync(PackedInstallError)` produced `cause: { name: "Error", message: "original" }`; the stack-preservation check returned `false`. Round-1 r01 addressed three other error schemas and did not include `PackedInstallError`.
- failure: Encoding a packing, installation, discovery, or IO failure loses the originating exception’s stack. The green gates do not establish this required serialization behavior.
- fix: Replace `S.optionalKey(S.Defect())` with `S.optionalKey(S.Defect({ includeStack: true }))`, retaining the field annotation and optionality. Add one assertion that encoding an originating error preserves its stack.

### sol-2-4
- file: scratchpad/effected/workspaces/PackedInstall.ts:836
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.   evidence: `PackedInstallPreflight` and `PackedInstallGate` at line 850 remain handwritten interfaces. Other directly representable pure models include `BinProvenance` at line 361, `PackSource` at line 71, `PackedInstallClosureOptions` at line 87, `BinCommandOptions` at line 297, and `PackedInstallPreflightOptions` at line 822. A read-only module-export probe confirmed that none has a runtime value. The accepted schema-first deviation identifies `Replacement` and `ClosurePlan`, but grants no exception for these remaining models.
- failure: Preflight results, gate actions, provenance, and configuration remain outside the executable schema contract. Their runtime guards, codecs, and generated values cannot derive from the declarations. In particular, the named `run | skip | fail` result domain remains a type-only union.
- fix: Define annotated structural schemas for these pure models and derive their existing types. Use a named `LiteralKit` for gate actions. Preserve the current plain-object inputs/results, optional versus explicitly undefined fields, and behavior; no additional runtime rejection is needed.

### sol-2-5
- file: scratchpad/effected/workspaces/PeerCheck.ts:634
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33 and EF-13; `standards/effect-laws-v1.md` laws 17 and 20; D5 and D11.   evidence: The named, repeatedly constructed `Verdict` and `JoinedVerdict` domain results remain handwritten tagged unions at lines 634 and 645. `PeerCheckOptions` at line 142, `Walk` at line 323, and `LinkEdge` at line 362 also remain type-only pure data models. Existing schemas already represent their constituent package, parent, policy-data, and reason values; these declarations are not service contracts or overload machinery. The public export probe confirmed that `PeerCheckOptions` has no schema value.
- failure: The peer-judgment state machine has no executable source of truth for its satisfied, unsatisfied, and unjudged variants. Variant payloads and construction sites are maintained independently, and the remaining pure input/traversal models cannot supply schema-derived guards or arbitraries.
- fix: Model the verdict variants with annotated tagged-union schemas and derive the existing types. Add structural schemas for the cited pure options and traversal payloads, reusing existing component schemas. Preserve discriminator strings, payloads, optionality, and all current judgment behavior.

### sol-2-6
- file: scratchpad/effected/workspaces/ReleaseTag.ts:58
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.   evidence: `TagFormatOptions`, `TrackingTagOptions` at line 128, and the named internal `VersionCore` at line 80 remain handwritten interfaces. They contain only schema-representable strings, numbers, booleans, and a finite precision choice. Read-only export inspection confirmed that neither public options model has a runtime schema. Round-1 r21’s conversion of `TagClassification` does not cover these declarations.
- failure: Formatting configuration and the intermediate parsed-version payload remain type-only sources of truth. Their accepted shapes and optionality cannot derive runtime validation or generated schema laws, leaving the required schema-first migration incomplete.
- fix: Add annotated structural schemas and derive the same-name types, preserving current structural inputs and optionality. Derive `VersionCore` from a module-local schema without changing version parsing or construction behavior.

### sol-2-7
- file: scratchpad/effected/workspaces/SourceBoundary.ts:270
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.   evidence: `ScanOptions` and `ReferenceOptions` at line 93 remain interfaces containing only strings, arrays, existing `BoundaryRule` values, and optional rule-to-pattern mappings. A read-only module-export probe confirmed that neither has a runtime schema. Round-1 r22 converted `BoundaryRule` and `BoundaryFixture`, but these separate configuration models remain unmodeled.
- failure: Scanner configuration, including the path-specific waiver policy, has no executable schema source of truth. Its key domains and optionality are maintained independently of the schemas that already own rules and offences.
- fix: Define annotated structural schemas, reuse `BoundaryRule` and `OffenceRule`, and derive the existing option types. Preserve omitted and explicitly undefined options, optional waiver keys, defaults, and current scan behavior.

### sol-2-8
- file: scratchpad/effected/workspaces/VersioningStrategy.ts:110
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.   evidence: `VersioningDetectOptions` remains an interface repeating the optional nested-string-array `fixedGroups` shape already owned by the `ClassifyOptions` schema at line 92. A read-only export probe confirmed `VersioningDetectOptions` has no runtime value. This declaration was not among the `ClassifyOptions` and `PackageRelease` conversions required by round-1 r21.
- failure: Detection and classification maintain separate definitions of the same lockstep-group configuration. Schema-derived guards, codecs, and arbitraries are unavailable for detection options, and future changes can drift between the two definitions.
- fix: Derive an annotated `VersioningDetectOptions` schema by picking `fixedGroups` from `ClassifyOptions`, then derive its same-name type. Preserve optionality and the current behavior of `detect`.

REQUIRED: 8
BACKLOG: 0