# Upstream issue drafts

The operator will file these drafts against `facebook/lexical`. They describe
Lexical Playground 0.49.0 at commit
`a933222c489e7025d87b9217c2489d309fc8a3cf`.

## TWEET Markdown transformer loses selection and unmounts the Playground

### Version

- Lexical Playground: 0.49.0
- Commit: `a933222c489e7025d87b9217c2489d309fc8a3cf`

### Minimal reproduction

1. Open the Playground in rich-text mode with an empty editor.
2. Type `<tweet id="20" />`.
3. Press Enter to trigger the TWEET Markdown transformer.

### Expected

The transformer replaces the Markdown source with a `TweetNode`, moves the
selection to a valid location, and leaves the Playground usable.

### Actual

The transformer replaces the selected `TextNode` without moving selection.
Lexical reports `updateEditor: selection has been lost`, later reports
`Point.getNode: node not found`, and the Playground app unmounts. The
Playground has no error boundary that preserves the editor after the fault.

### Pinned source

- `packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts:184-200`
  defines TWEET with `triggerOnEnter: true` and replaces the text node.
- `packages/lexical-markdown/src/MarkdownShortcuts.ts:75-92` removes the
  leading selected text after the transformer replacement succeeds.

### Evidence

- `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.tweet/observations.ndjson`
- `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.tweet/01-activation-path-1.png`
- `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.tweet/02-activation-path-2.png`

## Typed Markdown table becomes nested while Markdown import stays flat

### Version

- Lexical Playground: 0.49.0
- Commit: `a933222c489e7025d87b9217c2489d309fc8a3cf`

### Minimal reproduction

1. Open the Playground in rich-text mode with an empty editor.
2. Type these three lines:

   ```markdown
   | A | B |
   |---|---|
   | 1 | 2 |
   ```

3. Press Enter to complete the typed Markdown shortcut.
4. Observe the resulting table.
5. Clear the document, choose `Convert To Markdown`, enter the same source,
   and choose `Convert from markdown`.
6. Compare the imported table with the shortcut result.

### Expected

Both paths create one flat 2x2 table with a header row and one data row.

### Actual

The typed rich-text shortcut creates an outer table whose cell contains header
text and another table. Importing the same Markdown source through Markdown mode
creates the expected flat 2x2 table.

### Pinned source

- `packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts:203-330`
  contains the TABLE transformer's row collection, table creation, sibling
  merge, and selection logic.

### Evidence

- `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.table/observations.ndjson`
- `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.table/01-activation-path-1.png`
- `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.table/02-activation-path-2.png`
