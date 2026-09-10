# corpus-mail-store-exception-approved-disposition

Native P2 proposal by Codex gpt-6-astra / xhigh under the current user-supplied
AGENTS instruction. Source HEAD e7b1e907726421c7d2a2e1cdd140280df47f2353;
origin/main bed30c6adf3beed7de8538209fbdc84d26a3b8ce. This is a Tier 2 singleton
compatibility change, with no implementation or independent P3 credit.

In source references below, `schemas` means
`packages/tooling/tool/cli/src/commands/Corpus/internal/Restoration.schemas.ts`,
and `transformations` means its sibling `RestorationTransformations.ts`.
Test paths are relative to `packages/tooling/tool/cli/test/`.

## Current shape

MailStoreExceptionRecord is a real S.Class at schemas 1118–1138. Its only Boolean
is `approved` at 1121. Its sibling `disposition` is exactly optional-key
MailDisposition at 1123, whose complete literal domain is defer/process/quarantine
at 1033–1037. The six shared identity fields at 287–294 add no Boolean. Do not
invent a second Boolean or a predicate over required counts, enums or strings.
This is the explicit E3 flag/payload-presence case allowed by DECISIONS 117–118;
SPEC's >=2 Boolean net describes scanner recall, not exclusion of this ratified
exact-presence example. It is not a merely one-way implication from a required
payload predicate.

The private class is exposed through the public TransformationLedgerRecord
union and its `.cases["mail-store-exception"]` constructor (1343–1373), plus JSON
encode/decode exports (1389/1405). Corpus.schemas.ts 63 and index.ts 36 export
that surface. The record is an app-owned append-only restoration ledger shape,
not an external SDK/DB mirror. It is stored/persisted and therefore Tier 2.

Common data remains exactly: preservationRunId, preservationSealSha256,
recordedAt, runLabel, schemaVersion; transformationRunId; attemptId;
exceptionKind (all five literals); family="mail"; mailScope (slice/full);
message; objectId; recordType="mail-store-exception"; retainedOutputBytes;
retainedOutputSha256; sourceFamily (eml/msg/ost/pst/residue). Preserve their
current branded/refined types and all actual values. None becomes an axis in
this independently adjudicated approved/disposition cluster.

## Cardinality gap

The complete encoded product is Boolean x (absent | defer | process | quarantine),
so eight representable states. Four coherent semantic states are supported:

| approved | disposition key/value | Coherent domain state | Current approval reader |
| --- | --- | --- | --- |
| false | absent | unapproved exception | false |
| false | defer | inconsistent approval evidence | false |
| false | process | inconsistent approval evidence | false |
| false | quarantine | inconsistent approval evidence | false |
| true | absent | inconsistent approval evidence | false |
| true | defer | approved defer | true |
| true | process | approved process | true |
| true | quarantine | approved quarantine | true |

Correct the raw 8/3 claim to **8/4**. The three current writer images are not the
entire accepted contract. appendPstException (transformations 1030–1058) emits
false/absent or true/quarantine; the budget terminal (2072–2090) emits
false/absent; the non-PST terminal (2102–2120) emits true/defer. No valid writer
produces either mismatch. The first computes approval from full scope and
non-engine-failure, then conditionally supplies the disposition from the same
value. Preserve that policy; do not permit slice or engine failure merely
because a disposition can be represented.

Process is also supported: the public codec includes it, mailExceptionIsApproved
at 4174–4175 checks only approved AND presence, and the complete mail segment
checks (4229–4297) do not distinguish the three dispositions. Resume (2164–2205)
and final reconciliation (4499–4508, 4899–4908) do not add a process-specific
restriction. Substituting process for quarantine in the otherwise valid explicit
exception fixture at restoration-transformations-coverage.test.ts 910–924
therefore leaves approval, identities, ownership, counts, hashes of retained
outputs and candidate accounting valid, with the ledger evidence digest
recomputed from its actual lines where required. This is a source-grounded
supported-input proof, not an assertion that an existing test already uses
process or that schema permissiveness alone proves legality.

The same fixture file 2820–2838 explicitly distinguishes a valid approval from
true/absent and false/quarantine; the latter return false. The enclosing test is
about rejection of malformed ownership/accounting. Corpus-command.test.ts
134–208 deliberately mutates evidence and invokes these diagnostic readers;
it does not assert those mutated combinations are legitimate domain operations.
A false/absent terminal is nevertheless a real produced domain state, even
though it blocks a successful family acceptance. Thus success alone is not the
legality criterion.

