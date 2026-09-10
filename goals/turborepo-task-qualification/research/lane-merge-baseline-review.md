# Reviewed quality-lane main integration

Reviewed 2026-09-09 at merge `ed12e4ede8`, which incorporates main
`bed30c6adf`. The operator requested the commit and main merge. This review
attributes the inherited task graph and script changes; it grants no cache
qualification, promotion or new activation.

The [complete changed-field delta](./lane-merge-baseline-delta.json) compares
the previous reviewed baseline with a fresh native census. The population
still has 142 workspaces and 2,840 configured graph nodes. Executable nodes
decrease from 1,480 to 1,474 because six `test:property` wrappers were removed:
cosmos, graph-3d, n3, ontology-domain, oxigraph and shacl. Those configured
nodes remain graph-only. There are no new executable nodes, no changed
commands among common nodes and no changes to their cache flags. Inherited
cached executable nodes decrease from 928 to 922 and remain unassessed.

Main's quality-lane changes remove dependency-lint edges from root `lint` and
`lint:fix`, add transit dependencies to unit/property tests, remove unused
test pass-through variables and remove `CI` from the audit environment list.
The complete projection has 649 changed effective configurations and 500
changed dependency lists. Across configuration fields, `dependsOn` changes
on 509 nodes, `env` on 140, and `passThroughEnv` on 140. Complete-script
digests change on 667 nodes as manifests add test-typechecking scripts and
remove redundant property-test wrappers. The root global configuration is
unchanged; `turbo.json` is the only changed Turbo configuration source.

These are reviewed inherited settings, not evidence of semantic safety.
Environment and task-graph changes still require fresh qualification before
any affected tuple can promote. In particular, identity lint now has no task
dependencies. The pilot must validate that actual graph instead of demanding
the former types-lint execution. The separately governed types lint tuple
remains excluded after its previously observed unsafe ignore-file replay.

The baseline scope remains exactly `@beep/identity#lint` and `@beep/types#lint`,
under `local-linux-x64-bun1.4.2` and `qualification-v2`. Both child lint cache
flags stay false. Existing ledger entries and transition history must remain
byte-identical. The canonical writer must compare the old baseline digest
and verify this review's bytes. Audit must then report zero drift while still
reporting all 922 inherited cached computations as unassessed.

The changed lockfile and root files invalidate earlier activation, toolchain
and entrypoint bindings. Fresh previews and isolated worktree inputs are
required before the next native pilot run. Historical receipts remain intact
and do not prove this integrated configuration or any signed remote behavior.
