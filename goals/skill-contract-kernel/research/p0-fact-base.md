<!-- Provenance: 2026-08-24; gpt-5.6-sol xhigh P0 pass. Content below copied verbatim. -->

# Skill Contract Kernel — P0 implementation fact base

Date: 2026-08-24. Scope: first vertical slice only. All paths and line numbers are from this checkout.
The packet locks the slice to `Gate` + `EvidenceReceipt`, one `cited-artifact-exists` typed gate,
then parity tests before widening (`goals/skill-contract-kernel/PLAN.md:9-12`;
`explorations/typed-agent-skill-contracts/MAP.md:56-62`). The package is
`@beep/skill-contract`, schemas-only, under `packages/foundation/modeling/`
(`goals/skill-contract-kernel/GOAL.md:7-10`; `goals/skill-contract-kernel/SPEC.md:5-18`).

## 1. Current QA judge contract

### 1.1 Every rule implemented in `JudgeCheck.ts`

`JudgeCheck.ts` says the two evidence questions are artifact existence and witness-event existence
(`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:1-8`). Its complete exported check surface is:

1. **`cited-artifact-exists` (first typed gate).** Input is a decoded `QaInventory`, a
   `RoundLayout`, and the round `QaEventLog` through `crossCheckAgainstRound`; the pure core receives
   `HashSet<string> existingPaths` through `crossCheckEvidence`
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:168-189,259-287`). `citedPaths` flattens
   every finding's evidence paths and deduplicates in first-occurrence order
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:105-110`). Failure is not an Effect error
   at evaluation time: the cited strings absent from `existingPaths` populate
   `EvidenceCrossCheck.missingPaths: Array<string>` (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:43-59,185-188`).
2. **`cited-event-id-exists`.** `citedEventIds` flattens all evidence `eventIds` and deduplicates;
   the known set is `eventLog.events[*].seq`; absent ids become
   `EvidenceCrossCheck.missingEventIds: Array<Int>`
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:137-142,185-188,283-287`).
3. **`declared-round-coherent`.** Inputs are requested `round: number` and decoded inventory. Strict
   equality passes; mismatch fails `QaCommandError` with
   `qa judge inventory declares round <declared> but round <requested> was requested.`
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:343-356`). This is separate because event
   ids and frame names can repeat between rounds (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:317-321`).
4. **Cross-check settlement/rendering.** Clean means both missing arrays are empty. Dirty rendering
   starts `qa judge inventory for round <n> cites evidence the round cannot back up.`, then emits all
   missing artifacts before all missing event ids. `raiseCrossCheckFailure` maps dirty to one
   `QaCommandError`; clean is `Effect.void`
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:77-78,208-220,305-314`).
5. **Judge-output extraction (ingest pre-gate, not an evidence rule).** `extractLastJsonBlock` tries
   the last `json` fence, then last anonymous object fence, then the mixed-output balanced-object
   parser; a fence wins over later unfenced objects
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:358-390,412-417`). It is used only by
   `JudgeIngest.parseJudgeOutput`, where no block, malformed JSON, or schema rejection becomes
   `QaCommandError` (`packages/tooling/tool/cli/src/commands/Qa/JudgeIngest.ts:112-132`).

The `qa-inventory/v1` decode itself is adjacent, not a `JudgeCheck` rule. Both commands decode before
these checks (`packages/tooling/tool/cli/src/commands/Qa/JudgeLint.ts:66-74`;
`packages/tooling/tool/cli/src/commands/Qa/JudgeIngest.ts:124-132,166-172`).

### 1.2 Invocation and externally observable failure shape

- **JudgeLint:** read/JSON/schema failures are `QaCommandError`; it calls `requireInventoryRound`,
  reads the log, and calls `crossCheckAgainstRound`. On a dirty cross-check it prints the detailed
  renderer and returns `CliReportedExit` code 1 with the summary
  `qa judge-lint: round <n> inventory is not backed by evidence`; it does **not** call
  `raiseCrossCheckFailure` (`packages/tooling/tool/cli/src/commands/Qa/JudgeLint.ts:57-90`).
- **JudgeIngest:** parses first, performs its own round comparison with the distinct message
  `qa judge-ingest was asked for round ...`, calls `crossCheckAgainstRound`, then
  `raiseCrossCheckFailure`; only after success does it encode/write JSON and Markdown
  (`packages/tooling/tool/cli/src/commands/Qa/JudgeIngest.ts:151-191`). Thus dirty evidence is a
  `QaCommandError` containing the full renderer and no inventory files are written.