All eight structurally well-formed encoded combinations currently decode and
can be inspected. The four inconsistent inputs must keep that diagnostic
acceptance and their later rejection behavior. Distinguish four coherent
semantic states from eight encodable audit inputs; do not delete or silently
normalize the latter to manufacture a narrower public decoder.

## Target schema

Keep the existing MailDisposition LiteralKit and every common payload schema.
Replace decoded sibling `approved` and optional `disposition` with one required
`approval` schema. No decoded Boolean, compatibility getter, missing default,
null or empty-string sentinel remains. For this persisted evidence contract the
concrete target is a small tagged evidence union:

| approval.kind | Payload | Intended construction |
| --- | --- | --- |
| unapproved | none | Normal unapproved writer; encodes false/absent. |
| approved | required disposition: existing MailDisposition | Normal approved writer; encodes true/full literal value. |
| missing-disposition | none | Lossless decoded diagnostic for true/absent. |
| unapproved-disposition | required disposition: existing MailDisposition | Lossless decoded diagnostic for false/present, including process. |

Use an annotated LiteralKit for these four new kind values, schema-first case
classes and `S.toTaggedUnion("kind")`; derive constructors and guards from that
union. Preserve the original outer `recordType` and the outer public tagged
union. Keep the model and compatibility codec in the existing schema role;
no package, service, new module, architecture relocation or dependency is needed.
Annotate the schema and every reused case with the existing $I composer and
provide same-name derived types where the schema is not a class.

A coherent business result alone could be Option<MailDisposition>. The tagged
union here is justified by the independently supported *diagnostic evidence*
contract: true/absent and false/present have different exact inverse encodings,
and false/present carries the full disposition. Do not introduce one class per
defer/process/quarantine value. The two diagnostic variants are not newly
approved domain states and must never pass approval or be chosen by normal
writers. They prevent malformed input from being normalized into legitimate
unapproved or approved evidence.

Preserve an exact private encoded schema with the old flat fields, validators,
order and optional-key semantics. Compose it with the honest decoded model
through `S.decodeTo` and `SchemaTransformation.transform`, with the bijection in
the table above. A concrete implementation can keep a private encoded ledger
union and a decoded TransformationLedgerRecord union; bridge only this mail
member and pass every other record through unchanged. Feed the composed codec
into the existing JsonStringCodec helpers. Keep the exported decoded union and
its `.cases` as schema models with normal constructors/guards, rather than
assuming a transformed codec retains class `.make` statics.

Local Effect reference Schema.ts 5366–5397 and SchemaTransformation.ts 382–392
support this pure reversible mapping. Reuse JsonCodec.ts 78–85 for JSON;
introduce no native JSON parser or throwing codec wrapper. The raw compatibility
schema is a concrete boundary exception, not a second operational Boolean
model; no business reader may depend on its fields.

Whole-record codec construction must preserve the old field ordering when
encoding compact JSON. Retain approved at its original position and disposition
at its original optional slot; do not append flattened fields after a common
spread. This matters to current evidence digests and golden encoded strings.
Keep every key/default/validator of the old raw class exactly. Normal constructors
supply only unapproved or approved-with-disposition; the decoder alone classifies
inconsistent flat input. Direct test construction of diagnostic variants remains
available where testing the reader contract is intentional.

## Migration inventory

