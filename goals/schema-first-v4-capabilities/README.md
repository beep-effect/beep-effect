# Schema-First V4 Capabilities

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

### Portfolio closeout (2026-07-14)

The retained deliverable is P0–P2: Effect v4 Schema doctrine, agent steering,
and the enforcement plumbing that emits structured schema-first issues through
Yeet. P3 helper statics are deferred until repeated cross-package demand. The
completed P4 pilots remain evidence, while all remaining remediation waves and
the five existing arbitrary cases are recorded deferrals. The
`SchemaRepresentation` generated-model spike is dropped.

P5's docs-side closeout reconciles this README, `PLAN.md`, and the manifest.
The existing false-positive and deferral ledger is final; the five arbitrary
deferrals remain Glob, TypedArrays, IRI, PackageJson, and Graph in
[`reviews/p4-wave3-deferred-arbitraries.md`](./reviews/p4-wave3-deferred-arbitraries.md).

This packet turns a research finding into a repo initiative: we already require
schema-first development, but we are underusing Effect v4 Schema features that
make that law more valuable and more enforceable.

The packet is grounded in the local Effect v4 subtree at `.repos/effect-v4` and
the repo's current patterns. It is intentionally phased: first teach and enforce
the high-leverage patterns, then remediate call sites with feedback from Yeet
and schema-first lint.

## Review Status

Packet review round 01 is recorded in `reviews/round-01.md`. The review fixed
source-fidelity issues around seeded Faker arbitraries, `withKeyDefaults`
semantics, `annotateKey`, diagnostics, SchemaRepresentation limits, and Yeet
issue-shape claims.

The packet was then expanded to include schema-derived static APIs such as
`TaggedUnion.match`, `TaggedUnion.cases`, `LiteralKit.Enum`, `LiteralKit.is`,
`LiteralKit.pickOptions`, `MappedLiteralKit` directional helpers, and
class-local derived helpers. Future agents should treat `SPEC.md` as the source
of truth for rule cards and `PLAN.md` as the phase order.

The packet was also aligned after merging `feat/yeet-pr-closeout-loop`.
Closure should now use Yeet's exact proof-reuse paths only when Yeet accepts
the current state, should reserve `publish --start-pr-early --monitor` for the
explicit remote-overlap path, and should run `yeet closeout` as a read-first PR
gate before claiming hosted review readiness.

## Scratch References

- `scratchpad/index.ts` contains concrete examples for:
  - `S.withDecodingDefault`
  - `S.withConstructorDefault`
  - `S.withDecodingDefaultType`
  - `S.withDecodingDefaultKey`
  - `S.withDecodingDefaultTypeKey`
  - `S.withDecodingDefault(..., { encodingStrategy: "omit" })`
- `scratchpad/test/schema-arbitrary-fastcheck.test.ts` contains a runnable
  property-testing scratch:
  - static fixture passes on an under-specified `S.Number` schema;
  - `S.toArbitrary` plus FastCheck finds the broader domain;
  - `S.Int` plus range checks fixes the model;
  - `annotate({ toArbitrary })` demonstrates seeded Faker integration.
- `scratchpad/test/schema-static-apis.test.ts` contains a runnable static API
  scratch:
  - `S.TaggedUnion` exposes `.cases`, `.guards`, `.isAnyOf`, and `.match`;
  - `LiteralKit` exposes `.Options`, `.Enum`, `.is`, `.pickOptions`,
    `.omitOptions`, `.$match`, `.thunk`, and `.toTaggedUnion`;
  - `MappedLiteralKit` exposes directional `From` / `To` literal helpers.

## Why This Matters

Schema-first should not only replace `type` and `interface`. It should make the
schema the active center for validation, construction defaults, generated test
data, equivalence, boundary codecs, diagnostics, and eventual code generation.

This directly reduces classes of bugs:

- fallback object literals drifting away from accepted input;
- happy-path fixtures masking negative, huge, or malformed values;
- `S.Number` accepting `NaN` / infinities where `S.Finite` was intended;
- broad `S.String` / `S.Array` schemas failing to say what the domain accepts;
- agents hand-writing branching and guard helpers that schema values already
  expose;
- manual equality checks that disagree with schema semantics;
- boundary parsers and generated models carrying duplicate plumbing.

