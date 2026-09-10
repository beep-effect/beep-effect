# Instance

- id: `docgen-generation-outcome`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus `origin/main`: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/Docgen.schemas.ts:396`
- symbol: `DocgenGenerationResult`
- members: `success`, `error`, `moduleCount`
- evidence: E3 at `internal/RunDocgen.ts:72`, `:95`, `:109`; E2 at
  `Docgen.render.ts:114` and `Docgen.command.ts:415`, `:469`.
- cardinality: 8 representable / 2 legal; stored; wire exposure; Tier 2.
- refresh receipt: `../data/design-refresh-2026-09-09-r28-docgen-files-impact.md`
- prior design: `../history/designs/2026-09-09-pre-main-d1b4d7/docgen-generation-outcome.md`

P2 design only; independent P3 acceptance and implementation remain separate.
Short source paths are relative to
`packages/tooling/tool/cli/src/commands/Docgen/`.

# Current shape

The class at `Docgen.schemas.ts:392-404` stores packageName/packagePath strings,
success Boolean, optional finite moduleCount, optional string error, and
independent optional string output. The three constructors in
`internal/RunDocgen.ts:71-115` produce only success/count or failure/error.
No other production constructor was found in the named-result search.
The successful count can be zero: missing/unreadable module output directories
are deliberately recovered to zero at `:81-93`. Captured command failures first
become an exit-code-one result at `:55-68`; the outer catch at `:103-119` handles
earlier execution failures. Preserve both routes and their different messages.

The old design missed a supported JSON writer. `docgen generate --json` passes
the results array to `renderDocgenJson` at `Docgen.command.ts:413-418`, then
reports failure. `Docgen.render.ts:45-51` delegates to the unknown-JSON encoder
and existing pretty renderer; it does not apply the result schema's encoder.
This exposure already existed before the latest merge. Correct the old
internal/Tier-1 classification to wire/Tier-2; no new JSON feature is proposed.

Human generation logging remains at `Docgen.render.ts:113-130`. The `run`
command checks the result flag at `Docgen.command.ts:469` before aggregation.
The latest render diff extracts analysis-report helpers at `:228-365`; it does
not change generation logging. Aggregate's extracted duplicate-path and
clean-destination helpers retain their existing behavior.

# Cardinality gap

| success | moduleCount presence | error presence | Supported outcome |
| --- | --- | --- | --- |
| true | present | absent | Generated, including zero module files |
| false | absent | present | Failed, with the complete error string |

Boolean times two actual optional-property axes gives eight tuples; two are
produced and consumed. The finite count's numeric value is payload, not an
invented zero/nonzero axis. Do not tighten `S.Finite` to positive or integer.
Package strings and output content/presence stay outside this cluster; preserve
empty strings and the output schema's optional-key behavior.

# Target schema

In the existing `Docgen.schemas.ts`, define an annotated
`DocgenGenerationStatus` LiteralKit with `succeeded` and `failed`. Define
annotated `DocgenGenerationSucceeded` and `DocgenGenerationFailed` classes.
Both retain packageName, packagePath, and `output: S.optionalKey(S.String)`.
Succeeded owns required `moduleCount: S.Finite`; failed owns required
`error: S.String`. Assemble through the kit's `mapMembers` and
`S.toTaggedUnion("status")`, retaining `DocgenGenerationResult` as the exported
union/schema-derived Type. Use generated cases, guards, and match helpers;
do not retain decoded success flags or optional wrong-arm payloads.

The JSON compatibility adapter is an outgoing projection, not another domain
state cache. Add one generation-specific renderer in `Docgen.render.ts`, used
by `Docgen.command.ts:414`, which exhaustively matches each result into the
legacy flat object before calling existing `renderDocgenJson`. Construct legacy
keys in established order: packageName, packagePath, success, the applicable
moduleCount/error, then optional output. Copy output only when its optional key
is present; do not trim or discard a present empty string in this projection.
Keep the projection private to the renderer. Derive its output Type from a
private encoded-only union of the two legacy Struct arms: success=true owns
moduleCount and success=false owns error; both retain identity and optional
output. Boolean literals here preserve the existing wire discriminator, while
the decoded domain uses LiteralKit. Do not export a second freely constructible
Boolean/optional-payload domain model.

This total projection needs no fallible bidirectional codec: no production JSON
decoder or supported persisted input format for this result was found. The
existing generic renderer retains its other callers and failure mapping. Do
not pass tagged cases directly to its unknown-JSON encoder and assume a schema
encoder will run. Do not introduce native JSON serialization, synchronous
throwing codecs, or a different command JSON envelope.

# Migration inventory

| Current owner/consumer | Required change |
| --- | --- |
| `Docgen.schemas.ts:374-404` | Replace class with kit/cases/union; migrate constructor example and exported Type. Preserve primitive and optional-output schemas and annotations. |
| `internal/RunDocgen.ts:72`, `:95`, `:109` | Construct exact cases at all three writes; preserve identity, count recovery, error text, output content, and omission. |
| `internal/RunDocgen.ts:152-170` | Carry union through both curried/data-first overloads and both existing Effect success/error type positions. Preserve dual dispatch and recovery; narrowing the declared error channel is separate work. |
| `Docgen.render.ts:113-130` | Partition using case guards; preserve relative order within partitions, success-first logging, then failures and failure count. Required payloads remove fallbacks. |
| `Docgen.render.ts:45-51`; `Docgen.command.ts:413-418` | Add/use typed generation renderer with legacy outgoing projection; preserve JSON-before-reported-failure ordering and JSON error message. |
| `Docgen.command.ts:405-423`, `:459-482` | Update both flag readers to generated failed-case guards. Preserve concurrency, include patterns, failure messages, and aggregation skip behavior. |
| `internal/Operations.ts:9-13` | Preserve compatibility barrel exports of schema/render/run modules, with no duplicate implementation. |
| package `package.json:35`, `:60`, `:66` and published counterparts | Preserve facade and wildcard schema/render subpaths; internal subpaths stay blocked. `Docgen/index.ts` exports command/Doctest modules, not generation schemas. Do not widen that facade for an old example. |
| `test/docgen.test.ts` and source examples | Add outcome/JSON compatibility proof below. No direct named-result test constructor was found in the focused test file. |

`internal/Aggregate.ts:92-125`, `:174-189` remain operational validation:
duplicate paths still fail before cleanup; selected packages with no generated
docs still fail; empty all-package selection still returns before cleanup.
The generation migration must not reorder these paths. Analysis-report helpers
at `Docgen.render.ts:228-365` accept different models and are outside this change.

# Guard-deletion accounting

- Delete decoded success Boolean and optional ownership of error/count.
- Replace Boolean filters at `Docgen.render.ts:114-115` with case guards;
  delete `moduleCount === undefined` suffix fallback at `:118` and
  `error ?? "unknown error"` at `:123` for valid internally built outcomes.
- Replace command success predicates at `Docgen.command.ts:415`, `:469`;
  readers no longer infer payload ownership from a separate bit.
- Keep the optional/nonblank output check at `Docgen.render.ts:124`, exit-code
  handling, filesystem/count recovery, and aggregation guards. Legacy success
  exists only in the final outgoing projection.

# Encoded-side impact

Tier 2, one singleton PR. Preserve the exact supported `generate --json` array
shape, item order, fields, values, omission, formatting, and trailing-newline
behavior. Success remains success=true with moduleCount and no error; failure
remains success=false with error and no moduleCount. No status discriminator
appears on stdout. Output stays independently optional on both cases; successful
output remains in JSON although human logging does not print it.

The nonzero-exit writer omits empty captured output (`RunDocgen.ts:77`), as does
the success writer (`:100`), while the outer failure writer always includes the
trimmed string (`:114`), even when empty. Preserve these writer differences.
The shared renderer still uses `internal/cli/Json.ts:176-179`, `:222` for JSON
encoding and pretty formatting. This caller passes no maxLength option, so it
always uses pretty formatting even for large output; do not introduce a cap.

The decoded exported Type changes under atomic in-repo migration authority.
Unknown external TypeScript users are not proven absent, so include the package
changeset/API impact in Tier-2 review. No file migration, new JSON reader, or
versioned envelope is required by the observed outgoing contract. Demonstrate
byte compatibility with old/new render fixtures before application; this P2
source audit does not claim to have executed them.

# Test impact

1. Construct both cases with complete identity/payloads and test required
   payload rejection. Preserve the finite count domain, including zero, and
   output absent, empty, nonblank, Unicode, and escaped strings.
2. Capture old render bytes for both outcomes, mixed/empty arrays, output
   omission/present-empty, and large output retaining current pretty formatting. Compare
   the typed renderer byte-for-byte, with no tag leakage.
3. Exercise `generate --json`: output precedes the same reported failure;
   JSON item order stays intact. Exercise human success-first log order,
   module suffix, errors, output printing, and failure count separately.
4. Exercise nonzero exit, captured spawn failure, outer failure, and missing/
   unreadable module directories with bounded fixtures. Preserve `run`'s
   aggregation skip on any failure and existing parallel/include behavior.
5. Preserve `test/docgen.test.ts:1706-1749`'s newly expanded findings/checklist
   fixture, aggregation fixtures at `:1408`, `:1512`, `:1569`, `:1660`, and
   selector-conflict fixture at `:4589`. These are neighboring behavior,
   not additional cardinality axes.

At implementation run focused Docgen tests and full `@beep/repo-cli` package
verification. Neither was run for this design audit.

# Risk and sequencing

Replace previous Tier-1 scheduling with one Tier-2 singleton spanning schema,
three writers, human/JSON/aggregation readers, exports, and tests. The primary
risk is leaking tagged objects through generic JSON rendering; the typed
outgoing renderer is mandatory. Also guard against losing present-empty output,
changing log order, narrowing count payloads, or aggregating after failure.
Independent P3 must verify these points on current source before implementation.
This source audit is not P3.
