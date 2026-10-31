# Producer quality closure after accepted R5b main

The integration consumes accepted main `adedee335a` (PR #2407), including its
reviewed `@beep/markdown` dependency and policy-input changes. Its baseline is
the authoritative starting point. Preserve all 188 non-root subject reviews,
its four-computation scope, `local-linux-x64-bun1.4.4` profile and
`qualification-v3` epoch. This preserves an accepted current-runtime profile;
it does not replay, qualify, rotate, enable or restore an older runtime.

Relative to that accepted baseline, the producer verifier adds exactly these
four inputs to `//#lint:policy-fingerprint:quality`:

- `packages/drivers/github/src/GitHubContent.ts`
- `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.github.schemas.ts`
- `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.github.ts`
- `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts`

The canonical fingerprint writer retains the accepted Markdown inputs and adds
no other root task change. No input is removed; command, cache flag, outputs,
dependencies and global configuration stay unchanged. The canonical baseline
compare-and-swap request targets root subject `//` only and binds the exact
accepted-main baseline bytes and this review. Carry the accepted R5b reviews
for `@beep/repo-docgen` and `@beep/effect-drizzle` without modification.

After writing, compare all nodes and sources to the accepted starting point:
only the quality-seal node and `turbo.json` source may differ. Require no added
or removed node/source, unchanged global settings/profile/epoch/scope, unchanged
non-root reviews, and a byte-identical qualification ledger. This acknowledgement
grants no task qualification, security-verdict reuse or deployment; all full
Turbo goal acceptance and observation windows remain open.

Recovery retains the exact accepted baseline privately. To reverse, restore
the reviewed prior closure and submit a new review with the then-current digest;
never overwrite a newer baseline or substitute the qualification ledger.
