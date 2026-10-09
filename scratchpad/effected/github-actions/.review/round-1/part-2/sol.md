### sol-1-1

- file: scratchpad/effected/github-actions/BlobStore.ts:249
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by a failing signing property); `internal/sigv4.ts` requires the canonical URI to encode each path segment.
- evidence: A read-only probe through `BlobStore.layerS3` captured `has("a#b")` requesting a URL whose pathname is `/cache/a` and fragment is `#b`, while `canonicalize` signs `/cache/a%23b`. Likewise, `a?b` becomes pathname `/cache/a` with query `?b`, while the signer uses `/cache/a%3Fb` and an empty canonical query. For `a%2Fb`, the request pathname is `/cache/a%2Fb` while the signed pathname is `/cache/a%252Fb`. The pinned oracle contains the same raw URL interpolation.
- failure: Reserved characters in an accepted key change the HTTP resource or query independently of the signature. These requests cannot authenticate against the intended object path.
- fix: Percent-encode each raw path segment with the existing SigV4 `uriEncode` helper when constructing the request URL. Continue passing the raw path to the signer so it encodes exactly once. Add regression cases for `#`, `?`, and `%`, and record the verified upstream-bug deviation.

### sol-1-2

- file: scratchpad/effected/github-actions/BlobStore.ts:235
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by a failing distinct-key storage property); `BlobStoreShape` exposes storage indexed by the supplied string key.
- evidence: Against the pinned oracle, an in-memory HTTP transport received the same URL, `https://example.invalid/cache/a/b`, for `put("a//b", first)`, `put("a/b", second)`, and `get("a//b")`. The final read returned the second blob’s metadata and body. The reviewed source retains the same `.replaceAll(/\/{2,}/g, "/")`.
- failure: Distinct keys alias the same object. Writing one silently overwrites the other. `layerMemory` preserves these distinct keys, so the production backend also disagrees with the memory backend.
- fix: Preserve slash runs inside the supplied key when joining the bucket, optional prefix, and key. Update canonical-path construction to preserve those empty segments as well; its current empty-segment filtering would otherwise sign a different path. Add the distinct-key regression and record the upstream-bug deviation.

### sol-1-3

- file: scratchpad/effected/github-actions/CacheKey.ts:486
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by inconsistent literal and wildcard matching); `CacheKey.matchingFiles` promises to exclude paths outside the workspace.
- evidence: A read-only pinned-oracle probe seeded `/ws/..lock`. With `workspace: "/ws"`, `patterns: ["..lock"]` returned `[]`, while `patterns: ["..*"]` returned `["/ws/..lock"]`. The reviewed source’s `relative.startsWith("..")` rejects the valid relative filename `..lock`.
- failure: Literal includes silently omit legitimate files whose first path component begins with two dots. `hashMatching` can consequently return an empty result or derive a cache key without an explicitly requested file.
- fix: Reject the parent component itself and paths beginning with a parent component plus the platform separator, rather than every string beginning with `..`. Retain the absolute-path guard. Add the literal/wildcard consistency regression and record the upstream-bug deviation.

### sol-1-4

- file: scratchpad/effected/github-actions/CheckDocument.ts:140
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by a failing ordering property); `CheckDocumentStamp.isAtLeastAsRecent` specifies that a strictly older incoming stamp returns `false`.
- evidence: For equal `at: "2024-01-01T00:00:00Z"`, both the reviewed implementation and pinned oracle return `true` when incoming `runId` is `"9007199254740992"` and existing `runId` is `"9007199254740993"`. Converting both strings to `Number` rounds them to the same value.
- failure: The staleness guard treats different numeric run IDs as equal beyond the safe-integer range. An older run can therefore pass the overwrite check against a newer run with the same timestamp.
- fix: Compare decimal integer run IDs without lossy floating-point conversion, preserving the existing fallback behavior for other inputs. Add adjacent large-integer ordering cases in both directions and record the upstream-bug deviation.

### sol-1-5

- file: scratchpad/effected/github-actions/ManagedDocument.ts:385
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated by a failing preservation property); `ManagedDocument` promises that every byte outside managed regions survives regeneration.
- evidence: A pinned-oracle probe called `parseResult(...).withRegionsResult([])`. Input `"human\n\n\n"` became `"human\n\n<!-- tool:doc -->\n"`, losing an existing newline. Input `"  \t\n"` became `"<!-- tool:doc -->\n"`, losing all existing whitespace. The reviewed implementation retains the same whitespace-only replacement and trailing-newline stripping.
- failure: Adopting a document without a sentinel modifies unmanaged content, even when no regions are declared. The byte-preservation guarantee fails for trailing blank lines and whitespace-only text.
- fix: Append the missing sentinel without removing bytes from the existing text. Add only the separator needed for the new sentinel; do not replace whitespace-only input or strip existing newline runs. Add preservation regressions and record the upstream-bug deviation.

### sol-1-6

