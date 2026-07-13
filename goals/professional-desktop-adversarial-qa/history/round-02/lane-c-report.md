# Lane C — Rendering & node coverage

| id | severity | summary | repro | location | recommended fix | screenshot |
|---|---|---|---|---|---|---|
| C-01 | P1 | A bare YouTube watch URL is decoded as an ordinary `LinkNode`; no `YouTubeNode` or embedded player is produced, both immediately and after reopening the thread. | 1. Create a new thread. 2. Ask for exactly `https://www.youtube.com/watch?v=dQw4w9WgXcQ` on its own line. 3. Wait for completion: the assistant shows a blue text link, not a player. 4. Reload or switch threads and return: it is still a link. | `packages/foundation/modeling/lexical/src/Lexical.codec.ts:376` handles an Md `youtube` block correctly, but the incoming bare URL reaches the codec as a paragraph/link instead; `apps/professional-desktop/src/chat/ui/StreamingBlocks.tsx:277` likewise only embeds when the upstream block is tagged `youtube`. | Normalize a paragraph containing only a canonical YouTube watch URL into the Md `youtube` block before both streaming block emission and persisted Lexical conversion. Add an end-to-end fixture for the exact bare-URL form used by the chat model. | [lane-c-01-youtube-not-embedded.png](screenshots/lane-c-01-youtube-not-embedded.png) |
| C-02 | P1 | A valid Mermaid code block disappears in the persisted viewer: the source `<code data-language="mermaid">` is hidden, but no diagram, loading state, or fallback is mounted. Ordinary fenced code in the same response remains visible. | 1. Create a new thread. 2. Ask for exactly a valid fenced `mermaid` block containing `graph TD` and `A[Start] --> B[End]`. 3. Wait for the response to persist. 4. Reload or switch away/back. 5. Observe blank output where the diagram should be. DOM inspection shows the Mermaid code element has `hidden`, zero size, and no adjacent rendered portal. | `packages/foundation/ui-system/editor/src/mermaid-code-decorator-plugin.tsx:78-96` hides the code before establishing the portal target; the portal is created at `:138-145`. `packages/foundation/ui-system/editor/src/mermaid-view.tsx:123-169` owns the async render state. | Do not hide the source until a portal target is mounted and `MermaidView` has produced a visible pending/ok/failed state. Keep a source fallback visible if target collection or portal mounting fails. Add a reload/reopen integration test asserting one visible `data-testid="mermaid-diagram"` and no hidden-only code block. | [lane-c-02-mermaid-blank.png](screenshots/lane-c-02-mermaid-blank.png) |

Hostile-content results: the 600-character code line remained contained with horizontal scrolling; the 12-column table stayed within the message region and wrapped cell text; `javascript:` was sanitized to `#`; raw `<img ... onerror>` rendered as inert text; no app-origin console errors were observed. The model did not emit the requested invalid/huge Mermaid blocks or the deeper list descendants, so those specific variants are `not-produced`, not app passes.

## Node coverage

| node kind | STREAMING | PERSISTED |
|---|---|---|
| TextNode | ok — `lane-c-00-node-coverage-streaming.png` | ok — `lane-c-00-node-coverage-persisted.png` |
| TabNode | ok; literal tabs preserved in fenced code — `lane-c-02-exotic-streaming.png` | ok; DOM retained `\t` and `\t\t` — `lane-c-02-exotic-persisted.png` |
| LineBreakNode | ok — `lane-c-00-node-coverage-streaming.png` | ok — `lane-c-00-node-coverage-persisted.png` |
| ParagraphNode | ok — `lane-c-00-node-coverage-streaming.png` | ok — `lane-c-00-node-coverage-persisted.png` |
| HeadingNode | ok — `lane-c-00-node-coverage-streaming.png` | ok — `lane-c-00-node-coverage-persisted.png` |
| QuoteNode | ok — `lane-c-00-node-coverage-streaming.png` | ok — `lane-c-00-node-coverage-persisted.png` |
| ListNode (+ListItemNode) | ok for ordinary and one nested level — `lane-c-00-node-coverage-streaming.png` | ok for produced list structure — `lane-c-00-node-coverage-persisted.png`; six-level hostile descendants not-produced by model |
| LinkNode | ok; safe link works and `javascript:` becomes `#` — `lane-c-01-hostile-streaming.png` | ok — `lane-c-01-hostile-persisted.png` |
| CodeNode | ok for ordinary fenced code — `lane-c-02-exotic-streaming.png`; Mermaid live state was not captured before landing | broken for Mermaid decoration (hidden with no replacement) — `lane-c-02-mermaid-blank.png` |
| TableNode | ok — `lane-c-01-hostile-streaming.png` | ok — `lane-c-01-hostile-persisted.png` |
| TableRowNode | ok — `lane-c-01-hostile-streaming.png` | ok — `lane-c-01-hostile-persisted.png` |
| TableCellNode | ok — `lane-c-01-hostile-streaming.png` | ok — `lane-c-01-hostile-persisted.png` |
| YouTubeNode | broken; exact bare URL became LinkNode — `lane-c-01-youtube-not-embedded.png` | broken; still LinkNode after reopen — `lane-c-01-youtube-not-embedded.png` |
| ArtifactRefNode | ok; dedicated `⧉ Open artifact` chip produced from `artifact://render-001` — `lane-c-02-exotic-streaming.png` | ok — `lane-c-02-exotic-persisted.png` |
