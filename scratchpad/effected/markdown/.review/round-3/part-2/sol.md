### sol-3-1

- file: scratchpad/effected/markdown/internal/blockParser.ts:325
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); standards/effect-first-development.md EF-31.   evidence: A read-only Node v24.20.0 probe calling `Markdown.parseResult("x\n".repeat(150000) + "---\n")` throws `RangeError: Maximum call stack size exceeded` at `replacement.segments.push(...block.segments)`. The Effect entry point returns a failure containing `Cause.Die`. The pinned oracle reproduces the same overflow in `BlockParser.replaceBlock`. This is a separate site from round-2 req-35’s repaired definition-extraction spread.
- failure: A valid, shallow multiline setext heading exceeds the runtime’s function-argument limit when paragraph promotion spreads every source segment into `push`. Parsing escapes the advertised Result/error channel even though nesting remains within the hardening limit.
- fix: Copy the segments with an iterative loop instead of argument spreading. Add a Node regression for the 150,000-line setext heading, asserting successful parsing and retained source positions, and record the verified upstream bug through section 14.

### sol-3-2

- file: scratchpad/effected/markdown/Mdast.ts:436
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-3 requires deliberately synchronous decoding paths to be non-throwing; EF-31 separates input failures from defects; D9, D11 and section 14 (`upstream-bug`).   evidence: A read-only probe builds a positionless paragraph wrapped in 16,000 distinct blockquotes, then calls `Mdast.fromMdastResult({ type: "root", children: [child] })`. Both the port and pinned oracle throw `RangeError: Maximum call stack size exceeded`. The port’s `Mdast.fromMdast` returns `Cause.Die`. The input is acyclic, so the recorded round-2 ancestor-cycle repair never rejects it.
- failure: Deep acyclic foreign input still exhausts the recursive normalization stack before a structured `MdastDecodeError` can be returned. The synchronous API throws, and its Effect twin defects.
- fix: Add an iterative admission preflight that checks a documented safe foreign-tree depth budget before recursive normalization and schema decoding. Return `MdastDecodeError` with a structured `SchemaIssue.InvalidValue` when that budget is exceeded. Preserve shared acyclic subtrees and supported foreign trees above the visitor’s separate depth limit; add regressions for both entry points and record the upstream-bug deviation.

### sol-3-3

- file: scratchpad/effected/markdown/internal/inlineParser.ts:468
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion; the parser’s documented protection against quadratic link processing; D9 and section 14 (`upstream-bug`).   evidence: Read-only, in-memory instrumentation counted the bracket visits performed by `deactivateLinkOpeners` while parsing `"![[[]()".repeat(n)` under CommonMark. For `n = 500, 1000, 2000, 4000`, the counts were **250,500; 1,001,000; 4,002,000; 16,004,000**, exactly `n(n + 1)`. The pinned oracle contains the same full-stack loop. An in-memory trial that stops once `activeLinkOpeners` reaches zero reduced those counts to **500; 1,000; 2,000; 4,000** and preserved the complete parse result for the 50-repetition control.
- failure: Each repetition leaves older image and inactive link openers on the stack while introducing another active opener. Deactivation clears that active opener, then unnecessarily scans the entire older stack, producing Θ(n²) work for Θ(n) input.
- fix: Include `this.activeLinkOpeners > 0` in the traversal’s continuation condition, or break immediately after the count reaches zero. Add a scaled bracket-visit regression and record the verified upstream performance bug.

### sol-3-4

- file: scratchpad/effected/markdown/internal/blockTypes.ts:155
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5 and D11.   evidence: `RawInlineSlice` at line 155, `PreparedInline` at line 168, `DefinitionData` at line 249 and `FootnoteData` at line 272 remain exported interfaces without corresponding schema values. They contain immutable payload fields and no methods or complex type-level machinery. Their shapes can be represented with `S.Struct`, existing node/content schemas and `RawInlineSegment`. The recorded schema migration covers neighboring source/provenance models but does not exempt these four records; the green gates accept these remaining type-only declarations.
- failure: These reusable engine payloads have no executable source of truth for their shapes and cannot supply schema-derived validation, equivalence or arbitraries. They remain outside the required schema-first model contract.
- fix: Define annotated `S.Struct` values under the same four names and derive their same-name types with `typeof Name.Type`. Preserve the current plain-object payloads and field optionality, and add the corresponding schema properties.

### sol-3-5

- file: scratchpad/effected/markdown/internal/blockTypes.ts:338
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 requires `LiteralKit` for named internal literal domains; standards/effect-first-development.md EF-35; D5 and D11.   evidence: `BlockContinueResult` at line 338 and `BlockStartResult` at line 352 are still independently declared as `0 | 1 | 2`. These named verdict domains are reused by `BlockConstruct.continue` and `BlockStart.trigger`, respectively. Unlike the repaired `BlockType`, neither has an annotated runtime domain. Round-2 req-26 addressed the block and inline node-kind domains, rather than these verdict domains.
- failure: The two parser verdict vocabularies exist only as handwritten TypeScript unions, leaving their documented finite domains without the required schema ownership or derived runtime guards.
- fix: Define annotated `LiteralKit([0, 1, 2])` values for the two verdict domains and derive their same-name types. Retain the existing numeric codes and scanner behavior.

REQUIRED: 5
BACKLOG: 0