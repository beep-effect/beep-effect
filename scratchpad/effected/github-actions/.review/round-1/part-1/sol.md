### codex-1-1
- file: scratchpad/effected/github-actions/Artifact.ts:194
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14.   evidence: The pinned oracle declares `list: () => Effect.Effect<...>`, implements it with `Effect.fn`, and calls `artifacts.list()` in its tests. The port changes the member to an Effect value at lines 194 and 482 and changes the test calls accordingly. A read-only probe of `Artifact.makeTest()` returned `typeof list === "object"` and `Effect.isEffect(list) === true`; invoking the original `list()` contract threw `TypeError: port.list is not a function`. Neither Port notes nor the ledger records this deviation.
- failure: Existing consumers and test doubles using the upstream callable contract fail to compile or throw at runtime. The green tests conceal the incompatibility because their calls were changed alongside the implementation.
- fix: Restore the callable `list` signature, implementation, and default test double, and restore the oracle’s `list()` test calls. Keep the Effect value behind a separately named addition if needed.

### codex-1-2
- file: scratchpad/effected/github-actions/BlobEnvelope.ts:223
- class: bug   severity: required
- standard: D11; section 14’s verified-upstream-bug route; the ownership contract at lines 190 and 221–222 and the retained “does not alias the frame’s buffer” test.   evidence: Read-only probes against both the port and pinned oracle encoded body `[1, 2, 3]`, wrapped the frame with `Buffer.from(frame)`, decoded it, and assigned `decoded.body[0] = 99`. The original frame’s first body byte also became `99`. The same probe with an ordinary `Uint8Array` left the frame unchanged.
- failure: `Buffer` is a valid `Uint8Array` input, but its overridden `slice()` returns a view. The returned body therefore aliases the frame for common Node inputs, allowing a caller to corrupt the stored envelope despite the explicit copy guarantee.
- fix: Copy without invoking the input’s overridden `slice`, for example `Uint8Array.from(bytes.subarray(HEADER_BYTES + metaLength))`. Extend the ownership regression to a `Buffer` input and record the upstream bug under section 14.

### codex-1-3
- file: scratchpad/effected/github-actions/ActionInput.ts:402
- class: bug   severity: required
- standard: D11; section 14’s verified-upstream-bug route; `ActionInput.pairs`’ accepted-key contract at lines 360–380.   evidence: Read-only probes against both the port and pinned oracle parsed `__proto__=value\nnormal=ok`. Both succeeded with `{"normal":"ok"}`, and `Object.hasOwn(result, "__proto__")` returned `false`. The key passes every validation check.
- failure: A valid, non-empty input key disappears silently because assignment to `__proto__` on `{}` invokes the inherited prototype setter instead of creating a data property. The successful result does not contain all accepted pairs.
- fix: Replace `result[key] = value` with `R.assignProperty(result, key, value)`, which the installed Effect implementation explicitly supports for external `__proto__` keys. Add the fidelity regression and record the upstream bug under section 14.

### codex-1-4
- file: scratchpad/effected/github-actions/ActionEnvironment.ts:199
- class: type-safety   severity: required
- standard: D11; section 14’s verified-upstream-bug route; `ActionEnvironmentShape.get` and `getOptional` at lines 150–153.   evidence: A read-only probe of `layerFrom({})` returned `Some(function)` for `getOptional("toString")` in both the port and pinned oracle. A second port probe using `layerFrom({ toString: "configured" })` returned a function from both `getOptional("toString")` and `get("toString")`.
- failure: The default overrides object inherits `Object.prototype`. Its inherited `toString` wins the nullish fallback before the configured base value is read. Missing variables can appear present, configured values can be shadowed, and APIs typed to return strings actually return functions.
- fix: Use own-property record lookups for both overrides and base, such as `R.get` followed by `O.getOrUndefined`, before applying the existing fallback and empty-string rule. Add absent and explicitly configured prototype-name cases and record the upstream bug under section 14.

### codex-1-5
- file: scratchpad/effected/github-actions/Artifact.ts:249
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data” and “Effect owns fallibility and runtime boundaries”; D11 and section 14.   evidence: `ArtifactItem` is an interface, and `toItem` normalizes unknown response fields without validating the result. A read-only probe supplied a mocked `ListArtifacts` response containing `{ databaseId: "not-a-number", name: "logs", size: "not-a-number" }`. Listing succeeded with one item; both `Number.isNaN(item.id)` and `Number.isNaN(item.size)` were `true`. The pinned oracle contains the same unchecked conversions.
- failure: Malformed backend data crosses the service boundary as a successful artifact with an unusable database id and byte size. Consumers receive no typed failure; downloading that returned id subsequently searches for `NaN`, which cannot match even itself.
- fix: Define an annotated runtime schema for `ArtifactItem`, derive its type, and decode normalized rows before returning them. Map validation failure to `ArtifactError` with the existing malformed-response error policy. Preserve both field spellings and record rejection of these invalid numeric fields under section 14.

### codex-1-6
- file: scratchpad/effected/github-actions/Action.ts:25
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md “Hard requirements” and “Carrier policy”; explicitly deferred S2 in the review brief.   evidence: The focused files retain `@remarks` and `@example` carriers and omit required category/since metadata on public declarations. For example, `ActionServices` uses `@remarks` at line 25, and `Action` uses `@example` at line 220. Its example also references an undefined `program`.
- failure: The carried documentation does not yet satisfy the canonical section grammar or self-contained example contract. S2 cannot close on these blocks as written.
- fix: During S2, preserve the upstream prose while converting carriers to `**Details**` and titled `**Example**` sections, add canonical categories and `@since 0.0.0`, and make examples self-contained.

### codex-1-7
- file: scratchpad/test/github-actions/ActionEnvironment.test.ts:47
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5 and D14; explicitly deferred S3 in the review brief.   evidence: The `live` helper provides the effectful `ActionEnvironment.layerFrom` and `MemoryFileSystem.layerWith` layers per test through `Effect.provide`. Tests also manually inspect Options, including `assert.isTrue(O.isNone(...))` at line 88.
- failure: The suite retains the resource-provision and assertion patterns that the requested S3 canon migration must replace.
- fix: During S3, move effectful fixtures into appropriately isolated `it.layer` blocks and use the canonical Option/Result/Exit assertion helpers. Apply the same migration to equivalent patterns in the other focused suites.

### codex-1-8
- file: scratchpad/test/github-actions/BlobEnvelope.test.ts:132
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D10; goals/effect-vitest-canon/SPEC.md property-run guidance; explicitly deferred S3 in the review brief.   evidence: The two envelope properties at lines 132 and 151 specify no `fcRuns` floor. The focused `ActionEnvironment` and `ActionOutputs` suites contain no schema round-trip properties for exported `GitHubContext`, `RunnerContext`, or `RecordedOutput`.
- failure: The focused suites do not yet meet the explicit property floor for exported schemas/codecs or the required repository-controlled property run counts.
- fix: During S3, add schema-derived encode/decode round-trip properties for the exported schemas and configure explicit `{ arbitrary: fcRuns(n) }` floors on the retained and added properties.

REQUIRED: 5
BACKLOG: 3