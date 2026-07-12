# Findings ledger — master inventory

Every reviewer finding across all rounds. Status: `open` → `confirmed` →
`fixed` | `waived` (→ `ledgers/waivers.md`) | `rejected` (not reproducible /
no evidence) | `backlog` (→ `ledgers/backlog.md`).

Severity: P0 crash/data-loss · P1 broken feature · P2 degraded UX ·
P3 polish. Gate is on unwaived status, not severity.

| id | round | lane | severity | surface | summary | evidence | location | status | fix |
|---|---|---|---|---|---|---|---|---|---|
| F-000-01 | 0 | smoke | P1 | Vault sync | Real Box sync always shows "disconnected" with valid credentials: Box SDK materializes absent response fields as present-but-undefined keys (`nextMarker: undefined` on final marker-paginated page); exact-optional generated schemas reject the decode, `resolveMirrorRootId` fails, probe reports connected:false. Broke ALL final-page listings driver-wide. | Tempo trace 68a452caf08711b411eeaf2461bc9e6e; standalone driver probe repro | `packages/drivers/box/src/internal/Box.runtime.ts` (decodeWith) | fixed | pruneUndefined normalization before response decoding + regression scope: driver tests green |
| F-000-02 | 0 | smoke | P3 | Box driver DX | `BoxError` stringifies schema decode failures to literal `"SchemaError"` (cause Option<string>), discarding the issue tree — diagnosing F-000-01 required a standalone repro instead of reading the error/log/trace. | box-probe output: `cause: Some("SchemaError")`, empty exception.message in trace | `packages/drivers/box/src/Box.errors.ts` (causeLabelFromInput) | open | — |
| F-000-03 | 0 | smoke | P2 | Chat sidebar | Thread list dates render "Dec 31" — root-caused by code-chat lane: `ThreadStore.repo.ts:55` writes entity ids as createdAt/updatedAt epoch millis (≈1970-01-01 → local Dec 31 1969). Fix: Clock.currentTimeMillis in create/update. | screenshot 01-app-loaded.png; code-chat-report.md §date | `packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:55` | open | — |

## Round 01 inventory (details in history/round-01/<lane>-report.md)

