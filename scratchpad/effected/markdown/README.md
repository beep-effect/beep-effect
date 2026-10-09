# markdown (lab port of @effected/markdown)

[![npm](https://img.shields.io/npm/v/@effected%2Fmarkdown?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/markdown)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Zero-dependency CommonMark 0.31.2 and GFM parsing, editing and transformation expressed as Effect schemas and pure functions. Parse markdown into mdast-shaped nodes carrying byte offsets, navigate headings, sections and links, compute surgical offset-splice edits, normalize markers, decode frontmatter into a validated domain schema, project to and from plain mdast for the remark ecosystem, and walk a document as a `Stream`.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/markdown

Markdown is where documentation, changelogs, knowledge bases and AI-agent context files actually live — files people edit by hand and expect to survive a tool touching them. The remark ecosystem is the JavaScript default, but its serializer reformats by design: read a document and write it back and you get remark's idea of markdown, not yours. Nobody in the ecosystem ships a lossless markdown CST, and the remark maintainers themselves point at positional splicing instead.

This package takes that advice as the architecture. Every node carries byte offsets alongside unist line/column positions, so an edit is a splice against the original source rather than a re-serialization of a tree: change a heading and the blank lines, HTML comments and hand-tuned spacing everywhere else come through byte-identical. `MarkdownEdit` is field-identical to `JsoncEdit`, `YamlEdit` and `TomlEdit`, so the same editing vocabulary spans every format in the kit.

The engine is a vendored, hardened port of commonmark.js — the reference parser maintained by the spec author — restructured as one module per construct behind dialect-keyed registries. That means no runtime parser dependency and no plugin surface to reason about: `commonmark` and `gfm` are the two dialects, `gfm` is the default, and both are pinned by the upstream conformance corpora. Parse is near-total, because CommonMark has no syntax errors: the typed error channel carries hardening-guard trips only, never "malformed markdown".

Nodes are shaped to mdast's exact type names and field shapes, so the tree is already the shape the remark ecosystem speaks, and `Mdast.toMdast` strips this package's fidelity fields to hand you plain spec-valid mdast JSON. Frontmatter — which mdast has no parsing story for at all — is captured behind a parse toggle and decoded through free-standing per-format codecs, giving typed gray-matter parity without dragging three format engines into a bundle that needs one.

Markdown to HTML is deliberately out of scope. This package parses, edits and transforms markdown; rendering belongs to whatever renderer you already have, reached through the mdast projection.

## Install

```bash
npm install @effected/markdown effect
```

```bash
pnpm add @effected/markdown effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency; the package itself adds no runtime dependencies.

`@effected/yaml`, `@effected/toml` and `@effected/jsonc` are **optional** peers, required only by the frontmatter codec module you import. A consumer decoding yaml frontmatter installs `@effected/yaml` and nothing else; a consumer who never touches frontmatter installs none of them.

```bash
npm install @effected/yaml
```

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

`MarkdownDocument.parse` gives you the source, the tree, the definition index and the navigation accessors in one value:

```ts
import { MarkdownDocument } from "@effected/markdown";
import { Effect } from "effect";

const source = `# Release notes

## Fixed

- Tables no longer ~~drop~~ trailing cells.
`;

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source);
  return doc.headings.map((heading) => `${"#".repeat(heading.depth)} ${heading.text}`);
});

Effect.runPromise(program).then(console.log);
// [ "# Release notes", "## Fixed" ]
```

The dialect defaults to `gfm`, so the strikethrough above parses as a `delete` node with no configuration. Pass `MarkdownParseOptions.make({ dialect: "commonmark" })` for strict CommonMark.

Every parse has a synchronous twin — `MarkdownDocument.parseResult` and `Markdown.parseResult` return a `Result` — so a build script, a Vite plugin or a language-server tick can call in without an Effect runtime.

## Editing without reformatting the document

`MarkdownFormat.modify` computes a `MarkdownEdit` array against the parsed document; `modifyToString` applies it in one step. The target is a node from the document's own tree, matched by identity, and everything the edit does not cover survives byte-for-byte:

```ts
import { MarkdownDocument, MarkdownFormat } from "@effected/markdown";
import { Effect } from "effect";

