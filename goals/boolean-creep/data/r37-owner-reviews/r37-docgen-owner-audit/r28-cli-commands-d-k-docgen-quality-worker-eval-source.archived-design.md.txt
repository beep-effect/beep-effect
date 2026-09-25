# Design: r28-cli-commands-d-k-docgen-quality-worker-eval-source

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Existing8/3 owner remains designed; independent P3 and ratification pending.

Owned source object: `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:887-892`,
enclosing `docgenQualityWorkerEvalCommand`. Raw descriptor anchor836 is withdrawn
as evidence and replaced by this actual object. Source count858 and exact-one rejection869-873 precede
packet-limit validation875, model validation881 and construction887. The helper
must return a selection at the old rejection position869, preserving source-error
precedence over packet/model errors and all work. Preserve provider, model,
baseUrl trimming/omission, reasoning options, output Option, and evaluator
arguments900-909. Output handling912-920 retains exact file/stdout behavior.
This design changes only the local evaluator's call site.

## Current shape

The inventory anchor must be the actual object passed to
`resolveQualityWorkerEvalSource`, not the `Command.make` flag descriptor bag
or the anonymous callback parameter signature. The object has exactly four
own members: `all: boolean`, `input: Option<string>`,
`packageSelector: Option<string>` and `packetLimit: number`. Its string
payloads are unrestricted selectors/paths, not additional finite alternatives.
The original report uses the parser spelling `package`; the actual member is
`packageSelector`. The stable candidate ID is retained while the anchor,
member spelling and kind become honest source object metadata.

The command constructs this object only after rejecting zero or multiple
source selections. FileSystem acquisition857 and pure provider/reasoning
normalization859-867 occur before rejection869. Keep those positions. Codex
omitted reasoning defaults through the existing helper; other providers retain
omission. Do not trim the model passed to evaluator: trim is used only to reject
blank model881. BaseUrl is trimmed and omitted when blank893-898, only after
source resolution. All remaining argv/Option payloads retain full original strings. The exported raw helper in
`packages/tooling/tool/cli/src/commands/Docgen/internal/Targets.ts:271-316`
has a broader compatibility contract: input wins immediately, including
input combined with all/package; input absence delegates to
`resolveDocgenQualityTargets`; no source falls back to affected discovery;
all plus package fails there after orphan-config checking. Its documented
example is at253-264. Do not narrow that public raw entrypoint or treat its
anonymous parameter as an independently qualified owner.

## Cardinality gap

Eight Boolean/presence projections are representable. Three are legal at this
post-validation operation object: `(false,Some(path),None)`,
`(false,None,Some(selector))`, `(true,None,None)` in
`[all,input,packageSelector]` order. There is no default/affected operation
here, although the exported raw helper supports that behavior for callers.
The full strings and packet limit must survive every mapping. Flag descriptors
and function parameters are OUT OF NET; successful operation objects are the
candidate being designed. Parent source reconciliation and the bounded independent correction accept
this owner; independent P3 review remains required before implementation.

## Target schema

Use a shared, annotated `QualityWorkerEvalSelection` schema with cases
`Input { path: S.String }`, `Package { selector: S.String }`, and `All {}`.
An operation schema owns `{ selection, packetLimit: S.Number }`; neither an
all Boolean nor absent sibling source payloads remain in it. Use a private LiteralKit vocabulary mapped to named annotated cases, annotate
the union before toTaggedUnion to preserve statics, and use schema-derived cases/match. Use current local Effect tagged-union APIs and schema-derived constructors;
validate exact signatures against the installed/reference version during implementation.
Do not tighten empty strings, packet limits or paths at construction beyond
this command's existing validation.

Resolve selection at the existing exact-one gate. Keep invalid CLI acceptance
and the exact domain error at that raw boundary. Pass only the canonical
operation to a shared `resolveQualityWorkerEvalSelection` implementation.
Retain the original `resolveQualityWorkerEvalSource` name, input type,
documented example and raw semantics. Factor input reading and report
construction out of its current body so both entrypoints share actual work;
no second analyzer or copied report-building body is permitted. The raw
entrypoint continues its existing input-first and target-resolution behavior,
including affected fallback and its current `scope: package` / generated:affected
metadata mapping. Targets.ts267 documents mutually exclusive options, but its
broader established helper semantics are an explicit preservation obligation in
this packet; this design neither qualifies its parameter bag nor silently
turns that documentation into new public runtime rejection. The new entrypoint matches the three valid selections and
uses the same filesystem decoding, target lookup and analysis primitives.

Place the shared data schema in existing Docgen.schemas.ts and the
resolver beside existing Targets helpers, with necessary imports and export
annotations. Preserve existing barrel/public symbols; add only the shared
internal operation API needed by these two command sites, without compatibility
aliases or a new service. The canonical target resolver's public raw API,
orphan check and selector errors also remain unchanged.

## Migration inventory

- `Docgen.command.ts:81-138`: preserve package/input flags, aliases,
  optional semantics, and default-false all. These descriptors are not the
  migrated data owner. Preserve every sibling command option.
- Migrate only the owned operation call and its selection normalization point
  listed above. The other eval command is a separate candidate and remains
  on its current path until its own staged change.