The intent is not to delete fixtures. Keep fixtures for golden payloads,
snapshots, external compatibility, migrations, and regression repros. Add
schema-derived properties when a behavior claims to hold across a schema domain.
When those properties are hard to generate, sharpen the source schema or add
source-schema arbitrary annotations instead of defining weaker test schemas.

## Primary Sources

- `.repos/effect-v4/packages/effect/SCHEMA.md`
- `.repos/effect-v4/packages/effect/src/Schema.ts`
- `.repos/effect-v4/packages/effect/src/SchemaAST.ts`
- `.repos/effect-v4/packages/effect/src/SchemaGetter.ts`
- `.repos/effect-v4/packages/effect/src/SchemaIssue.ts`
- `.repos/effect-v4/packages/effect/src/SchemaParser.ts`
- `.repos/effect-v4/packages/effect/src/SchemaRepresentation.ts`
- `.repos/effect-v4/packages/effect/src/SchemaTransformation.ts`
- `.repos/effect-v4/packages/effect/src/SchemaUtils.ts`
- `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts`
- `packages/foundation/modeling/schema/src/MappedLiteralKit/MappedLiteralKit.schema.ts`
- `packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts`
- `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/QualityIssueIndex.ts`

## Current Readiness

P0 and P1 are complete. P2 is complete for the initial rule-card set: current
`beep lint schema-first` failures emit structured `[schema-first:issue]` lines,
and Yeet parses them into `schema-first-policy` quality issues with rule id,
file, remediation, and package routing. The live repo currently tracks zero
boundary-codec advisories after the Runpod OpenAPI generator remediation, zero
equivalence advisories after `LocalDate.equals` / `Timestamp.equals` were moved to
`S.toEquivalence`, zero active precision-audit advisories after the two
remaining broad email fields were reviewed as raw-input/diagnostic exceptions,
and zero defaults/numeric/static-api advisories. The `SFV4-arbitrary-tests`
rule was then hardened from the async-only codec list to the full Effect v4
sync/async codec family, re-surfacing 34 synchronous-codec advisory candidates
for Wave 3. An orchestrated triage then remediated 8 of those with derived
round-trip property tests (HttpStatus, Options, and the
CanonicalizationSecurity / MutableHashMap / MutableHashSet / wink ToolValidation
/ Model / Rdf batch), reclassified 8 incidental JSON-boundary and
meta-combinator tests as inventory exceptions, and deferred the rest. A
follow-up source-annotation batch then added `fc.stringMatching` `toArbitrary`
annotations to the `Kebab/Pascal/SnakeCaseStr`, `WindowsDriveRoot`, and
`EthereumValidatorPublicKey` source brands (remediating CaseStr, FilePath, and
BlockchainRedacted, count to 15). A probe-first deferred-arbitraries batch then
remediated 9 more (FileName + TSMorph SymbolId source annotations plus
probe-only DateTimeUtcFromValid, RegExp, Duration, Color, URI, Observed),
reverted IRI and PackageJson as flaky, and made PromiseSchema an exception —
bringing the live arbitrary-tests count to 5 (Glob/TypedArrays runtime-blocked,
IRI/PackageJson flaky pending curated arbitraries, Graph not yet addressed).
Cumulatively the 34 surfaced candidates are 20 remediated, 9 exceptions, 5
deferred. P3 has started with an internal
repo-cli laws helper that formats `SchemaError.issue` through
`SchemaIssue.makeFormatterStandardSchemaV1(...)` and provides redacted
diagnostic output through public formatter hooks while avoiding a premature
public `@beep/schema` export.
P4's completed pilot set includes low-risk Sha256,
Markdown, secure-header
option, CSV, repo-configs route-predicate, LocalDate codec, and Organization
value-schema, identity-id, and EntityKernel property-test pilots: `Sha256Hex`
now owns a `toArbitrary` annotation, `Markdown` works with its derived arbitrary
directly, secure header option tests derive COEP/COOP/CORP values from source
schemas, CSV row generation exposed a `-0` text round-trip hole that was fixed
by tightening the row id source schema,
`NextModels.schema.test.ts` derives `RouteHas` predicates from the source
schema, and `LocalDate.test.ts` derives class instances for a schema
encode/decode law in both schema and shared-domain packages;
`Organization.test.ts` derives license-tier/settings values from source schemas.
`IdentityNamespaces.test.ts` derives ids across every registered identity
namespace.
`EntityKernel.test.ts` derives document ids and proves entity-reference
round-trips.
`OrganizationDisplay.test.ts` derives browser-safe display/form payloads and
proves UI codec stability plus the primary-label law.
`packages/foundation/modeling/md/test/Md.test.ts` derives Markdown AST
inline/block/document values and proves schema codec plus renderer handoff
stability.
`FileProcessing.test.ts` derives file-processing artifact and operation payloads
from source schemas; the pilot also added valid-subset arbitrary annotations for
prefixed SHA-256 identifiers and local artifact names/extensions.
`Graph/Schema.test.ts` derives NLP graph nodes, edges, annotation nodes, and
analysis summaries from source schemas and proves codec stability.
`PatternCore.test.ts` derives NLP pattern options, elements, and full patterns
from source schemas and proves schema codec plus compact encode/decode
stability.
`ServicesAndSurface.test.ts` derives semantic-web RDF datasets and
canonicalization DTOs from source schemas and proves encoded-boundary stability.
The retired semantic-web JSON-LD suite derived JSON-LD context/literal/frame
DTOs from source schemas and proved encoded-boundary stability beside exact
document/RDF fixtures (the JSON-LD surface and its tests were later removed
from the package as unconsumed; the pilot's findings stand).
`Form.test.ts` derives values from a schema produced by
`FormBuilder.buildSchema(...)` and proves encoded-boundary stability.
`agent-effectiveness-command.test.ts` derives agent-effectiveness report values
from source schemas and proves the same `S.fromJsonString(...)` JSON boundary
used by the command renderers.
`ai-metrics-command.test.ts` derives representative AI-metrics command report
values from source schemas and proves the same JSON boundary across forwarder,
label queue, mirror, OTLP, and weekly-report outputs.
`files-command.test.ts` derives representative files-command and
file-processing report values from source schemas and proves JSON-boundary
stability while leaving larger media manifest arbitraries for a bounded
annotation pass.
`Libpff.service.test.ts` and `Tika.service.test.ts` derive file-processing
source artifacts and operation payloads from source schemas and prove direct
schema codec stability for runtime data that may include `Uint8Array` bytes.
`VeniceAI.service.test.ts` derives local OpenAPI operation and prompt-body
fixture payloads from source schemas and proves direct schema codec stability
beside the exact swagger and request-shaping checks.
`agent.test.ts` and `protocol.test.ts` derive ACP JSON-RPC responses and
notifications from source schemas and prove JSON-boundary stability.
`WorkItemDrizzleRepository.pglite.test.ts` derives architecture-lab domain ids
and titles from source schemas in an always-on property while keeping the PgLite
repository cases behind their existing integration gate.
`OipContent.model.ts` and `ContactSubmission.model.ts` now expose class-local
derived decoders on `OipSiteContent`, `ContactSubmission`, and
`ContactSubmissionFormPayload`, with compatibility exports delegating to those
statics.
`Rdf.ts` and `SemanticSchemaMetadata.ts` now expose class-local
`decodeUnknownResult` statics on `NamedNode`, `Literal`, and
`SemanticSchemaMetadata`, with RDF construction helpers delegating to those
schema-owned decoders.
`Quality/Tasks.ts` now demonstrates the loaded-module static helper pattern by
using `LiteralKit` domains, `QualityTaskName.Enum`, `QualityTaskName.is.lint`,
and `S.is(...)` guards for quality task routing while keeping the lazy
`bin-main.ts` preflight intentionally minimal.
`projectMarkdown(...)` now demonstrates the first defaults remediation by
constructing `OntologyMarkdownProjectionOptions` through its schema-owned
`linkMode` constructor default instead of restating the portable-link fallback
in normalization code.
`SecureHeaderOptions` now demonstrates the options-argument default pattern:
omitted aggregate helper options are normalized through a schema-owned
constructor default while `createHeadersObject()` and `createSecureHeaders()`
keep their ergonomic call shape.
Wave 2 also started with HubSpot request-email and shared `EmailString`
precision pilots. These pilots reduced the async-only arbitrary-test advisories
from 27 to 0 and active precision-audit advisories from 7 to 0, with two
reviewed precision exceptions still tracked in the inventory. Hardening
`SFV4-arbitrary-tests` to the full Effect v4 sync/async codec family then
re-surfaced 34 synchronous-codec advisory candidates for Wave 3.
No implementation phase remains active after portfolio closeout. Use `PLAN.md`
for the recorded dispositions and `SPEC.md` for the historical acceptance
contract.
