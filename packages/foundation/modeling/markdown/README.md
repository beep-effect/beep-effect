# @beep/markdown

CommonMark 0.31.2 and GFM parsing, editing and formatting as Effect schemas and pure functions. Parse markdown into mdast-shaped nodes that carry byte offsets, query headings, sections and links, compute offset-splice edits that leave untouched bytes alone, normalize markers, decode frontmatter into a validated schema, project to and from plain mdast for the remark ecosystem, and walk a document as a `Stream`.

## Why this package

Markdown is where documentation, changelogs, knowledge bases and agent context files live, and people edit those files by hand. They expect a tool that touches one heading to leave the rest of the file alone. The remark ecosystem is the JavaScript default, but its serializer reformats by design: read a document, write it back, and you get remark's idea of markdown rather than the author's. Nobody ships a lossless markdown CST, and the remark maintainers recommend positional splicing instead.

This package is built on that advice. Every node carries byte offsets next to its unist line and column positions, so an edit is a splice against the original source, not a re-serialization of the tree. Change a heading and the blank lines, HTML comments and hand-tuned spacing everywhere else come through byte-identical. `MarkdownEdit` has the same fields as `JsoncEdit`, `YamlEdit` and `TomlEdit`, so one editing vocabulary covers every format package.

The engine is a vendored, hardened port of commonmark.js, the reference parser maintained by the spec author, restructured as one module per construct behind dialect-keyed registries. There is no runtime parser dependency and no plugin surface: `commonmark` and `gfm` are the two dialects, `gfm` is the default, and the upstream conformance corpora pin both. CommonMark has no syntax errors, so the typed parse error carries hardening-guard trips (nesting depth, input size), never "malformed markdown".

Nodes use mdast's type names and field shapes, so the tree is already what the remark ecosystem reads, and `Mdast.toMdast` strips this package's fidelity fields to give you plain mdast JSON. Frontmatter, which mdast cannot parse, is captured behind a parse option and decoded through per-format codecs that live on their own subpaths, so a bundle that needs the JSON codec never pulls in the yaml engine.

Rendering markdown to HTML is out of scope. Reach your existing renderer through the mdast projection, or bridge into the repo's semantic Markdown model: `@beep/md/Md.parse` and `@beep/md/Md.syntax` fold a parsed `MarkdownDocument` into an `Md.Document`, report every construct they cannot carry as a typed loss, and keep a source map back to this package's positions. `@beep/md` then renders Markdown or safe HTML.

The package is ESM-only. Its runtime dependencies are `effect` v4 and the workspace packages `@beep/identity`, `@beep/schema` and `@beep/utils`; the frontmatter codecs add `@beep/yaml`, `@beep/toml` and `@beep/jsonc`, and only the codec you import reaches your bundle. Import from the leaf modules (`@beep/markdown/MarkdownDocument`, `@beep/markdown/Markdown`, and so on). The root barrel re-exports the core leaves only.

## Usage

### Parse a document

`MarkdownDocument.parse` returns the source, the tree, the definition index and the query accessors in one value:

```ts
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import * as Effect from "effect/Effect";

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

The dialect defaults to `gfm`, so the strikethrough parses as a `delete` node with no configuration. Pass `{ dialect: "commonmark" }` as the second argument for strict CommonMark.

Every parse has a synchronous twin. `MarkdownDocument.parseResult` and `Markdown.parseResult` return a `Result`, so a build script, a Vite plugin or a language-server tick can call in without an Effect runtime. `Markdown.parse` and `Markdown.stringify` work on the bare `Root` when you do not need the document wrapper, and `Markdown.MarkdownFromString` is the same pair as a two-way `Schema` codec.

### Query headings, sections and links

The accessors on `MarkdownDocument` are derived from the tree, so they cannot disagree with it. `headings` lists every heading, including those inside blockquotes and list items. `DocumentHeading.text` is a plain-text projection; `headingSource` returns the heading content exactly as written, inline HTML and code-span backticks included:

```ts
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import * as Effect from "effect/Effect";

const doc = Effect.runSync(MarkdownDocument.parse("# Use `Effect.gen` <b>now</b> #\n"));
const [heading] = doc.headings;

console.log(heading?.text); // Use Effect.gen now
console.log(heading === undefined ? "" : doc.headingSource(heading.node)); // Use `Effect.gen` <b>now</b>
```

`sections` are delimited by root-level headings only, and each section's range spans its subsections, so one edit can splice a whole section out. `firstSection` and `sectionByHeading` find a single `DocumentSection`. `sectionByHeading` matches an exact trimmed heading string, a `RegExp` or a predicate, and both accept `{ depth }` to restrict the match to one heading level:

```ts
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import * as Effect from "effect/Effect";

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

`DocumentSection.body` is the section without its heading. It is not trimmed: it is exactly the bytes `bodyRange` describes.

`links` collects every URL-bearing node and passes `url` through as written, so bundle-relative hrefs are never normalized:

```ts
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import * as Effect from "effect/Effect";

const source = `See the [changelog](./CHANGELOG.md) and the [docs](https://example.com/docs).
`;

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source);
  return doc.links.map((link) => link.url);
});

Effect.runPromise(program).then(console.log);
// [ "./CHANGELOG.md", "https://example.com/docs" ]
```

For anything else, `find` and `findAll` walk the tree in document pre-order. A string selector matches the node's `type` and narrows the result: `doc.findAll("heading")` is `ReadonlyArray<Heading>` and `doc.find("table")` is `Table | undefined`. A type-guard predicate narrows the same way. The nodes come back by identity, so `doc.findAll("heading")[1]` can be handed straight to `MarkdownFormat.modify`.

### Walk a tree as a stream

`MarkdownVisitor.visit` streams the same pre-order walk as `Enter` and `Exit` events carrying the node, its child-index path and its depth. The event type is a schema tagged union; a tree nested past the depth guard ends the stream with an `Error` event:

```ts
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownVisitor } from "@beep/markdown/MarkdownVisitor";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

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

### Edit without reformatting

`MarkdownFormat.modify` computes a `MarkdownEdit` array against a parsed document, and `modifyToString` applies it in one step. The target is a node from the document's own tree, matched by identity, and everything the edit does not cover survives byte for byte:

```ts
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFormat } from "@beep/markdown/MarkdownFormat";
import * as Effect from "effect/Effect";

