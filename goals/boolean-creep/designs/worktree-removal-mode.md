# worktree-removal-mode

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/3. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `WorktreeRemovalRequest` at `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:305`,
with members `archive`, `deleteBranch`.
Storage/exposure: stored/internal; target: literalkit.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-removal-mode.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

`src/commands/Worktree/Worktree.schemas.ts:305-319` exports WorktreeRemovalRequest with archive/deleteBranch Booleans beside name, targetPath, mainCheckout, branch and expectedHead. The incoming name schema rejects dot/dotdot, separators, control characters and surrounding whitespace; targetPath is nonempty without control characters. Keep both exact schemas. Branch is OptionFromNullOr(string); expectedHead is OptionFromNullOr(GitObjectId); neither gains a default or a narrower payload.

The interactive writer at Worktree.command.ts:838-846 forwards raw flags. The reaper writer at Reap.service.ts:562-574 always requests archive and deletion with an authorized HEAD. The fenced copy at Worktree.service.ts:1038 changes only targetPath. Incoming validateRemovalRequest:695-747 now owns both the flag implication and target-security checks. This is an exported resolved operation owner; the raw function flag parameters remain outside this record.

# Cardinality gap

The pair represents four tuples; three operations are legitimate: false/false removes a clean tree and keeps the branch, true/false archives and keeps the branch, true/true archives then conditionally deletes the optional branch. False/true is rejected at Worktree.service.ts:702-707. This E4 relation is unchanged by incoming security work. Missing branch is still legitimate for all three modes and produces no branch deletion.

# Target schema

Use named annotated schema classes for payload-bearing cases, a LiteralKit for each finite discriminator domain, and schema-derived matching through `S.toTaggedUnion`. Keep schemas in the existing owner module and preserve complete payload types. Exact local Effect v4 references: `.repos/effect/packages/effect/SCHEMA.md:3135-3163`, `src/Schema.ts:5366-5390` (`decodeTo`), `:6105` (`toTaggedUnion`), `:1868` (`encodeUnknownEffect`), `:12848-12851` (`OptionFromNullOr`), and `src/SchemaTransformation.ts:333-340` (fallible bidirectional transformations). The local reference hashes are in the impact receipt; these API references are separate from corpus source pins.

Define exported annotated `WorktreeRemovalMode = LiteralKit(["remove", "archive", "archive-and-delete-branch"])` with its same-name runtime type in Worktree.schemas.ts. Replace only archive/deleteBranch with mode on the existing request class. Retain all five sibling fields and their exact schemas, annotations and supported decoded constructor semantics. Update its public example to a mode constructor.

At the interactive adapter, decode the hardened name, check target existence and exact registered entry, then check the raw false/true conflict immediately before request construction. Keep the exact conflict error message and targetPath from Worktree.service.ts:704-705. This preserves incoming precedence: context/NUL parse, invalid name, missing target, unregistered target, flag conflict, then service target-security validation. Collapse the three legal pairs once. Keep raw CLI flags and receipt rendering's archive function parameter. Service dispatch uses the LiteralKit matcher; only archive-and-delete-branch enables optional branch deletion. No compatibility Boolean aliases.

# Migration inventory

- Worktree.schemas.ts:265-319: preserve security and authority Details, migrate class fields/example and add mode in this existing leaf module.
- Worktree.command.ts:42,803-849: retain schema-derived name decoder, all three target diagnostics, raw flags and rendering at848; insert the single raw conflict guard after836 and before838.
- Worktree.command.ts command descriptors and renderWorktreeRemovalReceipt remain public compatibility surfaces. Preserve flag spellings/default false, messages and presentation API.
- Reap.service.ts:562-574: construct archive-and-delete-branch and preserve authorized expectedHead. Reap's new NUL parser at636-643 remains effectful and maps failure before assessment.
- Worktree.service.ts:695-747: remove only the implication block702-707. Keep validateRemovalRequest itself, its FileSystem/Path/ChildProcess requirements, schema-derived name validation, managed-root equality718, registration727, canonical path732 and common-directory equality744, with exact typed diagnostics.
- Worktree.service.ts:880,1030,1089: preserve all three validation calls and their order. Validate the original registered request before legacy deletion and immediately before archive fencing. Do not validate the renamed fenced copy against the original managed-name rule.
- Worktree.service.ts:894-908: replace deleteBranch filtering with mode matching; preserve None branch=>false and exact archived-HEAD compare-and-swap.
- Worktree.service.ts:980-1094: carry mode through fenced copy1038; retain safety validation before exhaustive service dispatch, authority checks, residue root, atomic fence, rollback, post-capture quiescence, prune and deletion order.
- Worktree.service.ts:253-259,619-632: preserve sanitized refName in residueRoot and containment refusal. These incoming fixes are not Boolean-coherence guards.
- Worktree/index.ts:69,76 and CLI package wildcard source exports expose the schema/service. Migrate decoded source consumers atomically; root src/index.ts exports command rather than every schema. No additional aliases.
- Incoming constructors: command838, reaper562, service fenced-copy1038, sixteen worktree-command.test.ts constructions at690,721,754,806,841,926,990,1035,1087,1100,1153,1188,1227,1274,1316,1368, and worktree-reap.test.ts:497, plus schema example290. The prior design's twelve command-test count is stale. Migrate the sixteen test constructions by their existing pair except the one deliberately invalid service request at806, which becomes adapter conflict coverage; preserve the original rejection/target-survival assertion.

# Guard-deletion accounting

Delete two stored request Booleans and the single implication guard at702-707. Replace the archive dispatch1090 and deletion selection898 with mode matches. Keep one raw conflict check at the adapter. Delete zero target-security, filesystem, registration, canonical-directory, authority, containment, process, quiescence or preservation guards. The old instruction to delete validateRemovalRequest wholesale is expressly withdrawn; all three calls remain.

# Encoded-side impact

Tier 1 internal decoded request. No request object is persisted or printed. The public TypeScript constructor shape migrates atomically under the campaign rider; no encoded compatibility alias is required. Preserve incoming accepted name/path inputs and every other payload; do not restore the pre-hardening broader path grammar. CLI flags/defaults, receipts, branchDeleted values, archive refs, sanitized residue destinations, manifests and Git operands remain exactly incoming behavior.

# Test impact

At implementation time retain NUL/hostile-path parser tests290-344, archive traversal-plan expectation243-251, command invalid/missing/unregistered diagnostics602-646, detached/dirty command behavior648-678, name mismatch680-707, symlink709-740, foreign common-directory742-777, and unregistered repository827-858. Add raw flag matrix with conflict precedence under invalid/missing/unregistered names. Migrate remaining request fixtures, preserve reaper authorized HEAD assertions459-518 and the managed-root fixture repo-worktrees at69-72. Preserve dirty-submodule, residue, rename/rollback, exact-HEAD, quiescence and cleanup-failure tests. Run focused Worktree tests and required CLI package verification only during implementation; no tests ran for this private P2 audit.

# Risk

The incoming validator contains safety checks that cannot be absorbed into the mode type. Removing the whole function or moving its rechecks would weaken target authorization. Land in the ordered Tier 1E tooling batch, with shared Worktree files edited serially. Independent P3 review must verify the exact incoming security sequence and raw-input diagnostics before implementation.
