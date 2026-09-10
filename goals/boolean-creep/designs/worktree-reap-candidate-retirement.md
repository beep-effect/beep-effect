# worktree-reap-candidate-retirement

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 32/17. Tier 2: one record per singleton PR.
Independent P3 review and implementation acceptance remain pending.

Owner `WorktreeReapCandidate` at `packages/tooling/tool/cli/src/commands/Worktree/Reap.schemas.ts:132`,
with members `retired`, `skipReason`.
Storage/exposure: stored/wire; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-reap-candidate-retirement.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

Public WorktreeReapCandidate at Reap.schemas.ts:123-137 carries retired:boolean and skipReason:OptionFromNullOr(WorktreeReapSkipReason), beside path:string, branch:OptionFromNullOr(string), reapClass, prNumber:OptionFromNullOr(Int), idleHours:OptionFromNullOr(Finite), bytes:OptionFromNullOr(Finite). Preserve all full payloads and existing null encodings. The skip kit61-77 contains15 literals. WorktreeReapReport165-182 nests candidates and has fixed worktree-reap/v1 schemaVersion plus all count/byte/warning fields.

Incoming Reap.service NUL listing636-643 and WorktreeRemovalService target validation change upstream failure conditions. Existing outcomes remain: still-present failure is skipped retirement-failed; already-gone cleanup failure is retired with a warning. No new candidate flag state is needed.

# Cardinality gap

retired has2 values and skipReason has None plus15 literals, hence32 representable tuples.17 are legitimate: eligible(false,None), skipped(false,Some(each reason)), retired(true,None). All15 are retained: locked, detached-head, missing-directory, filesystem-probe-failed, git-probe-failed, gh-probe-failed, idle-probe-failed, dirty-tree, open-pr, no-pr, reused-branch, too-young, live-session, liveness-unknown, retirement-failed. E4/E1 writers Reap.service408-479,495,503,555,579 and readers539/543 plus Reap.command37-41 exclude true/Some. Other payload presence combinations remain accepted; do not infer new prNumber/bytes constraints from a candidate disposition.

# Target schema

Use named annotated schema classes for payload-bearing cases, a LiteralKit for each finite discriminator domain, and schema-derived matching through `S.toTaggedUnion`. Keep schemas in the existing owner module and preserve complete payload types. Exact local Effect v4 references: `.repos/effect/packages/effect/SCHEMA.md:3135-3163`, `src/Schema.ts:5366-5390` (`decodeTo`), `:6105` (`toTaggedUnion`), `:1868` (`encodeUnknownEffect`), `:12848-12851` (`OptionFromNullOr`), and `src/SchemaTransformation.ts:333-340` (fallible bidirectional transformations). The local reference hashes are in the impact receipt; these API references are separate from corpus source pins.

Define an annotated LiteralKit-backed disposition union eligible, skipped({reason:WorktreeReapSkipReason}), retired, inside Reap.schemas.ts. Replace the two decoded fields with this disposition and keep every sibling unchanged. Attach an exact bidirectional compatibility codec from/to the current flat candidate, rejecting only retired true with a non-null skipReason. false/null=>eligible, false/reason=>skipped, true/null=>retired. Reuse the established15-reason kit, not a duplicate literal list; use schema-generated matches and guards.

Migrate the exported decoded constructor and examples atomically with public Type users. The established schema name remains the candidate's codec owner; use a private legacy wire schema as needed, without a public compatibility alias. Report encoding composes the nested candidate codec.

# Migration inventory

- Reap.schemas.ts:61-137,165-182: reuse full reason kit, migrate class/example and nested report while preserving all sibling field schemas/defaults (there are no new defaults).
- Reap.service.ts:397-405 base no longer stores retired false; writers408,415,423,436,450,458 create skipped dispositions,465,474,479 create eligible. Preserve lock/detached/directory/probe/class/age/liveness priority and reporting-only size failure.
- Reap.service.ts:486-507: present/error-fallback true chooses skipped retirement-failed; gone chooses retired and retains exact retirement-cleanup-failed warning. Incoming target-security failures pass through this established outcome without becoming a new skip literal.
- Reap.service.ts:512-529: filter retired by schema guard, retain candidate order and byte totals, missing bytes=>0 and warning concatenation for apply.
- Reap.service.ts:532-584: match assessed and rechecked disposition; preserve full rechecked class/evidence plus assessed bytes547, authorization refusal555, expectedHead562-574, success579 and failure584. Retain incoming managed-path/registration/realpath/common-directory checks and original-request validation calls in Worktree.service.
- Reap.command.ts:23-42: match disposition once for action/skip text, retaining exact human labels and other payload formatting. Existing encoder21 and JSON path122-123 must continue encoding WorktreeReapReport before printCommandJson.
- Reap.service.ts:636-643 preserves --porcelain -z and typed NUL parse failure before assessment. Incoming worktree-reap.test.ts fixture69-72 must remain repo-worktrees.
- Worktree/index.ts:27,34,41 and package source exports expose candidate/report/workflow; update public constructors/examples, renderWorktreeReapReportLines input and worktree-reap.test.ts candidate fixtures551,561,571. No new export alias.

# Guard-deletion accounting

Delete retired/skipReason coordination from base and all writers. Replace Option guards539,543, renderer skip match37/action chain41 and retired filter518 with schema case selection. Keep eligibility/probe checks, candidate recheck, fs.exists failure=>present, authorization, removal, cleanup and warnings. No removed branch may suppress the already-gone cleanup warning or skip incoming target security.

# Encoded-side impact

Tier 2 wire singleton. Preserve exact candidate keys in current order, all values and explicit nulls. OptionFromNullOr encodes absence as null, not an omitted key; this applies to skipReason, branch, prNumber, idleHours and bytes. Preserve report schemaVersion worktree-reap/v1, applied flag, counts, byte totals, warnings and arrays in order. The report already has explicit schema encoding; preserve it while replacing the nested candidate codec. Do not emit the decoded disposition tag.

# Test impact

At implementation time round-trip eligible, retired and each of15 skipped reasons with representative complete sibling payloads; reject true/reason only. Assert explicit null versus zero and complete captured JSON bytes. Retain recheck-changed eligibility, authorized HEAD mismatch, still-present refusal, already-gone cleanup failure with warning, failed size measurement and bytes accounting. Include incoming registered-root fixture and NUL parsing behavior. Run focused command/reap tests and required CLI package verification during implementation; none ran here.

# Risk

Reporting an already removed checkout as merely retryable can cause unsafe repeated work. Preserve retired plus cleanup warning, and do not narrow independent optional evidence. Land alone as Tier 2; serial shared-file coordination with Tier 1 classifier/idle/removal modes must preserve their current public projections. Independent P3 remains pending.
