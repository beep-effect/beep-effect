### sol-1-1
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:639
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the containment invariant documented at lines 540–545.   evidence: A read-only probe ran the installer with filesystem and download stubs, supplying `{"bin":{"../../outside":"bin/cli.js"}}`. Both the pinned oracle and the port returned `Success("tool-cache")` and attempted `writeFileString("/memory/extracted/outside", ...)`, outside `/memory/extracted/package`. The stub recorded the attempted path in memory; no file was written.
- failure: Manifest validation checks each bin’s **target**, but the bin **name** becomes a shim filename without containment validation. An archive can therefore cause shim writes outside `.bin` and outside the extracted package, or overwrite other package files.
- fix: Validate bin names before writing any shims. Reject names whose resolved shim path escapes `.bin`, using the existing `layoutUnexpected` error. Record the verified upstream bug under section 14 and add a regression case with an escaping bin name.

### sol-1-2
- file: scratchpad/effected/github-actions/internal/sigv4.ts:134
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); [AWS S3 canonical-request specification](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sig-v4-header-based-auth.html), which requires preserving the absolute path and forbids URI-path normalization.   evidence: A pure probe of both the pinned oracle and the port produced `/bucket/folder` for request path `/bucket/folder/`, and `/bucket/a/b` for `/bucket/a//b`. The filter removes all empty segments. The contextual `BlobStore` request builder retains a trailing slash in its outgoing URL.
- failure: The canonical URI differs from the URI sent for an object key ending in `/`, so the signature is calculated for another path and S3 rejects it. Direct signing calls also collapse repeated slashes, changing the object name covered by the signature.
- fix: Normalize only the presence of the initial `/`; preserve empty interior and trailing segments while applying `uriEncode` to each segment. Record the verified upstream bug and add canonical-request cases for trailing and repeated slashes.

### sol-1-3
- file: scratchpad/effected/github-actions/ToolInstaller.ts:41
- class: bug   severity: required
- standard: D9 behavior preservation and section 14; Effect `SCHEMA.md`, “Numbers,” distinguishes `S.Number` from `S.Finite`.   evidence: A read-only differential probe decoded `{_tag:"ToolInstallerError", reason:"downloadFailed", subject:"probe", status}` through both error schemas. For `NaN`, `Infinity`, and `-Infinity`, the oracle returned `Success` and the port returned `Failure`; both returned `Success` for `503`. Upstream uses `Schema.Number`; the port uses `S.Finite`. Neither the README nor the ledger records this narrowing.
- failure: The exported error schema rejects values accepted by the upstream schema, changing its construction and decoding contract. The supplied green gates do not establish parity for these inputs.
- fix: Restore the upstream numeric domain with `S.optionalKey(S.Number)`, retaining the field annotation.

### sol-1-4
- file: scratchpad/effected/github-actions/internal/runnerFile.ts:19
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: For `value = "EFFECTED_EOF" + "_".repeat(n)`, the loop tries `n + 1` progressively longer delimiters and compares their prefixes, giving quadratic work. A read-only Bun probe measured approximately `17.56 ms`, `48.16 ms`, and `188.58 ms` for 10,000, 20,000, and 40,000 underscores. A single scan finding the longest underscore run after any `EFFECTED_EOF` occurrence produced identical delimiters in approximately `0.24 ms`, `0.04 ms`, and `0.03 ms`. Equality also held for absent, multiple, and embedded delimiter occurrences. This is an algorithmic improvement over behavior inherited from upstream, rather than a claimed port regression.
- failure: Runner-file formatting can spend quadratic CPU time on a value consisting of the base delimiter followed by a long underscore run.
- fix: Scan once for occurrences of the base delimiter and their following underscore runs, then return the base plus one more underscore than the longest run. Return the unchanged base when it never occurs.

