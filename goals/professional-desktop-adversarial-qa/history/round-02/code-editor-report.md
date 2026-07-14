Found six actionable issues in the scoped editor changes. No P0 defects.

### Findings

#### R02-01 — P1: typeahead visibility is not scoped to the active composer

[atoms.ts:149](/home/elpresidank/YeeBois/projects/beep-effect6/packages/foundation/ui-system/editor/src/chat/atoms.ts:149)

`isTypeaheadMenuVisible(editor)` obtains the current editor root but then queries the entire `ownerDocument`:

```ts
root.ownerDocument.querySelector(...)
```

Failure scenario: composer A has a stale `menusOpenAtom` flag. Composer B has a visible slash/mention option. Pressing Enter in composer A sees B’s option, falsely concludes A owns a visible menu, and suppresses sending. The same false positive is possible with any second editor or test fixture in the document.

Fix: associate each portal with its editor root using a unique editor/menu ID and query that ID, or retain the menu element in per-editor state. Merely querying underneath `root` will not work because the portal is mounted at Lexical’s external anchor.

#### R02-02 — P1: mention failure notice does not count as a visible typeahead

[atoms.ts:152](/home/elpresidank/YeeBois/projects/beep-effect6/packages/foundation/ui-system/editor/src/chat/atoms.ts:152), [typeahead.tsx:283](/home/elpresidank/YeeBois/projects/beep-effect6/packages/foundation/ui-system/editor/src/chat/typeahead.tsx:283)

Visibility requires a `[role="option"]`, but `MentionUnavailableNotice` renders only `role="status"` and lacks `data-typeahead-menu`.

Failure scenario: type `@alice`; the async mention source rejects; the “Mentions are unavailable right now” popup is visibly open. Pressing Enter reaches the high-priority send binding, reports no visible menu, and sends the draft instead of leaving Enter to the open typeahead interaction.

Fix: track actual menu ownership in per-editor state or mark the failure portal with the same menu attribute and treat it as visible. Define explicit Enter behavior for the unavailable state—normally close/consume it before sending.

#### R02-03 — P2: viewport listeners can cause unbounded synchronous render churn

[typeahead.tsx:86](/home/elpresidank/YeeBois/projects/beep-effect6/packages/foundation/ui-system/editor/src/chat/typeahead.tsx:86)

The atom correctly removes both listeners through its finalizer, so I found no persistent listener leak or post-unmount write. However, its capture-phase `scroll` listener receives scroll events from every descendant in the window and synchronously increments atom state for every event, without animation-frame coalescing.

Failure scenario: leave a typeahead open while scrolling a long thread or an independently scrolling code/menu pane. Each raw scroll event causes an atom write, React render, selection measurement, and layout reads. Trackpads can generate many events per frame, producing avoidable layout/render thrash and menu jank.

Fix: coalesce updates to one per animation frame, cancel the outstanding frame in the finalizer, and avoid writing when caret coordinates did not change. If practical, attach listeners only to the window and actual scroll ancestors.

#### R02-04 — P2: every thread streaming update re-encodes all persisted viewer states

[viewer.tsx:67](/home/elpresidank/YeeBois/projects/beep-effect6/packages/foundation/ui-system/editor/src/viewer.tsx:67)

The encoded state is calculated synchronously on every `EditorViewer` render. The comment that this “costs nothing extra” is incorrect: it avoids a second encode within that render, but does not avoid re-encoding unchanged messages. In the desktop thread, streaming state causes the parent timeline to render repeatedly, and the persisted rows are not memoized.

Failure scenario: a long conversation containing large rich-text messages remains open while a response streams. Every streaming update walks and encodes every persisted editor state again, even though none changed. The full serialized state is also retained as the React key.

Fix: memoize encoding by `state` identity and memoize the persisted message/turn row boundary. Prefer a short stable content revision/hash as the composer key rather than the complete encoded payload. If state identity is not stable, cache encoding at the projection atom that creates the state.

#### R02-05 — P2: `AttachmentPortFailed` is logged and then deliberately erased

[atoms.ts:310](/home/elpresidank/YeeBois/projects/beep-effect6/packages/foundation/ui-system/editor/src/chat/atoms.ts:310)

