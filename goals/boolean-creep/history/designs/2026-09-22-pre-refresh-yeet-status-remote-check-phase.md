# Instance

- id: `yeet-status-remote-check-phase` (stable existing id; expanded members)
- source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- corpus source: `663904610cce2a38c06b0619a8c414646b69361c`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:206`
- symbol: `YeetStatusRemote`
- members: `available`, `checked`, `isDraft`
- classification: E1/E4; stored; persisted; literalkit; Tier 2 singleton
- native source receipt: `../data/design-refresh-2026-09-09-r27-cli-seed-drift.md`
- independent census: `../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-cli-yeet-contract-correction1.jsonl`
  and its completed `.execution.json`
- design handoff: `../data/design-refresh-2026-09-09-r27-remote-status-design.md`
- prior exact design: `../history/designs/2026-09-09-r27-pre-draft-axis-yeet-status-remote-check-phase.md`

The completed independent correction confirms this expanded 12/5 contract.
It is a census correction, not P3 approval. This design does not advance
canonical inventory status or authorize implementation before packet gates.
References to `Status.ts`, `Handler.ts`, and `MonitorLoop.ts` below are under
`packages/tooling/tool/cli/src/commands/Yeet/internal/`; `test/...` is relative
to `packages/tooling/tool/cli/`.

# Current shape

`YeetStatusRemote` at `Status.ts:206` is a public schema class with required
`available` and `checked` booleans (`:208`–`:209`) and exact optional
`isDraft: S.optionalKey(S.Boolean)` (`:213`). Draft has three states: absent,
false, true. There are no defaults for these three encoded fields. The app
authors availability/checking around its GitHub call; the different
`GhStatusPullRequest` at `:313` is the driver mirror with required isDraft.

The current remote schema has 25 fields, in this encoded order:

```text
available, checked, detail, checkCount, failingCheckCount, isDraft,
mergeStateStatus, mergeable, number, pendingCheckCount, requiredCheckCount,
failingRequiredCheckCount, pendingRequiredCheckCount, optionalCheckCount,
failingOptionalCheckCount, pendingOptionalCheckCount,
unresolvedReviewThreadCount, unresolvedReviewThreads, unresolvedThreads,
headSha, rerunFailedCommand, rerunFailedDecision, reviewDecision, state, url
```

All 22 non-selected siblings survive. `detail` is required `S.String`.
The eleven optional finite numbers are `checkCount`, `failingCheckCount`,
`number`, `pendingCheckCount`, `requiredCheckCount`,
`failingRequiredCheckCount`, `pendingRequiredCheckCount`, `optionalCheckCount`,
`failingOptionalCheckCount`, `pendingOptionalCheckCount`, and
`unresolvedReviewThreadCount`. None gains an integer, nonnegative, presence,
or cross-count constraint. Optional strings are `mergeStateStatus`,
`mergeable`, `rerunFailedCommand`, `rerunFailedDecision`, `reviewDecision`,
`state`, and `url`. `unresolvedReviewThreads` is an optional string array.
`unresolvedThreads` is an optional-key `Option<Array<YeetStatusReviewThread>>`
with None constructor default; `headSha` is the same Option/default
arrangement for a string. Thread payloads and their own optional fields and
defaults also remain unchanged.

`YeetStatusSnapshot.remote` nests the schema at `:275`; snapshot version
is `yeet-status/v1` at `:277`, codec `YeetStatusSnapshotJson` at `:311`, and
writer `:1386`. A second boundary at `Handler.ts:1251` prints the decoded
snapshot through generic `printCommandJson`, bypassing the artifact codec.
Both output representations must be accounted for.

# Cardinality gap

The product is `2 × 2 × 3 = 12`, with exactly **five** supported states.

| Phase | available | checked | isDraft | Evidence |
| --- | --- | --- | --- | --- |
| skipped | false | false | absent | `Status.ts:858`–`:862`; triage test `:166`. |
| checked-absent | false | true | absent | No-PR and truncated-output constructors at `Status.ts:926`–`:937`. |
| checked-present-draft-unknown | true | true | absent | Legacy rendering at `test/yeet-status-triage.test.ts:153`–`:161`, check summaries at `:458`/`:471`, actual artifact writer at `test/yeet-artifact-writers.test.ts:355`–`:377`. |
| checked-present-not-draft | true | true | false | Live constructor at `Status.ts:972`–`:976`; `openRemote` fixture at `test/yeet-status-triage.test.ts:93`. |
| checked-present-draft | true | true | true | Same live constructor; explicit draft test at `test/yeet-status-triage.test.ts:358`–`:374`. |

Seven unsupported triples are available/unchecked with any draft state,
plus each unavailable phase with either Boolean draft value. E1 is the
explicit writer family. E4 is availability implying checked and a produced
draft value implying checked-present. Legacy unknown draft is an exercised
operation, not merely a permissive arbitrary schema value.

`deriveYeetMergeReady` reads `remote.isDraft === false` at `Status.ts:1117`.
Unknown and true draft both fail `notDraft`, but remain different encoded
states. Not-draft does not mean merge-ready: all other criteria still run.
The bounded audit establishes no relations between phase and the 22 other
payload fields.

# Target schema

Define the schema-owned payload-free domain:

```ts
const YeetStatusRemotePhase = LiteralKit([
  "skipped",
  "checked-absent",
  "checked-present-draft-unknown",
  "checked-present-not-draft",
  "checked-present-draft",
])
```

Annotate the kit and expose its same-name derived type. A private annotated
`S.Class` named `YeetStatusRemoteValue` contains required `phase` plus exactly
the 22 sibling fields above. Remove **all three** selected axes from the
decoded model. Do not retain an independent optional isDraft, available,
checked, draft Option, cached predicate or compatibility getter beside phase.
The five values establish no different payload requirements, so a LiteralKit
field is appropriate rather than five tagged payload classes.

Retain a private encoded-boundary class `YeetStatusRemoteEncoded` with the
exact current 25 fields, order, codecs and defaults. It is not the business
constructor. Define one schema-owned phase transformation: fallible decode
accepts exactly the five table rows and builds `YeetStatusRemoteValue`;
encode uses `YeetStatusRemotePhase.$match` for the exact inverse. Both
copy all non-selected siblings without stronger validation or normalization.
Explicitly exclude the replaced keys instead of spreading a whole old value
into the new model or a whole phase model into the encoded representation.

Export the codec `YeetStatusRemote` and its same-name Type alias:

```text
YeetStatusRemoteEncoded
  .pipe(S.decodeTo(S.toType(YeetStatusRemoteValue), remotePhaseTransformation))
