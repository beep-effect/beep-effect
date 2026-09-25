# Instance

- id: `m365-tool-error-retryability`
- exact source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- file:line: `packages/drivers/m365-mcp/src/M365Tools.ts:78`
- symbol: `M365ToolError`
- members: `reason`, `retryable`
- status: refreshed P2; no independent P3 or implementation credit.

# Current shape

`M365ToolError` is an exported schema class at `M365Tools.ts:70-91`.
Its reason field is `Option<M365ErrorReason>` decoded from an optional string
key, with a constructor-only None default. Its independently required boolean
is `retryable`. The three other fields are nonempty strings: message,
operation, and toolName. `M365ErrorReason` already owns eight literals at
`packages/drivers/m365/src/M365.errors.ts:42-55`.

The sole production constructor, `M365Handlers.ts:39-48`, copies the driver
reason and derives retryability through its helper at 36-37. All eleven
handlers feed this finalizer (113-180). All eleven tool declarations use this
same failure schema and `failureMode: "return"`, at M365Tools lines
111,137,163,189,215,241,267,293,319,345,371. This app-owned MCP failure schema
is not a literal Graph SDK mirror; its outward encoding requires Tier 2
compatibility rather than D2 dismissal.

# Cardinality gap

The reason has nine states (eight literals plus absence), independently paired
with two booleans, giving 18 representable tuples. E4 is the production
writer's exact policy at `M365Handlers.ts:36-46`: retryable true requires
transport or throttled. The explicit no-reason constructor and wire assertion
at `test/Server.test.ts:182-187,200-205` establishes the ninth supported state.

| Reason | Retryable |
| --- | --- |
| absent | false |
| config | false |
| auth | false |
| request encoding | false |
| response decoding | false |
| response status | false |
| encrypted item | false |
| transport | true |
| throttled | true |

False does not imply absence. Do not replace the reason with an existence bit,
collapse non-retryable reasons, or invent another retry vocabulary. The current
schema accepts inverse tuples, and the arbitrary roundtrip at Server.test
211-227 exercises permissive schema invertibility. Neither makes those tuples
legitimate policy states. Conversely, production presence alone does not
justify dropping the explicitly supported absent/false fixture.

# Target schema

Keep `Option<M365ErrorReason>` as the only semantic retry policy owner. Use a
private annotated semantic `S.Class` containing message, operation, reason,
and toolName, with no retryable member or getter. Its reason field uses
`S.Option(M365ErrorReason).pipe(SchemaUtils.withNoneDefault)`: at this internal
stage the reason is already a runtime Option. Keep the constructor-only None
default so callers can omit reason.

Define an exact private annotated legacy `S.Struct` with the old field order
and field schemas: message, operation, reason, retryable, toolName. Only this
boundary uses `S.OptionFromOptionalKey(M365ErrorReason)` and retains the
required boolean. Reuse named field schemas/key annotations so nonempty
constraints and descriptions do not drift.

Export `M365ToolError` as the annotated legacy struct piped through
`S.decodeTo(SemanticClass, SchemaTransformation.transformEffect(...))`, plus
its same-name `typeof M365ToolError.Type` alias. The transformation decode
receives the legacy struct's decoded Option and validates the boolean against
that reason. Matching input becomes the semantic class fields; mismatch fails
with a `SchemaIssue.InvalidValue`. Encode receives the target's encoded
fields (including runtime Option), projects retryability, and returns legacy
fields in their original order. Preserve the class schema identity/description
annotation and all public key annotations deliberately.

A single colocated boundary derivation may use the existing reason kit guards
and Option matching. Both directions share it. It is not an independently
stored semantic boolean or a generic retry-policy abstraction. `None` maps to
false; only Some(transport/throttled) maps to true. The legacy optional-key
codec then omits None's reason key on encoding.

The local Effect reference confirms decodeTo carries target constructor input
and make types (`Schema.ts:5320-5332`) and accepts getter-backed transformations
at 5388-5394. `SchemaTransformation.transformEffect` at 380-389 supports
schema-issue failure, and `SchemaIssue.InvalidValue` is at 747. A private
runtime prototype confirmed transformed `.make` constructs the target class,
including its omitted-reason default. Do not pass the transformed codec into
`S.Class` as though it were a Struct; the Class overload accepts fields or an
actual Struct (Schema.ts:14686-14713).

# Migration inventory

Paths below are relative to `packages/drivers/m365-mcp/` unless qualified.

- `src/M365Tools.ts:46-91`: replace exported five-field class with private
  semantic class plus legacy codec exported under the original schema/type
  name. Update JSDoc example to inspect reason or explicitly encode a wire
  object; delete its semantic retryable input/read.