const source = `# Release notes

See the [changelog](./CHANGELOG.md).
`;

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source);
  const label = doc.find("text");
  if (label === undefined) {
    return doc.source;
  }
  return yield* MarkdownFormat.modifyToString(doc, label, "Release notes (2026)");
});

Effect.runPromise(program).then(console.log);
// # Release notes (2026)
//
// See the [changelog](./CHANGELOG.md).
```

A replacement is a literal string or a node fragment, and both render through the canonical stringifier. A modified document therefore re-parses cleanly: you cannot splice in raw markdown that reopens a fence or breaks a table. A target the edit cannot represent safely fails with a typed `MarkdownModificationError`.

The edits are plain data. `MarkdownEdit.applyAll(text, edits)` applies an array, and an editor can take the same array as a text-edit payload.

### Normalize markers

`MarkdownFormat.format` normalizes markers and never rewrites content. It converts heading style, bullet character, emphasis marker, fence character, thematic-break character and code-block style, and it skips any conversion that would not re-parse the same:

```ts
import { MarkdownFormat } from "@beep/markdown/MarkdownFormat";

const source = `Setext heading
==============

* one
* two
`;

const options = { headingStyle: "atx", bulletChar: "-" } as const;

console.log(MarkdownFormat.formatToString(source, undefined, options));
// # Setext heading
//
// - one
// - two

console.log(JSON.stringify(MarkdownFormat.format(source, undefined, options)));
// [{"offset":0,"length":29,"content":"# Setext heading"},{"offset":31,"length":1,"content":"-"},{"offset":37,"length":1,"content":"-"}]
```

`format` is pure and total: a document that fails to parse yields no edits.

Know the `codeBlockStyle` default before you rely on it. Without the option, a language-less code block keeps its current spelling, and a language-less `Code` node with no `fenceChar` serializes as an indented block. `"fenced"` rewrites indented blocks as fences, and `"indented"` goes the other way where the result provably re-parses the same. Both apply to root-level, flush-left blocks only. A block with a language has no indented spelling and is never touched.

### Typed frontmatter

Frontmatter capture is opt-in, because it changes how a document that opens with `---` parses: CommonMark reads `---\ntitle: x\n---` as a thematic break and a setext heading, and that reading holds unless you ask for capture. Turn it on and pair your schema with a codec:

```ts
import { MarkdownFrontmatter } from "@beep/markdown/Frontmatter";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const source = `---
title: Release notes
draft: false
---

# Release notes
`;

const Post = S.Struct({ title: S.String, draft: S.Boolean });
const decodePost = MarkdownFrontmatter.schema(Post, YamlFrontmatter);

const program = Effect.gen(function* () {
  const doc = yield* MarkdownDocument.parse(source, { frontmatter: true });
  return yield* decodePost(doc);
});

Effect.runPromise(program).then(console.log);
// { title: "Release notes", draft: false }
```

Each stage fails with its own tagged error. No capture is a `FrontmatterMissingError`; catch the tag for optional semantics. A codec handed the wrong fence fails with `FrontmatterFormatMismatchError`. Content the format engine cannot parse fails with `FrontmatterDecodeError`, which keeps the engine's positioned failure as its `cause`. Data the schema rejects fails with `FrontmatterValidationError`, which carries the structured issue tree.

Because capture is opt-in, "no frontmatter" can mean two things, and `FrontmatterMissingError.reason` separates them: `"absent"` when the source has no block, and `"captureDisabled"` when it opens with one but was parsed with capture off, which a parse option fixes. `MarkdownDocument.hasFrontmatterBlock` answers the same question by re-running the parser's own pre-scan, so the accessor and the error always agree. `MarkdownFrontmatter.set` and `setToString` write the block back: they re-serialize the whole block from data (gray-matter parity), so comments inside a yaml block do not survive a write.

The codecs are `YamlFrontmatter` (`---`), `TomlFrontmatter` (`+++`) and `JsonFrontmatter` (`---json`), one subpath module each and never grouped into a namespace object, because importing a codec is what pulls in its format engine. `Frontmatter`, `FrontmatterResolver` and the three codec modules are subpath-only; the root barrel does not export them. A codec is a `FrontmatterCodec` built with `FrontmatterCodec.make(format, parse, stringify)` from an engine's synchronous `Result` functions, and it exposes `decodeResult` and `encodeResult` next to the `Effect` forms `decode` and `encode`, which are defined through them:

```ts
import { FrontmatterCodec } from "@beep/markdown/Frontmatter";
import { Frontmatter } from "@beep/markdown/MarkdownNode";
import * as Result from "effect/Result";

const codec = FrontmatterCodec.make(
  "json",
  (text) => Result.try({ try: (): unknown => JSON.parse(text), catch: (cause) => cause }),
  (data) => Result.succeed(JSON.stringify(data))
);

const decoded = codec.decodeResult(Frontmatter.make({ format: "json", value: '{"a":1}' }));
console.log(Result.isSuccess(decoded)); // true
```

A frontmatter block can also declare its own schema. `SchemaResolver.classify` (from `@beep/markdown/FrontmatterResolver`) sorts a `$schema` value into the tagged union `ByUrl`, `ByPath`, `Inline` or `ByName`, and `SchemaResolver.fromRegistry` resolves `ByName` declarations such as `skill@2.1.0` against schemas you register. URLs, paths and inline documents are carried as data and never fetched; the package performs no IO.

### Split frontmatter without parsing the body

When the body should not go through the CommonMark engine at all (an MDX page, a template, a hash over byte-exact boundaries), `FrontmatterSource.split` runs the same closed fence grammar over the raw string and nothing else:

```ts
import { FrontmatterSource } from "@beep/markdown/FrontmatterSource";

const split = FrontmatterSource.split("---\ntitle: x\n---\nBody\n");

console.log(split.frontmatter?.format); // yaml
console.log(JSON.stringify(split.body)); // "Body\n"
console.log(FrontmatterSource.join(split) === "---\ntitle: x\n---\nBody\n"); // true
```

`split` is total. It returns the block's format, the exact bytes between the fence lines and the body, with `body` always equal to `source.slice(bodyOffset)`; a missing block is a representable result, not an error. A fence line is the fence itself, optionally followed by spaces and tabs, on the opening and the closing line alike; an indented line is never a fence. `join` reproduces the original bytes for an unmodified round trip, with three normalizations: a closing fence that ends the document without a line terminator gains one, fence lines with mismatched terminators are both re-emitted with the opening fence's, and trailing spaces or tabs on a fence line are dropped, because `join`, like `MarkdownFrontmatter.set`, always writes the canonical fence. The value and body bytes are never parsed at this level.

### mdast interop

The nodes already use mdast's type names and field shapes. `Mdast.toMdast` strips the fidelity fields this package adds (bullet characters, fence style, ATX versus setext spelling; a `Text` node keeps `escapeStyle` when set) and emits plain mdast JSON that the remark ecosystem, `mdast-util-to-hast` included, consumes directly:

```ts
import { Markdown } from "@beep/markdown/Markdown";
import { Mdast } from "@beep/markdown/Mdast";
import * as Result from "effect/Result";

