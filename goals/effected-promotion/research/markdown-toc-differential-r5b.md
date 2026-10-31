# Markdown TOC differential: roadmap PR R5b

Run 2026-10-31 on lane `refactor/markdown-toc-onto-beep-markdown` at commit
ae75405fd7, a clean tree after the lane merged `origin/main` f16d82e9f1 and took the #2407 review fix
(`MarkdownSlug.headingLine`: a multi-line setext heading's lines join with one space, without their
continuation prefixes), by
`ops/markdown-toc-differential.ts` against a
disposable `@effect/markdown-toc@0.1.0` install (`remarkable` 1.7.4) under
`~/.cache/beep/markdown-toc-oracle`. The machine-readable report is
`markdown-toc-differential-r5b.json`; this note classifies what it records.

## The oracle for the adopted site (docgen)

After `bun run docgen` (full, every `docgen.json` package, exit 0) with the new
`MarkdownToc.render` in `Core.getModuleMarkdownFiles`, every generated module
page under a `docs/modules/` directory was put back to the TOC input the
builder saw (frontmatter dropped, the inserted `## Exports Grouped by Category`
block replaced by the `<!-- toc -->` marker) and rendered by both
implementations with `bullets: "-"` / `bullet: "-"`:

| Corpus | Files | Oracle headings | Kit == oracle | Page's embedded TOC == oracle |
| --- | --- | --- | --- | --- |
| docgen module pages | 3,378 | 36,267 | 3,378 | 3,378 |

So the TOC block of every generated page is byte-identical to what
`@effect/markdown-toc` rendered for the same content: the generated docs do not
change. The 168 `index.md` module indexes carry no TOC block and are skipped.

## The slugger differential (every tracked Markdown file)

| Corpus | Files | Oracle headings | Identical | Differing | Kit errors |
| --- | --- | --- | --- | --- | --- |
| `git ls-files -- '*.md'` | 8,826 | 71,154 | 8,787 | 39 | 0 |

No heading of the 71,154 slugs differently between the two implementations: the
39 differing files all differ in which lines the two **parsers** read as
headings, never in the slug, title or anchor of a heading both agree on. The
tracked corpus's multi-line setext headings, where the kit departs from the oracle, all sit in these 39 files. Three
classes cover all 39:

1. **A frontmatter block at the top of the file** (4 files: `explorations/
   legal-patent-kg-deepening/research/mined/L10.md` and `L12.md`, two receipts
   under `goals/repository-simplification-confidence/history/receipts/`). The
   kit parses with frontmatter capture on, so the block contributes no heading;
   `remarkable` has no frontmatter notion and reads a one-line block
   (`---`, one line, `---`) as a thematic break followed by a setext H2 (the
   oracle lists `{id: L10, source: ...}` and `"@beep/repo-cli": patch` as
   headings). A multi-line block is not a setext heading for `remarkable`
   either, which is why the other frontmatter-bearing files agree. Intended
   shift: `MarkdownToc.renderResult` documents the capture.
2. **The okf stamp in `KNOWLEDGE.md` files** (32 files, every tracked
   `KNOWLEDGE.md` with the stamp): `---`, `<!-- okf/modules/<x>.md -->`, `---`,
   then a YAML mapping closed by `---`. CommonMark (the kit, GitHub) reads the
   HTML comment as an HTML block and the `---` after it as a thematic break;
   `remarkable` reads the comment as a paragraph and the `---` as its setext
   underline, listing an empty-slug heading. The trailing mapping is a setext
   H2 for the kit (a multi-line paragraph underlined by `---`, CommonMark 0.31
   §4.3) and no heading for `remarkable`. Net: the oracle lists 161 more
   headings than the kit over the 32 files, 1,329 index positions shift. No
   consumer renders a TOC for these files.
3. **CommonMark conformance fixtures** (3 files under
   `packages/foundation/modeling/markdown/data/conformance/mdast/`): an empty
   ATX heading (`#` alone, `heading-atx.md`), a multi-line setext heading
   (`heading-setext.md`) and a list item underlined by `---` (`list.md`). The
   kit follows CommonMark 0.31.2; `remarkable` 1.7.4 predates it on all three.

Edges pinned in `test/MarkdownSlug.test.ts` and `test/MarkdownToc.test.ts`
against the oracle: the punctuation and CJK deletion lists, the Latin-1 and
Latin Extended-A fold with the `diacritics-map` exceptions, duplicate ordinals,
the leading-link title and slug, `maxDepth` after the shallowest depth, the
marker inside a paragraph, heading, fenced code block and a second marker. Two
documented divergences stay the kit's own rule: a lone surrogate in an anchor
is replaced by U+FFFD (`querystring.escape` pairs it with the next code unit;
no file-decoded source carries one), and an indented code block holding the
marker does not swallow the blank lines after it (`remarkable`'s indented-code
token does, so the oracle also drops the heading right after an indented
marker). A tab inside a heading becomes `--` in the kit's slug as
`markdown-toc`'s own `slugify` spells it; `remarkable` expanded the tab to
spaces before `slugify` saw it. None of the three shapes occurs in the corpus.

Reproduce: `bun add @effect/markdown-toc@0.1.0` in an empty directory outside
the repo, then from the repo root
`bun goals/effected-promotion/ops/markdown-toc-differential.ts --oracle <dir> --out <report.json>`
after `bun run docgen`.
