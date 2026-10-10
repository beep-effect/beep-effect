### sol-1-1
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:488
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated source-position failure); `InlineScanner`’s original-source position contract.   evidence: A read-only `bun -e` probe calling both the port’s `parseBlocks` and the pinned oracle’s `parseBlocks` on `"&#64;a@b.com"` produces a prefix text span `[0,1)` and an email link span `[1,12)`. The entity occupies `[0,5)`, and the literal email occupies `[5,12)`. `"\\!a@b.com"` similarly starts the link at offset 1 instead of 2. Neither bug is recorded in the module’s deviations.
- failure: At a decoded piece’s end, `localAt` maps the decoded value length into the source with `node.start + within`. That truncates the entity or escape’s source extent and includes part of it in the following email link. Consumers using the link position to replace or delete the address can corrupt the preceding entity or escape.
- fix: When `within === piece.node.value.length`, return `piece.node.end`; retain the existing mapping for interior indices. Add regression assertions for the prefix and link spans, and record this inherited upstream bug through section 14.

### sol-1-2
- file: scratchpad/effected/markdown/internal/inlines/link.ts:75
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated differential failure); `plainTextOf`’s stated contract to preserve the image description’s plain text.   evidence: A read-only probe renders `"![a\\\nb](u)"` through the port and its retained `renderHtml` helper as `<img src="u" alt="ab" />`; the installed CommonMark 0.31.2 test oracle renders `<img src="u" alt="a\nb" />`. The pinned effected oracle also produces `alt: "ab"`. The failure reproduces with a spaces-style hard break and with an image reference.
- failure: `plainTextOf` handles text, code and nested images, then traverses children for every other node. A `break` has no children, so its entire contribution disappears. Image descriptions lose the separation between words across hard line breaks.
- fix: Add a `node.type === "break"` arm that appends `"\n"` to the flattened text. Cover both hard-break styles and an image reference, and record the inherited bug through section 14.

### sol-1-3
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:64
- class: bug   severity: required
- standard: [CommonMark 0.31.2 §2.1](https://spec.commonmark.org/0.31.2/#characters-and-lines) defines characters as Unicode code points and punctuation as categories P or S; [§6.2](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis) applies that classification to delimiter flanking. D9 and section 14 permit a verified upstream bug fix.   evidence: Read-only probes show that both the port and pinned oracle parse `"😀_a_"` and `"_a_😀"` entirely as text, and parse `"a*𐄀*b"` with emphasis. Under the cited rules, the first two inputs contain emphasis around `a`, while the third stays literal because U+10100 is punctuation between alphanumeric neighbors and the delimiters.
- failure: `charAt(startpos - 1)` reads only the preceding low surrogate. On the other side, `scanner.peek()` returns a UTF-16 code unit, so `String.fromCodePoint(ccAfter)` reconstructs only the high surrogate. The Unicode punctuation regex consequently receives surrogate halves and misclassifies astral punctuation and symbols, both allowing forbidden emphasis and rejecting valid emphasis.
- fix: Read the complete code point on each side of the delimiter run, including stepping back over a valid surrogate pair for the preceding character. Keep scanner offsets in UTF-16 units. Add astral flanking regressions and record the inherited spec violation through section 14.

### sol-1-4
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:485
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: `localAt` starts at the first `RunPiece` for every position lookup, and each email invokes it for its link boundaries and intervening text boundaries. A read-only probe built adjacent pieces `"a"`, `"_"`, `"b@c.de "` per email and counted reads of the original nodes’ `value` properties during `linkifyEmails`: 64 emails/192 pieces → 25,153 reads; 128/384 → 99,457; 256/768 → 395,521. Doubling input approximately quadruples the work. The implementation matches the pinned oracle, so this is an inherited quadratic path.
- failure: A paragraph containing Θ(n) email matches and Θ(n) text pieces requires Θ(n²) work just to recover source positions, despite the matches and pieces already being ordered.
- fix: Retain a piece cursor across the nondecreasing `localAt` queries, advancing it only when the requested index passes the current piece. This reduces position lookup to O(pieces + matches), while preserving the corrected boundary mapping from sol-1-1.

### sol-1-5
- file: scratchpad/effected/markdown/internal/inlines/rawHtml.ts:36
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: The precheck covers comments, processing instructions and CDATA, but omits declarations. `reHtmlTag` includes the declaration pattern `<![A-Za-z]+[^>]*>`. For `"x " + "<!A".repeat(n)` with no `>`, each opener retries that pattern against the remaining suffix: Θ(n) attempts, each scanning Θ(n) remaining characters, yielding Θ(n²) work. A bounded read-only parse probe took approximately 58 ms, 87 ms and 319 ms for 8,000, 16,000 and 32,000 openers respectively. The pinned oracle has the same path; the required basis is the algorithmic-class improvement.
- failure: Repeated unterminated declarations bypass the memoized missing-closer protection and repeatedly scan the rest of an otherwise valid text paragraph.
- fix: Add `["<!", ">"]` to the missing-closer prechecks, or perform a memoized `hasAhead(">")` check before attempting the HTML regex. For this input family, one initial scan followed by constant-time misses reduces the work to O(n) without changing parsed output.

### sol-1-6
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:33
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; AGENTS.md’s schema-first domain-model law; D5.   evidence: `DelimiterRun` is an exported pure-data interface containing only `numdelims`, `canOpen` and `canClose`; `scanDelims` constructs a parallel object literal at line 81. It is neither a service contract nor type-level machinery. The green lint gate runs oxlint and `effect-fn`, `terse-effect`, `native-runtime`, and `effect-imports`; those checks do not enforce this pure-data modeling requirement.
- failure: The shared delimiter measurement has no runtime schema as its source of truth. Its runtime validator and arbitrary cannot be derived from the exported model, and the model bypasses the required identity and schema annotation surface.
- fix: Define an identity-annotated `DelimiterRun` schema, derive the same-name type from it, and construct or type the measurement against that schema. Preserve the existing fields and parser behavior.

### sol-1-7
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:48
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-2, “Absence is Option”; effect-first-development skill law 5; D5.   evidence: Both overloads of `scanDelims` expose `DelimiterRun | undefined`, and the implementation returns `undefined` when no run exists. Its domain consumers branch directly on that sentinel in `handleDelim` and `strikethrough.ts`. This is an internally produced domain result, not external nullable input. The four green beep laws do not enforce EF-2.
- failure: Missing delimiter measurements flow through parser domain logic as a nullish union rather than the required `Option`, leaving absence outside the Effect model.
- fix: Return `O.Option<DelimiterRun>` from both overloads, use `O.none()` and `O.some(...)`, and update the two consumers to narrow the option. Preserve cursor restoration and parsing behavior; record the return-shape change as `law:EF-2` under section 14.

### sol-1-8
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:39
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements” and “Kind-split Example law”; the review brief explicitly defers S2 findings to backlog.   evidence: `scanDelims` has descriptive prose but no titled `**Example**`, canonical `@category`, or `@since 0.0.0`. The same omission affects the exported value declarations throughout the eleven focused files; the exported `DelimiterRun` and `LinkCloseFallback` types also lack category and since tags.
- failure: The exported declarations do not yet meet the repository documentation rubric or teach the newly added direct and pipeable call forms.
- fix: During S2, preserve the existing prose and add canonical category/since tags and compilable titled examples for value exports. Document the direct and pipeable forms where applicable; examples remain optional for pure type exports.

REQUIRED: 7
BACKLOG: 1