- file: scratchpad/effected/github-actions/CheckState.ts:30
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b.
- evidence: The exact reviewed source declares the named, exported, annotation-bearing vocabulary as `S.Literals([...])`. It is reused by `CheckReport` and has a derived same-name type. The cited standard reserves `S.Literals` for anonymous inline unions and requires `LiteralKit` for named literal domains.
- failure: The central check-state vocabulary remains outside the required schema-kit convention despite the completed identity/import stage. This source-level violation remains present on the stated green-gate commit.
- fix: Construct `CheckState` with `LiteralKit`, retaining the seven literals, identity annotation, derived type, and existing projection behavior.

### sol-1-7

- file: scratchpad/effected/github-actions/DetachedProcess.ts:165
- class: schema   severity: required
- standard: D5 and the goal’s operator step 4; `standards/effect-first-development.md` EF-12.
- evidence: `ProcessId` is an exported schema constructed from `S.Number`, checks, and `S.brand("ProcessId")`. Its declaration never applies the file’s `$I` identity or an `$I.annote(...)` schema annotation, unlike the annotated error schemas in the same file.
- failure: This exported schema was missed by the required identity conversion. Its brand name does not supply the canonical schema identifier, title, and meaningful description required for schema metadata.
- fix: Apply the canonical `$I` schema annotation to `ProcessId`, preserving its checks and branded type.

### sol-1-8

- file: scratchpad/effected/github-actions/GitHubMarkdown.ts:18
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 1 requires the `S` alias for `effect/Schema`.
- evidence: `git show 3fa5876691901fccf3d1cd29e9324564df134b56:scratchpad/effected/github-actions/GitHubMarkdown.ts` contains `import * as Schema from "effect/Schema"` and corresponding `Schema.*` references. This concrete violation remains in the exact commit despite the stated green gates.
- failure: The file violates the canonical Effect-module alias law.
- fix: Rename the schema namespace to `S` and update its references. Rename the method’s generic parameter if needed to keep the schema namespace and row-schema type parameter unambiguous.

### sol-1-9

- file: scratchpad/effected/github-actions/BlobStore.ts:137
- class: jsdoc   severity: backlog
- standard: D4; section 10.2; `.patterns/jsdoc-documentation.md`; S2 is explicitly deferred by the reviewer brief.
- evidence: The focused files retain legacy `@example` and `@remarks` carriers. For example, `BlobStore` uses `@example` at this location and lacks canonical `@category` and `@since` tags; several exported error classes also lack required examples.
- failure: The focused public API documentation has not yet reached the required docgen grammar and export documentation rubric.
- fix: During S2, convert the carriers to titled `**Example**` and `**Details**`/`**Gotchas**` sections, preserve upstream behavioral prose, add canonical categories and `@since 0.0.0`, and supply compiling examples for value exports.

### sol-1-10

- file: scratchpad/effected/github-actions/CacheKey.ts:366
- class: docs   severity: backlog
- standard: D2, D9, and section 14; documentation findings are backlog under the reviewer brief.
- evidence: The reviewed implementation throws `InvalidDigestLengthError` where the pinned oracle throws `RangeError`, and the corresponding upstream-derived test was changed to expect the new class. At the reviewed SHA, README Port notes still say “Deviations: None,” and the module ledger has empty `deviations` and `exportsAdded` arrays. Other focused files also introduce exported error classes.
- failure: The provenance record does not distinguish intentional law-driven behavior changes and added exports from upstream behavior. Future parity review cannot identify their accepted cause and adjusted test from the required records.
- fix: Record the error-class replacement with its forcing law and adjusted test in the ledger and Port notes. Inventory the added exports from the focused files under D2.

### sol-1-11

- file: scratchpad/effected/github-actions/CacheKey.ts:141
- class: test   severity: backlog
- standard: D10 and section 11.4; S3 is explicitly deferred.
- evidence: The reviewed `CacheKey`, `CheckState`, `CheckDocument`, `DetachedProcess`, `ManagedDocument`, and `OidcTokenIssuer` test files contain no property-tester calls or `Arbitrary.schema` round-trip properties. Existing example-based round trips do not satisfy the property floor.
- failure: Exported schemas in the focused surface lack the mandated generated encode/decode properties, leaving the schema domain checked only through selected examples.
- fix: During S3, add the required round-trip and successful-decode properties for the exported schemas using schema-derived arbitraries, Effect equality, and `fcRuns`. Retain the existing upstream examples.

### sol-1-12

- file: scratchpad/test/github-actions/CheckDocument.test.ts:66
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14; section 11.2; S3 is explicitly deferred.
- evidence: The test provides `layer` directly inside `it.effect`; that layer comes from `CheckDocument.layer`, whose implementation uses `Layer.effect`, registers a finalizer, and forks a scoped daemon. D14 requires `it.layer` for scoped or effectful fixture layers.
- failure: The fixture retains the upstream per-test provision pattern and has not completed the required test-canon migration.
- fix: During S3, move the scoped/effectful fixture lifecycle to `it.layer`, retaining per-test state isolation, TestClock behavior, final-flush assertions, and all existing upstream assertions.

REQUIRED: 8
BACKLOG: 4