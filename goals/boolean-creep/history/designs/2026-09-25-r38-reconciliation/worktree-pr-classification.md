# worktree-pr-classification

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 64/5. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `PrClassification` at `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts:83`,
with members `failed`, `reusedBranch`, `reapClass`, `prNumber`, `mergedHead`.
Storage/exposure: stored/internal; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-pr-classification.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

Private PrClassification at Reap.service.ts:80-86 has failed/reusedBranch Booleans, WorktreeReapClass's four literals and Option prNumber/mergedHead payloads. classifyPr:152-196 checks open PRs first, then merged PRs, and only the merged branch probes current HEAD to detect reuse. Missing live HEAD also counts as reused. The incoming NUL parser and removal registration security do not change this producer or its readers.

# Cardinality gap

The full product is2x2x4x2x2=64. Five legitimate tuples exist: probe failure(unknown,true,false,None,None), open(open-pr,false,false,Some(number),None), none(no-pr,false,false,None,None), merged exact(merged-pr,false,false,Some(number),Some(GitObjectId)), and merged reused(merged-pr,false,true,Some(number),Some(GitObjectId)). E1 writers161,165-171,175,179,189-195 and E3 failed/unknown reader338 prove the relation. Required numeric/object-id contents are payloads, not added axes.

# Target schema

Use named annotated schema classes for payload-bearing cases, a LiteralKit for each finite discriminator domain, and schema-derived matching through `S.toTaggedUnion`. Keep schemas in the existing owner module and preserve complete payload types. Exact local Effect v4 references: `.repos/effect/packages/effect/SCHEMA.md:3135-3163`, `src/Schema.ts:5366-5390` (`decodeTo`), `:6105` (`toTaggedUnion`), `:1868` (`encodeUnknownEffect`), `:12848-12851` (`OptionFromNullOr`), and `src/SchemaTransformation.ts:333-340` (fallible bidirectional transformations). The local reference hashes are in the impact receipt; these API references are separate from corpus source pins.

Define private annotated LiteralKit-backed tagged cases probe-failed, open-pr({prNumber}), no-pr, merged-pr({prNumber,mergedHead}), and merged-reused-branch({prNumber,mergedHead}). Reuse the existing GitHub-decoded number payload contract and GitObjectId schema; preserve full values. Derive the Type and exhaustive matching from the schema. Retain public WorktreeReapClass's vocabulary unchanged and project it from cases; no new public class literal.

# Migration inventory

- Reap.service.ts:80-86,152-196: replace all five state constructions. Keep open-first query ordering, gh decode, branch strings, current HEAD probe and exact comparison to merged PR headRefOid.
- Reap.service.ts:98-110,332-376: EvidenceProbe's nested pr type follows the private union; failure produces the exact gh-probe-failed warning343 and pr None. Later Git/idle failures retain Some(pr) for existing candidate evidence.
- Reap.service.ts:378-389: project reap class for classSkipReason and match merged-reused-branch for refusal. Preserve dirty-tree, class, reused-branch, too-young priority.
- Reap.service.ts:430-445: project reapClass/prNumber through schema matching, including failure-path evidence. Reap.service.ts:465-480 preserves mergedHead as CandidateAssessment.authorizedHead for eligible results, including size-measurement failure.
- Reap.service.ts:532-584: preserve recheck, candidate payload replacement, authorized HEAD refusal, expectedHead passed to removal, success and cleanup outcomes. Incoming Worktree.service.ts:695-747,880,1030,1089 target revalidation and expected-HEAD CAS remain independent safety contracts.
- Reap.schemas.ts:33-45,123-137 preserves public class, optional numeric evidence and all sibling payloads. Reap.command.ts:23-42 and21,122-123 retain labels and schema-encoded JSON. Private union gains no barrel export; Worktree/index.ts existing public exports remain.
- worktree-reap.test.ts open/revived/reused/no-PR/GitHub-failure/HEAD-race cases and request497 remain in scope; preserve incoming managed-root fixture69-72 and all outcome assertions.

# Guard-deletion accounting

Remove failed/reusedBranch/reapClass plus duplicated Option wrappers from this private carrier; the case tag determines class/failure/reuse and owns only supported PR/head payloads. Replace failed338, reused385 and projections432,443-444,467,476,481 with schema matches. Keep open/merged query guards, raw Git failure checks, live HEAD equality, dirty/age/liveness eligibility, recheck and every target/authority safeguard. No standalone classifier-coherence validator exists to delete.

# Encoded-side impact

Tier 1 internal. WorktreeReapCandidate retains the same reapClass and prNumber projections, including explicit null through OptionFromNullOr. mergedHead remains internal authorization data and must not be added to JSON or dropped before expectedHead. Preserve all report fields, keys, warning text and order; no new public tag.

# Test impact

At implementation time cover all five states, failed open/merged queries, open taking precedence over historical merged, absent/mismatched/exact current HEAD, and full candidate projections. Retain authorized-head/recheck/branch-CAS safety and warning outcomes under incoming removal refusals. Validate schema-encoded report JSON via the public reaper seam and run required package verification during implementation only. No tests ran here.

# Risk

Conflating a reused branch with an eligible historical merge can delete active work. Preserve open-first ordering, absent live HEAD refusal, exact object-id payload and all revalidation layers. Tier 1E serial Reap.service work; no dependence on candidate-retirement implementation and no P3 approval claimed.
