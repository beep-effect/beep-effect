# Production document and cleaner service composition

The live document path now obtains its value owner, builtins, named-container
adapter, cleaner registry and pipeline from a production constructor. It no
longer creates an unused test registry/value owner to recover those services.
Semantic and verified replay also use the production step-container Context;
their manual service bindings are removed.

## Ownership and dependency capture

The constructor reuses the existing native-runtime/policy preparation helper
to capture decoded limits and explicit HTML runtime. It composes existing
Effect services through Context and provideService; no registry algorithm,
worker protocol, iterator framework or admission controller is added.
Every component receives the same captured policy. In particular, builtin
cleaning no longer receives the test harness's independent default limits.

Host cleaner protocols are a required injected service. Optional host Document
protocols retain their existing delegation behavior. The production constructor
supplies no fake callback, rejecting host stub or request-carried function.
The primitive replay has an explicit test-only empty host fake, matching the
prior primitive fixture. Stateful custom-host coverage retains its own harness
and is not claimed by this named/primitive replay.

The caller's Scope owns the cohort. Existing value/container finalizers
invalidate capabilities and release tables, and existing worker owners retain
their retirement rules. The final engine must choose lifetimes for retained
Document/registry state explicitly. This factory does not reset persistent
custom registry state on each request or claim final lifecycle integration.
Returned methods capture their dependencies; the supplied Context includes
values, Document protocols, cleaner runtime and named-step construction.

## Package retention

Package dry-run inspection found that the server file allowlist omitted the
entire citation-diff asset directory. The manifest now includes that directory.
A before/after `bun pm pack --dry-run --ignore-scripts` comparison confirms
that every committed diff kernel/source/notice/license file is retained, while
the previous package retained none. This does not publish a package or run
package lifecycle scripts. No runtime algorithm or limit changes.

## Verification

Initial connected Document/verified replay passes four tests in 35.27 seconds
on Bun and Node. With the first ownership control, five tests across three
files pass in 32.33 seconds. They compare complete original models and verified
plain/Unicode/HTML evidence through the production constructor.

The focused ownership/delegation test passes in 1.65 seconds. A supplied
five-character source limit permits `__A__` and refuses `__AA__` before cleaning.
Named underscores cleaning returns A with one produced unit and R=never. A
host plan delegates through the captured injected service, consumes its issued
step once and produces the same output. Closing the caller Scope makes retained
value reads, container plans and new container creation fail closed. The
observed native counters remain zero. Final connected regression after removing
manual step-port bindings passes five tests across three files in 52.61
seconds, including all eight semantic families on Bun and Node.

Package lint/type checks, declaration generation, blocking laws and codec lint
pass. Scoped scans show no new cognitive or clone findings. The unchanged
documentRequest estimated-coverage CRAP finding remains an isolated-scan
estimate; hosted coverage is authoritative. No baseline or threshold changes.
Hosted Fallow passes on preceding head 0b492e879b, Check run 42268429334,
job 128066552439. Hosted confirmation of this wave remains pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationDocumentServices.test.ts \
  test/CitationSemanticExtraction.test.ts test/CitationVerifiedExtraction.test.ts
```

Public cleaner/tokenizer port contracts, default engine wiring, deployment
build/selected-port binding, public request/error/service/Layer, final document
integration, transforms, broad host semantics, exhaustive accounting and
whole-engine safety/scaling remain required. All eleven representation laws,
four fidelity questions and fifteen unfinished proof rows remain open without
a semantic waiver. Base-pinned Secret Scanning still requires the independently
reviewed exact-digest policy in PR #2786 to land before merging main here.