const parsed = Markdown.parseResult("A *b* c\n");
if (Result.isSuccess(parsed)) {
  console.log(JSON.stringify(Mdast.toMdast(parsed.success)).slice(0, 62));
  // {"type":"root","children":[{"type":"paragraph","children":[{"t
}
```

`Mdast.fromMdast` and `fromMdastResult` go the other way as a checked admission boundary: they validate a foreign tree and fill in zero-width sentinel positions where a position is missing or incomplete. Trees admitted that way serve tree-level work and canonical `stringify`; offset-splice editing needs the real positions only a parse produces.

### MDX trees

The MDX node vocabulary lives on its own subpath, `@beep/markdown/MarkdownMdx`: `MdxJsxFlowElement` and `MdxJsxTextElement` (with `MdxJsxAttribute`, `MdxJsxExpressionAttribute` and `MdxJsxAttributeValueExpression` as attribute carriers), `MdxFlowExpression`, `MdxTextExpression` and `MdxjsEsm`, shaped to the `mdast-util-mdx` contracts. The parser does not read MDX syntax. These nodes exist so a synthesized tree can carry JSX and serialize to valid MDX instead of joining strings:

```ts
import { Markdown } from "@beep/markdown/Markdown";
import { MdxJsxAttribute, MdxJsxAttributeValueExpression, MdxJsxFlowElement } from "@beep/markdown/MarkdownMdx";
import { Root } from "@beep/markdown/MarkdownNode";
import * as Result from "effect/Result";

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

Serialization matches `mdxJsxToMarkdown`'s defaults: `"` quotes, spaced self-closing `<a />`, `<></>` fragments, flow children indented two spaces per JSX ancestor, `{expr}` expressions and ESM values verbatim. A tree that contains any MDX node escapes `{` in text the way MDX requires; a tree with none serializes byte-identically to the table below. Shapes with no MDX spelling cannot be constructed: a fragment cannot carry attributes and an attribute needs a non-empty name, and both are refused at `make` and at decode.

The subpath changes only where the names are exported. The MDX schemas are still members of the core `FlowContent` and `PhrasingContent` unions, so they stay in the closure of `@beep/markdown/MarkdownNode`.

### The canonical form is stable

`Markdown.stringify` takes no options. It emits one canonical form, byte-level tests pin that form, and the engine behind it is cross-checked against commonmark.js over the full CommonMark 0.31.2 corpus. Changing any of it is a breaking change to this package, not a patch. A test may assert on these bytes, and a pipeline that needs stable rendered markdown can serialize through here instead of a third-party stringifier whose defaults may move between releases.

For a node that carries no fidelity field:

| Construct | Canonical form |
| --- | --- |
| Heading | ATX (`## x`), at every depth |
| Thematic break | `***` |
| Bullet list marker | `-` |
| Ordered list delimiter | `.`, flipping to `)` to separate an immediately adjacent sibling list |
| Emphasis / strong | `*` / `**` |
| Code block | fenced when the node carries a `lang` or a `fenceChar`, with the fence grown past any interior backtick run; otherwise indented, except where indenting would not re-parse as a code block, which forces a fence |
| Block separation | exactly one blank line |
| Document | a single trailing newline |

The MDX serialization choices above are pinned the same way, and only trees that carry an MDX node pay for the extra `{` escape.

The canonical form never emits text that would re-parse as something else, so a table row gives way when the two conflict. The case a consumer meets is the indented code block: an indented block directly after a list is absorbed as list content, so a `Code` node with neither `lang` nor `fenceChar` is emitted fenced in that position and indented everywhere else. A byte-level assertion over synthesized code blocks therefore depends on the preceding sibling. If you build trees and assert on their bytes, set `fenceChar` on every `Code` node that has neither a `lang` nor a `fenceChar`, in a walk that reaches nested nodes; then no output depends on a node's neighbours.

Set fidelity fields on the decoded tree. `Mdast.fromMdast` admits spec mdast and strips everything outside it, so a `fenceChar` placed on a plain mdast tree before admission is dropped. The one exception is `escapeStyle` on a `text` node, described next. A node that carries a fidelity field (`headingStyle`, `markerChar`, `fenceChar`, `delimiter`) overrides the matching row, which is how a parsed document re-serializes in its author's spelling.

#### Literal text

Text escaping is canonical by default: `~0.2.1` in a table cell is emitted as `\~0.2.1`. A `Text` node with `escapeStyle: "literal"` opts out. The caller vouches that the value is already safe markdown, and the emitter writes it without the escaping aimed at inline syntax. That suits generated content such as a dependency table, where `~0.2.1`, `^1.0.0` and `@scope/pkg` should read as written:

```ts
import { Markdown } from "@beep/markdown/Markdown";
import { Mdast } from "@beep/markdown/Mdast";
import * as Result from "effect/Result";

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

Escapes that protect the surrounding block still apply, because dropping them would corrupt the document rather than add formatting:

- in a table cell, every `|` not already backslash-escaped becomes `\|`;
- in any container, a value-final `\` is doubled when more content follows it, so it cannot escape that content's first character;
- in a table cell or heading, a newline becomes a space;
- in a heading, a trailing `#` run that would read as the closing sequence is escaped;
- elsewhere, a newline that would form a blank line becomes `&#10;`, leading whitespace at a line start becomes a character reference, and a line start that can open a block is escaped. That covers a `-`, `+` or `*` bullet or an ordered-list marker followed by a space, tab or line end; one to six `#` followed by the same; `>`; a run of three backticks or tildes; a thematic-break or setext run; a `---` or `+++` frontmatter fence; a line of only `-`, `:`, `|` and whitespace; and, conservatively, any `<`, `[`, `|` or `:`. Text that cannot open a block, such as `~0.2.1`, `1.0.0`, `-x` or `#x`, is written as is;
- in a tree that carries MDX nodes, `{` and `<` stay escaped.

