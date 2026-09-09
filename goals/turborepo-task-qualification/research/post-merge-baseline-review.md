# Reviewed main integration and new runtime profile

Reviewed 2026-09-09 after the operator requested committing the qualification
work and merging current main. Merge `bab96e90fc` incorporates main
`85cc86d1f3`. This review attributes inherited configuration; it grants no
qualification, runtime equivalence or cache activation.

The [complete delta](./post-merge-baseline-delta.json) compares the prior
baseline with a fresh native census under the installed Bun 1.4.2 runtime.
There are still 142 workspaces and 2,840 configured graph nodes. Executable
nodes change from 1,503 to 1,480: 26 codegen wrappers disappear and three
nodes become executable (`@beep/lint-rules#docgen`, `@beep/md#audit`, and
`@beep/runpod#codegen`). Graph-only nodes remain in the census.

Across the common population, 1,476 complete-script digests and 137 commands
change because main converged generated workspace scripts. Task dependency
closures and global Turbo configuration remain unchanged. One task definition
changes: uncached, persistent `@beep/storybook#storybook` gains `PORTLESS` and
`PORTLESS_URL` pass-through variables. Its child configuration is the only
changed Turbo source. No common node changes its cache flag. The two new
cached nodes raise the inherited, unassessed cached population to 929.

All workspace manifests equal merged main except the two owned changes:
`@beep/repo-configs` exposes the cache policy facade; `@beep/identity` retains
the quiet implementation behind its generated wrapper and preserves the
verbose diagnostic command. Their package boundaries do not expand.

The replacement baseline keeps scope limited to `@beep/identity#lint`, under
profile `local-linux-x64-bun1.4.2` and epoch `qualification-v2`. The old
`local-linux-x64-bun1.4.1` / `qualification-v1` ledger entry and history remain
immutable. A separate exclusion records that the new runtime and wrapper need
fresh capture, comparison, shadow and signed-remote proof. The identity child
configuration remains `cache: false`. No acceptance transfers across epochs.

The canonical baseline writer must check the previous baseline digest and
this review's bytes. The transition writer must check ledger revision one
before recording the new exclusion. A subsequent audit must report no drift;
that result still classifies inherited caching as unassessed.
