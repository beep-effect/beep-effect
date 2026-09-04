# Instance

- id: `worktree-removal-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:294`
- symbol: `WorktreeRemovalRequest`
- members: `archive`, `deleteBranch`
- evidence: E4 at `Worktree.service.ts:664-673` — the removal service rejects
  `deleteBranch` without `archive`; branch deletion is a later phase of archive
  retirement and therefore implies archive.

# Current shape

The exported decoded service request carries two booleans for three removal
behaviors. `remove` retains the branch and refuses dirty state, `archive`
preserves reachable residue before removal, and archive plus branch deletion
performs the same retirement before deleting the local branch. The fourth pair
is rejected by `validateRemovalRequest` before any work begins.

# Cardinality gap

Four boolean pairs are representable and three removal modes are legal:
`remove`, `archive`, and `archive-and-delete-branch`.

# Target schema

Add an annotated `WorktreeRemovalMode` LiteralKit beside the existing
Worktree schema family and replace `archive` plus `deleteBranch` on
`WorktreeRemovalRequest` with `mode`. Match the literal at the removal-service
decision boundaries. The CLI continues to parse the two existing flags,
preserves the exact `--delete-branch requires --archive` error before request
construction, and collapses the three legal raw pairs into the literal once.

# Migration inventory

- `Worktree.schemas.ts:264-300` — define and export the named literal and type;
  replace the request fields and update its titled example and annotation.
- `Worktree.command.ts:795-831` — retain the raw parser flags because function
  parameters are outside this campaign, validate the illegal pair at this
  adapter, construct one request mode, and derive receipt presentation from
  that mode without changing command output.
- `Worktree.service.ts:664-881` — remove `validateRemovalRequest`; match request
  mode for legacy versus archived removal and delete the branch only for
  `archive-and-delete-branch`.
- `Worktree.service.ts` preservation helpers — replace archive/delete-branch
  reads with exhaustive mode matches while preserving archive-ref creation,
  residue capture, worktree removal, prune, and branch-deletion order.
- `commands/Worktree/index.ts` and package barrels — export the new owner if
  the existing Worktree schema barrel is explicit; do not add a compatibility
  alias for the never-encoded decoded request shape.
- `test/worktree-command.test.ts` — migrate every request fixture and replace
  the direct invalid service request with CLI-boundary conflict coverage.
  Update any schema arbitrary and source-contract assertions found by the final
  whole-source search.

# Guard-deletion accounting

Delete `validateRemovalRequest`, its `!request.archive &&
request.deleteBranch` implication guard, both booleans on the decoded service
request, and downstream interpretation of their combinations. The same raw
flag conflict remains only at the CLI compatibility boundary, where the
illegal user input originates.

# Encoded-side impact

None. `WorktreeRemovalRequest` is an internal decoded TypeScript service
request and is not persisted or emitted. The two CLI spellings, default values,
exact conflict message, console receipts, residue manifests, archive refs, and
branch behavior remain unchanged. This is an authorized atomic decoded public
TypeScript migration of all in-repo consumers.

# Test impact

Table-test all four raw CLI flag pairs: the three legal modes and the exact
delete-without-archive error. Exercise clean and dirty removal, residue
preservation, detached worktrees, optional branches, archive-only branch
retention, archive-and-delete branch deletion, and unchanged receipt text.
Tests continue importing source through `@beep/repo-cli`. Run focused Worktree
tests and full `@beep/repo-cli` package verification.

# Risk and sequencing

Land in Tier 1E after the packet PR and after re-reading any Worktree changes
merged to `main`. The recent archive-first Worktree work is still moving, so
the implementation PR must repeat the declaration/writer/reader/test/barrel
search at its exact source SHA. Keep `WorktreeResidueReason`, dirty/unpushed
facts, timestamps, provider paths, and receipt `branchDeleted` independent.
