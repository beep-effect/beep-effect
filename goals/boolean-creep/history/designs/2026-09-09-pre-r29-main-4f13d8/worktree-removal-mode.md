# Instance

- id: `worktree-removal-mode`
- exact source SHA: `05405bf322da0ca7eb88b8bb402145081e8fded6`
- corpus source SHA: `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:304`
- symbol: `WorktreeRemovalRequest`
- members: `archive`, `deleteBranch`
- evidence: E4 at `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts:686-695` — `validateRemovalRequest` rejects `deleteBranch` without `archive`; branch deletion is a later phase of archive retirement and therefore implies archive.

# Current shape

The exported decoded service request at `Worktree.schemas.ts:304-318` carries
two booleans for three removal behaviors. Plain removal refuses dirty state and
retains the branch. Archive removal fences the checkout, preserves reachable
residue, removes the tree, and retains the branch. Archive plus branch deletion
performs the same retirement and then deletes the branch with the archived
HEAD compare-and-swap. The fourth boolean pair is rejected by
`validateRemovalRequest` before the service branches.

There are two production writers: the interactive command adapter at
`Worktree.command.ts:802-839` forwards raw CLI flags, while the reaper at
`Reap.service.ts:558-573` always requests archive plus branch deletion. The
service reads `deleteBranch` at `Worktree.service.ts:837-850` and `archive` at
lines 1024-1035. It also reconstructs the request with a fenced target path at
line 980.

# Cardinality gap

Two booleans represent four pairs. Three modes are legal: `remove`, `archive`,
and `archive-and-delete-branch`. `deleteBranch: true` with `archive: false` is
illegal because branch deletion is safe only after archive retirement has made
the target HEAD reachable and preserved residue.

# Target schema

Keep the domain in the existing leaf schema-role file. Define and export an
annotated LiteralKit beside `WorktreeRemovalRequest`:

```ts
export const WorktreeRemovalMode = LiteralKit([
  "remove",
  "archive",
  "archive-and-delete-branch",
]).pipe(
  $I.annoteSchema("WorktreeRemovalMode", {
    description: "Preservation and branch-retirement behavior for removing a managed worktree.",
  })
)
export type WorktreeRemovalMode = typeof WorktreeRemovalMode.Type
```

Replace `archive` and `deleteBranch` on `WorktreeRemovalRequest` with
`mode: WorktreeRemovalMode`. The CLI continues to expose the two existing
boolean flags. After the current target-existence checks, its adapter rejects
the illegal raw pair with the exact current error and path, then collapses the
three legal pairs into one mode before request construction. This placement
preserves current error precedence for a missing target.

Use `WorktreeRemovalMode.$match` at mode decision boundaries. `remove` invokes
the legacy path; both archive modes invoke archive retirement. Only
`archive-and-delete-branch` makes the optional branch eligible for deletion.
Do not add `isArchive` or `shouldDeleteBranch` aliases.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:13-18,264-318` — reuse the existing `LiteralKit` import and identity composer; add `WorktreeRemovalMode` in this leaf schema module, replace the request booleans with `mode`, and update the titled example, Details prose, and annotation to describe all three modes.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts:33` — import `WorktreeRemovalMode` with the request schema.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts:715-800` — preserve the public `renderWorktreeRemovalReceipt(receipt, archive)` API and its exact output. Its boolean is a presentation parameter outside the campaign record and has no illegal combination.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts:802-839` — retain raw `archive` and `deleteBranch` in the command adapter. After resolving the existing target and branch, preserve the exact conflict message from `Worktree.service.ts:691` and its `targetPath`; map the three legal pairs to `WorktreeRemovalMode.Enum.*`, construct one request mode, and keep receipt rendering based on the raw `archive` flag.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts:882-896` — preserve both CLI flag spellings, defaults, descriptions, and command wiring unchanged.
- `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts:30,558-573` — import the mode and replace the always-true pair with `mode: WorktreeRemovalMode.Enum["archive-and-delete-branch"]`; retain the authorized-HEAD comments and behavior.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts:686-695` — delete `validateRemovalRequest`; the decoded request can no longer represent its rejected pair.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts:837-850` — select a branch only in the `archive-and-delete-branch` mode, using the LiteralKit helper rather than a boolean projection; preserve detached-head behavior and the compare-and-swap deletion command.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts:923-1021` — retain the mode when the request is copied for the fenced path at line 980; preserve fencing, rollback, quiescence checks, residue capture, deletion, prune, and branch-deletion order.
- `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts:1024-1035` — replace validation plus `Bool.match(request.archive)` with one exhaustive mode match: `remove` uses `removeLegacyWorktree`; both archive modes use `removeArchivedWorktree`.
- `packages/tooling/tool/cli/src/commands/Worktree/index.ts:64-69` — the wildcard schema facade automatically exports the new owner. `packages/tooling/tool/cli/src/index.ts:395-403` exports only the command from the package root, so no root-barrel edit is needed.
- `packages/tooling/tool/cli/test/worktree-command.test.ts:595-623` — replace the now-unconstructible direct invalid service request with command-adapter coverage of the same flag conflict and exact message, while retaining proof that the target survives.
- `packages/tooling/tool/cli/test/worktree-command.test.ts:669-1150` — migrate every direct request fixture to `archive` or `archive-and-delete-branch` according to its old pair. The legacy fixture at lines 1039-1046 becomes `remove`.
- `packages/tooling/tool/cli/test/worktree-reap.test.ts:489-518` — migrate the direct archive-and-delete request fixture.
- `packages/tooling/tool/cli/test/worktree-reap.test.ts:459-487` — extend the captured reaper request assertion to prove its mode is `archive-and-delete-branch`, in addition to its authorized HEAD.