A literal value that parses as markdown does not round-trip: `*a*` is emitted verbatim and re-parses as emphasis. Keeping the value free of inline syntax is the caller's job; the emitter does not check it. The parser never sets `escapeStyle`, and `Mdast.fromMdast` admits it on a `text` node, the one fidelity field that crosses that boundary, because it instructs the emitter rather than recording source spelling. A tree that never sets it serializes byte-identically to the canonical form.

To normalize an existing document to different choices, use `MarkdownFormat` with `MarkdownFormattingOptions`. That surface is configurable; this one is not.

### Conformance corpora

The vendored conformance data ships with the package under `data/conformance/` and is importable as JSON through the `@beep/markdown/conformance/*` subpath: `conformance/commonmark/spec` (the 652 CommonMark 0.31.2 examples), `conformance/gfm/spec-extensions` and `conformance/gfm/extensions` (the cmark-gfm corpora), and `conformance/mdast/<name>` (the `mdast-util-from-markdown` trees). Each corpus directory has a `VENDORED.md` with its upstream, pinned ref, licence and regeneration command. Nothing under `src/` reads these files.

## Features

- `Markdown`: `parse` and `stringify` as `Effect`s with typed `MarkdownParseError` and `MarkdownStringifyError` channels, the synchronous `parseResult` and `stringifyResult`, `parsePhrasing` and `parsePhrasingResult` for a prose fragment parsed as one paragraph's inline content (no reference context, positions relative to the input), and the `MarkdownFromString` / `fromString(options)` two-way codecs. `MarkdownParseOptions` selects the dialect (`commonmark` or `gfm`, default `gfm`) and the frontmatter toggle.
- `MarkdownDocument`: source, tree, diagnostics and the link-definition index, plus the derived `headings`, `sections` and `links`, `headingSource` for a heading's content as written, the `firstSection` and `sectionByHeading` finders, type-narrowed `find` and `findAll`, and the `frontmatter` capture with `hasFrontmatterBlock`.
- `MarkdownNode`: `Point`, `Position` and the mdast-shaped core nodes (the CommonMark types plus GFM's `delete`, `table`, `tableRow`, `tableCell`, `footnoteDefinition`, `footnoteReference` and task-list `checked`), the content unions, the fidelity literal domains and `MarkdownNodeKind`, a `LiteralKit` over every node tag. Nodes are branded `S.Opaque` schemas built with `X.make`; `position` defaults to a zero-width synthetic sentinel, so `Text.make({ value: "shipped" })` is a complete replacement fragment.
- `MarkdownMdx` (subpath only): the MDX node vocabulary and `MdxJsxAttributeContent`, for constructing and serializing MDX trees.
- `MarkdownEdit` and `MarkdownRange` (with `applyAll`): the non-mutating text-edit vocabulary shared with `@beep/jsonc`, `@beep/yaml` and `@beep/toml`.
- `MarkdownFormat`: `format` and `formatToString` compute conservative marker-normalization edits from `MarkdownFormattingOptions`; `modify` and `modifyToString` replace a node by identity through the canonical stringifier and fail with `MarkdownModificationError`.
- `MarkdownFence`: `fences` lists a document's fenced code blocks as `CodeFence` values (raw info string, raw body, opening line, an `unterminated` verdict and half-open offsets for the fence, info string and body), including fences in blockquotes and list items.
- `MarkdownVisitor`: a lazy `Stream` of `MarkdownVisitorEvent` values (`Enter`, `Exit`, `Error`) with child-index paths and depth.
- `Mdast`: `toMdast` projects to plain mdast JSON; `fromMdast` and `fromMdastResult` admit a foreign mdast tree with validation, failing with `MdastDecodeError`.
- `FrontmatterSource`: string-level `split` and `join` over the closed fence grammar, with byte-exact boundaries and no parsing of value or body.
- `Frontmatter` (subpath only): `MarkdownFrontmatter.schema`, `set` and `setToString`, the `FrontmatterCodec` class, and the error family (`FrontmatterMissingError` with its `FrontmatterMissingReason`, `FrontmatterFormatMismatchError`, `FrontmatterDecodeError`, `FrontmatterEncodeError`, `FrontmatterValidationError`).
- `YamlFrontmatter`, `TomlFrontmatter`, `JsonFrontmatter` (subpath only): one codec per module over `@beep/yaml`, `@beep/toml` and `@beep/jsonc`.
- `FrontmatterResolver` (subpath only): `SchemaResolver.classify`, `declarationOf` and `fromRegistry` for `$schema` declarations, with no IO.
- `MarkdownDiagnostic`: the structured diagnostic (`code`, `message`, `offset`, `length`, `line`, `character`) every typed error carries, shaped like the sibling packages' diagnostics.
- Positions: every node carries unist line and column positions plus byte offsets, which is what makes offset-splice edits possible.
- Hardening: recursive surfaces share a 256-deep nesting cap, so a nesting bomb fails through the typed error channel instead of overflowing the stack.

### Conformance

All 652 CommonMark 0.31.2 spec examples pass with an empty skip map, and the whole corpus runs again under both dialects against an asserted divergence list. The GFM extension corpora from cmark-gfm (the spec's extension sections and `extensions.txt`, the only official footnote corpus) pass in full, as does the 27-fixture `mdast-util-from-markdown` corpus, which asserts AST and position equality through the `Mdast` projection rather than comparing rendered HTML.

Two further checks back that up. A differential property suite cross-checks the parser against the `commonmark` npm package over the corpus and tens of thousands of generated documents, and the cmark-gfm pathological suite pins linear time with calibrated budgets: markdown's denial-of-service vector is quadratic emphasis and link blowup, and the delimiter-stack algorithm is what defeats it. Every oracle is a devDependency; none reaches your runtime.

## Development

```bash
# from the repository root
bun run beep quality package-verify @beep/markdown

# from packages/foundation/modeling/markdown
bun run check
bun run lint
bun run test
bun run docgen
```

Tests live in `test/` and import package source through `@beep/markdown/<Module>` aliases. The end-to-end conformance suites are in `test/e2e/`, the shared harness (corpus loader, test-only HTML writer, the commonmark.js oracle, the pathological cases) is in `test/support/`, and the corpora they read are the shipped `data/conformance/` files. `scripts/generate-entities.ts` regenerates `src/internal/entityMap.ts` (`bun run generate:entities`), and `scripts/extract-gfm-corpora.py` regenerates the GFM corpora. `KNOWLEDGE.md` carries the upstream design notes verbatim.

## Provenance

Ported from upstream `@effected/markdown` (MIT, C. Spencer Beggs) through the effected port, which landed it as the scratchpad module `scratchpad/effected/markdown`, then promoted into this workspace package by `goals/effected-promotion` (wave 2d-1). The promotion moved the sources to `src/`, the tests to `test/` and the conformance corpora to `data/conformance/`, renamed the schema identities from `@beep/scratchpad/effected/markdown/<Name>` to `@beep/markdown/<Name>`, and changed the node construction model and the export surface as listed under Deviations. A differential over 150,674 inputs shows no parse or stringify behaviour change from the promotion.

### Attribution

- Upstream package: `@effected/markdown` 0.15.1
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (`~/YeeBois/references/effect/effected`)
- License: [LICENSE](./LICENSE) (MIT; beep-effect and upstream notices)
- Vendored engine: 33 files under `src/internal/` are ported from commonmark.js 0.31.2 (Copyright (c) 2014-2023 John MacFarlane, BSD-2-Clause), and 6 (`blocks/footnoteDefinition`, `blocks/table`, `blocks/taskListItem`, `inlines/autolinkLiteral`, `inlines/footnoteReference`, `inlines/strikethrough`) from cmark-gfm 0.29.0.gfm.13 (Copyright (c) 2014 John MacFarlane and GitHub, Inc.; BSD-2-Clause, per the cmark-gfm `COPYING` file). Each file keeps its upstream notice in a three-line header.
- Vendored data: `data/conformance/commonmark` (commonmark-spec 0.31.2, CC-BY-SA 4.0), `data/conformance/gfm` (cmark-gfm 0.29.0.gfm.13, CC-BY-SA 4.0 spec text and the cmark-gfm licence), `data/conformance/mdast` (mdast-util-from-markdown 2.0.3, MIT) and the test-only `test/support/pathological/cases.ts` (cmark-gfm `pathological_tests.py`, BSD-2-Clause). Each directory's `VENDORED.md` records the upstream, pinned commit and licence.

### Added exports

- `MarkdownNodeKind`: a `LiteralKit` over all 34 node tags (25 core, 9 MDX).
- `MarkdownDocument.headingSource`: a heading's content as written in the source.
- `FrontmatterCodec.make`, `decodeResult` and `encodeResult`: upstream's `FrontmatterCodec` is an interface with `decode` and `encode` only.
- `@beep/markdown/MarkdownMdx`: the MDX leaf (the names were exported from `MarkdownNode` upstream).
- `@beep/markdown/conformance/*`: the vendored conformance corpora as JSON subpaths.
- `@beep/markdown/MarkdownFence` and `Code.unterminated`: fenced-code source spans and the unterminated-fence verdict (repo PR R6), the one fence extractor behind docgen and the repo-cli Markdown laws.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row. Test paths are relative to `test/`.

Promotion (wave 2d-1):

- **node-construction**: Nodes are branded `S.Opaque` schemas instead of classes. The parser builds plain trees through an internal `trustedNode` cast, and each public entry point admits the finished tree once with `Root.make`, so construction stays linear in nesting depth; a `make` per node would cost O(n·depth). Public construction with `X.make` and decoding are unchanged.
- **export-surface**: The MDX nodes moved to the `@beep/markdown/MarkdownMdx` leaf. They remain members of `FlowContent` and `PhrasingContent`, so only the export surface changed. The root barrel is core-only and codec-free: `Frontmatter`, `FrontmatterResolver` and the three codecs are subpath-only, and a closure test asserts that no root-barrel module reaches `@beep/yaml`, `@beep/toml` or `@beep/jsonc`.
- **tagged-errors**: The engine carriers `RawMarkdownError` and `GuardExceeded` are `S.TaggedError` schemas (upstream and the lab used `Data.TaggedError`), and `MarkdownVisitorEvent` is an `S.TaggedUnion` (upstream used `Data.TaggedEnum`).
- **conformance-data**: The conformance corpora live under `data/conformance/`, ship with the package and are exported as `./conformance/*`; the test harness loads them with `import.meta.glob` instead of `node:fs`.

Promotion (wave 2d-A):

- **frontmatter-fence-whitespace**: A frontmatter fence line may carry trailing spaces and tabs, on the opening and the closing line, for `---`, `+++` and `---json` alike; upstream and the lab required the line to be exactly the fence. This matches micromark-extension-frontmatter 2.0.0 (and so remark-frontmatter), gray-matter's trimmed language hint, and `@changesets/parse` 1.0.0, which closes on `--- `. The parser's capture, `hasFrontmatterBlock` and `FrontmatterSource.split` share the widened grammar; `FrontmatterSource.join` and `MarkdownFrontmatter.set` still write canonical fences. Indentation is still not a fence, as in micromark and gray-matter; only `@changesets/parse` accepts it (test/frontmatter.test.ts; frontmatter-source.test.ts; frontmatter-write.test.ts; internal/blocks/frontmatter.property.test.ts).

Port:

- **native-runtime** — Effect hash collections and explicit definitionOrder replace upstream native Map/Set indexes, while A.sort replaces native edit sorting and DateTime replaces the generator timestamp (test/block-pass.test.ts:510; document.test.ts:406; inline-dispatch.test.ts:23; hardening.test.ts:193; edit.test.ts:74).
- **identity-keys** — Operation-owned regex clones and a primitive-offset definition index replace upstream global identity-keyed WeakMaps and the BlockNode-keyed Map (test/pattern-clones.test.ts:5,26,71; document.test.ts:406).
- **tagged-errors** — Schema tagged errors replace upstream native Error/TypeError failure sites (the engine carriers followed at promotion; see above) (test/hardening.test.ts:193; edit.test.ts:59; frontmatter-resolver.test.ts:380; document.test.ts:382; diagnostic.test.ts:95,102).
- **schema-first** — LiteralKit domains, navigation/options/delimiter schemas, derived guards and JSON codecs replace upstream literal/interface duplication, manual guards and asserted JSON parsing (test/node.test.ts:87; delimiter-run.test.ts:62; table-align-types.test.ts:7; module suite test/**).
- **numeric-domains** — S.Finite rejects non-finite values that upstream numeric schemas admitted across diagnostics, edits, positions, code/list fields, frontmatter offsets and the delimiter model (test/delimiter-run.test.ts:62; module suite test/**).
- **type-safety** — Guarded narrowing, typed projection, commonmark declarations and the approved deliberatelyInvalid helper replace upstream source/test assertions (module suite test/**).
- **tsgo-diagnostics** — Diagnostic-required dual call forms and schema construction/recognition helpers replace upstream data-first-only helpers, including an options-object parseBlocks contract (test/block-pass.test.ts:585; delimiter-run.test.ts:43; source-offsets.test.ts:9; module suite test/**).
- **effect-first** — Option delimiter absence, Match dispatch, an Effect.fn resolver and Effect helpers replace upstream undefined results, switch dispatch and manual runtime forms (test/delimiter-run.test.ts:43,52; inline-dispatch.test.ts:12; module suite test/**).
- **effect-imports** — Per-module effect/* imports replace upstream root effect barrel imports in source, tests and examples (module suite test/**).
- **identity-annotations** — Per-file @beep/identity identities and meaningful schema/key descriptions augment upstream short names and missing metadata (test/node.test.ts:51,68,87; module suite test/**).
- **upstream-bug** — Composed whole-heading replacements make combined heading and emphasis formatting succeed where upstream emitted overlapping edits and threw (test/format.test.ts:70,85).
- **upstream-bug** — Parity-aware table replacement escaping preserves inline-code pipes where upstream reparsing split cells and lost content (test/format.test.ts:395,419).
- **upstream-bug** — Decimal-string version canonicalization distinguishes valid large integers that upstream numeric rounding aliased (test/frontmatter-resolver.test.ts:312,327,343,355).
- **upstream-bug** — CRLF-interior diagnostics retain the preceding line and nonnegative character positions where upstream consumed LF beyond the requested offset (test/diagnostic.test.ts:35).
- **upstream-bug** — Appending a separate engine terminator preserves foreign code content line endings that upstream mdast round trips stripped (test/mdast.test.ts:124,138).
- **upstream-bug** — Protecting decoded association labels preserves literal entities and backslashes that upstream decoded twice (test/mdast.test.ts:148,177).
- **upstream-bug** — Own-key admission returns typed mdast failures for prototype-property kinds that upstream let escape as TypeError (test/mdast.test.ts:190).
- **upstream-bug** — Image-alt flattening preserves raw HTML tags and comments that upstream discarded (test/image-alt.test.ts:10,11,12,19).
- **upstream-bug** — Image-alt flattening preserves hard-break newlines that upstream removed (test/image-alt.test.ts:8,9,19).
- **upstream-bug** — Email boundaries use complete decoded-piece source ends where upstream entity/escape prefixes truncated link and text spans (test/autolink-boundaries.test.ts:10,34,48,100).
- **upstream-bug** — Unicode code-point flanking fixes astral-adjacent emphasis and strikethrough classification that upstream performed on surrogate halves (test/emphasis-astral.test.ts:6,23,37,46; delimiter-run.test.ts:70,79).
- **upstream-bug** — Column-count reduction serializes schema-valid tall tables that upstream argument spreading rejected with Node RangeError (test/stringify-scalability.test.ts:10).
- **upstream-bug** — Binary-searched source offsets replace upstream quadratic repeated segment scans while preserving pinned positions and boundaries (test/source-offsets.test.ts:9,29,43).
- **upstream-bug** — One backing string per text run replaces upstream quadratic suffix rebuilding while preserving escaping and node identity (test/stringify-scalability.test.ts:20; stringify-literal.test.ts:44,56,72).
- **upstream-bug** — A forward email-boundary cursor replaces upstream quadratic piece rescans while preserving corrected source spans (test/autolink-boundaries.test.ts:48,71).
- **upstream-bug** — Memoized declaration-closer checks bypass upstream quadratic HTML regex retries while preserving accepted HTML and literal text (test/raw-html-pathological.test.ts:7,31,44,59).
- **upstream-bug** — Upstream: ATX-to-setext conversion after a nonblank paragraph removes the interrupting marker and absorbs the preceding block into the heading; lab: conversion is skipped unless the heading begins a physical line with a blank or absent predecessor; separate blocks survive LF, CR and CRLF boundaries (test/format.test.ts:272).
- **upstream-bug** — Upstream: Converting a setext heading ending in literal whitespace-plus-hashes emits an ATX closing sequence and loses those hashes on reparse; lab: hazardous setext-to-ATX conversions retain the original heading spelling; escaped hashes still permit safe conversion (test/format.test.ts:285).
- **upstream-bug** — Upstream: LF-only line boundaries allow a lone-CR paragraph followed by a thematic break to normalize into a setext heading; lab: boundary helpers recognize LF, bare CR and actual CRLF pairs; hazardous thematic-break rewrites are skipped (test/format.test.ts:296).
- **upstream-bug** — Upstream: Emphasis normalization tests surrogate halves and introduces underscores beside astral letters, turning emphasis into literal text; lab: the formatter tests complete adjacent Unicode code points and retains emphasis spelling at hazardous astral-letter flanks while keeping UTF-16 offsets (test/format.test.ts:305).
- **upstream-bug** — Upstream: Fence normalization treats trailing backticks in an unclosed final content line as a closing fence and rewrites code content; lab: only genuine closing lines are rewritten; unclosed foo-backtick content survives, and genuine closing fences normalize in CR and container contexts (test/format.test.ts:313; test/format.test.ts:321).
- **upstream-bug** — Upstream: Independent nested bullet edits can turn marker-only list lines into thematic breaks and erase the list structure; lab: all range-selected bullet edits are projected together; edits on a line that would introduce a thematic break are suppressed (test/format.test.ts:335).
- **upstream-bug** — Upstream: Bare-CR replacements bypass LF-only multiline protection and can escape blockquotes or alter headings and table rows; lab: cR and LF both trigger typed UnsupportedTarget inside protected multiline containers (test/format.test.ts:591).
- **upstream-bug** — Upstream: Replacing ATX heading text with after # emits a closing-hash sequence and loses the requested literal hash on reparse; lab: the replacement escapes a newly introduced terminal hash run in the surrounding heading source, preserving literal heading content (test/format.test.ts:610).
- **upstream-bug** — Upstream: A Link or LinkReference fragment inside another link succeeds but invalidates the surrounding link when reparsed; lab: direct and descendant link fragments inside either link context fail with typed UnsupportedTarget before rendering (test/format.test.ts:630).
- **upstream-bug** — Upstream: Flow replacements render in isolation and can merge with preceding paragraphs or become prose inside preceding lists or footnotes; lab: the replacement is parsed in its actual source context; blocks that lose their category or splice-relative start in the container slot fail with typed UnsupportedTarget (test/format.test.ts:648; test/format.test.ts:665).
- **upstream-bug** — Upstream: Cyclic foreign mdast children recurse until RangeError, escaping Result and becoming an Effect defect; lab: ancestor back-edges return MdastDecodeError with a structured InvalidValue issue through both APIs; shared acyclic subtrees remain accepted (test/mdast.test.ts:146; test/mdast.test.ts:164).
- **upstream-bug** — Upstream: Independent block and inline depth budgets accept combined trees deeper than 256 which the visitor truncates and stringifier rejects; lab: successful parsing requires the entire materialized tree to fit the existing depth budget from root depth zero; excessive combined depth returns the typed parse failure (test/hardening.test.ts:135; test/hardening.test.ts:156).
- **upstream-bug** — Upstream: Projection recomputes list spread from synthetic item positions and loses explicit spread:true on positionless foreign lists; lab: lists with synthetic item positions preserve the admitted spread flag; real item positions continue to determine between-item spacing (test/mdast.test.ts:176).
- **upstream-bug** — Upstream: Extracting a definition before 150000 shallow paragraph lines spreads the surviving segments into call arguments and throws RangeError in Node; lab: the existing segment array is cleared and refilled iteratively, preserving identity and order while allowing the valid shallow paragraph to parse (test/internal/blocks/linkReferenceDefinition.property.test.ts:59).
- **upstream-bug** — Upstream: Decoded entity-shaped link/image destinations and titles are emitted directly and decoded again on reparse, changing their values; lab: literal ampersands are encoded before destination syntax and title quoting, preserving decoded URLs and titles for links, images and definitions (test/stringify.test.ts:992).
- **upstream-bug** — Upstream: Decoded code language and metadata are inserted as active fence syntax; backticks, entities and whitespace can alter fences, values or language boundaries; lab: info-string encoding protects ampersands, backslashes, backticks, line endings, language whitespace and metadata edge whitespace, preserving decoded language, metadata and code content (test/stringify.test.ts:1014).
- **upstream-bug** — Upstream: Direct-image and full-image-reference alt serialization activates decoded markup and entity syntax, losing literal alt characters; lab: both image arms apply inline-text escaping to decoded alt text, preserving literal emphasis, code, HTML, brackets, backslashes and entity-shaped text (test/stringify.test.ts:1030).
- **upstream-bug** — Upstream: Balanced destinations deeper than 32 parentheses are emitted bare, although the parser rejects that bare nesting depth; lab: destinations above the parser cap retain angle brackets; the 32-level boundary still uses bare spelling and both cases round-trip as links (test/stringify.test.ts:1047).
- **upstream-bug** — Upstream: Each consecutive definition rescans the growing child prefix and recreates the remaining source-segment suffix, causing quadratic extraction bookkeeping; lab: extraction tracks consumed text and one insertion index, positions against original segments, and rebases the surviving suffix once; final-child extraction avoids preceding-sibling reads (test/internal/blocks/linkReferenceDefinition.property.test.ts:36; test/internal/blocks/linkReferenceDefinition.property.test.ts:80).
- **native-runtime** — Upstream: Entity lookup and block construct registries expose native ReadonlyMap methods and insertion-order iteration; the earlier lab port retained ordered facades over HashMap; lab: eNTITY_MAP and BlockDialect.constructs expose Effect HashMap directly, with Option lookups and hash traversal order; Explicit scanner starts retain parsing precedence (test/internal/entityMap.coverage.test.ts; test/internal/blockRegistry.coverage.test.ts).
- **effect-first** — Upstream: decodeEntity returns a decoded string or undefined for malformed, unknown or unterminated references; lab: decodeEntity returns Option<string>; both production consumers use literal-source fallback on None, preserving parsed text and successful decoded values (test/inline-pass.test.ts:23; test/internal/entities.coverage.test.ts:8; test/internal/entities.property.test.ts:17).
- **schema-first** — Upstream: RawDiagnostic, source/provenance, reference, capture and table intermediate models are type-only; several engine domains are hand-written unions; JSX empty-name checks report struct-level filter issues; lab: new annotated schema values own RawDiagnostic, SourceLine, LineColumn, ParsedReference, RawInlineSegment, InlineSource, frontmatter captures and table models; LiteralKit owns engine kinds and shared raw domains; Shared NonEmptyString moves JSX empty-name issues to name fields; parser payloads remain plain objects (test/internal/blockTypes.property.test.ts; test/internal/inlineParser.property.test.ts; test/internal/blocks/frontmatter.property.test.ts:17; test/internal/blocks/table.property.test.ts:27; test/mdx.test.ts).
- **numeric-domains** — Upstream: Newly modeled diagnostic, source/provenance, capture and table numeric fields have no executable finite-number validation; DelimiterRun.numdelims accepts any finite number in the earlier lab schema; lab: new schemas use finite numeric fields; DelimiterRun.numdelims additionally requires a positive integer, rejecting zero, negative and fractional lengths; Ordinary parser outputs and scanning behavior are preserved (test/delimiter-run.test.ts:62; test/line-index.test.ts:8; test/internal/Preprocess.property.test.ts; test/internal/references.property.test.ts).
- **upstream-bug** — Modification returns UnsupportedTarget unless standalone replacement ends and the following sibling type and both shifted boundaries survive; empty replacements cannot merge neighboring lists compared with upstream: flow replacements can absorb untouched following paragraphs, lists, code blocks, blockquotes, table rows or definition continuations (test/format.test.ts:436; test/format.test.ts:457).
- **upstream-bug** — Phrasing splices encode terminal whitespace as character references when reaching a delimiter-bearing ancestor closing boundary, preserving replacement text and enclosing markup compared with upstream: terminal replacement whitespace beside emphasis, strong or delete closing delimiters invalidates the enclosing markup (test/format.test.ts:493).
- **upstream-bug** — Formatting applies parser-equivalent punctuation, whitespace and flanking rules at both underscore delimiters, retaining safe source spelling beside U+0301 and U+200C compared with upstream: underscore formatting checks only neighboring Unicode letters and numbers and removes emphasis beside combining marks or format characters (test/format.test.ts:512).
- **upstream-bug** — Conversion is skipped unless reparsing with the formatter dialect produces exactly one setext heading with the same depth and retained content compared with upstream: aTX-to-setext conversion of HTML-block or reference-definition-shaped content turns the heading into another construct (test/format.test.ts:540).
- **upstream-bug** — MarkdownDocument adds an encoded dialect field, populated by parsing and defaulted to gfm for legacy decoding and construction; both modification reparses use it compared with upstream: markdownDocument omits the parse dialect and flow modification safety reparses default to GFM, allowing unsafe splices into CommonMark documents (test/format.test.ts:552; test/document.test.ts:182).
- **upstream-bug** — Projection checks consecutive non-synthetic item positions when two exist, preserves admitted spread when missing positions prevent a gap check, and keeps fully positioned singleton behavior compared with upstream: the oracle derives list spread from item gaps; the earlier lab fallback lets any synthetic item suppress real gaps or preserve an incorrect admitted spread flag (test/mdast.test.ts:193).
- **upstream-bug** — Segment copying appends each segment individually so the shallow heading parses successfully with complete text and exact heading, text and root positions compared with upstream: promoting a 150,000-line paragraph into a setext heading spreads all segments into push arguments and throws RangeError in Node outside Result (test/hardening.test.ts:76).
- **upstream-bug** — An iterative child-edge preflight rejects depths above 512, with root depth zero, as MdastDecodeError carrying InvalidValue depth/limit metadata; shared acyclic trees through depth 512 remain admitted compared with upstream: deep acyclic foreign mdast input overflows recursive normalization, throwing RangeError synchronously and producing an Effect defect (test/Mdast.coverage.test.ts:34; test/Mdast.coverage.test.ts:38).
- **upstream-bug** — Deactivation stops when the active-link count reaches zero; scaled regressions require exactly n visits through n=4,000 and identical parse output compared with upstream: link-opener deactivation continues through older image and inactive openers after all active links clear, performing quadratic bracket visits (test/internal/inlineParser.coverage.test.ts:141).
- **upstream-bug** — Serialization reads the previous complete Unicode code point and following nonempty Text sibling, using asterisks beside Unicode letters or numbers while preserving safe underscore spelling compared with upstream: underscore emphasis and strong serialization checks one preceding UTF-16 unit and ignores following text, so unsafe astral-letter or alphanumeric neighbors erase markup on reparse (test/stringify.test.ts:993).
- **upstream-bug** — Destination and title escaping encodes CR/LF as numeric character references after literal ampersand escaping, preserving decoded values and existing quote, backslash and destination escapes compared with upstream: decoded CR/LF in link, image and definition destinations or titles is emitted as physical source line endings, losing links or splitting paragraphs (test/stringify.test.ts:1011).
- **upstream-bug** — When language is absent, serialization emits an empty info string and drops unrepresentable metadata, retaining original code content and absence of a language class compared with upstream: a code node with metadata but no language emits metadata as the first info word, acquiring a language class on reparse (test/stringify.test.ts:1036).
- **upstream-bug** — Paragraph interruption and both code separator classifications recognize metadata as fenced code, preserving single-newline separators and tight-list rendering compared with upstream: metadata-only fenced code is classified as indented for block separators, introducing blank lines and making tight list items loose (test/stringify.test.ts:1050).
- **upstream-bug** — Table-cell and reclaimed-paragraph segments append iteratively, with retained-interval segments appended individually; large cells parse successfully with exact content and source spans compared with upstream: unbounded table-cell segment spreads throw Node RangeError for a shallow cell containing 150,000 escaped pipes (test/gfm-tables.test.ts:70).
- **upstream-bug** — Canonical text and image-alt escaping emits decoded CR as a numeric character reference, preserving inline content and rendering across block-opening characters compared with upstream: decoded carriage returns in canonical text or image alt are emitted as raw CR, allowing subsequent heading, list or other block-opening text to become source structure (test/stringify.test.ts:1072).
- **upstream-bug** — Escaping emits a numeric newline reference when preceding output ends in two spaces, preserving a Text soft newline across canonical and mixed-style siblings compared with upstream: a decoded soft newline after emitted trailing spaces becomes a spaces-style hard break, including when spaces and newline belong to adjoining Text siblings (test/stringify.test.ts:1092; test/stringify-literal.test.ts:46).
- **upstream-bug** — A forward segment cursor processes ordered retained intervals, meeting linear segment-read bounds while preserving content, exact source offsets and segment boundaries compared with upstream: table-header promotion rescans every source segment for every retained escaped-pipe interval, producing quadratic provenance reads (test/internal/blocks/table.property.test.ts:31).
- **upstream-bug** — Info-string encoding replaces one leading language tilde with a numeric character reference for tilde fences, preserving language, metadata and code content on reparse compared with upstream: a tilde-fenced code language beginning with a tilde lengthens the opening fence, losing language and sometimes retaining the closing fence as content (test/stringify.test.ts:1113).
- **schema-first** — Executable annotated Struct schemas and derived types own these six payloads; two LiteralKit schemas expose unchanged 0/1/2 verdicts; Four exported parser payloads and two verdicts gain runtime schema values; plain records and optional title keys remain intact compared with upstream: taggedEdit, RawInlineSlice, PreparedInline, DefinitionData, FootnoteData and EmailMatch are handwritten interfaces; BlockContinueResult and BlockStartResult are type-only numeric unions (test/internal/blockTypes.property.test.ts:66; test/format.test.ts:436; test/autolink-boundaries.test.ts:10).
- **numeric-domains** — TaggedEdit reuses finite MarkdownEdit offsets; raw/prepared inline offsets use Finite, and EmailMatch from/to use Natural; New schemas reject non-finite offsets and noninteger or negative email offsets; ordinary scanner records remain unchanged compared with upstream: the newly modeled edit-owner, raw/prepared inline and email-match offsets have only TypeScript number fields without their own executable numeric admission contracts (test/internal/blockTypes.property.test.ts:66; test/autolink-boundaries.test.ts:10).
- **identity-annotations** — Both JSX schemas reuse one filter with a shared MdxFragmentAttributes identity, title, description and the existing user-facing rejection message; accepted element shapes remain unchanged compared with upstream: mDX flow and text JSX fragment-with-attributes checks are duplicated filters without shared identifier, title or description metadata (test/mdx.test.ts).

### Dependency backlog

None.

## License

[MIT](LICENSE). The package `LICENSE` carries both copyright notices: beep-effect and the upstream author, C. Spencer Beggs. The vendored engine files and conformance data keep their own notices, listed under Attribution.