### 1.3 Exact `cited-artifact-exists` behavior to preserve

For each deduplicated cited string, in order:

1. Canonical root is `fs.realPath(layout.root)`; root-resolution failure falls back to lexical
   `path.resolve(layout.root)` (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:264-267`).
2. Compute lexical `path.resolve(canonicalRoot, cited)`, independently resolve the candidate under
   the pinned canonical root, and require exact equality. PathSafety follows the deepest existing
   ancestor, rejects canonical escape, and rejoins a missing suffix
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:271-277`;
   `packages/foundation/capability/file-processing/src/PathSafety/PathSafety.service.ts:84-117,124-154`).
   Equality also rejects a symlink/linked alias even if its target remains in-root.
3. `stat` the canonical candidate and admit only `info.type === "File"`; directories and every other
   type are missing (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:278-279`).
4. **Any** per-path PathSafety, linked-path, resolution, or stat failure is swallowed to `None`, so
   the original citation is reported in `missingPaths`; the evaluator's failure channel is `never`
   (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:259-280`). This is fail-closed denial-as-data.
5. Present strings become a set; `crossCheckEvidence` filters the original deduplicated list against
   it, preserving citation order (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:271-287`).

### 1.4 `qa-inventory/v1` schema tree relevant to gates

```text
QaInventory { findings: Array<QaFinding>; judge: QaJudgeRef;
  requiredCount: Int >= 0; round: RoundNumber;
  schemaVersion: "qa-inventory/v1"; sessionRef: string }
  invariant: requiredCount === count(findings where severity is P0 or P1)

QaFinding { evidence: NonEmptyArray<QaEvidenceRef>; fix: string;
  id: branded `R${RoundNumber}-${twoDigitOrdinal}`; lens: QaLens; repro: string;
  resolvedInRound: Option<RoundNumber> = None; severity: P0 | P1 | P2; title: string }

QaEvidenceRef { eventIds: Array<SequenceNumber>; frameRange: Option<[Int, Int]> = None;
  kind: clip | frame | screenshot | sheet | strip; path: string }
```

Evidence: `QaEvidenceRef` fields are at
`packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts:258-285`; `QaFinding` and its nonempty
evidence invariant are at `:347-394`; severity is exactly `P0 | P1 | P2`, with P0 blocking, P1
required, P2 non-required (`:25-49`); evidence kind is the five-member domain at `:127-145`.
`isRequiredSeverity` maps P0/P1 to true and P2 to false; the whole-struct filter requires exact count
coherence (`:413-450`). `QaInventory.requiredCount` is nonnegative and the filter is attached to its
Struct (`:474-517`). Decode/encode are schema-derived (`:534-537,562-565`).

## 2. Substrate precedents (templates, not dependencies)

### `VerifiedTextAnchor`

- Serializable `TextAnchorVerificationReceipt` is deliberately structural and explicitly not proof
  (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:139-172`).
- The module-private `VerifiedTextAnchorValue` owns `#verified = true`, readonly `anchor/source`, a
  constructor unavailable outside the module, and an `instanceof` + private-field static guard
  (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:174-186`). The public type is an
  alias; its from-self schema is `S.declare<VerifiedTextAnchor>(VerifiedTextAnchorValue.is)`, so wire
  objects cannot decode as proof (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:188-243`).