const source = `# Release notes

See the [changelog](./CHANGELOG.md).
`;

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source);
  const label = doc.find("text")!;
  return yield* MarkdownFormat.modifyToString(doc, label, "Release notes (2026)");
});

Effect.runPromise(program).then(console.log);
// # Release notes (2026)
//
// See the [changelog](./CHANGELOG.md).
```

`find` walks the tree in document pre-order and returns the document's own node, so the match feeds `modify` by identity. Replacements are literal strings or node fragments, and both render through the canonical stringifier, so a modified document re-parses cleanly by construction — you cannot splice in raw markdown that reopens a fence or breaks a table.

`MarkdownFormat.format` handles the other half: conservative marker normalization, never content rewriting. It converts heading style, bullet character, emphasis marker, fence character, thematic-break character and code-block style, and skips any conversion that would not be safe rather than attempting it cleverly:

```ts
import { MarkdownFormat, MarkdownFormattingOptions } from "@effected/markdown";

const source = `Setext heading
==============

* one
* two
`;

const options = MarkdownFormattingOptions.make({ headingStyle: "atx", bulletChar: "-" });

console.log(MarkdownFormat.formatToString(source, undefined, options));
// # Setext heading
//
// - one
// - two

console.log(MarkdownFormat.format(source, undefined, options));
// [
//   { offset: 0, length: 29, content: "# Setext heading" },
//   { offset: 31, length: 1, content: "-" },
//   { offset: 37, length: 1, content: "-" }
// ]
```

`format` is pure and total, and the edits are non-mutating data — hand them to `MarkdownEdit.applyAll`, or send them to an editor as a text-edit payload.

`codeBlockStyle` is the option to know about before you hit its default: absent it, a language-less code block keeps whichever spelling it already has, and a language-less `Code` node with no `fenceChar` serializes as an *indented* block. `"fenced"` rewrites indented blocks to fences, `"indented"` goes the other way where the result provably re-parses the same, and both directions apply to root-level flush-left blocks only. A block with a language has no indented spelling and is never touched.

## Frontmatter

Frontmatter capture is opt-in, because enabling it changes how a document opening with `---` parses: CommonMark reads `---\ntitle: x\n---` as a thematic break and a setext heading, and that spec-conformant reading holds unless you ask for something else. Turn it on and compose your schema with a codec for typed gray-matter parity:

```ts
import { MarkdownDocument, MarkdownFrontmatter, MarkdownParseOptions, YamlFrontmatter } from "@effected/markdown";
import { Effect, Schema } from "effect";

const source = `---
title: Release notes
draft: false
---

# Release notes
`;

const Post = Schema.Struct({ title: Schema.String, draft: Schema.Boolean });
const decodePost = MarkdownFrontmatter.schema(Post, YamlFrontmatter);

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source, MarkdownParseOptions.make({ frontmatter: true }));
  return yield* decodePost(doc);
});

