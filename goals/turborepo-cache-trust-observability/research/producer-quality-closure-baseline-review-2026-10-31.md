# Reviewed producer quality-seal input closure

PR #2386 adds the protected-producer verifier layer to the quality command.
The canonical policy fingerprint writer follows that real import closure and
adds exactly four inputs to `//#lint:policy-fingerprint:quality`:

- `packages/drivers/github/src/GitHubContent.ts`
- `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.github.schemas.ts`
- `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.github.ts`
- `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts`

No quality-seal input is removed. The cache flag, command (`true`), dependency
on the shared seal, environment and output settings remain unchanged. The
reviewed `turbo.json` source change is that generated input-list expansion;
`standards/policy-tools.fingerprint.json` mirrors the same closure. A seal
records policy implementation inputs; this grants no cached security verdict.

Use the canonical reviewed-baseline compare-and-swap writer, restricted to
subject `//`, with the exact previous digest in the request. Carry all other
package reviews. Retain the existing four-computation scope and historical
profile `local-linux-x64-bun1.4.2` / epoch `qualification-v2`; this configuration
acknowledgement makes no current-runtime or qualification claim. The separate
current-runtime review remains necessary before new runtime qualification.

After writing, require the only changed projected node to be the quality seal
and the only changed source to be `turbo.json`, with no added/removed nodes,
no other configuration changes and a byte-identical qualification ledger.
No disposition, exception, cache enablement, artifact key, tenant or deployment
changes. All full goal criteria remain unproven.

Recovery: retain the exact prior baseline privately and reverse through a new
reviewed compare-and-swap request for the then-current digest after restoring
the prior reviewed input closure. Never overwrite a newer baseline or replace
the qualification ledger.
