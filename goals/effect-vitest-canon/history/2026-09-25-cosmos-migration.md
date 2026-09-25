# Cosmos migration checkpoint

## P2 implementation checkpoint

Implementation `64208a8841347969b55dc168357a8930f70d40f1` fixes the Option assertion, renderer failure cleanup,
complete-buffer determinism and instrumentation findings. All 22 original plain
assertions are preserved. Normal and failure cleanup share the existing renderer
test, keeping a single owner of global vendor state under concurrent execution.
The failure probe requires exactly one vendor kill after the failed scope closes.

Four actionable rows are fixed; four exceptions are explicitly reviewed: the
direct vi import required by hoisted vendor mocks, plus three intentional shorter
scopes that must close before fixture mutation, global restoration or cleanup
assertion. Five coverage-only rows remain unchanged. These exceptions are not an
empty-baseline closeout claim.

Both Node and Bun pass eight tests in two files. Each explicit 400-run / 20260708
seed sweep passes seven tests in the projection file, selected by the repository
property-sweep configuration. Package audit (9.0 s) and docgen (3.8 s) pass.
The full detector ratchet introduces zero findings; four unrelated resolved rows
remain untouched. Seven Cosmos cache nodes change dependency edges only.

Configured Node timing: 3354.67 ms reporter time, 4.006 s whole-command time.
Workstation load and source/runtime hashes are recorded; the older baseline has
a different runtime cohort and seven registrations, so no speedup is claimed.
Hosted checks, review closure and prerequisite integration remain pending.

## Runner integration and title review follow-up

The merged runner prerequisite now propagates through schema, codegen, colors
and Cosmos. Data separately merged current main to clear its PR conflict. All
four downstream packages passed package-verify after integration: data audit
14.4 s/docgen 6.8 s; codegen 10.5 s/3.1 s; colors 11.9 s/6.2 s; Cosmos
18.4 s/7.2 s. These are package proofs, not exact-head root or hosted proof.

Review fix `b99e5ecb8c` expands the renderer test title to state both graph
rebuilding and failure-scope cleanup; its body is unchanged. The post-integration
Node timing sample passes eight tests across two files, 5948.44 ms reporter time
and 6.763 s whole-command time. Load1 peaked at 91.12, CPU pressure avg10 at
21.03, memory at 1.82, and I/O at 4.15. This loaded-host observation is not a
causal regression or speedup measurement. Public timing artifacts retain the
full context and source hashes.