Effect.runPromise(program).then(console.log);
// { title: "Release notes", draft: false }
```

Each stage fails typed and separately: no capture is a `FrontmatterMissingError` (catch the tag for optional semantics), a codec handed the wrong fence is a `FrontmatterFormatMismatchError`, unparseable content is a `FrontmatterDecodeError` carrying the format package's own positioned failure structurally, and schema-invalid data is a `FrontmatterValidationError` carrying the structured issue tree rather than a stringified rendering.

Because capture is opt-in, "there is no frontmatter" has two meanings, and `FrontmatterMissingError.reason` tells them apart: `"absent"` when the source genuinely has no block, `"captureDisabled"` when it opens with one but was parsed with the toggle off — where the fix is a parse option, not a document edit. `MarkdownDocument.hasFrontmatterBlock` answers the same question directly, by re-running the parser's own pre-scan, so the accessor and the error can never disagree.

The three codecs — `YamlFrontmatter` (`---`), `TomlFrontmatter` (`+++`) and `JsonFrontmatter` (`---json`) — are free-standing named exports, one module each, deliberately never collected into a namespace object. Naming one codec is what pulls in its format engine, so a JSON-frontmatter consumer never pays for the yaml parser.

Frontmatter blocks can also describe their own schema. `SchemaResolver.classify` sorts a `$schema` value into a tagged union — `ByUrl`, `ByPath`, `Inline` and `ByName` — and `SchemaResolver.fromRegistry` resolves `ByName` declarations like `skill@2.1.0` against schemas you register. URLs, paths and inline documents are carried as data and never fetched: this is a pure package and it performs no IO.

When the body should not go through the CommonMark engine at all — an MDX page, a template, a snapshot-hash contract that needs byte-exact boundaries — `FrontmatterSource.split` runs the same closed fence grammar over the raw string and nothing else. It is total: it returns the block's format, the exact bytes between the fence lines and the body remainder (`body` is always exactly `source.slice(bodyOffset)`), with absence a representable result rather than an error. `FrontmatterSource.join` serializes the parts back, reproducing the original bytes for an unmodified round-trip. Two edges normalize instead of reproducing: a closing fence that ends the document without a line terminator gains one, and fence lines with mismatched terminators (say `---\r\n … ---\n`) re-emit both with the opening fence's. The value and body bytes survive verbatim in every case, and neither is ever parsed at this level — decoding stays the codec modules' business.

## Working with the tree

`MarkdownDocument` derives its navigation accessors from the tree, so they can never disagree with it. `links` collects every URL-bearing node and passes `url` through exactly as written — bundle-relative hrefs are never normalized:

```ts
import { MarkdownDocument } from "@effected/markdown";
import { Effect } from "effect";

const source = `# Release notes

See the [changelog](./CHANGELOG.md) and the [docs](https://example.com/docs).
`;

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source);
  return doc.links.map((link) => link.url);
});

Effect.runPromise(program).then(console.log);
// [ "./CHANGELOG.md", "https://example.com/docs" ]
```

`headings` lists every heading wherever it sits, including inside blockquotes and list items. `sections` are delimited by root-level headings only, and each section's range spans its subsections, so the edit layer can splice a whole section out in one edit. `firstSection` and `sectionByHeading` find one `DocumentSection` without scanning `sections` yourself — the second matches on an exact trimmed heading string, a `RegExp`, or a predicate, and both accept `{ depth }` to restrict to one heading level:

```ts
import { MarkdownDocument } from "@effected/markdown";
import { Effect } from "effect";

const source = `# Changelog

## 1.2.3

Fixed a bug.

## 1.2.2

Initial release.
`;

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source);
  return doc.sectionByHeading("1.2.3", { depth: 2 })?.body.trim();
});

Effect.runPromise(program).then(console.log);
// Fixed a bug.
```

`DocumentSection.body` is the section without its heading, and it is deliberately untrimmed — exactly the bytes `bodyRange` describes — so callers write `.body.trim()` when they want the tidy form.

For anything the accessors do not cover, `find` and `findAll` walk the whole tree in document pre-order. A string selector matches the node's `type` and narrows the result — `doc.findAll("heading")` is `ReadonlyArray<Heading>`, `doc.find("table")` is `Table | undefined` — and a type-guard predicate narrows the same way. The nodes come back by identity, so `doc.findAll("heading")[1]` addresses the second heading for `MarkdownFormat.modify` without raw child indexing.

`MarkdownVisitor.visit` streams the same walk as `Enter`/`Exit` events carrying the node, its child-index path and its depth:

```ts
import { MarkdownDocument, MarkdownVisitor } from "@effected/markdown";
import { Effect, Stream } from "effect";

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse("# Title\n\nA *b* c\n");
  const events = yield* Stream.runCollect(MarkdownVisitor.visit(doc.root));
  return Array.from(events).map((event) => `${event._tag}:${"node" in event ? event.node.type : "?"}`);
});