- The only constructor path is
  `verifyTextAnchor(input: VerifyTextAnchorInput): Effect<VerifiedTextAnchor,
  VerifiedTextAnchorError, Crypto.Crypto>` via `Effect.fn`; it returns `new VerifiedTextAnchorValue`
  only after all checks (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:370-398`).
  The existing test proves receipt round-trip does not grant proof
  (`packages/foundation/modeling/provenance/test/VerifiedTextAnchor.test.ts:198-221`).

### `TierGateVerdict`

- Internal outcome domain is `approved | refused`; the verdict is
  `TierGateOutcomeTag.toTaggedUnion("verdict")({ approved:{audit}, refused:{audit} })`, and **both**
  cases carry the audit record (`packages/foundation/capability/mcp-kit/src/TierGate.ts:38-38,186-223`).
- `TierGateAuditRecord` fields are `tool: NonEmptyString`, `outcome`, `reason: NonEmptyString`,
  `destructive: Boolean`, `toolCallId: Option<NonEmptyString> = None`, and
  `occurredAt: NonEmptyString` (`packages/foundation/capability/mcp-kit/src/TierGate.ts:155-184`).
- Its service signature is total verdict-as-value:
  `evaluate(ToolCallRequest): Effect<TierGateVerdict>` and
  `recordOutcome(request, settlement): Effect<void>`
  (`packages/foundation/capability/mcp-kit/src/TierGate.ts:276-279,281-329`).

### `ClaimGateResult`

`ClaimGateResult` is `admitted | rejected` discriminated on `verdict`; admitted has `{}`, rejected
has `{ violations: Array<ClaimGateViolation> }`. A violation has `focusNode`, `path`, `message`, and
severity (`packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts:81-97,128-140`).
The service returns admitted only for `conforms && !truncated`, otherwise rejected with projected
violations; rejection is a value, never an error
(`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:70-87`).

## 3. Effect v4 authority check (`.repos/effect`, current rc)

Both checkout authority and root catalog say `effect` is `4.0.0-rc.111`
(`.repos/effect/packages/effect/package.json:1-5`; `package.json:149-152`).

- **`S.TaggedError`:** current call shape is
  `class E extends S.TaggedError<E>()("Tag", { field: Schema }) {}`. The optional outer
  `identifier` is separate from the inner tag; the second inner argument accepts fields or a Struct
  (`.repos/effect/packages/effect/src/Schema.ts:14821-14858`). Implementation defaults the identifier
  to the tag (`:14859-14874`). Repo law says use `$I` only for a distinct namespaced identifier, else
  omit it; never pass a bare identifier equal to the tag
  (`standards/architecture/09-errors-across-boundaries.md:29-34`). Use it only for genuine decode or
  invariant boundary failures, never a denied gate (`goals/skill-contract-kernel/SPEC.md:69-73`).
- **Unions:** `S.Union([members], { mode?: "anyOf" | "oneOf" })` tests in order, first match, with
  `anyOf` default (`.repos/effect/packages/effect/src/Schema.ts:4899-4927`).
  `S.Union([...]).pipe(S.toTaggedUnion("tag"))` adds cases, discriminants, guards, `isAnyOf`, `match`,
  and `matchOrElse`, rejecting missing/duplicate literal discriminants (`:6277-6395`). Prefer the repo
  wrapper: `LiteralKit` exposes `toTaggedUnion` (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:632-680`)
  and builds `S.Struct({ [tag]: S.tag(literal), ...caseFields })` then calls `S.toTaggedUnion`
  (`:796-819`). That is the verdict implementation template.
- **Effect AI public extension surface:** `effect/unstable/ai` currently namespace-exports exact
  modules `Tool` and `Toolkit` (`.repos/effect/packages/effect/src/unstable/ai/index.ts:87-95`). A
  later adapter may use `Tool.make`, `Tool.Tool`, `Tool.Any`, `Tool.Name`, `Tool.Parameters`,
  `Tool.ParametersEncoded`, `Tool.Success`, `Tool.Failure`, `Tool.Result`, and the public schema fields
  `parametersSchema/successSchema/failureSchema`; `Tool.make` accepts description, parameters,
  success, failure, failureMode, dependencies, and needsApproval
  (`.repos/effect/packages/effect/src/unstable/ai/Tool.ts:197-355,651-867,1204-1275`). It may compose
  with `Toolkit.make`, `Toolkit.Toolkit`, `Toolkit.Any`, `Toolkit.Tools`, `Toolkit.HandlersFrom`,
  `Toolkit.WithHandler`, instance `.of/.toHandlers/.toLayer`, and `Toolkit.merge`
  (`.repos/effect/packages/effect/src/unstable/ai/Toolkit.ts:65-104,134-224,496-498,571-584`).
- **Must avoid in the kernel:** do not duplicate Tool parameter/result/failure codecs, handler
  dispatch, approval, or toolkit composition; wrap their schema-valid handler result with gates, as
  the packet's authority says (`goals/skill-contract-kernel/research/SOURCES.md:28-41`). Do not base the
  contract on `Tool.dynamic`, `Tool.providerDefined`, `AnyDynamic`, `AnyProviderDefined`, or
  `unsafeSecureJsonParse`: those are provider/runtime or unsafe parsing surfaces, not a schemas-only
  contract (`.repos/effect/packages/effect/src/unstable/ai/Tool.ts:666-689,1326-1422,1988-1988`).
  Recommendation: no `effect/unstable/ai` import in P1's kernel slice; expose a later adapter in a
  capability/tooling consumer so rc churn cannot infect the persisted contract schema.

