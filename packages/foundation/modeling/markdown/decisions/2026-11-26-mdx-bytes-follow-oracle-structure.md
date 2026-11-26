---
title: MDX serialization follows the mdast-util-mdx oracles for MDX structure and this package's canonical table inside it
date: 2026-11-26
reversal: Re-derive the mdx.test.ts expectations from the oracles' own to-markdown output for child markdown too, and switch the child serializer to those defaults.
governs:
  - src/internal/stringify.ts#serializeMdxJsxFlow
  - src/internal/stringify.ts#serializeMdxAttribute
  - src/internal/stringify.ts#mdxExpression
  - test/mdx.test.ts#leadingTextElement
enforcedBy: []
---

Serialization expectations in `mdx.test.ts` are lifted from the oracle suites of `mdast-util-mdx-jsx` (`mdxJsxToMarkdown`), `mdast-util-mdx-expression` and `mdast-util-mdxjs-esm` at the oracle defaults: quote `"`, no quoteSmart, spaced self-closing, and attributes wrapped onto their own lines only when one carries a line ending.

The oracle's `inferDepth` breaks only at `blockquote` and `listItem`: a list item's hanging indent owns indentation from there in, while a footnote definition keeps counting its JSX ancestor. Its `indentLines` splits on `\r\n`, `\n` and bare `\r`, keeps every terminator verbatim and never indents a blank line.

Where a case's child block content is ordinary markdown, the bytes follow this package's canonical table (bullet `-`, tight lists), not the oracles' to-markdown defaults: the MDX structure is the oracle contract, the markdown inside it is ours.

Rejected: the oracles' to-markdown defaults for child markdown, which would make one tree serialize two ways depending on whether it sits inside JSX, and quoteSmart.
