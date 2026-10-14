### sol-3-1

- file: scratchpad/effected/workspaces/SourceBoundary.ts:387
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; `BoundaryRule`’s `console-stdout` contract exempts exactly `error`, `warn`, `trace`, and `assert`.   evidence: Read-only `bun -e` probes against the reviewed source and pinned oracle both return no offence for `console.error\u0058(x);`, but return `console.errorX` for the equivalent unescaped spelling. Conversely, both flag `console.\u0065rror(x);` while sparing `console.error(x);`. JavaScript execution with an injected console confirms the escaped members resolve to `errorX` and `error`, respectively. Round-2 r23 repaired escaped receiver names; these member-name cases remain.
- failure: `memberAfter` stops at the backslash instead of reading and cooking the complete member identifier. It exempts a longer member beginning with a stderr method name and falsely reports an escaped spelling of a permitted stderr method.
- fix: Read the complete raw member token and reuse the lexer’s Unicode identifier cooking before checking `STDERR_METHODS`, retaining original offsets and malformed-escape controls. Add the escaped permitted-member and escaped longer-member regressions, and record the verified upstream-bug deviation under section 14.

### sol-3-2

- file: scratchpad/effected/workspaces/SourceBoundary.ts:346
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; `BoundaryRule`’s `stdout-write` contract forbids `stdout.write` on any receiver and excludes longer identifiers.   evidence: Read-only probes against the reviewed source and pinned oracle both return no offence for `stdout.wr\u0069te(x);`, but report `stdout.write` for `stdout.write\u0058(x);`. The unescaped `stdout.writeX(x);` control produces no offence. Injected JavaScript execution confirms the latter escaped spelling calls `writeX`.
- failure: The raw-text regular expression misses valid escaped spellings of the forbidden operation. Its trailing boundary check also treats a Unicode escape as the end of an identifier, falsely reporting a different method as `write`. Escaping the `stdout` identifier similarly bypasses the rule.
- fix: Match complete cooked identifiers for `stdout` and its `write`/`end` member while retaining raw offsets and existing receiver, private-name, and comment controls. Add escaped receiver/member and longer-member regressions, and record the verified upstream-bug deviation.

### sol-3-3

- file: scratchpad/effected/workspaces/SourceBoundary.ts:362
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; `ReferenceOptions.ignoreTokens` exempts exact tokens, and the default exemption names only `process.env.__PACKAGE_VERSION__`.   evidence: Read-only probes against the reviewed source and pinned oracle both return no offence for `process.env.__PACKAGE_VERSION__\u0058;`; the equivalent unescaped `process.env.__PACKAGE_VERSION__X;` is flagged. `referencesProcess` also incorrectly returns `false` for the escaped spelling. Executing the expression with an injected process reads `env.__PACKAGE_VERSION__X`.
- failure: The exemption’s end guard examines the raw backslash, considers it a non-identifier character, and grants the build-time constant exemption to a different runtime environment property. Custom ignore tokens ending in an identifier have the same boundary defect.
- fix: Make the exemption boundary check recognize Unicode-escaped identifier continuations, preserving exact token matching and original offsets. Add default and custom exemption regressions with escaped suffixes, and record the verified upstream-bug deviation.

### sol-3-4

- file: scratchpad/effected/workspaces/SourceBoundary.ts:349
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; `BoundaryRule`’s `stdout-write` contract forbids `stdout.end(chunk)` because it writes the final chunk, while sparing calls without a chunk.   evidence: Read-only probes against the reviewed source and pinned oracle both return no offence for `stdout.end?.(x);`, although `stdout.end(x);` reports `stdout.end`. The `stdout.end?.();` control correctly produces no offence. JavaScript execution with an injected `stdout.end` confirms the optional call invokes it with the supplied chunk.
- failure: `END_WITH_CHUNK` requires `(` immediately after whitespace following `end`; the valid optional-call punctuation `?.` makes it reject a chunk-writing call. The documented exclusions do not cover this syntax.
- fix: Permit the optional-call `?.` before the argument parenthesis in the final-chunk test. Add chunk-bearing and empty optional-call regressions, and record the verified upstream-bug deviation.

REQUIRED: 4
BACKLOG: 0