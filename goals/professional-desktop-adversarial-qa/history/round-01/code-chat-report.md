## Findings

1. **P1 — Successful persistence followed by timeline-refresh failure permanently locks chat streaming**

   [Chat.atoms.ts:860](/home/elpresidank/YeeBois/projects/beep-effect6/packages/agents/client/src/Chat.atoms.ts:860)

   After the streaming RPC succeeds, `ctx.result(threadTimelineAtoms(...))` runs outside the preceding error handler. If assistant persistence succeeds but the follow-up `GetTimeline` request fails, `streamingTurnAtom` is never cleared and `turnErrorAtom` is never populated. Every composer then sees a global active stream and refuses further submissions.

   Fix: wrap streaming, invalidation, and the awaited refresh in one exit-aware workflow. Clear streaming state in `ensuring`/`onExit`, route refresh failures into `turnErrorAtom`, and avoid waiting indefinitely for a successful query result.

2. **P1 — Submitting clears the only recoverable copy before the RPC accepts it**

   [Composer.tsx:151](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ui/Composer.tsx:151)

   `runTurn(...)` is fire-and-forget, followed immediately by clearing the draft and edit target and returning `true`, which tells `ChatComposer` to clear its editor. If the sidecar is offline, rejects authorization, or rejects an edit, the user receives a toast but loses the composed replacement text.

   Fix: retain a pending submission snapshot until the RPC has at least accepted/persisted the user turn. On failure, restore the draft/editor and edit target. A simpler safe version is to clear the persisted draft only on successful completion and leave failed content recoverable.

3. **P1 — Edit regeneration sends the obsolete branch tail to the model**

   [ChatOrchestrator.ts:268](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ChatOrchestrator.ts:268)

   `editMessage` appends a new user turn branching from the edited turn, then `streamAndPersist` fetches the entire timeline and `projectTimelineToHistory` flattens every turn. Editing an early prompt after several replies therefore sends the old user/assistant tail plus the new replacement prompt to the kernel. The generated response is based on history the UI has optimistically hidden.

   Fix: project only the selected ancestry/branch. For an edit, construct history from the edited turn’s ancestors plus the replacement turn, excluding the edited turn and all obsolete descendants.

4. **P1 — Persisted assistant turns are detached from the user turn they answer**

   [ChatOrchestrator.ts:278](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ChatOrchestrator.ts:278)

   Both send and edit finalization persist the assistant with `parentTurnId: O.none()`. After an edit, the replacement user turn is correctly parented to the edited turn, but its assistant answer becomes another root. Sibling/version detection and any future ancestry-based branch selection cannot associate that assistant response with the replacement prompt.

   Fix: retain the appended user turn’s ID and pass it into `streamAndPersist`; persist the assistant with `parentTurnId: O.some(userTurnId)`.

5. **P1 — Streaming links accept executable or privileged URI schemes**

   [StreamingBlocks.tsx:155](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ui/StreamingBlocks.tsx:155)

   The schema describes an “absolute http(s) url” but enforces only `S.String`. Model-controlled content can therefore emit `javascript:`, `data:`, `file:`, or application-specific URLs directly into an anchor. Depending on the React/webview version and registered desktop protocols, clicking it can execute content, expose local resources, or invoke privileged handlers.

   Fix: enforce a shared sanitized URL schema at decode time and again at the rendering boundary. Permit only explicit schemes such as `https:` and optionally `http:`; render rejected destinations as plain text. Use the repository’s canonical URL-sanitization surface rather than an ad-hoc regex.

6. **P2 — “Bounded” hashing still materializes unbounded paragraph, list, and table keys**

   [StreamingBlocks.tsx:92](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ui/StreamingBlocks.tsx:92)

   `boundedKey` hashes only 4 KiB, but it receives an already-built `raw` string. `inlinesRenderKey`, table-row keying, and list/block keying concatenate all hostile content before the bound is applied. A multi-megabyte paragraph or table therefore causes large allocations and repeated full traversal on each streamed update despite the stated O(`KEY_SAMPLE_LIMIT`) guarantee.

   Fix: build the sampled fingerprint incrementally with a remaining-character budget, while separately accumulating total length. Never create the complete composite key. Alternatively use stable envelope IDs supplied by the stream.

7. **P2 — Autoscroll forcibly steals the reader’s position on every block update**

   [Thread.tsx:141](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ui/Thread.tsx:141)

   Both timeline and streaming atom changes unconditionally call smooth `scrollIntoView`. If the user scrolls upward to read an earlier answer while a response streams, every incoming block drags them back to the bottom. Smooth animations can also continuously restart during rapid block delivery.

   Fix: track whether the thread viewport is near the bottom, using the scroll container or an `IntersectionObserver` sentinel. Autoscroll only while pinned; once the user scrolls away, show a “jump to latest” control. Respect reduced-motion preferences.

8. **P2 — Optimistic state records user content but never renders it**

   [Thread.tsx:179](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ui/Thread.tsx:179)

   `StreamingTurn.userContent` is populated for sends and edits, but `Thread` renders only `turn.blocks`. Before timeline invalidation completes, a fresh user message can be absent while “Thinking…” appears. During editing, the old tail is hidden but the replacement prompt is also absent, leaving an assistant response with no visible triggering message.

   Fix: render `streamingHere.userContent` as an optimistic user `MessageView` immediately before the assistant stream. For edits, insert it at the truncation point. Deduplicate it when the persisted timeline containing the replacement arrives.

