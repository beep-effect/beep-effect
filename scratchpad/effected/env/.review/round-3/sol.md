### sol-3-1
- file: scratchpad/effected/env/Audience.ts:114
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5, “Schemas Are Executable Contracts”; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-33; D5/D11.   evidence: `AudienceOptions` remains an exported handwritten interface containing only `readonly envVar?: string`. This is a pure configuration payload, which the cited standards explicitly require to be schema-owned. It contains no operations, overloads, or type-level machinery requiring the interface carve-out. The round-2 inventory does not cover this model; the green gates do not enforce configuration-payload schema ownership.
- failure: The audience configuration has no schema value from which its runtime contract, field metadata, guard, codec, or arbitrary can be derived. Its public type disappears at runtime instead of coming from the required executable contract.
- fix: Replace the interface with an identity-annotated `AudienceOptions = S.Struct({ envVar: S.optionalKey(S.String) })`, annotate the field, and derive `export type AudienceOptions = typeof AudienceOptions.Type`. Preserve ordinary option objects, omitted-key semantics, all accepted strings, and the existing type-only barrel export.

### sol-3-2
- file: scratchpad/effected/env/RuntimeEnv.ts:122
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-33; D5/D11.   evidence: `RuntimeEnvOverrides` remains an exported handwritten three-field configuration interface. Its fields contain only optional `Option` values whose component schemas already exist: strings, `CiName`, and `DetectedTerminal`. The earlier finding about the duplicated terminal member was fixed by deriving that member from `DetectedTerminal.Type`; it did not establish schema ownership of the enclosing overrides payload. None of the green gates checks that remaining requirement.
- failure: The overrides configuration still lacks a schema-derived runtime contract and metadata for its three fields. Reusing a schema-derived nested type does not give the enclosing configuration a validator, codec, equivalence, or arbitrary.
- fix: Define an identity-annotated `RuntimeEnvOverrides` `S.Struct` with optional keys wrapping the corresponding `S.Option` schemas, and derive its same-name type. Preserve plain objects, absent keys, explicit `None` overrides, existing terminal values, and `layerTest` behavior; retain the type-only barrel export.

### sol-3-3
- file: scratchpad/effected/env/TerminalEnv.ts:96
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-33; Effect `SCHEMA.md`, “Mapping all fields at once”; D5/D11.   evidence: `TerminalEnvTestOptions` remains an exported handwritten configuration interface containing an optional boolean and two optional partial stream snapshots. These are pure values. `StreamEnv` already supplies the stream-field schemas, and Effect documents deriving an optional-field struct through `mapFields(Struct.map(S.optionalKey))`. The outer configuration is neither an operational service contract nor solely a type-level utility. The round-2 inventory does not cover its schema ownership, and the green gates miss this omission.
- failure: The terminal test configuration has no executable schema contract. Its outer fields remain independently declared instead of deriving their types and runtime metadata from schemas, despite all component data being representable.
- fix: Derive an annotated partial stream schema from `StreamEnv`, then define an identity-annotated `TerminalEnvTestOptions` `S.Struct` with optional `stdinIsTerminal`, `stdout`, and `stderr` keys. Derive the existing type from it. Preserve plain partial objects, omitted fields, non-finite column values, quiet defaults, and the type-only barrel export.

REQUIRED: 3
BACKLOG: 0