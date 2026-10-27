### sol-2-1
- file: scratchpad/effected/github-actions/BlobStore.ts:360
- class: bug   severity: required
- standard: D9 and section 14’s verified-upstream-bug route; the path-style addressing contract on `S3Config.endpoint`; the signing path supplied at BlobStore.ts:351.   evidence: A read-only `bun --eval` probe called `has` through `FetchHttpClient` with a recording fetch stub, against both the port and the pinned oracle. With bucket `bucket`, keys `a/../b`, `b`, and `./b` all reached `https://store.test/bucket/b`; `a/./b` reached `/bucket/a/b`; `../outside` reached `/outside`. Signing receives the unnormalized object path. The round-1 reserved-character and repeated-slash fixes do not cover this new dot-segment counterexample.
- failure: URL normalization changes the resource after its path has been signed. Dot-segment keys produce signatures for a different request target, so an authenticating S3 backend rejects them. Distinct accepted keys also collapse to the same outgoing URL, and `..` can remove the bucket component.
- fix: Reject complete `.` and `..` segments in the joined object path with a typed `BlobStoreError` before signing or sending, unless the transport can preserve the raw request target. Add dot-segment regressions asserting rejection before HTTP execution, and record the verified upstream bug under section 14.

### sol-2-2
- file: scratchpad/effected/github-actions/CheckDocument.ts:639
- class: bug   severity: required
- standard: D9 and section 14’s verified-upstream-bug route; `CheckDocumentOptions.debounce` documents `maxWait` as the staleness bound; CheckDocument.test.ts:112 promises a steady stream writes by that bound.   evidence: A read-only TestClock probe used `quiet: "500 millis"` and `maxWait: "750 millis"`, reporting at 0 ms and 400 ms. Both the port and pinned oracle recorded no write at 750 ms and their first write at 1,000 ms. The loop always sleeps a full quiet interval before checking the deadline.
- failure: A `maxWait` that is not a multiple of `quiet` is exceeded. Under continuous reports, the first write occurs at approximately `ceil(maxWait / quiet) * quiet`, potentially almost one additional quiet interval after the documented deadline.
- fix: Bound each sleep by the remaining max-wait budget and flush when that budget expires. Add a TestClock regression with a non-multiple deadline, such as 750 ms with a 500 ms quiet interval, and record the verified upstream bug.

### sol-2-3
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:300
- class: bug   severity: required
- standard: D9 and section 14’s verified-upstream-bug route; `GitHubMarkdown.table`’s row-preservation contract and GitHubMarkdown.test.ts’s newline-safety assertions.   evidence: A read-only probe evaluated `table(["one", "two"], [["a\rb", "ok"]])` against both the port and pinned oracle. Both emitted a literal carriage return inside the cell. Parsing each result with the pinned upstream Markdown parser produced two data rows: `["a", ""]` and `["b", "ok"]`, instead of one row containing the supplied two cells.
- failure: Bare carriage returns terminate GFM rows. A cell containing CR-only line endings splits the row and changes the relationship between columns. `tableFor` inherits the same defect because it delegates to `table`.
- fix: Replace all three line-ending forms with `<br>`, using `/\r\n|\r|\n/g`. Add CR-only regressions for direct tables and schema-derived tables, and record the verified upstream bug.

### sol-2-4
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:439
- class: bug   severity: required
- standard: D9 and section 14’s verified-upstream-bug route; the class documentation says the writer owns surrounding structure wherever a fragment could break it.   evidence: Read-only probes against both the port and pinned oracle returned `[left]right](https://example.test)` for `link("left]right", "https://example.test")`, and `[left[right](https://example.test)` for the corresponding unmatched opening bracket. The pinned upstream Markdown parser parsed the first as literal text plus a URL autolink; the second linked only `right`, leaving `[left` outside the link.
- failure: Valid string labels containing unmatched brackets break the generated link or change its linked label. Passing the label through an `Html` node bypasses the escaping needed by the surrounding link syntax.
- fix: Apply bracket-aware escaping to unmatched, unescaped label brackets before the passthrough node, preserving supported inline Markdown. Add regressions asserting that the entire supplied label remains inside one link, and record the verified upstream bug.

### sol-2-5
- file: scratchpad/effected/github-actions/BlobStore.ts:133
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md, “Schema owns pure data”; D5 and D11.   evidence: `S3Config` remains a plain interface containing strings, optional strings, and redacted strings. It is a representable configuration payload, rather than a service contract or type-level utility, and has no corresponding runtime schema. The supplied green gates leave this declaration intact; the recorded schema-first deviations do not exempt it.
- failure: The public object-store configuration remains outside the required schema source of truth. Consumers cannot derive decoding, guards, metadata, or arbitraries from `S3Config`, and its field documentation exists separately from any executable contract.
- fix: Define an identity-annotated `S3Config` schema and derive the same-name type from it, preserving the existing field types and explicit-undefined optional semantics. Retain current constructor behavior; add the required schema round-trip property and record the law-driven runtime export.

### sol-2-6
- file: scratchpad/effected/github-actions/DryRun.ts:49
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 12, requiring `Bool.match` for boolean branching in domain/runtime orchestration; standards/effect-first-development.md EF-7b; D11.   evidence: `make(enabled: boolean)` implements the mutation-versus-rehearsal decision with `enabled ? ... : effect`. This explicit boolean orchestration branch remains in the source despite the supplied green gates.
- failure: The runtime guard does not use the mandated boolean matching idiom. Its behavior is correct, but the implementation remains below the binding law’s requirement.
- fix: Import `effect/Boolean` as `Bool` and replace the ternary with `Bool.match(enabled, { onTrue: ..., onFalse: ... })`, preserving lazy dry-run logging, the fallback value, and the original effect in the disabled branch.

REQUIRED: 6
BACKLOG: 0