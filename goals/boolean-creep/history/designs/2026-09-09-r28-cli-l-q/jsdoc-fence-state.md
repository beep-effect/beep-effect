# Instance

- id: `jsdoc-fence-state`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/internal/jsdoc/JSDocSections.ts:41`
- symbol: `fenceState`
- members: `nextOpenFence`, `isFenced`
- evidence: E4 at `JSDocSections.ts:41-54` — every defined
  `nextOpenFence` is paired with true, while a closing fence deliberately
  returns `[undefined, true]`; `[marker, false]` is unreachable.

# Current shape

`fenceState` advances one Markdown fence scanner from the previous open marker
and returns `[nextOpenFence, isFenced]`. Outside text is
`[undefined, false]`, an opener or body line is `[marker, true]`, and the
matching closer is `[undefined, true]`. Marker absence therefore does not mean
outside: the true/undefined closer suppresses `*/` parsing and remains visible
to the migration rewriter for that line.

The scanner recognizes backtick or tilde runs of at least three characters.
A closer must use the opener's character, be at least as long, and contain only
trimmed whitespace after its run. A different, shorter, annotated, or nested
fence stays inside and retains the original open marker.

# Cardinality gap

The optional marker and Boolean expose four presence pairs. Three are legal:

| next marker | fenced | disposition |
| --- | --- | --- |
| absent | false | outside |
| present | true | fenced, with the active marker |
| absent | true | closing |

Present/false is never produced or meaningfully consumed. The `fenced` case
covers both an opening line and an interior line; callers that need that
distinction already compare with the previous input state.

# Target schema

Define one private `FenceLineDisposition` schema as a union of `outside`,
`fenced`, and `closing`. The `fenced` member carries the exact active marker;
the other two carry no marker. Derive guards with `S.is(...)` or match on the
case tag. Return this disposition from the private scanner and from the
existing exported dual `fencedLineState` API.

Do not add separate opener/interior cases: the prior `openFence` already tells
the sole reader that needs that distinction, and duplicating it would add no
new output fact. Do not reduce the result to marker presence because that
would collapse closing into outside.

# Migration inventory

- `packages/tooling/tool/cli/src/internal/jsdoc/JSDocSections.ts:41-74` — add
  the private schema and return the three dispositions while preserving the
  exported data-first/data-last API and exact marker parsing.
- `JSDocSections.ts:76-95` — retain the active marker only for `fenced`; search
  for the JSDoc terminator only for `outside`; treat `closing` as fenced for
  the current line.
- `JSDocSections.ts:293-447` — preserve the downstream section-name guard,
  fenced-content masking, section parsing, and source offsets. The merged
  compiler hoist moves the guard to line 300 and the parser to lines 420-447;
  it adds no fence-state reader or state.
- `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts:651-671`
  — migrate `tagsFromComment` to the disposition and continue skipping opener,
  body, and closer lines in the same order.
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateRewrite.ts:71-91`
  — derive `outside`, `open`, `inside`, and `close` line classes from the new
  disposition plus the previous marker presence. Preserve the downstream
  fenced-body rewrite and quarantine behavior.
- `packages/tooling/tool/cli/src/test/Docgen.test-kit.ts:32` and
  `src/test/Quality.test-kit.ts:78` — retain the test-kit export under the same
  name with the new return schema type.
- CLI JSDoc, quality-artifact, and migration tests that consume those test kits
  — update tuple assertions and retain parser, tag, rewrite, offset, and
  malformed-fence fixtures.

Targeted source and barrel search found no other writer or reader of this
tuple.

# Guard-deletion accounting

Delete all three tuple destructures, the `nextOpenFence`/`isFenced` pair, the
`!isFenced` guards in comment and tag parsing, and the rewriter's combinations
of `wasOpen`, `isFenced`, and next-marker presence. Exhaustive disposition
matching becomes the coherence boundary. Keep previous marker state because it
is the scanner input and is required to validate closers.

# Encoded-side impact

None. The result is transient parser state. It is exposed only through repo
CLI test-kit TypeScript exports and is not serialized, persisted, or emitted by
a command. Migrate those compile-time callers atomically; no compatibility
codec, stored state, or default is warranted.

# Test impact

Table-test outside text, both opener characters, opener info strings, interior
text, exact and longer closers, shorter and wrong-character pseudo-closers,
nonempty closer tails, and an unterminated fence. Assert that a closing line is
`closing`, is skipped for tags, cannot terminate the JSDoc block through an
embedded `*/`, and is classified as `close` by the rewrite path. Retain exact
source offsets and existing tag order. Run the focused repo CLI JSDoc/quality
tests and package verification when implemented.

# Risk and sequencing

Tier 1 internal derived refactor. Migrate the exported test-kit type and all
three production readers in one change. The main risks are treating a closer as
outside for its own line, accepting a shorter or annotated closer, changing
the first-character rule, or losing the original marker needed for later
lines. The owner, all three production readers, test-kit exports, and shifted
downstream parser were rechecked at the exact source SHA above.
