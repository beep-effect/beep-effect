# Lane B — Composer / chat input

| id | severity | summary | repro | location | recommended fix | screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| lane-b-01 | P1 | A non-empty rich-text draft can become silently unsendable after exercising the supported inline-mark combinations. Both Enter and the visible Send button no-op with no menu, error, toast, or disabled-state explanation. | 1. In a fresh composer, type short runs while toggling Bold, Italic, Underline, Strikethrough, and Inline code through all 32 combinations (the captured draft used `c00` through `c31`). 2. Confirm the composer shows 128 characters and no listbox is open. 3. Press Enter: nothing happens. 4. Toggle Inline code off and press Enter again: nothing happens. 5. Click Send: nothing happens. The draft remains intact and no turn starts. | `packages/foundation/ui-system/editor/src/chat/atoms.ts:591-607` — `sendCommandBindingAtom` silently maps `SerializedEditorState.decodeOption(editorState.toJSON())` failure to `false`; `apps/professional-desktop/src/chat/ui/Composer.tsx:154-172` is never reached. | Make the serialized-editor schema accept every state the shipped toolbar can emit, including mixed inline-mark runs, and add an integration test that constructs/sends all 32 combinations through the live Lexical editor. Treat decode failure as a typed, visible composer error (and telemetry event) instead of a silent no-op; keep the draft intact. | [lane-b-01-enter-dead-after-inline-combos.png](screenshots/lane-b-01-enter-dead-after-inline-combos.png) |

## Clean areas

- Stale-typeahead regression chain: slash menu selection, select-all replacement, Escape, mention menu, and subsequent Enter-to-send worked; no stranded menu and no overlapping menus were observed.
- Enter after dismissing the mention menu sent immediately, cleared the editor, and retained composer focus.
- Composer exposes the accessible name `Message composer`.
- Slash typeahead exposed exactly one `listbox` with nine options; no nested listbox appeared.
- Quote → code block → quote produced a single `blockquote`, no nested code block, with truthful `aria-pressed` states. Double-clicking the block toggles did not introduce nesting.
- All 32 inline-mark pressed-state combinations were exercised; the draft DOM represented each short run with the expected mark combination. The send boundary is the failing portion documented above.
- Pasting 100,000 characters completed and the count displayed `100000 characters`.
- Shift+Enter created two real paragraph elements (`first`, `second`); empty Enter remained a no-op.
- Character count updated for empty, short, 128-character, and 100,000-character drafts.
- The initial hard-reload briefly showed the unavailable state while unauthenticated RPC attempts raced authenticated retries, but it recovered and did not reproduce on the next hard reload, so it is not reported as a defect here.

## Coverage limitations

- Chrome control refused local file injection at the file-chooser boundary (`setFiles` was not permitted), so oversized MIME rejection, unknown MIME rejection, chip removal, and drag-drop could not be truthfully verified in this run. The picker itself opened.
- The nine slash options were present and keyboard/click lifecycle paths were exercised, but the silent-send P1 prevented sent-render verification for the batched 32-combination message.
