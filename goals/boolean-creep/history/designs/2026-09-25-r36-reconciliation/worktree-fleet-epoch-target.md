# worktree-fleet-epoch-target

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Stored wire owner remains designed4/3, Tier2. Independent replacement P3 and
implementation are pending. Paths are relative to packages/tooling/tool/cli/.

## Current shape

Worktree.schemas.ts:1311-1320 exports FleetEpochTarget with full string ref, nullable string sha and materialized Boolean. FleetSnapshot:1393-1407 nests it. Four writers in Fleet.service.ts:871,885,896,910 produce unresolved false/null, known but unavailable false/string, and materialized true/string. The incoming clone parser adds an unlisted fallback at548-552; it changes checkout coverage, not this epoch owner or its constructors.

## Cardinality gap

Two materialization values times nullable SHA presence represent four combinations; three are legal. True/null conflicts with the documented meaning at1294-1297: unresolved remote means sha=null, while materialized means that commit object exists. E4 writers preserve this implication. This is not qualification merely from an absent writer. SHA remains a string payload: do not narrow the public field to GitObjectId merely because this producer validates remote tokens. E2 readers at Fleet.command.ts:124-129 and Fleet.service.ts:1177-1183 distinguish all three states.

## Target schema

Use named annotated case classes and a private LiteralKit discriminator in the
existing owner module. Map the intact kit before annotation; annotate the union
before toTaggedUnion to retain generated match/case statics. Verify nontrivial
codec composition against local Effect SCHEMA.md and Schema.ts decodeTo5388:
decode transforms source Type to target Encoded, not automatically target Type.
Class.extend14423 accepts field maps or Struct, not arbitrary transformation
codecs. Build canonical schemas separately; do not assert fabricated statics.

Use a LiteralKit-backed tagged union unresolved, known-unmaterialized({sha:string}) and materialized({sha:string}), with required ref:string beside one required state field on the canonical target class. Unresolved has no SHA payload; other cases require sha:string. Define annotated schema cases in Worktree.schemas.ts. Attach a bidirectional compatibility codec between the exact flat legacy fields and the decoded union; reject only true/null. Map false/null to unresolved, false/string to known-unmaterialized and true/string to materialized; encode back to exact ref,sha,materialized field order. Reject true/null before projecting away raw fields, with no silent coercion or erasure. The raw schema uses exact required S.String/S.NullOr(S.String)/S.Boolean; full arbitrary strings, including empty strings accepted by this public schema, remain supported. Keep the public schema/Type under its established FleetEpochTarget name; migrate supported decoded constructors/examples and their consumers atomically, without unneeded compatibility aliases.

## Migration inventory

- Worktree.schemas.ts:1311-1320,1393-1407 and examples1304,1376: union, codec, examples and FleetSnapshot nested codec.
- Fleet.service.ts:865-910: migrate all four constructors, preserving scanner availability, ls-remote validation, cached cat-file, fetch and post-fetch cat-file order, including --end-of-options and complete string payloads.
- Fleet.service.ts:920-928,1171-1198,1293-1316: pass the decoded target through DerivationContext, match materialized to obtain SHA, and retain head-unknown before target-unmaterialized precedence. Keep policy/conflict evaluation and independent failure aggregation.
- Fleet.command.ts:124-129: match decoded cases while retaining exact human labels and shortSha formatting. At317-323 explicitly encode with S.encodeUnknownEffect(FleetSnapshot) before calling printCommandJson. Keep the existing WorktreeCommandError message across both encoding and printing failures. Use one pipeline mapping both errors to that message; no private tag reaches generic serialization.
- internal/cli/Json.ts:19,190-195,310-318 is a generic unknown-value serializer, not a FleetSnapshot encoder. It must receive the encoded flat snapshot; defining a codec alone is insufficient.
- Worktree/index.ts:13,20,69 and package source exports remain; migrate public decoded FleetMirrorService.scan result consumers, direct examples and source test imports. No additional service or API alias.
- worktree-fleet-scan.test.ts:144,154,195,208,234,260,282,304-305 reads target fields; migrate decoded assertions and add exact captured command JSON comparisons. The new degraded-listing test167-212 must retain a materialized target and one unlisted clone with null facts. The legacy worktree-fleet.test.ts has no direct FleetSnapshot/target references in the source search; retain it as supporting Worktree regression coverage, not an invented direct owner consumer.

## Guard-deletion accounting

Delete the stored materialized/nullable-sha coordination. Replace two targetLabel decisions and deriveSignals' materialized ternary with schema case matches. Keep the independent missing-head/target-availability branching, all Git/spawn/truncation checks and input validation; no probe safety guard is deleted. Compatibility rejection of the impossible flat true/null tuple lives at the encoded boundary only.

## Encoded-side impact

Tier 2 wire, one singleton PR. All three legitimate flat target objects round-trip exactly, including full string values and explicit null. Preserve every FleetSnapshot sibling field (fleetRoot, originUrl, scannedAt, coverage, checkouts and contestedPaths), key order, array order and generic command output newline. Preserve decoder acceptance of all legitimate legacy payloads; no normalization of known-but-unmaterialized to unresolved. No field has a default: all three encoded fields remain required; do not turn missing SHA into null or missing materialized into false. The new NUL parser's unlisted fallback must still produce the same degraded checkout row and coverage counts, never a fabricated target failure. Direct decoded TypeScript changes are atomic; raw JSON remains flat through explicit schema encoding.

## Test impact

At implementation time round-trip all three target states with nontrivial ref/sha strings and reject true/null; compare complete command JSON bytes and human labels. Preserve unavailable scanner/ref, cached object, failed fetch, successful fetch and current incoming malformed-listing tests. Assert head-unknown precedence and unchanged checkoutsDegraded. Use public FleetMirrorService and CommandJsonOutput seams, and required CLI package verification. This P2 audit only enumerates the four finite projections; no scanner/worktree operations or runtime migration prototype were executed.

## Risk

The primary compatibility risk is a private tag leaking through printCommandJson because it does not automatically invoke nested schema codecs. Land alone as Tier 2 and explicitly encode the full snapshot. Coordinate shared Fleet.service edits serially with Tier 1 readers; their migrations are not prerequisites for changing this target contract. Independent P3 remains pending.