- `src/M365Tools.ts:109-377`: retain all eleven failure schema references,
  names, return failure mode, read-only hints, parameters and success codecs.
- `src/M365Handlers.ts:34-53`: keep the error value alias valid against the
  same-name exported type, remove helper at 36-37 and constructor retryable
  argument at 46. Message formatting, operation, Some(error.reason), toolName,
  and Effect error mapping remain unchanged.
- `src/M365Handlers.ts:113-180`: retain each finalizer mapping; no tool-specific
  retry policy is introduced.
- `src/index.ts:41` and `package.json` root/wildcard exports: retain schema and
  type accessibility. The private semantic class is not exported.
- `test/Server.test.ts:50-53,71-74`: keep codecs/equivalence bound to the public
  transformed schema. Generate semantic values from the target schema for the
  property test, so generation cannot manufacture an independent retry flag.
  Prefer the public codec's target Type projection when a class shape is
  needed; do not expose the private model merely for test access.
- `test/Server.test.ts:174-227`: remove decoded constructor flags; preserve
  exact throttled/true and absent/false encoded assertions; extend to all
  nine supported projections and inverse rejection cases.
- `test/Server.test.ts:229-247` and remaining stdio tests: preserve the eleven
  tool names and protocol behavior; add failure-path encoding coverage.
- `packages/drivers/m365/src/M365.errors.ts:42-73`: reuse unchanged reason
  vocabulary/guards. No changes to the driver's error or Graph wire shapes.

Targeted repository search found no other M365ToolError value constructor or
semantic retryable reader beyond the handler, JSDoc, and server test fixtures.
The barrel is a wildcard export, so preserving its name needs no invented
explicit re-export. Absence of in-repo class `new`/`instanceof` consumers does
not prove absence of external consumers.

# Guard-deletion accounting

Remove the decoded retryable field and independent constructor input, the
handler retry helper, its redundant write, and JSDoc's semantic read. There is
no old coherence rejection or legacy normalizer to claim deleted. One boundary
projection and one equality validation remain because the required wire key
must be retained. They cannot produce a semantic object containing two
independent retry policy variables. No code elsewhere gets a compatibility
getter that recreates the removed field.

# Encoded-side impact

Retain all legitimate encoded fields, reason spellings, string constraints,
key order, required keys, optional reason omission, and values. None encodes
without reason and with retryable false. A missing retryable key still fails;
null, explicit undefined, and unknown string reasons remain rejected. No
new wire default, null normalization, reason renaming, or Boolean coercion is
allowed. The nine inverse combinations deliberately become decode failures;
this tightens incoherent permissive schema inputs, not the supported domain.

The public decoded class surface changes to a transformed schema/type and
loses retryable. Keep `.make` for known consumers; construction with `new`,
class identity introspection, and removed field reads are not promised source
compatible. Apply the campaign's decoded-shape migration rider and update
known consumers atomically. Do not claim all public TypeScript behavior is
unchanged or add aliases that retain semantic redundancy. JSON Schema/MCP
failure-schema representation must still describe the legacy encoded keys;
verify the actual tool conversion rather than assuming source schema order
alone establishes protocol compatibility.

# Test impact

A private P2 codec prototype checked all nine supported tuples. Each encoded
`JSON.stringify` result matched the current codec byte-for-byte for fixed
message/operation/toolName values; each inverse decoded under the old codec
and failed under the prototype. It also checked omitted constructor reason,
class construction, absence of decoded retryable, all eleven toolkit names,
and rejection parity for five malformed boundary shapes. This is bounded API
feasibility evidence, not a product implementation or complete MCP proof.

At implementation, retain these exhaustive finite projection assertions with
varied unchanged payload strings, explicit required-key/type/empty-string
checks, semantic schema property roundtrips, and exact existing fixtures.
Assert all eleven tools retain the same public failure codec and return mode;
exercise a returned tool failure over stdio and compare its encoded shape.
Check generated encoded JSON Schema, .make/type inference, docs, and downstream
imports. Run full `bun run beep quality package-verify @beep/m365-mcp` and the
applicable Yeet proof; this P2 pass does not run or claim those gates.

# Risk and sequencing

Tier 2 stored/wire. Land semantic model, legacy codec, handler, JSDoc and tests
atomically after GATE 2. Main risks are losing the required encoded retryable,
using an optional-key codec twice so reason is encoded too early, failing to
preserve constructor None default, or treating generic arbitrary acceptance
as business legitimacy. P3 must review both domain judgment and compatibility;
no source implementation or review completion is claimed here.