| Surface | Required change and preserved behavior |
| --- | --- |
| schemas 287–294, 1027–1037, 1118–1138 | Retain all identity, exception and disposition domains. Introduce the required approval union; retain exact flat encoded schema privately. No extra Boolean or payload restriction. |
| schemas 1343–1405 | Migrate the exported decoded case and union atomically; compose one compatibility codec and reuse its JSON encode/decode functions. Other ledger members and outer recordType remain exact. |
| transformations 211, 1030–1058 | Build one approved/quarantine or unapproved variant from the existing full-scope/non-engine-failure policy. Remove the conditional disposition spread and quarantineDisposition wrapper when no caller remains. Keep returned approval Boolean and all caller counter/error decisions. |
| transformations 1127–1140, 1227, 1387, 1400 | Keep all appendPstException paths, classifications, retained partial/final digest and caller return/unapproved accounting. Those callers receive the same scalar result; no error/timeout policy changes. |
| transformations 2072–2120 | Budget exhaustion constructs unapproved; unsupported non-PST family constructs approved/defer. Keep messages, family/scope, byte/digest fields and returned counters exactly. |
| transformations 256–264 | Append the same compact encoded line plus one newline through the existing durable append helper; preserve error mapping and writer-claim ownership. |
| transformations 1454–1483 | Decode all eight structural combinations into typed evidence. Preserve missing-file policy, newline/blank-row rejection, per-line decode failure, identity/scope check, record order and original lines. Do not fail mismatches early, drop them, or reserialize lines. |
| transformations 1607–1637, 4363–4379 | Every exception, including diagnostic or unapproved evidence, remains a terminal for ID binding/counting. Preserve attemptId/objectId and interruption behavior; do not filter mismatches out. |
| transformations 1865–1922 | Keep pending-summary counters, ceilings, ordering and the exact failure message. Reuse original decoded.lines for pending acceptance digest; approval still blocks inconsistent and unapproved evidence. |
| transformations 2164–2205 | Keep lifecycle/segment rejection before retained-output rehash and candidate lookup, the existing prior-checkpoint error, unknown-candidate error, processed set, full input/output counters and resume behavior. |
| transformations 4135, 4174–4175 | Update extracted decoded type. Replace the conjunctive coherence reader with the approval union's derived approved-case guard. Its true/false behavior for every old input remains identical. |
| transformations 4229–4297 | Preserve count, unique identity, safe attempt, child/warning ownership and repair checks in current order. `A.every(exceptions, mailExceptionIsApproved)` may retain its name as the test-facing semantic adapter, now using the derived guard. |
| transformations 4499–4508, 4518–4575 | Keep unapproved summary and lifecycle gates, terminal/segment checks, original line hashing and exact failure boundaries. Approval mismatches remain decoded evidence that causes the same later semantic rejection. |
| transformations 4594–4609, 4643–4707, 4768–4775 | Preserve full exception fields used to hash retained partial/final output and determine owned roots. Disposition is not permission to bypass digest, path or physical-file validation. |
| transformations 4878–4908, 5065–5089 | Keep digest/ceiling/count checks before semantic segment acceptance, and retained-output rehash only after acceptance. Preserve final error and all resulting acceptance bytes/metadata. |
| Corpus.schemas.ts 63; Corpus/index.ts 36; package.json 32/102 | Keep the actual public command facade and encoded exports; migrate the decoded TypeScript case in the same PR. No legacy decoded alias/getter is required by a proven consumer. |
| src/test/Corpus.test-kit.ts 15; transformations 4910–5063 | Keep testing namespace consumers in sync; remove quarantineDisposition export only after confirming no caller. Retain mailExceptionIsApproved behavior or its existing test-facing name over the new derived guard. |
| test/corpus-command.test.ts and test/restoration-transformations-coverage.test.ts | Update all case constructors, direct approved/disposition assertions, S.is guards, encode/decode consumers, and raw mutation handling atomically. Keep their deliberate malformed-input coverage. |

Exhaustive packages/apps searches find the specific record/type/helper consumers
only in the two implementation files and the two test files; the facade chains
above explain the public exposure. Graft's missing callers edge was not treated
as absence proof. The complete search result and exact input copies are bound
in the private audit bundle. No externally deployed TypeScript consumer was
identified; encoded ledger compatibility remains mandatory regardless.

## Guard-deletion accounting

Remove the operational Boolean field and optional-payload bag from the decoded
case. Delete the `record.approved && record.disposition !== undefined`
coherence expression at 4175, replacing it with one schema-derived approved-case
guard. Normal writer construction no longer duplicates the same decision into
approved and an optional spread; delete that spread at 1045 and the obsolete
quarantineDisposition object wrapper at 211 plus its unused test export at 4985.
The decoded explicit false/true writes at 2077/2106 disappear into constructors.

The compatibility codec reconstructs the two original wire fields exactly once
at the boundary and classifies inconsistent evidence exactly once at decode.
Those boundary checks and field emissions remain and are not counted as globally
deleted guards. Retain the approval gate itself: unapproved and diagnostic
exceptions still prevent resume and successful acceptance. Retain all semantic
identity, ownership, digest, count, resource-ceiling and checkpoint checks;
this design removes no unrelated safety validation.

There is no permission to interpret a present disposition as approved without
checking the decoded approval variant: false/present is an explicit rejected
diagnostic variant. That would otherwise introduce a safety regression.

## Encoded-side impact

The output format remains `oppold-corpus-restoration/v1`, with the same outer
recordType and exact flat approved/disposition property names and values. No
approval or kind key appears in JSON. The inverse map preserves all eight
structural combinations; coherent output remains the same four states and
normal current writers still emit their existing three-state subset.

Omission is literal key absence. The old field is S.optionalKey(MailDisposition),
not OptionFromNullishOr: null, empty string, unknown literal and explicit
undefined at object validation must not become a newly accepted absence. There
is no default for approved or disposition. Preserve missing approved rejection
and every required/refined common field. Local Effect Schema.ts 2285–2309
establishes exact optional-key semantics. Do not alter unknown/excess-key
handling: keep the old raw schema and parse options unchanged.