The exact writer search found 15 non-example request constructions: two in
production, twelve in `worktree-command.test.ts`, and one in
`worktree-reap.test.ts`. The service's line-980 fenced copy spreads the request
and changes only `targetPath`, so it requires no new mode construction.

# Guard-deletion accounting

- Delete `validateRemovalRequest` and the `!request.archive &&
  request.deleteBranch` implication guard at `Worktree.service.ts:686-695`.
- Delete the `request.archive` service dispatch at
  `Worktree.service.ts:1031-1035`; an exhaustive mode match owns the three
  cases.
- Delete the `request.deleteBranch` predicate at
  `Worktree.service.ts:841`; only the archive-and-delete mode enables branch
  deletion.
- Delete both booleans from `WorktreeRemovalRequest` and every downstream
  reconstruction of their combinations. Keep one raw conflict check only at
  the CLI adapter where the legacy two-flag input originates.

# Encoded-side impact

None. `WorktreeRemovalRequest` is an internal decoded TypeScript service
request. It is neither persisted nor emitted, and all repository consumers
are migrated atomically. The public TypeScript shape changes from two booleans
to one literal without a compatibility alias, as authorized by the campaign
rider for exported decoded shapes.

The CLI continues to accept the same two flags with the same defaults and
descriptions. It preserves the exact conflict text and current missing-target
error precedence. Console receipts, residue manifests, archive refs, generated
paths, Git argument order, dirty/unpushed handling, authorized-HEAD fencing,
and `branchDeleted` receipt semantics remain unchanged.

# Test impact

- At the command adapter, table-test all four raw flag pairs: the three legal modes and the exact `--delete-branch requires --archive so branch deletion cannot discard unreachable commits.` failure. Include a missing-target case to lock the existing precedence before the flag conflict.
- Migrate all request fixtures identified above and assert the reaper supplies `archive-and-delete-branch`.
- Retain the existing focused behavior coverage: legacy clean/dirty removal, archive-only branch retention, archive-and-delete branch removal, detached HEAD, residue-root refusal, dirty submodules, encoded refs, clone separation, dirty/unpushed preservation, process fencing, authorized HEADs, fence failures, and failed fenced-copy deletion.
- Retain exact receipt rendering tests at `worktree-command.test.ts:475-569`; the presentation API and output do not change.
- Add a small schema-derived check for `WorktreeRemovalMode.Options` only if needed beyond constructor coverage; do not create a duplicate test literal list.
- Run focused Worktree command/reaper tests and full `@beep/repo-cli` package verification during implementation.

# Risk and sequencing

Land in Tier 1E after re-reading Worktree source at the implementation SHA.
The archive-first removal path is safety-sensitive: preserve the fence,
rollback, quiescence, residue, prune, and compare-and-swap sequence exactly.
The only behavioral relocation is the impossible-pair validation from the
service request to the raw CLI adapter, at the same point in observable error
precedence. No dependency, generated file, persisted schema, CLI spelling, or
receipt shape changes.
