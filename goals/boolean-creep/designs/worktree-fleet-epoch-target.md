# worktree-fleet-epoch-target

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/3. Tier 2: one record per singleton PR.
Independent P3 review and implementation acceptance remain pending.

Owner `FleetEpochTarget` at `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:1072`,
with members `materialized`, `sha`.
Storage/exposure: stored/wire; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-fleet-epoch-target.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

Worktree.schemas.ts:1068-1077 exports FleetEpochTarget with full string ref, nullable string sha and materialized Boolean. FleetSnapshot:1150-1164 nests it. Four writers in Fleet.service.ts:871,885,896,910 produce unresolved false/null, known but unavailable false/string, and materialized true/string. The incoming clone parser adds an unlisted fallback at548-552; it changes checkout coverage, not this epoch owner or its constructors.

# Cardinality gap

Two materialization values times nullable SHA presence represent four combinations; three are legal. True/null is excluded by E4 writers. SHA remains a string payload: do not narrow the public field to GitObjectId merely because this producer validates remote tokens. E2 readers at Fleet.command.ts:124-129 and Fleet.service.ts:1177-1183 distinguish all three states.

# Target schema

Use named annotated schema classes for payload-bearing cases, a LiteralKit for each finite discriminator domain, and schema-derived matching through `S.toTaggedUnion`. Keep schemas in the existing owner module and preserve complete payload types. Exact local Effect v4 references: `.repos/effect/packages/effect/SCHEMA.md:3135-3163`, `src/Schema.ts:5366-5390` (`decodeTo`), `:6105` (`toTaggedUnion`), `:1868` (`encodeUnknownEffect`), `:12848-12851` (`OptionFromNullOr`), and `src/SchemaTransformation.ts:333-340` (fallible bidirectional transformations). The local reference hashes are in the impact receipt; these API references are separate from corpus source pins.

Use a LiteralKit-backed tagged union unresolved, known-unmaterialized({sha:string}) and materialized({sha:string}), with required ref:string beside the state. Define annotated schema cases in Worktree.schemas.ts. Attach a bidirectional compatibility codec between the exact flat legacy fields and the decoded union; reject only true/null. Map false/null to unresolved, false/string to known-unmaterialized and true/string to materialized; encode back to exact ref,sha,materialized field order. Keep the public schema/Type under its established FleetEpochTarget name; migrate supported decoded constructors/examples and their consumers atomically, without unneeded compatibility aliases.

# Migration inventory

- Worktree.schemas.ts:1068-1077,1150-1164 and examples1061,1133: union, codec, examples and FleetSnapshot nested codec.
- Fleet.service.ts:865-910: migrate all four constructors, preserving scanner availability, ls-remote validation, cached cat-file, fetch and post-fetch cat-file order, including --end-of-options and complete string payloads.
- Fleet.service.ts:920-928,1171-1198,1293-1316: pass the decoded target through DerivationContext, match materialized to obtain SHA, and retain head-unknown before target-unmaterialized precedence. Keep policy/conflict evaluation and independent failure aggregation.
- Fleet.command.ts:124-129: match decoded cases while retaining exact human labels and shortSha formatting. At317-323 explicitly encode with S.encodeUnknownEffect(FleetSnapshot) before calling printCommandJson. Keep the existing WorktreeCommandError message across both encoding and printing failures.
- internal/cli/Json.ts:17,179-183,296-303 is a generic unknown-value serializer, not a FleetSnapshot encoder. It must receive the encoded flat snapshot; defining a codec alone is insufficient.
- Worktree/index.ts:13,20,69 and package source exports remain; migrate public decoded FleetMirrorService.scan result consumers, direct examples and source test imports. No additional service or API alias.
- worktree-fleet-scan.test.ts:144,154,195,208,234,260,282,304-305 reads target fields; migrate decoded assertions and add exact captured command JSON comparisons. The new degraded-listing test167-212 must retain a materialized target and one unlisted clone with null facts. Existing worktree-fleet.test.ts renderer/service fixtures remain in the blast radius.

# Guard-deletion accounting

Delete the stored materialized/nullable-sha coordination. Replace two targetLabel decisions and deriveSignals' materialized ternary with schema case matches. Keep the independent missing-head/target-availability branching, all Git/spawn/truncation checks and input validation; no probe safety guard is deleted. Compatibility rejection of the impossible flat true/null tuple lives at the encoded boundary only.

# Encoded-side impact

Tier 2 wire, one singleton PR. All three legitimate flat target objects round-trip exactly, including full string values and explicit null. Preserve every FleetSnapshot sibling field, key order, array order and generic command output newline. Preserve decoder acceptance of all legitimate legacy payloads; no normalization of known-but-unmaterialized to unresolved. The new NUL parser's unlisted fallback must still produce the same degraded checkout row and coverage counts, never a fabricated target failure. Direct decoded TypeScript changes are atomic; raw JSON remains flat through explicit schema encoding.

# Test impact

At implementation time round-trip all three target states with nontrivial ref/sha strings and reject true/null; compare complete command JSON bytes and human labels. Preserve unavailable scanner/ref, cached object, failed fetch, successful fetch and current incoming malformed-listing tests. Assert head-unknown precedence and unchanged checkoutsDegraded. Use public FleetMirrorService and CommandJsonOutput seams, and required CLI package verification. No tests or fixtures were executed by this P2 audit.

# Risk

The primary compatibility risk is a private tag leaking through printCommandJson because it does not automatically invoke nested schema codecs. Land alone as Tier 2 and explicitly encode the full snapshot. Coordinate shared Fleet.service edits serially with Tier 1 readers; their migrations are not prerequisites for changing this target contract. Independent P3 remains pending.