Malformed JSON, unknown recordType, unknown disposition and invalid field types
still fail the schema path and retain the existing mapped decoding failure.
Structurally valid mismatches still decode and remain counted, then return false
from approval and fail the existing resume/final acceptance checks. Do not
collapse that into an earlier schema error or rewrite contradictory evidence.

Keep old ledger files and their whitespace untouched. decodeTransformationLedger
preserves its existing CRLF/LF splitting policy; strictEvidenceSha256 hashes the
original line strings with its existing LF join and trailing newline at
4551–4553, not newly encoded decoded objects. The pending-summary digest at 1913
also uses original lines. Compare old and new compact encoder bytes for complete
fixture records in every one of the eight combinations, with the old property
order, full strings/Unicode and omitted-key behavior. New append bytes and all
acceptance/evidence digest behavior must match the old implementation.

Decoded exported TypeScript changes are atomic and authorized. Existing
encode/decode function names, Effect/error contracts, command options, CLI
messages, persisted paths, hashing, fsync/append behavior and external engines
remain unchanged. No dependency, lockfile, generated output, corpus data file,
public schema-version or driver contract change is part of this design.

## Test impact

Add a complete eight-combination compatibility table through the public JSON
codec. For each case assert its decoded variant, exact inverse JSON bytes and
approval result. Include approved/process as a positive supported fixture;
include false/absent as a real emitted but unapproved terminal. Check missing
approved, null/unknown disposition, wrong types, exact omission and relevant
excess-key behavior against the old codec. Assert all common payloads survive.

Use the existing coverage exception (910–924) and matching start/candidate/output
fixture to add process and defer variants to successful resume/segment tests.
Recompute ledger evidence hashes from actual test lines where changing bytes;
do not mistake stale hashes for disposition rejection. Preserve the explicit
unknown-candidate failure at 952–958 and retained-output drift/ownership cases
at 2611–2636. No change may allow corrupt evidence to bypass these checks.

Migrate the intentional malformed fixtures at 2820–2838 through encoded
construction/decoding or explicit diagnostic variants. Preserve all three old
approval expectations, and extend to the eight-row table. Test the complete
resume error and final acceptance error for both mismatch directions, including
false/process, after otherwise valid identity and hash bindings. Do not satisfy
the test by rejecting the row at the public codec first.

In corpus-command.test.ts preserve the derived case guard at 74–76, filtered
exceptions at 168 and semantic calls at 176. The generator at 134–208 currently
mutates top-level Boolean/string/number fields. After removing the decoded
Boolean, move approval-specific tampering to the encoded flat representation
before decoding and/or deliberately mutate the nested discriminated evidence;
do not silently lose those adversarial cases because the generic mutator ignores
object payloads. The existing generic exercise loop only invokes readers and
does not claim every mutation must reject; retain that distinction and add
explicit assertions for this pair's known outcomes. Preserve all other mutation
and ordering/lifecycle cases.

Keep generated mail restoration fixtures, ledger rewrite/digest tests at
2819–2852, and corrupt-store assertions at 2920–2955. Update the direct approved
assertion to the derived approved variant while retaining output and filesystem
checks. Preserve full/slice and password/corrupt/codepage/engine-failure policy
coverage; exact journal append count, terminal order, retained output, counters,
resume immutability, pending summary and acceptance behavior remain the oracle.

At implementation run focused Corpus suites and the required
`bun run beep quality package-verify @beep/repo-cli`, then canonical Yeet gates
for this single Tier 2 PR. Require an exact-source independent P3 review of the
compatibility table and all consumers before implementation. This preparation
runs only private data/section/inventory validation, not product tests or engines.

## Risk

The largest risk is conflating coherent domain states with permissive audit
inputs. An Option-only decoder that drops approved would approve false/present;
a strict four-state decoder would move mismatch failures earlier and could
change mutation/counting/hash behavior. The explicit diagnostic variants and
reversible flat codec prevent both regressions without approving those inputs.
A second risk is pruning process solely because no current writer emits it;
source readers accept it and the complete three-value payload must survive.

Preserve exact encoder property order and original line hashing. Treat schema
bytes and ledger bytes separately: no historical file is rewritten. The two
codec directions and decoded constructor migration must land atomically with
all known consumers in one Tier 2 PR. If implementation cannot demonstrate exact
byte/acceptance/error-boundary compatibility, stop before apply and repair this
design; do not waive the encoded-side gate or count it as P3 success. No unresolved
source eligibility question remains, but the codec proof and independent review
are future required gates, not claims made by this P2 document.
