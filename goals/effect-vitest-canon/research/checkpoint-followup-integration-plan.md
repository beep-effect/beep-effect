# Checkpoint to follow-up integration preview

A git merge-tree preview of checkpoint head
`ba46587821511774bdc233d8c87bc0fb23950559` and the saved follow-up branch
reports five conflict paths. The preview writes only a temporary Git tree;
it does not change either checkout or perform the integration.

- goals/effect-vitest-canon/research/OPPORTUNITIES.md
- packages/tooling/tool/cli/test/docgen-stall-watchdog.test.ts
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
