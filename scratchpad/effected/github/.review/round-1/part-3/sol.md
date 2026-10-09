### sol-1-1
- file: scratchpad/effected/github/internal/octokit.ts:175
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, verified by a cancellation probe); the transport’s cancellation contract at lines 118–121.   evidence: A read-only `bun --eval` probe started a paginated request through a pending fake fetch, waited until fetch began, then interrupted the fiber. The fetch received no signal and observed no abort: `{"mode":"pagination","hasSignal":false,"aborts":0}`. Running the pinned oracle source through in-memory TypeScript transpilation produced the same result. The ordinary REST request served as a control: `{"mode":"request","hasSignal":true,"aborted":true,"aborts":1}`. The installed pagination iterator calls its request method with `{ method, url, headers }`, discarding per-request options passed to the iterator factory.
- failure: Interrupting a fiber while a page is being fetched stops the Effect consumer but leaves the HTTP request running. The discarded signal also prevents cancellation from stopping the underlying iterator’s eventual cursor advancement.
- fix: Supply the pagination iterator with a request-method wrapper that injects the current attempt’s `AbortSignal`, and change the attempt callback to receive and forward that signal. Preserve the existing Octokit iterator’s normalization and continuation behavior. Adding a signal only to the factory’s `params.request` is insufficient because the iterator discards it. Record the verified upstream bug through section 14 and add a focused cancellation regression test.

### sol-1-2
- file: scratchpad/effected/github/internal/octokit.ts:196
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, verified by a cancellation probe); the transport’s cancellation contract at lines 118–121.   evidence: The same read-only probe interrupted a GraphQL fiber after its fake fetch began. Both the port and the pinned oracle produced `{"mode":"graphql","hasSignal":false,"aborts":0}`. The callback passed to `attempt` ignores its signal and invokes `octokit.graphql(document, variables)` without request cancellation options.
- failure: Interrupting a GraphQL operation leaves its HTTP request running. For a mutation, the remote operation can consequently complete after the caller has canceled the Effect.
- fix: Receive the signal in the attempt callback and call `octokit.graphql(document, withSignal(variables, signal))`, using the existing helper to preserve other request options. Record the verified upstream bug through section 14 and add a focused cancellation regression test.

### sol-1-3
- file: scratchpad/effected/github/internal/octokit.ts:98
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, mandatory export documentation and section grammar; EFFECTED_PORT_GOAL sections 10.1–10.2; the brief explicitly defers S2 findings to backlog.   evidence: `makeTransport` retains `@remarks` at line 101 and has no titled compiling example, canonical `@category`, or `@since 0.0.0`. The exported `TransportOptions` and `Transport` interfaces likewise lack the required category and version metadata.
- failure: These exported APIs do not satisfy the S2 documentation contract and cannot pass the required JSDoc conversion unchanged.
- fix: During S2, preserve the upstream prose while converting `@remarks` to `**Details**`, add canonical category and version metadata to the exports, and add a titled compiling example for `makeTransport`.

### sol-1-4
- file: scratchpad/effected/github/internal/paginate.ts:26
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, mandatory export documentation and section grammar; EFFECTED_PORT_GOAL section 10.2 explicitly includes `internal/**`; the brief explicitly defers S2 findings to backlog.   evidence: The documentation for `PageSource`, `paginate`, and `fromArray` retains `@remarks` at lines 10, 29, and 64. All three exports lack canonical category and version metadata; the two value exports also lack titled compiling examples.
- failure: The internal pagination exports remain outside the required S2 JSDoc contract.
- fix: During S2, convert the existing prose into `**Details**` sections, add canonical categories and `@since 0.0.0`, and provide titled compiling examples for `paginate` and `fromArray`, including their added data-last forms.

REQUIRED: 2
BACKLOG: 2