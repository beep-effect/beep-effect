# Reviewed private observation storage input closure

PR #2611 adds `Cache.workflow.storage.ts`. The canonical policy fingerprint
writer follows the real quality-command import closure and adds exactly this
one input to `//#lint:policy-fingerprint:quality`:

- `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.storage.ts`

No input is removed. Removing only that inserted line from each generated file
reproduces its exact pre-writer bytes: `turbo.json` and
`standards/policy-tools.fingerprint.json`. The seal command, cache flag, outputs,
dependency, environment and every other setting remain unchanged.

Use the existing reviewed-baseline compare-and-swap writer, restricted to root
subject `//`, with the exact previous baseline digest. Preserve all other
reviews, the four-computation scope, profile `local-linux-x64-bun1.4.4`, epoch
`qualification-v3`, and the qualification ledger bytes. This acknowledges an
additional implementation input; it grants no qualification or cached security
verdict and changes no runtime signing, tenant, credential or deployment.

After writing, require exactly one changed projected node (the quality seal),
exactly one changed source (`turbo.json`), no added/removed nodes, no other
configuration change, and an unchanged qualification ledger. Preserve the prior
baseline privately. Reverse through a fresh reviewed compare-and-swap request
for the then-current digest after restoring the earlier reviewed input closure;
never overwrite a newer baseline or reset the ledger.
