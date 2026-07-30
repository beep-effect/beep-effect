# @beep/professional-desktop

## Chat Database Compatibility

The desktop sidecar owns `CHAT_DB_PATH` with the bundled in-process PGlite runtime. The app pins `@electric-sql/pglite` to the version that matches `@effect/sql-pglite`; this keeps the compiled sidecar assets and the runtime driver in lockstep.

If an existing `CHAT_DB_PATH` was created by an older desktop build and cannot be opened by the current runtime, boot fails closed and leaves that directory untouched. To preserve data, run the older build once, export the chat database, then import it into a fresh directory created by the current build. To reset local state, move the old `chat-db` directory aside or point `CHAT_DB_PATH` at an empty directory before launching the current build.

The sidecar writes `.beep-pglite-inprocess-v2` only after the current runtime opens the directory and migrations finish. That marker means future boots still probe the directory, but they do not treat it as a legacy non-PGlite folder.

## Rich-content boundaries

Composer drafts remain general `@beep/md` documents so persisted content is not
silently rewritten. Before send, the desktop refines the draft through
`@beep/md/Md.safe`. A legacy draft containing trusted raw HTML or Markdown is
projected into the editor as literal text, but its original persisted form stays
untouched. The composer shows an escaped preview and requires an explicit
“Send escaped literal copy” action before the normalized safe document can be
submitted. An out-of-policy link or embedded URL is non-confirmable and must be
edited first, as is text containing a NUL character or lone UTF-16 surrogate.

The desktop persists canonical `@beep/md` content, not Lexical wire. Persisted
messages are projected to the editor vocabulary for rich rendering; if that
projection fails, the app renders the Md plain-text projection as React text.
Consumers that do persist unknown Lexical wire should use the editor package's
exported `EditorWireViewer` or `EditorWireComposer` admission surfaces, which
keep malformed or forward-compatible wire escaped and read-only.

YouTube players use only
`https://www.youtube-nocookie.com` frames. Production and development CSP both
declare that exact `frame-src`. “Watch on YouTube” cancels its click and emits
a typed, cancelable request. The Tauri desktop claims validated requests and
uses the official opener plugin; an unclaimed browser request is opened
explicitly. If the native opener rejects a claimed request, an accessible
notice retains both a retry and an explicit browser fallback. Every path
remains scoped to canonical watch URLs with an exact eleven-character video id.

The packaged CSP keeps scripts, workers, and application assets on `'self'`;
the ontology projection worker is emitted as a same-origin module asset rather
than a `data:` URL. `style-src` additionally permits inline styles because the
dock and resizable-panel runtimes calculate geometry through DOM style
properties. This exception does not extend to scripts, frames, URLs rendered
from Markdown, or serialized HTML.
