# Checkpoint to follow-up integration preview

A git merge-tree preview of checkpoint head
`90cd89d70c7096d1f4629cd89bac1a72c58d7263` and the saved follow-up branch
reports seven conflict paths. The preview writes only a temporary Git tree;
it does not change either checkout or perform the integration.

- goals/effect-vitest-canon/ops/inventory/detector/beep_repo-cli.jsonl
- goals/effect-vitest-canon/research/OPPORTUNITIES.md
- packages/tooling/tool/cli/test/docgen-stall-watchdog.test.ts
- packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts
- packages/tooling/tool/cli/test/residue-reap.test.ts
- packages/tooling/tool/cli/test/worktree-reap.test.ts
- standards/effect-vitest.inventory.jsonc

After checkpoint readiness and merge, fetch main and merge it normally into
the follow-up branch. Re-evaluate conflicts against that actual main head.
Keep the later scoped-fixture migrations and their assertions while carrying
the checkpoint CI repairs and upstream changes. Preserve both sets of
opportunity receipts. Reconcile inventory occurrences by finding identity,
not by replacing the inventory wholesale from either branch.

Run focused Node and Bun proof, actual test-type diagnostics, ratchets and
package verification against the integrated dependency version before
applying the prepared shared-internals migration. Its existing baseline
timings describe the earlier dependency state and must not be presented as
a before/after comparison across different Effect versions.

The refreshed preview includes the named diagnostic fixtures introduced by the
checkpoint knowledge-reference repair. Preserve those exact strings and the
follow-up branch's canonical assertions. For the two overlapping scope/provider
pairs, compare rule IDs as well as occurrence hashes: different rules can
share a hash because they refer to the same enclosing source expression.

## Source conflict resolution preview

Against checkpoint `90cd89d70c`, the four source conflicts can preserve the
follow-up's canonical assertions:

- Docgen watchdog: three conflict blocks. Retain `Effect.flip` for expected
  failures. The resolved preview equals the follow-up file byte for byte.
- Residue reap: one conflict block. Retain both `Effect.flip` checks for
  invalid home roots. The resolved preview equals the follow-up file exactly.
- Worktree reap: two conflict blocks. Retain `assertNone` and the expected
  failure check through `Effect.flip`. The resolved preview equals the
  follow-up file exactly.
- Knowledge semantic delta: two call-site conflicts and three duplicate
  diagnostic constants introduced by the automatic merge. All three pairs
  have identical literal expressions. Retain the follow-up names and remove
  the duplicate checkpoint declarations. The resulting whole-file syntax
  tree equals the follow-up file without assertion normalization.

Private receipts preserve these resolutions and the preview tree. They are
unapplied and do not establish runtime integration proof. Re-evaluate against
the actual merged main head before using them; the ledger, opportunities,
and inventory conflicts still require their own reconciliation.
