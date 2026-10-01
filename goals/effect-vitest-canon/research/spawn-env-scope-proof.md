# Spawn environment conformance repair

The Node compatibility adapters now forward an explicitly supplied child environment instead of merging the parent environment back into it. Omitted environments retain native inheritance. Both spawn and spawnSync preserve array and object invocation forms.

The tracked regression runs twenty cases independently on actual Node and Bun. Its wrapper rejects Bun-backed node shims by probing PATH candidates; the fixture independently verifies runtime identity. Reporter decoding checks twenty total, twenty passed and zero failed, and retains bounded failure messages before scoped report cleanup. The public NodeServices layer owns child execution and reporter roots. These are OS runtime conformance subjects; MemoryFileSystem cannot represent them.

Applied generated package command `CI=true bun run test test/bun-spawn-env-parity.test.ts` passes both outer cases in 3.12 seconds. Root configuration and applied fixture/wrapper typechecks pass. Private controls establish that the old Node adapter fails eight empty/partial replacement cases, a named-node route under bunx fails runtime identity, and an unavailable host Node fails explicitly without skipping. Hostile inherited lane flags are removed only for the nested fixture. No real secret values are involved.

These focused results establish the applied regression. Full package and hosted proof remain separate gates. Current full-goal inventory and phase acceptance remain open.
