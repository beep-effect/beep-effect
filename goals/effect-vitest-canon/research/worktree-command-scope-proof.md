# Worktree command fixture and layer proof

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