- `Targets.ts:271-316`: the two source-operation callers are at887/1035;
  exhaustive source search also found the public example at257. The graph
  omitted the helper's call edge, so no-consumer conclusions are invalid.
  Preserve input read/decode first, input scope/path metadata, configured
  target lookup and sort order, zero-target error, packet-limit conversion,
  analyzeDocgenQuality arguments and all returned report payloads. Source cap
QualityWorkerEval.ts1175-1176 maps <=0 to0 and positive values to the maximum
of caller limit and existing DEFAULT_SOURCE_PACKET_LIMIT; raw helper retains
its broader Number domain. CLI uses Flag.Int163 with existing default, rejects
negative875, and supports0. Do not tighten the public helper to integer/nonnegative
merely because the canonical CLI operation is validated.
- `internal/quality/Quality.scope.ts:107-176`: retain raw resolver behavior,
  orphan-config-before-conflict ordering, package discovery, all discovery,
  affected/changed-files behavior, and existing `DocgenQualityScopeMode`.
  The new selection does not replace this broader scope family.
- `internal/QualityWorkerEval.ts` owns report decode, packet-limit conversion,
  analysis and JSON generation. `internal/QualityWorkerRunpodEval.ts` owns
  the Runpod evaluator and serializer. Neither report schema changes.
- `commands/Docgen/index.ts:14`, `src/test/Docgen.test-kit.ts:11,25-29`, the
  package's exported `commands/*` subpaths and `Docgen.command.ts:1213-1223`
  registrations preserve CLI/test reachability. Targets' documented import
  remains valid. A new shared symbol requires its normal documented export;
  no duplicate broad barrel layer is needed.

## Guard-deletion accounting

Replace the owned four-key source object with the selection+packetLimit
operation. Eliminate the owned sourceCount local/counting expression and its
separate !=1 dispatch by making the boundary selection resolver return the
existing error or one valid schema case at the same position. Raw rejection
is retained once, not removed. The Runpod sibling owns replacing its void-returning requireRunpodEvalSource
helper; no Runpod deletion credit belongs to this local instance.

The canonical resolver has one exhaustive selection match, with no input
Option presence check, independent all flag or package Option fallback. The
legacy helper retains the wider compatibility decision tree because its
supported inputs require it. Count only the migrated command's redundant
source carrier and canonical-path fallback checks; do not claim removal of
all public-helper checks. Shared report construction must prevent this
compatibility path from becoming a duplicated helper wall.

## Encoded-side impact

The operation is internal Tier1. No input/output JSON codec is redefined.
Its result remains `{ report, scope, sourceQualityReport }`; full report
payloads flow unchanged to the existing evaluator. Input emits scope `input`
and the exact supplied path. Generated package/all emit the existing scope
and generated:package/generated:all identity. Preserve report schema versions,
all keys, defaults, optional omission, false values, packet ordering and JSON
bytes. The wider exported helper still permits and preserves its current
generated:affected result metadata for no-selection callers.

## Test impact

During authorized implementation, test all eight source projections, exact
zero/multiple-source messages, full selected string payloads, and no file,
workspace or network work before the current validation gates. Include
empty strings and malformed input report behavior without inventing validation.
Cover all three successful sources, zero packets, output-file versus stdout,
and existing JSON golden/codec behavior. Add direct public-helper compatibility
cases for input+other selectors, no selection, and no-input all+package with
orphan-config precedence; these broader helper cases do not expand the three
valid CLI operation states. Use source aliases in package tests.

Current test/docgen.test.ts3701-3729 invokes input worker eval with packet-limit0,
checks schemaVersion1, scope/path/provider/model, codex default low reasoning,
SDK version, source packet count, zero selected packets and output-file log.
That fixture does not establish package/all/invalid-input coverage by itself.
Runpod command tests around3869/3895 belong to the sibling design and retain
their current confirmation/cleanup behavior. Run focused Docgen suites and `bun run beep quality package-verify @beep/repo-cli`
at implementation time. No product tests or provider requests ran in P2.

## Risk

The main risk is accidentally restricting the exported raw helper to the
three CLI cases or changing error/I/O precedence. Preserve that public
compatibility explicitly and restrict the tagged operation to successful
command normalization. Both eval designs share one schema/resolver and must
be staged serially: the first creates shared pieces and migrates only its own
call; the second reuses them and migrates the other call. Do not implement
both candidate records just because they share a helper. Coordinated with the
Runpod P2 owner: shared selection/resolver are created once; raw entrypoint
continues all existing input-first/affected behavior. The historical docgen quality-scope design is archived: its actual raw
request remains D1 and cannot inherit this post-validation 8/3 proof. This
current P2 design is not an independent P3 receipt or source implementation.

Integration and original provisional hashes: `data/r28-cli-first-owners-integration.json`.

Preserve exact command errors and order: source-selection error first, then
negative packet-limit error, then blank model error; only afterwards read/decode
input or inspect workspace. Generated source analysis remains scoreMode codex.
Report generation then output file write and wrote log, or stdout content, remain
unchanged. DomainError/NoSuchFileError catches keep reportDocgenCommandError;
other errors retain their existing behavior. This P2 launches no worker/model,
provider or subprocess and makes no runtime proof claim.