## 4. Package scaffold and first-PR governance

The command requires the positional name; exact invocation is:

```sh
bun run beep create-package skill-contract --family foundation --kind modeling \
  --description "Typed agent-work contract schemas and evidence receipts"
```

`name` is positional and type defaults to library; family/kind flags are explicit
(`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1118-1165`). Modeling is
a valid foundation kind (`:135-140`), validation requires it (`:1236-1270`), and the derived path is
`packages/foundation/modeling/skill-contract` (`:1361-1397`).

Generated package facts:

- Creates `package.json`, three tsconfigs, `src/index.ts`, `test/.gitkeep`, LICENSE, README,
  AGENTS.md + CLAUDE symlink, `docgen.json`, Vitest config, and docs index; directories are
  `src/test/docs` (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:524-538,659-665`).
- Manifest base is private MIT ESM `@beep/skill-contract` with canonical homepage/repository path
  (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1745-1759`), `beep`
  metadata, root/wildcard exports, public provenance publishing, standard scripts, `effect` runtime
  dependency, and test dev dependencies (`:2036-2067`). `beep:check` runs source then test tsconfigs;
  lint/test/integration/docgen scripts are wired (`:1943-1971`).
- Source tsconfig includes `src`; test includes `src,test`; check is no-emit
  (`packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.json.hbs:1-12`;
  `templates/tsconfig.test.json.hbs:1-17`; `templates/tsconfig.check.json.hbs:1-15`). Current generated
  Vitest config merges root shared config but has no package coverage thresholds
  (`templates/vitest.config.ts.hbs:1-11`). Docgen gets schema, source link, strict example compiler
  options, and internal exclusion (`templates/docgen.json.hbs:1-32`).