```

`S.toType` is intentional: the transformation receives already decoded
`unresolvedThreads` and `headSha` Options. Its target Encoded must be the
Value class's Type, not an optional-key representation that would require a
second Option conversion. Use `SchemaGetter.transformOrFail` for decode,
returning `SchemaIssue.InvalidValue` for unsupported triples, and
`SchemaGetter.transform` for the total five-phase inverse. Legacy scalar/key
validation runs before tuple selection. Exact optional-key input does not
silently accept explicit undefined or null as absence.

The generic command JSON boundary needs the same inverse at the *old decoded
value* level. Derive a second private boundary codec by replacing only the
source of this same transformation with `S.toType(YeetStatusRemoteEncoded)`.
Its Type remains the phase model; its Encoded is the old remote value with
runtime Options. This is a supported separate output contract, not a second
truth table or domain alias. An internal `printYeetStatusCommandJson` export
used by Handler encodes `snapshot.remote` through this boundary, replaces
only remote at its existing snapshot property position, and calls the
existing `printCommandJson`. All other snapshot values and generic
serialization behavior remain unchanged. Do not silently route the whole
CLI value through `YeetStatusSnapshotJson`, which would also change existing
Option representations on that output.

Migrate every legacy `.make` call; do not preserve or reattach the old flat
constructor API on the codec. Source producers use private Value construction;
public examples and external test fixtures use Effect/Result decoding of
legitimate encoded input. No `.fields` consumer was found, and no old class
alias is needed. Export the phase kit/type through the existing Yeet facade;
keep Value/encoded classes and transformation private. Export the command
printer only for its actual Handler and focused test consumers.

Exact local Effect v4 basis: `.repos/effect/packages/effect/src/Schema.ts:2490`
defines Type-side extraction; `:5366`–`:5385` defines source-Type to
target-Encoded transformation; `SchemaGetter.ts:612` defines fallible getters;
`SchemaIssue.ts:747` gives `InvalidValue(annotations, input, options)`.
This composition is a design specification, not an executed prototype.

# Migration inventory

| Surface | Required migration or preservation |
| --- | --- |
| `Status.ts:192`–`:237` | Add kit/Value/encoded schemas and shared bidirectional mapping; migrate example and remove all three decoded axes. |
| `:245`–`:311` | Update snapshot examples; nest the compatibility codec; retain every snapshot field, version, mergeReady Option, gate defaults and JSON codec. |
| `:858`–`:862` | Construct skipped through Value and preserve exact detail. |
| `:926`–`:937` | Construct checked-absent for both nonzero-exit and truncated-output paths, preserving distinct detail strings. |
| `:939`–`:998` | Keep GitHub decode, check partitions, thread pagination/triage, head binding and rerun collection. Required `view.isDraft` selects known-not-draft or known-draft; preserve all payloads/omissions. Live collection does not invent unknown draft. |
| `:1006`–`:1049` | Keep sibling-based readiness helpers: required counts, merge/review status, thread count and closeout/head binding. |
| `:1108`–`:1127` | Three checked-present phases enter readiness derivation; skipped/checked-absent return None. Only checked-present-not-draft yields notDraft true. Preserve dual call forms and criterion order. |
| `:1130`–`:1163` | Retain command priority: verdict repair, dirty-worktree publish, checked-absent PR creation, checked-present remote guidance, fallback verify/remote. Unknown draft reaches remote guidance. |
| `:1181`–`:1219` | Collect the new decoded snapshot and derive nextCommand/mergeReady without changing outer fields. |
| `:1231`–`:1240` | Only skipped short-circuits to checks-not-checked. Every checked phase keeps required-partition, then legacy-unsplit, then missing-count precedence. Do not suppress counts on checked-absent. |
| `:1281`–`:1297` | Present phases render threads; others render not-checked. Preserve nonempty structured-triage preference and legacy-string fallback. |
| `:1349`–`:1368` | Only skipped prints remote-not-checked; all checked phases print original detail. Preserve line order, gate/readiness and rerun text. |
| `:1386`–`:1399` | Preserve artifact schema encoding, error mapping, path/directory behavior and one trailing newline. |
| `:1416`–`:1430` | Preserve dual `yeetStatusNextCommandForTesting` with new decoded type. |
| `Handler.ts:1248`–`:1253` | Replace direct generic printing of the phase snapshot with the bounded command printer; retain YeetCommandError context and injected/chunked stdout. |
| `Handler.ts:1055`, `:1069`–`:1108`, `:1217` | Preserve status writing/rendering, mergeReady propagation, rerun suffix and unresolved-review enforcement. Sibling readers must not gain phase-based filtering. |
| `MonitorLoop.ts:964`–`:1007` | Preserve snapshot write/render, merged/closed detection from remote.state, headSha and failed-check rerun planning. Phase is not PR lifecycle state. |
| `src/commands/Yeet/index.ts:21`–`:44` | Preserve codec/snapshot/readiness/render exports and add phase kit/type. Do not export boundary or Value classes. |
| `src/test/Yeet.test-kit.ts:8` | Existing facade forwarding carries public exports; explicitly expose the command printer only if needed for focused boundary tests. Tests remain package-alias imports. |

Graft direct symbol search, Status API/field search, source-wide snapshot
search and Handler/MonitorLoop field searches found these consumers. A
complementary repository source search found no additional app consumer or
remote `.fields` use. The empty class caller graph was not treated as proof
of no consumers. Generic command printing was found by following the parent
snapshot.

# Guard-deletion accounting

| Old obligation | Concrete deletion/replacement |
| --- | --- |
| Independent fields at `Status.ts:208`, `:209`, `:213`. | Remove all three from Value; one LiteralKit phase carries five states. Legacy axes exist only in actual boundary schemas. |
| Four constructions at `:858`, `:926`, `:933`, `:972`. | Delete available/checked assignments and copied draft field; select one phase. |
| `!remote.checked || !remote.available` at `:1112` and `:1282`. | Delete both compound implication guards; use kit-derived membership in the three present phases. |
| `remote.isDraft === false` at `:1117`. | Remove the redundant draft read; derive notDraft exclusively from checked-present-not-draft. Unknown never passes. |
| Reconstruction at `:1157`–`:1158`. | Replace both Boolean conditions with phase matching, retaining command priority. |
| `!remote.checked` at `:1232` and checked ternary at `:1358`. | Replace both with the skipped phase guard; keep independent payload checks. |

The boundary contains the sole five-tuple compatibility validation. Preserve
process/truncation handling, count/review fallbacks, head binding, criterion
ordering and merge-ready checks: these represent independent facts.

# Encoded-side impact

Artifacts retain required encoded available/checked, optional isDraft, all
22 sibling codecs/defaults, current property order and `yeet-status/v1`.
Phase never appears in remote JSON. Unknown draft is omitted, not false or
null. The seven unsupported triples reject with a schema issue; do not
normalize them or strip supplied known keys. Missing required flags still
fail; exact optional-key validation remains.

No new payload ownership is inferred. All siblings remain accepted on any
of the five phases where the old schema accepted them. Checked-absent with
supplied counts still follows the old renderer; thread/rerun/state payloads
are not stripped. Preserve None versus Some(empty array), absent versus zero,
empty strings, finite numeric domains, full thread records and head hashes.

Command output is a separate established serializer:
`Handler.ts:1251` -> `src/internal/cli/Json.ts:296` -> unknown-value JSON.
Its adapter restores the old decoded remote through the shared inverse and
then uses the same printer. Phase cannot leak; old runtime Option
representations remain on this boundary, and outer snapshot serialization
is unchanged. Aligning generic output with artifact encoding would be
separate work; this migration must not silently do it. Preserve
`CommandJsonOutput` injection, bounded UTF-8 output, compact JSON and one
trailing newline.

Compare pre/post canonical remote encodings, full artifact bytes and captured
full CLI JSON bytes independently. Preserve errors, artifact location,
snapshot version, test-kit exports and public error channels. No artifact
rewrite, version bump, dependency change or GitHub request change is needed.

# Test impact

1. Exercise all 12 tuples through the public codec: five exact round trips
   and seven rejections. Assert phase, exact omission/false/true, no decoded
   legacy axes, no encoded phase and no new defaults. Include explicit
   undefined/null and missing-required-key failures where old schemas reject.
2. Round-trip minimal/full sibling payloads, all check partitions, legacy
   counts, optional zero/empty strings, None/Some(empty and populated triage),
   all thread fields and headSha. Retain unusual accepted phase/payload
   combinations; do not restrict beyond the audited triple.
3. Migrate `test/yeet-status-triage.test.ts:80`–`:113`, `:153`, `:166`,
   `:176`, `:295`, `:344`, `:358`, `:458`, `:471` and its JSON test.
   Preserve legacy unknown-draft rendering. With every other readiness
   criterion satisfied, false may pass while unknown/true fail not-draft;
   skipped/checked-absent yield None. Retain first-blocker order, exact-head
   closeout binding, dual calls, command priority and checked-absent counts.
4. Migrate `test/yeet.test.ts:154`, `:157`, `:2272`, `:2304`, `:2336`,
   `:2343`, retaining codec helpers, repair guidance, dirty-worktree publish,
   threads and rerun behavior. Use supported codec decoding for fixtures;
   do not expose Value merely to preserve old `.make` calls.
5. Extend real `test/yeet-artifact-writers.test.ts:355`–`:377` fixtures to
   all five phases. Compare bytes/newline/version and decode with
   `YeetStatusSnapshotJson`; retain no-runtime-Option artifact assertions.
6. Capture `CommandJsonOutput` on the actual status-JSON path before/after.
   Compare exact bytes for all five phases, Option-rich remote and all outer
   fields, including payload above 64 KiB. Artifact tests do not prove generic
   CLI compatibility. Keep Handler and monitor sibling/terminal/rerun tests
   without live GitHub operations.

Derive phase guards/arbitraries/equivalence from kit/Value schemas. Tests
import `@beep/repo-cli/test/Yeet` or the existing JSON helper alias. At
implementation handoff run full `bun run beep quality package-verify @beep/repo-cli`
and the packet's Yeet proof workflow. This design-only pass runs no product
or package tests.

# Risk

Land as one Tier 2 singleton under this stable id after fresh P3 review of
the independently confirmed expanded triple. The old three-phase design is
archived byte-for-byte; its old review cannot approve the new draft axis.
This lane changes no source, inventory or lifecycle status.

Principal risks are treating missing draft as false, retaining an independent
decoded draft axis, dropping sibling payloads and leaking phase through
untyped CLI JSON. Both output codecs share one inverse, with separate exact
byte fixtures required before apply. This is not the separate
`yeet-merge-ready-verdict` migration: preserve that carrier's codec/criteria
and change only how notDraft is derived here. Refresh citations/consumers
when source moves.
