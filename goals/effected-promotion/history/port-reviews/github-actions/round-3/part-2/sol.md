### sol-3-1
- file: scratchpad/effected/github-actions/ChildEnv.ts:174
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; `ChildEnv.prependPath`’s documented PATH-prepending contract.   evidence: Read-only `bun -e` differential probes with `platform: "linux"`, `dirs: ["/opt/tool"]`, and `base: { Path: "/ignored", PATH: "/usr/bin" }` return `{ env: { Path: "/opt/tool:/ignored" }, extendEnv: true }` in both the lab and pinned oracle. A child `/usr/bin/env` given the merged synthetic environment confirms `Path=/opt/tool:/ignored` while `PATH=/usr/bin`. The case-insensitive lookup is applied on every platform.
- failure: On POSIX, an unrelated `Path` or `path` variable can redirect the addition away from the actual, case-sensitive `PATH`. The requested tool directory is consequently absent from executable lookup, and an existing `PATH` is not prepended.
- fix: In `prependPath`, use `pathKeyOf(base)` only for `win32`; use the exact key `"PATH"` on other platforms. Preserve `pathKeyOf`’s existing case-insensitive public behavior. Add regressions for POSIX environments containing both `Path` and `PATH`, and containing only `path`; record the verified upstream bug.

### sol-3-2
- file: scratchpad/effected/github-actions/BlobStore.ts:376
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; the custom endpoint’s documented `<endpoint>/<bucket>/<key>` addressing contract and the existing “signs the resource sent” regression in `scratchpad/test/github-actions/BlobStore.test.ts`.   evidence: A read-only recording `HttpClient` probe used `endpoint: "https://example.test/gateway"`, `bucket: "cache"`, and `has("key")`, with synthetic credentials and no network execution. Both the lab and pinned oracle produce `url: "https://example.test/gateway/cache/key"`, `signatureMatchesSentPath: false`, and `signatureMatchesPathWithoutEndpoint: true`. Expected signatures were reconstructed with the pinned oracle signer using the captured signing timestamp. `request` signs only the bucket/prefix/key path, while URL construction prepends the complete endpoint.
- failure: A custom endpoint with a pathname sends a different canonical URI from the URI covered by its SigV4 signature. GET, PUT, and HEAD requests through such an endpoint are rejected by signature-verifying storage services.
- fix: Include the endpoint pathname in the canonical path supplied to signing, preserving its encoding so the signed URI exactly matches the transmitted URI. Add a recording-client regression for a custom endpoint with a path, and record the verified upstream bug.

### sol-3-3
- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:190
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream bug; `GitHubMarkdown.link`’s documented link-construction contract.   evidence: Read-only differential probes call `link("abc\\", "https://example.test")` and parse the result with the pinned oracle’s Markdown parser. Both implementations emit `[abc\](https://example.test)`, and the parsed child-node types are `["text"]`, with no link. The new `escapeLinkLabel` handles unmatched brackets but leaves an unmatched trailing backslash intact. This input is separate from the closed round-2 bracket cases and is absent from their regression matrix.
- failure: A label ending in an odd number of backslashes escapes the closing bracket supplied by the writer. The result becomes literal text instead of a hyperlink.
- fix: Escape an unmatched trailing backslash before inserting the surrounding link delimiters, while preserving existing escape pairs and supported inline Markdown. Add parser-backed regressions for odd and even trailing backslash counts, and record the verified upstream bug.

### sol-3-4
- file: scratchpad/effected/github-actions/CheckState.ts:107
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5/D11.   evidence: The reviewed commit still declares representable public data models solely as interfaces or type aliases, with no corresponding runtime schemas: `CheckRunConclusion` and `CheckRunProjection` (`CheckState.ts:91,107`), `CheckFlushOutcome` (`CheckDocument.ts:296`), `PathPrependEnv` and `PathPrependOptions` (`ChildEnv.ts:10,28`), `DetachedSpawnOptions` (`DetachedProcess.ts:371`), `ProvisionOptions` and `ReadOptions` (`GitHubToken.ts:74,106`), `ManagedDocumentSource` (`ManagedDocument.ts:195`), and `GitHubHeadingDepth` and `GitHubListOptions` (`GitHubMarkdown.ts:30,39`). These are finite domains, wire values, or pure configuration/input payloads. The green gates leave these declarations intact; the recorded deviations do not exempt them from schema-first modeling.
- failure: These public data contracts have no executable source of truth from which consumers can derive validation, codecs, annotations, or arbitraries. In particular, the check-run invariant—completed projections require a conclusion, while in-progress projections omit it—exists only in a TypeScript union.
- fix: Define identity-annotated structural schemas and literal domains, then derive the existing same-name types. Reuse existing schema building blocks and preserve plain-object construction, field types, and absent versus explicit-undefined semantics. Add schema round-trip properties and record the law-forced value exports and deviations. Keep service contracts and complex type-level table machinery as interfaces/types.

### sol-3-5
- file: scratchpad/effected/github-actions/BlobStore.ts:20
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b; D5/D11.   evidence: `DotSegment` is a named internal literal domain defined as `S.Literals([".", ".."])` and consumed through `S.is(DotSegment)` at line 390. Law 19 reserves `S.Literals` for anonymous inline unions and requires `LiteralKit` for named internal literal domains. This declaration remains on the supplied green commit.
- failure: The newly introduced path-validation domain violates the binding literal-domain convention despite passing the current gates.
- fix: Define `DotSegment` with `LiteralKit([".", ".."])`, attach its file-local identity annotation, and retain the existing guard and rejection behavior.

REQUIRED: 5
BACKLOG: 0