| id | lane | sev | surface | summary | status |
|---|---|---|---|---|---|
| F-001-01 | code-editor | P1 | editor | EditorViewer ignores `state` prop changes after mount (viewer.tsx:197); compounded by index-keyed timeline items (Thread.tsx:77) | fixed: EditorViewer keyed by encoded state (viewer.tsx) — remounts when content changes |
| F-001-02 | code-editor | P1 | editor | Throwing `onAttach` callback leaks newly created blob URLs (atoms.ts:243) | fixed: append-before-notify + typed AttachmentPortFailed; URLs always revocable (atoms.ts) |
| F-001-03 | code-editor | P2 | editor | Mention lookup failures silently render as "no results" (typeahead.tsx:332) | fixed: mentionFailedAtom + 'Mentions are unavailable' row (typeahead.tsx) |
| F-001-04 | code-editor | P2 | editor | Open typeahead menus don't reposition on scroll/resize (typeahead.tsx:192) | fixed: viewportTickAtom re-positions open menus on scroll/resize (typeahead.tsx) |
| F-001-05 | code-editor | P2 | editor | Typeahead option ids collide across menus/composers → aria-activedescendant ambiguity (typeahead.tsx:203) | open |
| F-001-06 | code-editor | P2 | editor | Combobox ARIA attributes survive plugin teardown (typeahead.tsx:408) | fixed: finalizer strips combobox ARIA attrs on teardown (typeahead.tsx) |
| F-001-07 | code-editor | P2 | editor | YouTube iframe unsandboxed in React + exported-DOM paths (youtube-embed.tsx:31, youtube-node.tsx:109) | fixed: least-privilege sandbox + referrerPolicy + watch-link fallback (youtube-embed.tsx) |
| F-001-08 | code-editor | P2 | editor | Unbounded mermaid input can block the UI thread; no size/complexity budget (mermaid-view.tsx) | fixed: 20k-char source budget; oversized shows source instead of laying out (mermaid-view.tsx) |
| F-001-09 | code-chat | P1 | chat | Timeline-refresh failure after successful stream permanently locks composer (Chat.atoms.ts:860) | open |
| F-001-10 | code-chat | P1 | chat | Draft + edit target cleared before RPC acceptance — failed sends lose content (Composer.tsx:151) | open |
| F-001-11 | code-chat | P1 | chat | Edit regeneration sends obsolete branch tail to the model (ChatOrchestrator.ts:268) | open |
| F-001-12 | code-chat | P1 | chat | Assistant turns persisted with parentTurnId none — detached from prompting turn (ChatOrchestrator.ts:278) | open |
| F-001-13 | code-chat | P1 | chat | Streaming links accept javascript:/data:/file: schemes into anchors (StreamingBlocks.tsx:155) | open |
| F-001-14 | code-chat | P2 | chat | boundedKey applies AFTER unbounded key-string allocation (StreamingBlocks.tsx:92) | open |
| F-001-15 | code-chat | P2 | chat | Autoscroll steals scroll position on every streamed block (Thread.tsx:141) | open |
| F-001-16 | code-chat | P2 | chat | Optimistic user/edit content never rendered during streaming (Thread.tsx:179) | open |
| F-001-17 | code-chat | P2 | chat | editTargetAtom not bound to thread — cross-thread edit submission (Composer.tsx:124) | open |
| F-001-18 | code-chat | P2 | chat | Codec failure drops content instead of documented plain-text fallback (MessageView.tsx:43) | open |
| F-001-19 | code-sync | P1 | sync | No server-side single-flight sync guard; concurrent passes requeue active leases (VaultSyncEngine.service.ts:1303) | fixed: per-workspace single-flight lock on syncOnce (VaultSyncEngine.service.ts) |
| F-001-20 | code-sync | P1 | intake | Dropped files base64-expanded with no size limit — renderer/sidecar memory exhaustion (DocumentIntakeTarget.tsx:265) | fixed: 25MB per-file bound checked BEFORE arrayBuffer(); rejection names the limit (DocumentIntakeTarget.tsx) |
| F-001-21 | code-sync | P1 | sync | Cached availability probe masks expired Box token — stays "connected", sync looks successful (DmsMirrorBox.ts:733) | fixed: probe resolution expires (30s TTL) so an expired token stops reporting connected (DmsMirrorBox.ts) |
| F-001-22 | code-sync | P1 | sync | "Mark reviewed" hides conflict row but item stays conflicted forever (VaultSyncEngine.service.ts:1030) | fixed: review returns the item to pending so the next pass re-converges it (VaultSyncEngine.service.ts) |
| F-001-23 | code-sync | P2 | sync | Conflict-query failure renders as "no conflicts" (VaultSyncPanel.tsx:109) | fixed: conflict-query failure renders an explicit alert, not silence (VaultSyncPanel.tsx) |
| F-001-24 | code-sync | P2 | intake | Tauri picker invocation failures treated as user cancellation — inert Choose folder (DocumentIntakeTarget.tsx:41) | fixed: typed VaultPickerUnavailable — cancellation and unavailability are distinct (DocumentIntakeTarget.tsx) |
| F-001-25 | code-sync | P2 | driver | pruneUndefined: __proto__ key hazard + eager full clone (Box.runtime.ts:23) | fixed: copy-on-write + defineProperty key writes; regression tests (Box.runtime.ts) |
| F-001-26 | code-ontology | P0 | ontology | Concurrent session mutations are last-write-wins — silent edit loss (Session.atoms.ts:1508) | fixed: sessionMutationSemaphore serializes every session-authoring mutation (Session.atoms.ts) |
| F-001-27 | code-ontology | P1 | ontology | SPARQL LIMIT detection is lexical; comment defeats safeguard → unbounded materialization (Session.sparql.ts:407) | fixed: lexical-state scanner; only a top-level LIMIT counts; 2 regression tests (Session.sparql.ts) |
| F-001-28 | code-ontology | P1 | ontology | SPARQL runs synchronously, uninterruptible — no timeout/cancel (Oxigraph.sparql.ts:196) | open |
| F-001-29 | code-ontology | P1 | ontology | Failed SPARQL RPCs never populate error atom; stale results stay visible (Session.atoms.ts:1244) | fixed: prior result cleared + failure published to error atom (Session.atoms.ts) |
| F-001-30 | code-ontology | P1 | ontology | Repair applied before revalidation; downstream failure invisible (Session.atoms.ts:1335) | fixed: validation marked running/failed around repair revalidation (Session.atoms.ts) |
| F-001-31 | code-ontology | P2 | ontology | In-flight cosmos mount not invalidated on container unmount — leak (Session.atoms.ts:1122) | open |
| F-001-32 | code-ontology | P1 | ontology | Add Triple accepts arbitrary strings as IRIs and trims literals (Session.workbench.tsx:506) | fixed: IRI-schema guard + verbatim literals; regression test for hash IRIs (Session.workbench.tsx) |
| F-001-33 | code-ontology | P1 | ontology | Open/save/preview failures render nowhere — inert controls, untruthful Saved badge (Session.atoms.ts:1419) | fixed: ontologyDocumentErrorAtom renders open/save/preview failures; invalid path explains itself |
| F-001-34 | lane-e | P2 | shell | Hash navigation write-only: reload/back desyncs URL vs rendered surface (App.tsx:166) | fixed: URL is the source of truth; hashchange binding (App.tsx) |
| F-001-35 | lane-e | P3 | sync | Sync now success has no feedback / last-sync timestamp (VaultSyncPanel.tsx:238) | fixed: success confirmation with explicit kind (VaultSyncPanel.tsx) |
| F-001-36 | lane-e | P2 | intake | Intake is drag-drop-only — no file-picker/keyboard alternative (a11y + also blocks browser QA) (DocumentIntakeTarget.tsx:308) | fixed: keyboard-reachable 'File documents…' picker driving the same intake path |
| F-001-37 | lane-a | P1 | chat | Send immediately after Stop: reply answers the cancelled request — causality corruption (live repro) | open |
| F-001-38 | lane-a | P1 | chat | Edit→Rewrite never truncates persisted tail; banner promise false (live repro; cluster w/ F-001-11/12) | open |
| F-001-39 | lane-a | P1 | chat | Reload mid-stream orphans user turn — no error/retry/recovery UI (live repro; = lane-c-01) | open |
| F-001-40 | lane-a | P1 | chat | Two-tab simultaneous send silently drops one submission (live repro) | open |
| F-001-41 | lane-b | P2 | editor | Typeahead renders nested listbox-in-listbox roles (typeahead.tsx:197) | fixed: portal no longer sets role=listbox; Lexical's anchor owns it (typeahead.tsx) |
| F-001-42 | lane-b | P1 | editor | Slash menu survives trigger removal/Escape; can overlap mention menu; aria-expanded stale (typeahead.tsx:247,330) | fixed: mutually exclusive menu open + unanchorable menus render nothing (typeahead.tsx) |
| F-001-43 | lane-b | P1 | editor | Quote/code toolbar toggles nest blocks (`code` inside `blockquote`) and lose pressed state (toolbar.tsx:243) | fixed: block toggles read live $selectionBlockType, not the React snapshot (toolbar.tsx) |
| F-001-44 | lane-b | P1 | editor | Stale anyMenuOpenAtom silently blocks Enter-to-send (atoms.ts:414; consequence of F-001-42) | fixed: send guard confirms a menu is really on screen (isTypeaheadMenuVisible) |
| F-001-45 | lane-c | P1 | rendering | Mermaid error SVG treated as success — promised raw-source fallback never fires, even valid diagrams errored (mermaid-view.tsx:105) | fixed: parse-first + suppressErrorRendering so the raw-source fallback actually fires (mermaid-view.tsx) |
| F-001-46 | lane-c | P1 | rendering | YouTube embed shows "Video unavailable" for valid id in this runtime (youtube-embed.tsx:29) — diagnose origin/referrer | partial: sandbox/referrer set + watch-link fallback added; 'Video unavailable' for valid ids likely a localhost-origin embed restriction — re-verify in R2 |
| F-001-47 | lane-c | P2 | rendering | Nested lists flatten in BOTH streaming and persisted pipelines (StreamingBlocks.tsx:238 + codec) | open |
| F-001-48 | lane-c | P3 | rendering | Code blocks: no copy control; pre-wrap instead of horizontal scroll | open |
| F-001-49 | lane-a/c | — | chat | DUPLICATE: lane-c-01 mid-stream reload = F-001-39 | dup |
| F-001-50 | lane-d | P1 | ontology | Pre-filled tutorial TTL absent from checkout; Open silently no-ops → entire workbench unusable, no error (Session.workbench.tsx:93,479) — seed fixture + error surfacing; blocked lane D coverage, re-run in R2 | fixed: sidecar seeds the starter document from the tutorial operations (OntologyWorkspaceSeed.ts); verified live (32 quads) |
| F-001-51 | lane-d | P2 | ontology | Invalid file paths accepted; decodePath onNone → undefined silent no-op, Open never disabled (Session.workbench.tsx:483,611) | fixed: invalid path renders a field error instead of a silent no-op (Session.workbench.tsx) |
| F-001-52 | verify | P2 | shell | A failed status/timeline query never retries: a transient sidecar restart leaves "Sync status is unavailable" + disconnected until a manual reload. Found while verifying R1 fixes against a tab held open across a restart. | open |
| F-001-53 | verify | P3 | campaign | codex Chrome extension cannot select files from disk ("Allow access to file URLs" disabled), so the intake picker is driven via in-page File objects instead. Not an app defect; recorded so the coverage limit is explicit. | waived (tooling) |