9. **P2 — Global edit state is not bound to its originating thread**

   [Composer.tsx:124](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ui/Composer.tsx:124)

   `editTargetAtom` contains only `turnId` and content. If the active thread changes without the sidebar click handler clearing it—for example, the implicit “most recent thread” fallback changes after list invalidation—the new thread’s composer loads the old thread’s message and submits that old `turnId` with the new `threadId`. The RPC fails after the editor has already cleared.

   Fix: include `threadId` in `EditTarget`, filter edit state by the composer’s thread, and validate the target/thread match before creating `EditTurnRequest`.

10. **P2 — Codec failure drops persisted message content despite a documented plain-text fallback**

   [MessageView.tsx:43](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ui/MessageView.tsx:43)

   The module documentation promises a plain-text fallback, but failure renders only “This message could not be rendered.” A valid persisted Markdown document that hits a Lexical projection incompatibility becomes unreadable even though `@beep/md` already provides a plain-text renderer.

   Fix: on projection failure, render `renderPlainTextUnsafe(content)` as escaped React text, optionally with the degradation notice. Keep telemetry separate from the user-visible fallback.

## Known sidebar date root cause

Not counted as a finding per the waiver. The `"Dec 31"` display originates upstream: [ThreadStore.repo.ts:55](/home/elpresidank/YeeBois/projects/beep-effect6/packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:55) assigns entity IDs such as `1` directly to `createdAt` and `updatedAt`. That means approximately `1970-01-01T00:00:00.001Z`; `DateTime.formatLocal` correctly converts it to December 31, 1969 in negative UTC offsets.

The exact fix is to obtain `Clock.currentTimeMillis` in create/update/append operations and pass that timestamp into `baseEntityRecord`, preserving `createdAt` on updates while advancing `updatedAt`. Changing `Sidebar` to UTC formatting would merely conceal the invalid timestamp and would display real activity dates in the wrong user timezone.

## Findings table

| id | severity | file:line | summary | failure scenario | fix |
|---|---|---|---|---|---|
| R01-01 | P1 | `Chat.atoms.ts:860` | Refresh failure leaves streaming permanently active | Stream and persistence succeed → `GetTimeline` fails → composer remains locked without toast | Exit-aware cleanup and refresh-error routing |
| R01-02 | P1 | `Composer.tsx:151` | Failed sends lose draft/edit content | Sidecar rejects request → editor, draft, and edit target were already cleared | Clear only after acceptance/success; restore on failure |
| R01-03 | P1 | `ChatOrchestrator.ts:268` | Edit kernel receives obsolete branch history | Edit early turn → old tail and replacement are both sent to model | Project only selected branch ancestry |
| R01-04 | P1 | `ChatOrchestrator.ts:278` | Assistant turn has no parent | Replacement user persists → assistant persists as root | Parent assistant to appended user turn |
| R01-05 | P1 | `StreamingBlocks.tsx:155` | Untrusted link schemes reach clickable anchors | Model emits privileged/executable URI → user clicks it | Decode and render with an HTTP(S) allowlist |
| R01-06 | P2 | `StreamingBlocks.tsx:92` | Hashing bound applies after unbounded allocation | Huge inline/table content → full key strings rebuilt every render | Incremental bounded fingerprint or stream IDs |
| R01-07 | P2 | `Thread.tsx:141` | Streaming forcibly autoscrolls readers | User reads earlier content → every block pulls viewport down | Autoscroll only when pinned near bottom |
| R01-08 | P2 | `Thread.tsx:179` | Optimistic user/edit content is invisible | Send/edit starts → assistant state appears without triggering prompt | Render `StreamingTurn.userContent` at the correct position |
| R01-09 | P2 | `Composer.tsx:124` | Edit target can cross thread boundaries | Implicit active thread changes → old turn ID submitted to new thread | Store and verify edit target `threadId` |
| R01-10 | P2 | `MessageView.tsx:43` | Codec failure discards readable content | Lexical projection fails → generic notice replaces message | Render escaped Markdown plain-text fallback |

## Clean areas

- `blockToLexical` exhaustively covers the current Markdown block union, including explicit `hr` degradation.
- `artifact://` recognition is constrained to a single-link paragraph and validates the artifact ID.
- Raw Markdown and raw HTML nodes become text nodes rather than injected DOM.
- React text/code rendering escapes hostile content by default; no direct HTML injection exists in `StreamingBlocks`.
- YouTube block IDs use the constrained 11-character schema and the embed URL has a fixed privacy-enhanced origin.
- Mermaid receives a stable per-block render identity and uses its strict security mode.
- Stream cancellation avoids persisting partial assistant rows and uses registry-level cleanup after atom lifetime disposal.
- Toast consumption clears handled turn errors, preventing the same error from replaying on remount.
- Theme toggle has an accessible name and decorative SVGs are hidden from assistive technology.
- Cost formatting correctly converts integer micro-dollars to dollars and suppresses zero-cost fixture turns.

No files were edited.


Codex session ID: 019f5491-798a-7ad3-b307-185289c72f42
Resume in Codex: codex resume 019f5491-798a-7ad3-b307-185289c72f42
