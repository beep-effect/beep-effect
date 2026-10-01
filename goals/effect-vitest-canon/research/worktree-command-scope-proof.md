# Worktree command fixture and layer proof

The full migration proof below is pinned to source commit `43c98e278b`.

The applied migration retains all 48 registration expressions (49 expanded
cases) and all 243 assertion ASTs. The structural comparison ignores formatter
whitespace and trailing separators while retaining expression kinds, operands,
operators and literal values. Native Git, bare origins, worktree/archive removal,
symlink and process subjects remain native.

Public instrumented it.layer registrations replace the local provider clone.
Fixed layers contain platform factories and a context-capturing removal service.
Each withScratchRepo invocation creates a fresh TestConsole and an independently
scoped scratch directory; nested invocations do not share captured output or
repository ownership. Temporary cleanup is registered before Git initialization
or the initial push, and removal failure is visible. Private initialization-error
and successful fixture controls passed on Node and Bun and checked root absence.

The one dynamic probe case builds a fresh removal-service layer, extracts its
service through Context.get, and uses provideServiceEffect within the original
short scope. This preserves the stub probe and its call-count assertions without
Effect.provide on a layer. The authoritative test typecheck rejected that earlier
private form; the final service-boundary form passes. Short descriptor scopes in
the process-holder cases still close before subsequent removal assertions.

Applied final Node: 49 tests passed in 17.52 seconds. Applied final Bun: 49 tests
passed in 22.36 seconds. Root quality test-tsgo passes. Reviewed baseline metadata
retains historical identities and adds 28 scope/layer judgments: 26 fixed-service
layer registrations and two intentional short scopes. The reviewed ratchet passes with zero introduced findings. Full package
verification passes: audit 1,001.1 seconds and docgen 25.8 seconds. Campaign
dispositions remain separate from this source proof.

## Campaign dispositions

Ten fixed findings and 23 reviewed exceptions retain all historical IDs and
evidence. Two property-wrapper findings are attributed to upstream
`b1aa7e320c`; six provider findings, the local helper finding and the native
cleanup finding are bound to `43c98e278b`. The native Git domain fixture and
shorter descriptor/root scopes remain intentional exceptions. The diagnostic
observability finding remains open until the next source proof.

## Subsequent diagnostic hardening

The runGit setup helper now concurrently drains stdout, stderr and exit code.
Its existing zero-exit assertion includes the command and both streams as an
assertion message. Private deliberate-failure probes verify the exact multiline
stdout/stderr text, not merely words present in the command arguments. Both
Node and Bun pass those controls. The 49 original tests pass on each runtime.
The combined applied worktree/CI-lane run passes 123 tests on Node in 30.87
seconds and Bun in 16.08 seconds; root test types pass. Full package proof for
these subsequent changes passes: audit 940.0 seconds and docgen 56.1 seconds.