- After writing, the command formats, ensures workspace membership and identity registration, runs
  root tsconfig/config sync, and refreshes the lockfile; dry-run names refs/aliases/syncpack/docgen as
  derived updates (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1441-1474,1598-1619`).

`@beep/provenance` is the mature modeling-package template: exact foundation/modeling metadata,
package scripts/exports, dependencies on identity/schema/effect
(`packages/foundation/modeling/provenance/package.json:1-72`); source project references its direct
workspace deps (`packages/foundation/modeling/provenance/tsconfig.json:1-20`); test tsconfig covers
`src,test` (`packages/foundation/modeling/provenance/tsconfig.test.json:1-16`); Vitest enforces 100%
coverage (`packages/foundation/modeling/provenance/vitest.config.ts:1-25`); docgen owns entrypoint/out,
source link, strict examples, and internal exclusion (`packages/foundation/modeling/provenance/docgen.json:1-34`).
Add only used `@beep/identity`, `@beep/schema`, `@beep/provenance`, or `@beep/md` dependencies; the
generator itself adds only `effect` (`CreatePackage.command.ts:1973-1977`).

First-PR gates:

- Path and manifest must agree; modeling may depend only on foundation primitive/modeling
  (`standards/ARCHITECTURE.md:583-596`). Foundation stays domain-agnostic and manifests must declare
  honest family/kind (`packages/foundation/AGENTS.md:3-24`).
- The topology test requires the foundation workspace glob, `beep: {family:"foundation",kind}`, and
  exact repository directory/homepage (`packages/tooling/tool/cli/test/foundation-topology.test.ts:24-69`).
- New packages must not enter the test-typecheck baseline: scaffold wiring is compliant by
  construction and the ratchet fails newly blind packages
  (`packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts:1-34,78-83`).
- Turbo makes `build` follow dependency builds, lint follow dependency lint, and check follow
  dependency builds (`turbo.json:34-100`). Root preflight regenerates tsconfig/fallow boundaries and
  runs JSDoc inventory, schema-first, test-tsgo, repo-sanity, JSDoc ratchet, Knip, and policy
  (`package.json:303-310`). Packet acceptance additionally names family metadata/import boundaries,
  docgen, lint, and typecheck (`goals/skill-contract-kernel/SPEC.md:117-120`).

## 5. First-slice design sketch (schemas/signatures)

```ts
// @beep/skill-contract — schemas only
const GateSeverity = LiteralKit(["blocking", "advisory"])
const GateApplicability = LiteralKit(["always", "conditional"])
const GateVerdictTag = LiteralKit(["allowed", "denied"])

const GateId = S.NonEmptyString.pipe(S.brand("GateId"))
class GateDeclaration extends S.Class<GateDeclaration>($I`GateDeclaration`)({
  id: GateId,
  severity: GateSeverity,
  applicability: GateApplicability,
  evidenceType: S.NonEmptyString,       // stable, versioned predicate/type id
  remediationOwner: S.NonEmptyString,
}) {}

class EvidenceSubject extends S.Class<EvidenceSubject>($I`EvidenceSubject`)({
  name: S.NonEmptyString,
  digest: S.Struct({ sha256: Sha256Hex }),
}) {}

const EvidenceReceipt = <Predicate extends S.Top>(Predicate: Predicate) => S.Struct({
  subject: S.NonEmptyArray(EvidenceSubject),
  predicateType: S.NonEmptyString,
  predicate: Predicate,
})

const GateAuditRecord = <Outcome extends "allowed" | "denied", Detail extends S.Top>(
  outcome: Outcome, Detail: Detail
) => S.Struct({
  gateId: GateId,
  outcome: S.Literal(outcome),
  reason: S.NonEmptyString,
  evaluator: S.NonEmptyString,
  occurredAt: S.NonEmptyString,
  detail: Detail,
})

const GateVerdict = <AllowedDetail extends S.Top, DeniedDetail extends S.Top>(
  AllowedDetail: AllowedDetail, DeniedDetail: DeniedDetail
) => GateVerdictTag.toTaggedUnion("verdict")({
  allowed: { audit: GateAuditRecord("allowed", AllowedDetail) },
  denied: { audit: GateAuditRecord("denied", DeniedDetail) },
})

type GateEvaluator<Input, Verdict, Failure = never, Requirements = never> =
  (input: Input) => Effect.Effect<Verdict, Failure, Requirements>
```

This is the `LiteralKit.toTaggedUnion` pattern above; both cases carry coherent audit records like
`TierGateVerdict`. `EvidenceReceipt` mirrors the locked digest-bound subject / versioned
`predicateType` / typed predicate split (`explorations/typed-agent-skill-contracts/DECISIONS.md:53-67`).
Do not put Schema values inside persistable `GateDeclaration`; `evidenceType` is the wire identity,
while the evaluator's `Input` schema supplies static typing.

```ts
// QA-local adapter; @beep/skill-contract never imports Qa, FileSystem, Path, or RoundLayout
const CitedArtifactExistsInput = S.Struct({
  roundRoot: S.String,
  citedPaths: S.Array(S.String),
})
const CitedArtifactAllowed = S.Struct({ checkedPaths: S.Array(S.String) })
const CitedArtifactDenied = S.Struct({
  checkedPaths: S.Array(S.String),
  missingPaths: S.NonEmptyArray(S.String),
})
const CitedArtifactExistsVerdict = GateVerdict(CitedArtifactAllowed, CitedArtifactDenied)

declare const evaluateCitedArtifactExists:
  GateEvaluator<CitedArtifactExistsInput.Type, CitedArtifactExistsVerdict.Type,
    never, FileSystem.FileSystem | Path.Path>

// Adapter projection preserves the legacy aggregate and renderer:
declare const citedArtifactVerdictToCrossCheck:
  (verdict: CitedArtifactExistsVerdict.Type, missingEventIds: ReadonlyArray<number>) => EvidenceCrossCheck
```

Evaluator algorithm is exactly §1.3. Every path-resolution/stat problem becomes the original path in
the denied audit's `missingPaths`; nonempty missing paths returns `{ verdict:"denied", audit }`, never
an Effect error. The adapter leaves event-id logic legacy in slice 1, then projects both results back
to `EvidenceCrossCheck`, so `JudgeLint`/`JudgeIngest` settlement and strings remain byte-compatible.
Unknown-input schema decoding may use a local `S.TaggedError` boundary error; QA translates it to its
existing `QaCommandError`, so no new error crosses the command boundary
(`goals/skill-contract-kernel/SPEC.md:66-77`).

### Parity-test plan

1. Reuse `finding`/`inventoryInput` fixtures and the pure missing path+event assertion
   (`packages/tooling/tool/cli/test/qa-command.test.ts:40-99,201-235`). For the same inventories and
   path sets, assert legacy `missingPaths` equals the new verdict projection, including ordering.
2. Reuse real-FS fixtures for missing file, present regular file, and `../` escape
   (`packages/tooling/tool/cli/test/qa-round-pipeline.test.ts:248-355`). Run legacy and new evaluator
   side-by-side before replacing the legacy branch.
3. Reuse duplicate-citation coverage (`packages/tooling/tool/cli/test/qa-pure.test.ts:637-664`) and
   clean/dirty raising coverage (`:692-703`).
4. Preserve command-level success, ingest refusal-before-write, lint revalidation, and wrong-round
   error text (`packages/tooling/tool/cli/test/qa-round-pipeline.test.ts:400-490,514-538`). Add an
   explicit lint dirty test that asserts detailed print + `CliReportedExit(1)` separately from
   ingest's `QaCommandError`.
5. Add missing parity cases: citation is a directory; missing leaf/stat failure; symlink to an
   in-root file; symlink escaping root; absolute path inside root; root `realPath` failure fallback;
   multiple findings with duplicate paths. Assert original cited string, order, verdict, audit, and
   unchanged legacy renderer.

## 6. RISKS / UNKNOWNS (decision + recommendation)

1. **Absolute paths:** `QaEvidenceRef.path` is only `S.String` despite “round-relative” docs
   (`packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts:234-240,276-279`), and the current
   resolver appears to accept an absolute existing file already under canonical root. **Recommend:**
   characterize and preserve in parity; tightening to relative-only is a separately approved behavior change.
2. **Linked aliases:** exact lexical/canonical equality rejects even an in-root symlink, but QA has no
   direct test. **Recommend:** lock current rejection with tests; do not “simplify” to containment-only.
3. **Canonical-root fallback:** failure of `realPath(roundRoot)` falls back to lexical root.
   **Recommend:** preserve for slice parity, record a later hardening decision rather than silently deny.
4. **Receipt honesty:** current QA proves existence/type/containment, not content digest; producing an
   in-toto-shaped allowed receipt would require reading/hashing and would strengthen/fork semantics.
   **Recommend:** ship the generic digest-bound `EvidenceReceipt` schema now, but keep the first gate's
   existence observations in its audit detail; mint no artifact-integrity receipt until hashing is an explicit gate.
5. **Applicability representation:** the brief requires applicability but does not lock a portable
   expression language (`explorations/typed-agent-skill-contracts/BRIEF.md:46-50`). **Recommend:** first
   schema supports `always`; reserve `conditional` with a versioned applicability type in the widening pass,
   not executable functions in persisted data.
6. **Opaque pass value:** eventual completion must require evaluator-only proof
   (`goals/skill-contract-kernel/SPEC.md:85-87`). **Recommend:** when the widening pass adds completion,
   copy `VerifiedTextAnchorValue` exactly: module-private class, private marker, from-self `S.declare`,
   one-way structural audit/receipt projection. Do not confuse the serializable allowed verdict with live proof.
7. **Audit time nondeterminism:** `TierGate` requires `occurredAt`, while current QA result is deterministic.
   **Recommend:** retain `occurredAt` in the audit schema, inject/fix clock in tests, and exclude audit time from
   the legacy `EvidenceCrossCheck` projection.
8. **Gate-id domain:** one global `LiteralKit` cannot know consumer-defined ids. **Recommend:** keep a branded
   wire `GateId` in the kernel and expose a consumer factory that accepts a local `LiteralKit`; QA's local
   one-member domain is `cited-artifact-exists`.
9. **Effect AI instability:** Tool/Toolkit are explicitly under `unstable` and rc.111 may move.
   **Recommend:** kernel contracts wrap, never extend/inherit, those runtime objects; pin adapter compilation
   tests to current exports.
10. **Scaffold coverage drift:** current generator emits no thresholds while provenance enforces 100%.
    **Recommend:** add package-local 100% thresholds for the small schema package, but treat that as an explicit
    package choice, not a claim about generator output.
11. **Scaffold side effects:** the generator intentionally changes identity/config/root refs and lockfile
    (`CreatePackage.command.ts:1598-1619`). **Recommend:** P1 start with `--dry-run`, inspect overlap, then run the
    canonical generator; never hand-create the directory.

## P0 conclusion

No substrate blocker was found. The implementation-ready first slice is a pure schema family in
`@beep/skill-contract`, a QA-local filesystem evaluator returning an audited `allowed | denied` value,
and a lossless projection back to the existing `EvidenceCrossCheck`. The principal parity work is not
the happy path; it is pinning linked aliases, absolute in-root paths, non-files, root-resolution fallback,
error-channel differences, ordering, and exact renderer behavior before replacing the legacy branch.
