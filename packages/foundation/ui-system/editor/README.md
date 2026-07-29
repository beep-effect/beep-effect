# @beep/editor

React editor kit on Lexical + `@lexical/react` for schema-first rich text: a
read-only viewer and composer primitives over the
`@beep/lexical-schema` v1 vocabulary, reusing the `@beep/ui` editor substrate
(theme, content-editable).

## Surface

- `EditorViewer` — read-only renderer for a schema-decoded
  `SerializedEditorState` (the schema → viewer side of the rich-text
  pipeline).
- `EditorCompatibilityViewer` — renders a compatible semantic state normally
  and shows lossless future/extension wire as escaped, read-only JSON.
- `EditorWireViewer` — admits unknown persisted Lexical wire before rendering;
  malformed or future wire stays escaped and read-only instead of entering the
  Lexical runtime.
- `EditorComposer` — editable surface wired with history, lists, check lists,
  links, and markdown shortcuts; `onSerializedChange` emits schema-decoded
  states (out-of-schema states are logged and skipped).
- `EditorWireComposer` — persisted-wire admission boundary for editing.
  Compatible input mounts `EditorComposer`; malformed or future wire remains
  escaped and read-only. A changed compatible input remounts the inner editor.
- `ChatComposer` — Atom-owned chat surface with slash commands, async mentions,
  attachment capture, formatting, send/stop commands, and inline typed
  refusals. Immutable ports and feature flags belong in `mountConfig`; changing
  them requires a new React `key`. Toolbar, slash commands, mentions,
  attachments, and character count all default to enabled; plain Enter sends
  by default (`sendOn: "enter"`).
- `CodeBlockView` / `MermaidView` / `YouTubeEmbed` — reader surfaces available
  from dedicated package subpaths. Mermaid rendering is interruptible and uses
  its frozen `securityLevel: "strict"` configuration; oversized or invalid
  source falls back to escaped text. Mermaid source is capped at 20,000
  characters before the renderer is loaded.
- `editorNodes` — node registration matching the schema v1 union, including
  runtime artifact and YouTube decorators. Runtime JSON/DOM import is decoded
  before construction; malformed values become inert fallbacks.
  `CodeHighlightNode` is
  intentionally not registered so code blocks keep plain text/tab/linebreak
  children — exactly the wire profile the schema persists.
- `editorTheme` — re-export of the `@beep/ui` Lexical theme.
- `ArtifactRefNode` / `$createArtifactRefNode` / `$isArtifactRefNode` — the
  runtime artifact-ref block, pinned to the schema's encoded contract.

## Usage

```tsx
import { EditorViewer } from "@beep/editor/viewer";
import { documentToEditorState } from "@beep/lexical-schema";
import { Document, P, Text } from "@beep/md/Md.model";
import * as Effect from "effect/Effect";

const turn = Document.make({ children: [P.make({ children: [Text.make({ value: "Hello" })] })] });
const state = Effect.runSync(documentToEditorState(turn));

export const Message = () => <EditorViewer state={state} />;
```

Mount-only chat configuration is grouped so React rerenders cannot produce a
half-live plugin/config state:

```tsx
import { ChatComposer } from "@beep/editor/chat/chat-composer";

export const Reply = () => (
  <ChatComposer
    mountConfig={{
      features: { attachments: true, sendOn: "enter" },
      onAttach: async (files) => upload(files),
      onSend: (state) => dispatchTurn(state),
    }}
    mentionSource={findMentions}
  />
);
```

`ChatComposer` treats `namespace`, `initialState`, and every `mountConfig` field
as mount-only. Change the component `key` when any of them changes. The bare
`EditorComposer` also treats `initialState` as mount-only; key it when replacing
the document. `EditorWireComposer` handles compatible `input` changes by keying
its inner editor to the canonical encoded state.

Unknown persisted Lexical input should enter through the wire admission
surfaces:

```tsx
import { EditorWireComposer } from "@beep/editor/composer";
import { EditorWireViewer } from "@beep/editor/viewer";

export const PersistedPreview = ({ input }: { readonly input: unknown }) => (
  <EditorWireViewer input={input} />
);

export const PersistedDraft = ({ input }: { readonly input: unknown }) => (
  <EditorWireComposer input={input} placeholder="Draft" />
);
```

`onAttach` may return a Promise. A rejected port rolls back only that capture
batch, revokes its object URLs exactly once, keeps the raw defect out of the DOM,
and displays a typed inline error. Attachments remain capture-only; this package
does not add them to message transport.

Dedicated imports are preferred for consumers that need only one surface:

```ts
import { CodeBlockView } from "@beep/editor/code-block-view";
import { MermaidView } from "@beep/editor/mermaid-view";
import { EditorViewer } from "@beep/editor/viewer";
import { YouTubeEmbed } from "@beep/editor/youtube-embed";
```

Stories live in `stories/` and render through the `apps/storybook` host.

## Development

```bash
bun run check      # tsgo + test tsconfig
bun run test       # vitest (headless lexical round-trip)
bun run lint:fix   # biome
```

Unit tests stay outside `test/integration`; tests import package source
through exact `@beep/editor/*` or other `@beep/*` aliases. The root and
`@beep/editor/chat` barrels remain deprecated compatibility facades. Use
relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