### sol-1-5
- file: scratchpad/effected/github-actions/internal/ieeeNumber.ts:16
- class: schema   severity: required
- standard: D5; `standards/effect-first-development.md` EF-12 and EF-12b; `standards/effect-laws-v1.md` law 19.   evidence: The new exported `IeeeNumber` schema has no `$ScratchpadId` identity or canonical schema annotations. Its named, repeatedly referenced `NonFiniteSpelling` domain at line 5 uses `S.Literals` instead of `LiteralKit`. The installed Effect source already provides `S.Number` for all numbers, with JSON spellings for non-finite values; the reference `SCHEMA.md` documents the same domain.
- failure: The new schema falls outside the identity and annotation requirements already required before this review, and its named literal domain violates the binding literal-domain convention. These are schema requirements, independent of the deferred JSDoc conversion.
- fix: Replace the custom declaration and codec helpers with an `IeeeNumber` export based on `S.Number`, annotated through a file-local `$ScratchpadId` composer. Retain the same-name derived type export. This also removes the separate named literal domain.

### sol-1-6
- file: scratchpad/effected/github-actions/Secret.ts:40
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements” and “Carrier policy”; D4; operator deferral of S2.   evidence: The class documentation retains `@remarks` and `@example`, lacks canonical `@category` and `@since` tags, and its example references the undeclared `theToken` at line 46. Similar legacy carriers remain in the focused installer files.
- failure: The documentation does not meet the eventual JSDoc grammar, and the displayed example is not self-contained or compilable.
- fix: During S2, preserve the existing prose while converting carriers to titled `**Example**` and `**Details**`/`**Gotchas**` sections, add canonical metadata, and construct an example token explicitly with `Redacted.make`.

### sol-1-7
- file: scratchpad/test/github-actions/PackageManagerInstaller.test.ts:81
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D14; `scratchpad/EFFECTED_PORT_GOAL.md` section 11.2; operator deferral of S3.
- evidence: `withRoot` installs the effectful live installer layer through per-test `Effect.provide(live(...))` and separately provides `NodeServices.layer`. The layer composition includes `Layer.effect` services rather than only pure `Layer.succeed`/`Layer.mock` stubs.
- failure: The suite retains runner-owned layer acquisition in test bodies instead of the required `it.layer` form. This is deferred test-canon work, not evidence that the existing assertions fail.
- fix: During S3, move live layer acquisition into `it.layer` suites and give the scratch-root fixture scoped acquisition and cleanup.

### sol-1-8
- file: scratchpad/test/github-actions/PackageManagerInstaller.test.ts:1814
- class: test   severity: backlog
- standard: D10 and section 11.4; operator deferral of S3.
- evidence: The schema round-trip test exercises two fixed examples. The file contains no `it.effect.prop`, `Arbitrary.schema`, or `fcRuns` use.
- failure: Example-based round trips do not satisfy the required property floor for `AmbientPackageManager`, `CachedPackageManager`, and `InstalledPackageManager`.
- fix: During S3, retain the examples and add schema-generated encode/decode round-trip properties for the exported schemas, using `Arbitrary.schema` and `fcRuns`.

### sol-1-9
- file: scratchpad/effected/github-actions/internal/jwt.ts:43
- class: docs   severity: backlog
- standard: D9 and section 14’s deviation-record requirements; EF-3 supplies the law basis for replacing native JSON parsing.
- evidence: A read-only differential probe with a malformed JSON JWT payload returned a failure whose `cause.constructor.name` was `SyntaxError` upstream and `SchemaError` in the port. Encoding `undefined` likewise changed the thrown error from `TypeError` to `SchemaError`. Separately, `internal/unstubbed.ts:31` replaces the oracle’s native `Error` defect with `UnstubbedMemberError`. The README says “Deviations: None,” and the ledger’s deviations array is empty.
- failure: The port notes omit observable, law-driven changes to error causes and defect identity, preventing callers and subsequent reviewers from distinguishing accepted changes from accidental divergence.
- fix: Record these changes in the README and ledger with their governing law IDs and focused regression evidence. Preserve the law-compliant implementations.

REQUIRED: 5
BACKLOG: 4