Effect.runPromise(program).then(console.log);
// [ "Enter:root", "Enter:heading", "Enter:text", "Exit:text", "Exit:heading",
//   "Enter:paragraph", "Enter:text", "Exit:text", "Enter:emphasis", "Enter:text",
//   "Exit:text", "Exit:emphasis", "Enter:text", "Exit:text", "Exit:paragraph", "Exit:root" ]
```

## mdast interop

The node classes already use mdast's type names and field shapes; `Mdast.toMdast` strips the fidelity fields this package adds — bullet characters, fence style, ATX-versus-setext spelling — (keeping only a `Text` node's `escapeStyle` when set, see [Literal text](#literal-text)) and emits plain spec-valid mdast JSON that the remark ecosystem consumes directly, including `mdast-util-to-hast` if you want hast:

```ts
import { Markdown, Mdast } from "@effected/markdown";
import { Result } from "effect";

const parsed = Markdown.parseResult("A *b* c\n");
if (Result.isSuccess(parsed)) {
  console.log(JSON.stringify(Mdast.toMdast(parsed.success)).slice(0, 62));
  // {"type":"root","children":[{"type":"paragraph","children":[{"t
}
```

`Mdast.fromMdast` goes the other way as a checked admission boundary: it validates a foreign tree and synthesizes zero-width sentinel positions where one is absent or incomplete. Trees admitted that way serve tree-level workflows and canonical `stringify`; offset-splice editing needs the real positions only a parse produces.

## MDX trees

The MDX node vocabulary — `MdxJsxFlowElement` and `MdxJsxTextElement` (with `MdxJsxAttribute`, `MdxJsxExpressionAttribute` and `MdxJsxAttributeValueExpression` as their attribute carriers), `MdxFlowExpression`, `MdxTextExpression` and `MdxjsEsm` — is shaped exactly to the `mdast-util-mdx` contracts and constructs like every other node class. The parser does not read MDX syntax; these nodes exist so a **synthesized** tree can carry JSX and serialize to valid MDX instead of joining strings:

```ts
import { Markdown, MdxJsxAttribute, MdxJsxAttributeValueExpression, MdxJsxFlowElement, Root } from "@effected/markdown";
import { Result } from "effect";

const page = Root.make({
  children: [
    MdxJsxFlowElement.make({
      name: "ApiSignature",
      attributes: [
        MdxJsxAttribute.make({
          name: "code",
          value: MdxJsxAttributeValueExpression.make({ value: JSON.stringify({ lang: "ts" }) }),
        }),
      ],
      children: [],
    }),
  ],
});

const mdx = Markdown.stringifyResult(page);
if (Result.isSuccess(mdx)) {
  console.log(mdx.success); // <ApiSignature code={{"lang":"ts"}} />
}
```

Serialization matches `mdxJsxToMarkdown`'s defaults — `"` quotes, spaced self-closing `<a />`, `<></>` fragments, flow children indented two spaces per JSX ancestor, `{expr}` expressions, ESM values verbatim — and a tree containing any MDX node escapes `{` in text the way MDX requires, while a tree with none serializes byte-identically to the table below. The shapes that have no MDX spelling are unconstructible rather than serialization errors: a fragment cannot carry attributes and an attribute requires a non-empty name, refused at `make` and at decode.

## The canonical form is stable

`Markdown.stringify` takes no options. It emits one canonical form, that form is pinned by byte-level tests, the engine behind it is cross-checked against commonmark.js over the full CommonMark 0.31.2 corpus, and **changing any of it is a breaking change to this package rather than a patch**. So a test may assert on these bytes, and a pipeline that needs stable rendered markdown should serialize through here instead of a third-party stringifier whose defaults are free to move between releases.

For a node carrying no fidelity field:

| Construct | Canonical form |
| --- | --- |
| Heading | ATX (`## x`), at every depth |
| Thematic break | `***` |
| Bullet list marker | `-` |
| Ordered list delimiter | `.`, flipping to `)` to separate an immediately adjacent sibling list |
| Emphasis / strong | `*` / `**` |
| Code block | fenced when the node carries a `lang` or a `fenceChar`, with the fence grown past any interior backtick run; otherwise indented — except where indenting would not re-parse as a code block, which forces a fence |
| Block separation | exactly one blank line |
| Document | a single trailing newline |

