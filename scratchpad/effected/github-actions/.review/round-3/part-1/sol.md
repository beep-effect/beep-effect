### sol-3-1
- file: scratchpad/effected/github-actions/Artifact.ts:489
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-1 and EF-31; EFFECTED_PORT_GOAL.md D11 and section 14’s verified-upstream-bug route.   evidence: A read-only differential probe used a no-op filesystem, stubbed process handle, recording RPC client, and counting transport. With `retentionDays` equal to `NaN`, `Infinity`, or `1e20`, both the lab and pinned oracle uploaded once and called `CreateArtifact`, then failed through the defect channel without calling `FinalizeArtifact`. The lab defect was `IllegalArgumentError: Invalid date`; the oracle defect was `RangeError: Invalid Date`. The `<= 0` guard admits all three values.
- failure: Invalid caller options fail after the artifact has been created and its bytes uploaded. Callers expecting `ArtifactError` cannot recover through that typed channel, and the upload remains unfinalized.
- fix: Validate retention and compute a representable expiration before entering the archive/create/upload sequence. Return `ArtifactError` with `reason: "invalidOptions"` for non-finite values or expiration overflow. Preserve omitted retention and valid positive values. Add regressions asserting typed failure and zero archive, RPC, and transfer calls; record the verified upstream bug under D9.

### sol-3-2
- file: scratchpad/effected/github-actions/BlobEnvelope.ts:330
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D10’s codec fidelity requirement, D11, and section 14; BlobEnvelope’s typed metadata encode/decode contract.   evidence: A read-only `bun --eval` differential probe called `encodeResult(O.some("hello"), new Uint8Array([42]), S.Option(S.String))`, then decoded the successful frame with the same schema. Both the lab and pinned oracle returned `encode: Success`, followed by `decode: Failure` with `BlobMetadataDecodeError`. The current properties exercise JSON-compatible struct metadata and miss this case.
- failure: Encoding can report success for a frame that its own metadata codec cannot subsequently read. `GitHubCacheBlobStore.put` can therefore publish an immutable cache entry successfully while every corresponding `get` fails.
- fix: Before returning framed bytes, verify that the serialized metadata decodes through the caller’s codec. Map failure to `BlobMetadataEncodeError`, preserving the existing wire format for supported metadata. Add the `S.Option(S.String)` regression and retain successful coverage for `S.OptionFromNullOr(S.String)`; record the verified upstream bug under D9.

### sol-3-3
- file: scratchpad/effected/github-actions/ActionState.ts:185
- class: bug   severity: required
- standard: ActionStateShape.save’s documented plain-JSON preservation guarantee at ActionState.ts:111; EFFECTED_PORT_GOAL.md D9, D11, and section 14.   evidence: A read-only differential probe captured runner-file output in memory. In both the lab and pinned oracle, `save("payload", NaN, S.Unknown)` succeeded, wrote JSON `null`, and a later `get("payload", S.Unknown)` returned `null`. The current check only verifies that the parsed value is accepted by the schema; it never establishes that the encoded value survived serialization. An installed-Effect probe confirmed that `S.decodeUnknownResult(S.Json)(NaN)` fails.
- failure: A successful save silently changes the state value across the phase boundary despite the documented promise to reject encoded values that do not survive JSON. Permissive codecs also allow undefined object fields to disappear undetected.
- fix: Validate the schema’s encoded value against `S.Json` before serialization, mapping rejection to the existing `notPlainJson` error. Retain the subsequent caller-schema decode check. Add regressions for `NaN` and an undefined object member, asserting typed refusal before runner-file append; record the verified upstream bug under D9.

### sol-3-4
- file: scratchpad/effected/github-actions/ActionInput.ts:717
- class: bug   severity: required
- standard: ActionInput.provider’s supplied-environment lookup contract; EFFECTED_PORT_GOAL.md D11 and section 14’s verified-upstream-bug route.   evidence: A read-only differential probe supplied `Object.create({ INPUT_TOKEN: "prototype-token" })` to `ActionInput.provider` and loaded `Config.String("token")`. Both the lab and pinned oracle returned `"prototype-token"`, although the supplied record contained no own environment entries. The alias map enumerates own entries through `R.toEntries`, but the direct lookup reads inherited entries through `env[name]`. The recorded ActionEnvironment deviation fixes a separate lookup implementation and does not cover this provider.
- failure: An absent input can become present through the environment object’s prototype. An inherited runner-prefixed value can also override a legitimate own bare-name entry.
- fix: Replace the direct indexed read with `O.getOrUndefined(R.get(env, name))`, retaining direct-entry precedence, alias fallback, and empty-string handling. Add regressions for inherited-only input and inherited runner-name shadowing of an own bare-name input; record the verified upstream bug under D9.

### sol-3-5
- file: scratchpad/effected/github-actions/ActionInput.ts:74
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; EFFECTED_PORT_GOAL.md D5 and D11.   evidence: On the reviewed commit, `PairsOptions` remains an exported interface containing the representable configuration field `requireValue?: boolean`. A module-wide symbol search finds its interface, consumers, examples, and type re-export, but no corresponding runtime schema. This declaration remains intact despite the reported green gates.
- failure: This public configuration payload has no executable schema source of truth from which its type, guard, annotations, or arbitrary can be derived.
- fix: Define an identity-annotated `PairsOptions` struct and derive the existing same-name type from it. Preserve optional-field semantics and the current `false` default at the call site. Add its schema-derived round-trip property and record any added public value export through the existing port bookkeeping.

### sol-3-6
- file: scratchpad/effected/github-actions/ActionLogger.ts:176
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; EFFECTED_PORT_GOAL.md D5 and D11.   evidence: `WithBufferOptions` at line 176 and `WithStepOptions` at line 210 remain exported interfaces for optional literal/string configuration fields. A module-wide symbol search finds no runtime schemas for either. These are pure data payloads, with no service methods or type-level constructs requiring the TypeScript-only exception, and both declarations survive the reported green gates.
- failure: Buffer and step configuration remain outside the required schema source of truth; their types and finite option domain cannot derive runtime validation or property generation from a shared model.
- fix: Define identity-annotated structs for both option payloads and derive their existing same-name types. Preserve plain-object callers, optional-field semantics, default flushing, and default summary behavior. Add schema-derived round-trip properties and record any added public value exports.

### sol-3-7
- file: scratchpad/effected/github-actions/Artifact.ts:157
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; EFFECTED_PORT_GOAL.md D5 and D11.   evidence: `UploadOptions` at line 157, `DownloadOptions` at line 205, and `DownloadResult` at line 217 remain exported interfaces containing only representable numeric/string fields. A module-wide symbol search finds no corresponding runtime schemas. By contrast, adjacent `ArtifactItem`, `UploadResult`, and `ArtifactRef` already derive their types from schemas. The remaining interfaces are present on the commit whose gates are reported green.
- failure: Artifact configuration and the download result lack the executable contracts required for pure configuration/result payloads. Their types, annotations, guards, and arbitraries cannot derive from a schema source of truth.
- fix: Define identity-annotated structs and derive the existing same-name types. Preserve plain-record inputs/results, absent and explicit-undefined option fields, defaults, and compression clamping; apply the separately evidenced retention validation fix without unrelated acceptance changes. Add schema-derived round-trip properties and record any added public value exports.

REQUIRED: 7
BACKLOG: 0