The code appends attachments before invoking `onAttach`, catches a thrown port failure, logs it, and applies `Effect.ignore`. The UI consequently shows an ordinary successful attachment chip with no failure state or retry path.

Failure scenario: the app upload/capture handoff throws because its service is unavailable. The user sees the file as successfully attached and continues composing, while the only failure evidence is a log inaccessible from the product UI.

Fix: expose the typed failure through a per-editor attachment status/error atom or an `onAttachmentError` callback. Either mark affected chips failed with retry/remove controls, or roll back and revoke them if successful port handoff is required for a valid capture. Do not terminate the typed error solely with `Effect.ignore`.

#### R02-06 — P2: block-type detection misclassifies headings/quotes/code inside tables

[toolbar.tsx:120](/home/elpresidank/YeeBois/projects/beep-effect6/packages/foundation/ui-system/editor/src/chat/toolbar.tsx:120)

For content inside a table cell, `getTopLevelElement()` resolves toward the table-level ancestor rather than the nearest block containing the selection. Lists work only because they receive a separate nearest-list lookup. Heading, quote, and code checks are performed against the top-level element.

Failure scenario: place the caret in an H1 or quote inside a table cell. The toolbar reports `paragraph`; clicking the already-active H1/quote button chooses the “create target” path again instead of toggling back to paragraph. Active-state styling is also wrong.

Fix: resolve the nearest block-level ancestor within the current root/table cell, stopping at structural containers such as table/cell/root. Then classify that nearest block. Keep the special list lookup, but do not use the outermost top-level element as the generic block.

### Findings table

| id | severity | file:line | summary | failure scenario | fix |
|---|---|---|---|---|---|
| R02-01 | P1 | `chat/atoms.ts:149` | DOM query is document-global, not per-editor | Another composer’s menu suppresses Enter in the active composer | Bind/query menu visibility by editor identity |
| R02-02 | P1 | `chat/atoms.ts:152`, `chat/typeahead.tsx:283` | Mention failure popup is treated as invisible | Enter sends while “Mentions unavailable” is visibly open | Track actual popup state or mark the failure portal visible |
| R02-03 | P2 | `chat/typeahead.tsx:86` | Raw capture-phase scroll events synchronously rerender the menu | Trackpad/descendant scrolling causes repeated layout and render work | Coalesce with `requestAnimationFrame`; cancel on finalization |
| R02-04 | P2 | `viewer.tsx:67` | Unchanged viewer states are re-encoded on every render | Long persisted threads are repeatedly encoded during streaming | Memoize viewer/encoding and use a compact stable key |
| R02-05 | P2 | `chat/atoms.ts:310` | Upload-port failure is logged then erased | Failed handoff still appears as a successful attachment | Surface typed status/error or roll back and revoke |
| R02-06 | P2 | `chat/toolbar.tsx:120` | Block detection uses the wrong ancestor inside tables | Heading/quote/code cannot reliably toggle off in table cells | Classify the nearest block inside the structural container |

### Clean areas

- `viewportTickAtom` removes its scroll and resize listeners through an atom finalizer; no persistent listener leak was found.
- Slash/mention `onOpen` writes are mutually exclusive, and late `onClose` callbacks preserve the other menu’s state.
- Mention request IDs correctly reject stale async results.
- The toolbar’s live selection read fixes the ordinary rapid-toggle lag outside structural containers.
- Mermaid’s `active` guard prevents state writes after unmount or source replacement.
- Mermaid render IDs are bounded and instance-specific.
- The 20,000-character Mermaid limit mitigates the worst unbounded layout input.
- Mermaid SVG remains rendered with strict security mode; no new direct LLM-content XSS path was found.
- Viewer remounting correctly fixes stale Lexical initial state.
- YouTube embeds retain sandboxing, privacy-enhanced origin, safe external-link attributes, and a fallback watch link.
- ContentEditable now supplies an accessible name when used by the chat combobox.
- Attachment object URLs remain reachable for later removal/unmount cleanup after a port exception.
- Scoped diff is clean under `git diff --check`.


Codex session ID: 019f553c-1e4d-78a0-9727-f522d2da22c6
Resume in Codex: codex resume 019f553c-1e4d-78a0-9727-f522d2da22c6