MDX nodes are part of the same commitment: the serialization choices listed under [MDX trees](#mdx-trees) are pinned the same way, and only trees that actually carry an MDX node pay the extra `{` escape.

**Representability wins over the table.** The canonical form never emits text that would re-parse as something else, so a row yields where the two conflict. The case that reaches a consumer is the indented code block: an indented block directly after a list is absorbed as list content, so a `Code` node with neither `lang` nor `fenceChar` emits fenced in that position and indented everywhere else. A byte-level assertion over synthesized code blocks therefore depends on the preceding sibling.

The posture that makes this a non-issue — and the one to adopt if you build trees and assert on their bytes — is to set `fenceChar` on every `Code` node carrying neither a `lang` nor one already, in a post-decode walk that reaches nested nodes. The choice then leaves the emitter entirely and no output depends on a node's neighbours.

Fidelity fields must be set on the **decoded** tree: `Mdast.fromMdast` admits spec mdast and strips everything outside it, so a `fenceChar` placed on a plain mdast tree before admission is silently dropped. The one exception is `escapeStyle` on a `text` node, described next.

A node that carries a fidelity field overrides the matching row — `headingStyle`, `markerChar`, `fenceChar`, `delimiter` — which is how a parsed document re-serializes in its author's spelling. The table describes a synthesized node, which is what a test asserting on generated markdown actually holds.

### Literal text

Text escaping is canonical by default: `~0.2.1` in a table cell emits as `\~0.2.1`. A `Text` node carrying `escapeStyle: "literal"` opts out — the caller vouches that the value is already safe markdown, and the emitter writes it verbatim with none of the escaping aimed at inline syntax. That suits generated content such as a dependency table, where `~0.2.1`, `^1.0.0` and `@scope/pkg` should read as written:

```ts
import { Markdown, Mdast } from "@effected/markdown";
import { Result } from "effect";

const cell = (value: string) => ({ type: "tableCell", children: [{ type: "text", value, escapeStyle: "literal" }] });
const tree = Mdast.fromMdastResult({
  type: "root",
  children: [{ type: "table", children: [{ type: "tableRow", children: [cell("Range"), cell("~0.2.1 | ^1.0.0")] }] }],
});
if (Result.isSuccess(tree)) {
  console.log(Result.getOrThrow(Markdown.stringifyResult(tree.success)));
  // | Range | ~0.2.1 \| ^1.0.0 |
  // | --- | --- |
}
```

Escapes that protect the surrounding **block** still apply, because dropping them would corrupt the document rather than add formatting:

- in a table cell, every `|` not already backslash-escaped becomes `\|`;
- in any container, a value-final `\` is doubled when more content follows it, so it cannot escape that content's first character;
- in a table cell or heading, a newline becomes a space;
- in a heading, a trailing `#` run that would read as the closing sequence is escaped;
- elsewhere, a newline that would form a blank line becomes `&#10;`, leading whitespace at a line start becomes a character reference, and a line start that can open a block is escaped — a `-`, `+` or `*` bullet or an ordered-list marker followed by a space, tab or line end, one to six `#` followed by the same, `>`, a run of three backticks or tildes, a thematic-break or setext run, a `---` or `+++` frontmatter fence, a line of only `-`, `:`, `|` and whitespace, and conservatively any `<`, `[`, `|` or `:` — while text that cannot, such as `~0.2.1`, `1.0.0`, `-x` or `#x`, is written as is;
- in a tree carrying MDX nodes, `{` and `<` stay escaped.

**A literal value that parses as markdown does not round-trip**: `*a*` emits verbatim and re-parses as emphasis. Keeping the value free of inline syntax is the caller's promise; the emitter does not check it. The parser never sets `escapeStyle`, and `Mdast.fromMdast` admits it on a `text` node — the one fidelity field that crosses that boundary, because it is an instruction to the emitter rather than a record of source spelling — so a plain mdast tree can carry it straight in. The opt-out is additive: a tree that never sets it serializes byte-identically to the canonical form above.

To *normalize* an existing document to different choices, use `MarkdownFormat` with `MarkdownFormattingOptions`. That is the configurable surface; this one deliberately is not.

## Features

- `Markdown` — `parse`/`stringify` as `Effect`s with typed `MarkdownParseError`/`MarkdownStringifyError` channels, the pure `parseResult`/`stringifyResult` twins for synchronous callers, and the `MarkdownFromString` two-way codec.
- `Markdown.parsePhrasing`/`parsePhrasingResult` — parse a prose fragment as a single paragraph's inline content, without a full document parse and a paragraph splice: blank lines stay inline, references never form (no reference context), and positions are correct relative to the input string.
- `MarkdownDocument` — source, tree, diagnostics and the link-definition index, plus the derived `headings`, `sections` and `links` accessors, the `firstSection`/`sectionByHeading` finders over a `DocumentSection` (heading, depth, range, body), the `find`/`findAll` tree queries over type-narrowed selectors, and the `frontmatter` capture with `hasFrontmatterBlock` to tell an absent block from an uncaptured one.
- The mdast-shaped node classes — the CommonMark types plus GFM's `delete`, `table`, `tableRow`, `tableCell`, `footnoteDefinition`, `footnoteReference` and task-list `checked`, each carrying unist positions with byte offsets and this package's fidelity fields. `position` defaults to the zero-width synthetic sentinel, so a replacement fragment constructs in one line — `Text.make({ value: "shipped" })`.
- The MDX node vocabulary — `MdxJsxFlowElement`/`MdxJsxTextElement` with their attribute carriers, `MdxFlowExpression`/`MdxTextExpression` and `MdxjsEsm`, shaped to the `mdast-util-mdx` contracts for construction and serialization (the parser reads no MDX syntax).
- `FrontmatterSource` — string-level frontmatter `split`/`join` over the same closed fence grammar, byte-exact boundaries, no parsing of value or body; for bodies the CommonMark engine should not touch.
- `MarkdownEdit` / `MarkdownRange` (with `applyAll`) — the non-mutating text-edit vocabulary, field-identical to `@effected/jsonc`'s, `@effected/yaml`'s and `@effected/toml`'s.
- `MarkdownFormat` — `format`/`formatToString` compute conservative marker-normalization edits; `modify`/`modifyToString` replace a node by identity through the canonical stringifier.
- `MarkdownVisitor` — walk a parsed tree as a lazy `Stream` of `Enter`/`Exit` events with child-index paths and depth.
- `Mdast` — `toMdast` projects to plain mdast JSON; `fromMdast`/`fromMdastResult` admit a foreign mdast tree with validation.
- `MarkdownFrontmatter.schema` plus the `YamlFrontmatter`, `TomlFrontmatter` and `JsonFrontmatter` codecs — typed frontmatter decoding over optional per-format peers, with four separately catchable failure modes and a `FrontmatterMissingReason` on the absent one.
- `SchemaResolver` — classify a frontmatter `$schema` declaration into `ByUrl`/`ByPath`/`Inline`/`ByName` and resolve names against a registry, with no IO and no dependencies.
- `MarkdownDiagnostic` — the structured diagnostic (`code`, `message`, `offset`, `length`, `line`, `character`) every typed error carries, shaped identically to the sibling packages'.

## Conformance

All 652 CommonMark 0.31.2 spec examples run with an empty skip map, and the whole corpus runs again under both dialects with an explicitly asserted divergence list. The GFM extension corpora from cmark-gfm — the spec extension sections and `extensions.txt`, the only official footnote corpus — run complete, as does the 27-fixture `mdast-util-from-markdown` corpus, which asserts AST **and** position equality through the `Mdast` projection rather than just matching rendered output.

Two independent checks back that up. A differential property suite cross-checks the parser against the `commonmark` npm package across the corpus plus tens of thousands of generated documents, and cmark's pathological suite pins the linear-time guarantee with calibrated budgets — markdown's DoS vector is quadratic emphasis and link blowup, and the delimiter-stack algorithm is what defeats it. Recursive surfaces carry a 256-deep nesting cap, so a nesting bomb fails through the typed error channel instead of overflowing the stack. Every oracle and corpus is devDependency-only; none reaches your runtime.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/markdown` 0.15.1
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/markdown/internal/blockParser.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blockParser.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blockParser.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blockRegistry.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blockRegistry.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blockRegistry.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blockTypes.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blockTypes.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blockTypes.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/atxHeading.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/atxHeading.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/atxHeading.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/blockquote.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/blockquote.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/blockquote.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/code.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/code.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/code.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/document.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/document.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/document.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/fencedCode.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/fencedCode.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/fencedCode.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/footnoteDefinition.ts:1 // Ported from cmark-gfm 0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
- scratchpad/effected/markdown/internal/blocks/footnoteDefinition.ts:2 // Copyright (c) 2014 GitHub Inc.
- scratchpad/effected/markdown/internal/blocks/footnoteDefinition.ts:3 // License: BSD-style (see the cmark-gfm COPYING file)
- scratchpad/effected/markdown/internal/blocks/htmlBlock.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/htmlBlock.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/htmlBlock.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/indentedCode.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/indentedCode.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/indentedCode.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/linkReferenceDefinition.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/linkReferenceDefinition.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/linkReferenceDefinition.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/list.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/list.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/list.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/paragraph.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/paragraph.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/paragraph.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/setextHeading.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/setextHeading.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/setextHeading.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/table.ts:1 // Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
- scratchpad/effected/markdown/internal/blocks/table.ts:2 // Copyright (c) 2014, John MacFarlane; Copyright (c) 2015, GitHub, Inc.
- scratchpad/effected/markdown/internal/blocks/table.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/blocks/taskListItem.ts:1 // Ported from cmark-gfm 0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
- scratchpad/effected/markdown/internal/blocks/taskListItem.ts:2 // Copyright (c) 2014 GitHub, Inc.
- scratchpad/effected/markdown/internal/blocks/taskListItem.ts:3 // License: BSD-2-Clause (see `.repos/cmark-gfm/COPYING`)
- scratchpad/effected/markdown/internal/blocks/thematicBreak.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/blocks/thematicBreak.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/blocks/thematicBreak.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/entities.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/entities.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/entities.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/htmlTags.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/htmlTags.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/htmlTags.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlineNode.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlineNode.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlineNode.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlineParser.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlineParser.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlineParser.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlineRegistry.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlineRegistry.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlineRegistry.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlineTypes.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlineTypes.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlineTypes.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/autolink.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/autolink.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/autolink.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:1 // Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
- scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:2 // Copyright (c) 2014, John MacFarlane; Copyright (c) 2015, GitHub, Inc.
- scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:34 // email only, but the vendored C at this pin also linkifies `ftp://`
- scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:36 // (`postprocess_text`). `extensions.txt` — the other vendored corpus —
- scratchpad/effected/markdown/internal/inlines/codeSpan.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/codeSpan.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/codeSpan.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/codeSpan.ts:33 // is quadratic on a document of many distinct-length runs (the vendored
- scratchpad/effected/markdown/internal/inlines/emphasis.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/emphasis.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/emphasis.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/entity.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/entity.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/entity.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/escape.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/escape.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/escape.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:1 // Ported from cmark-gfm 0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
- scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:2 // Copyright (c) 2014 GitHub Inc.
- scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:3 // License: BSD-style (see the cmark-gfm COPYING file)
- scratchpad/effected/markdown/internal/inlines/lineBreak.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/lineBreak.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/lineBreak.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/link.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/link.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/link.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/rawHtml.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/rawHtml.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/rawHtml.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/rawHtml.ts:34 // 300k unclosed `<!--` is one of the vendored pathological cases. Asking
- scratchpad/effected/markdown/internal/inlines/strikethrough.ts:1 // Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
- scratchpad/effected/markdown/internal/inlines/strikethrough.ts:2 // Copyright (c) 2014, John MacFarlane; Copyright (c) 2015, GitHub, Inc.
- scratchpad/effected/markdown/internal/inlines/strikethrough.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/inlines/text.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/inlines/text.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/inlines/text.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/preprocess.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/preprocess.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/preprocess.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/references.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/references.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/references.ts:3 // License: BSD-2-Clause
- scratchpad/effected/markdown/internal/unescape.ts:1 // Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
- scratchpad/effected/markdown/internal/unescape.ts:2 // Copyright (c) 2014-2023 John MacFarlane
- scratchpad/effected/markdown/internal/unescape.ts:3 // License: BSD-2-Clause

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
