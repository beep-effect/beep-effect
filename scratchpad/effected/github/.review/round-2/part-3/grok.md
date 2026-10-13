I'll review `octokit.ts` and `paginate.ts` against the pinned upstream oracle and the port decisions, and I won't repeat anything round 1 already closed.The two files are in hand. Next I’ll read the round-1 inventory, the port decisions, and the pinned upstream copies so I only raise new divergences.Round 1 already closed the obvious transport defects. I’ll compare the current files with the pinned oracle and check whether the fixes introduced new divergences.### grok-2-1
- file: scratchpad/effected/github/internal/octokit.ts:282
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`); `Transport.rateLimit` is updated from every `attempt` failure at line 175. `GitHubGraphQLError.fromThrowable` already reads both header locations (`scratchpad/effected/github/GraphQL.ts:178`).
- evidence: `@octokit/graphql` throws `GraphqlResponseError` for an HTTP 200 whose body has `errors`, and stores the HTTP headers on `error.headers` while `error.response` is the GraphQL body (`node_modules/@octokit/graphql/dist-src/error.js:6-10`, `graphql.js:49-58`). `readThrownHeaders` returns at line 285 when `error.response` has no `headers` property, so those headers are dropped. REST `RequestError`s keep headers on `response.headers` (`node_modules/@octokit/request-error/dist-src/index.js:23-24`), which is the only shape `scratchpad/test/github/transport.test.ts:119-138` injects. Line coverage still passes: the `response`-without-`headers` return is exercised by malformed `response.headers` fixtures, never by a top-level `headers` object. The pinned oracle's `readThrownHeaders` has the same single lookup.
- failure: A GraphQL `RATE_LIMITED` / validation body (HTTP 200 plus `errors`, with `x-ratelimit-*` on the throwable) leaves `transport.rateLimit` stale. The classified error still sees those headers via `fromThrowable`, and an HTTP 4xx/5xx GraphQL failure updates the snapshot, so the two GraphQL failure shapes disagree.
- fix: If `response.headers` is not a non-array record, read a non-array `error.headers` record with the same array exclusion. Keep rejecting array `response.headers` without falling through. Add a graphql regression whose throwable is `{ headers: rateLimitHeaders(...), response: { errors: [...] } }` and assert the snapshot updates. Record the upstream-bug centrally.

### grok-2-2
- file: scratchpad/effected/github/internal/paginate.ts:50
- class: jsdoc   severity: required
- standard: `.patterns/jsdoc-documentation.md` ("Examples compile through the docgen TypeScript gate"; "Every Example must compile"). Docgen drops the example before that gate: `shouldIgnore` skips any doc tagged `@internal` (`packages/tooling/tool/docgen/src/Parser.ts:182`), and `paginate` is tagged `@internal` at line 53.
- evidence: `Stream.runCollect` yields a `Chunk`. `Chunk` has no `join` method (`node_modules/effect/dist/Chunk.d.ts:46-55`; `ChunkProto` in `Chunk.js:70-110`). `Chunk.join` is a module function (`Chunk.d.ts:4698`, `dual(2, (self, sep) => toReadonlyArray(self).join(sep))`). The example calls `.join(",")` on the chunk. `fromArray`'s example is fine: `O.getOrElse` returns an array, and `Array.prototype.join` exists.
- failure: The example does not typecheck, and running it throws `TypeError` before printing `1,2`. The green docgen run never typechecks this fence.
- fix: Print with `Chunk.join(Effect.runSync(Stream.runCollect(items)), ",")`, importing `* as Chunk from "effect/Chunk"`. Keep the `1,2` result.

REQUIRED: 2
BACKLOG: 0
