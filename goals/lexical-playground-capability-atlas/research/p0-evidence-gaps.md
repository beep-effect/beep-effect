# P0 evidence gaps

Date: 2026-08-24

This ledger records the live-interaction remainder for
`editor-capability-atlas/v1`. Ten entries remain `unverified`: six pinned
Playground defects and four capabilities unavailable in the pinned Playground.
Another 154 entries are `verified-live`, 153 of them with exercise evidence;
14 entries are `verified-source`.

P0's entry gate is closed. The 10 `unverified` entries have user-approved
Exception Ledger waivers. The activation-path gate is closed with zero open
paths. P0.5 exercised 10 of the 13 paths that previously opened the gate and
closed the other three with user-approved scope waivers.

## Approved waiver scopes

| Atlas ID | Reason |
| --- | --- |
| `comments.threads` | waived (SPEC Exception Ledger, user-approved 2026-08-24): genuine defect: At 480 px, pasting a marked thread range reopens the fixed Comments panel after the scenario hid it. The close control is hidden, the panel intercepts Export, and click plus export verification fail. Pinned `packages/lexical-playground/src/plugins/CommentPlugin/index.tsx:822-845` reopens the panel for active marks; `packages/lexical-playground/src/plugins/CommentPlugin/index.css:167-171,181-192` hides the toggle at widths up to 600 px and fixes the 300 px overlay. Evidence: `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/comments.threads/observations.ndjson:29-30`. |
| `document.comments-panel` | waived (SPEC Exception Ledger, user-approved 2026-08-24): genuine defect: The Comments panel remains a fixed 300 px overlay while its only toggle is hidden at widths up to 600 px. Pinned `packages/lexical-playground/src/plugins/CommentPlugin/index.tsx:822-845` reopens the panel for active marks; `packages/lexical-playground/src/plugins/CommentPlugin/index.css:167-171,181-192` hides the toggle and fixes the overlay. The regenerated scenario hides it before narrowing, so the responsive gap remains open. Evidence: `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/document.comments-panel/02-after.png`. |
| `document.speech-to-text` | waived (SPEC Exception Ledger, user-approved 2026-08-24): unavailable upstream: The pinned Web Speech integration requires a real speech service, microphone permission flow, and audible utterance. The manual SKIP wrote no evidence directory. |
| `extension.floating-toolbar` | waived (SPEC Exception Ledger, user-approved 2026-08-24): genuine defect: The directly focused toolbar control works, but no editor-to-toolbar keyboard route exists. The pinned `TabIndentationExtension` consumes Tab; only the main toolbar registers the Alt+F10 focus-manager path. Evidence: `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/extension.floating-toolbar/02-after.png`. |
| `interchange.pandoc-docx` | waived (SPEC Exception Ledger, user-approved 2026-08-24): unavailable upstream: The pinned Playground has no Pandoc or DOCX importer, exporter, command, or adapter. The manual SKIP wrote no evidence directory. |
| `interchange.pdf` | waived (SPEC Exception Ledger, user-approved 2026-08-24): unavailable upstream: The pinned Playground has no PDF importer, exporter, command, or adapter. The manual SKIP wrote no evidence directory. |
| `network.remote-embed-resolution` | waived (SPEC Exception Ledger, user-approved 2026-08-24): unavailable upstream: The pinned Playground has no inert-reference resolver, provider authorization boundary, or consent UI. Provider fetching is a `drivers/*` concern, consent and authorization are product-slice policy, and `@beep/editor` only projects. The manual SKIP wrote no evidence directory. |
| `node.mark` | waived (SPEC Exception Ledger, user-approved 2026-08-24): genuine defect: At 480 px, pasting a marked range reopens the fixed Comments panel. The close control is hidden, the panel intercepts Export, and click plus export verification fail. Pinned `packages/lexical-playground/src/plugins/CommentPlugin/index.tsx:822-845` reopens the panel for active marks; `packages/lexical-playground/src/plugins/CommentPlugin/index.css:167-171,181-192` hides the toggle and fixes the overlay. Evidence: `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/node.mark/observations.ndjson:31-32`. |
| `transformer.table` | waived (SPEC Exception Ledger, user-approved 2026-08-24): genuine defect: The regenerated shortcut path still creates a malformed nested table while the importer path is flat. The pinned transformer path is `packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts:203-330`. Evidence: `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.table/01-activation-path-1.png`. |
| `transformer.tweet` | waived (SPEC Exception Ledger, user-approved 2026-08-24): genuine defect: The Enter-triggered transformer replaces the selected TextNode without moving selection, reports `updateEditor: selection has been lost` followed by `Point.getNode: node not found`, and unmounts the app because the Playground has no error boundary. Pinned paths: `packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts:184-200` and `packages/lexical-markdown/src/MarkdownShortcuts.ts:75-92`. Evidence: `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/transformer.tweet/observations.ndjson`. |
| `table.column-reorder` | waived (SPEC Exception Ledger, user-approved 2026-08-24): unavailable upstream: The pinned table action menu at `packages/lexical-playground/src/plugins/TableActionMenuPlugin/index.tsx:467-670` has no reorder or move-column item. The only route is the hover `Drag to reorder column` control at `packages/lexical-playground/src/plugins/TableHoverActionsV2Plugin/index.tsx:626-665`, backed by `$moveTableColumn` at lines 500-528. The context-menu path remains `unverified`; Goal B owns an accessible non-drag route under D13. |
| `document.read-only` | waived (SPEC Exception Ledger, user-approved 2026-08-24): unavailable upstream: The pinned Playground has no mount-time read-only input at `packages/lexical-playground/src/App.tsx:326-350` or `packages/lexical-playground/src/appSettings.ts:14-44`. The runtime lock calls `editor.setEditable` at `packages/lexical-playground/src/plugins/ActionsPlugin/index.tsx:354-361`. Reload evidence proves that the lock resets to `contenteditable="true"` after remount: `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/document.read-only/observations.ndjson:19-24`. |
| `interchange.canonical-json` | waived (SPEC Exception Ledger, user-approved 2026-08-24): product-host path: No Playground or current `@beep/editor` surface imports canonical `@beep/md` JSON. P1 builds Storybook fixtures over the canonical document, and P2 records the import lifecycle. |

## Activation-path gate

The activation-path gate has zero open paths. P0.5 closed the 13 paths that
previously opened it as follows:

| Atlas ID | Surface | Closure |
| --- | --- | --- |
| `node.image` | `paste-drop` | exercised: passing file-paste row 25 and image assertion row 26 |
| `node.image` | `importer` | exercised: passing imported-image and caption assertions at rows 33-34 |
| `setting.tree-view` | `settings-panel` | exercised: passing `aria-checked="true"` and `.tree-view-output` assertions at rows 9 and 11 |
| `format.bold` | `markdown-shortcut` | exercised: passing fourth-bold assertion at row 29 |
| `format.italic` | `markdown-shortcut` | exercised: passing fourth-italic assertion at row 29 |
| `format.strikethrough` | `markdown-shortcut` | exercised: passing strikethrough assertion at row 25 |
| `format.inline-code` | `markdown-shortcut` | exercised: passing inline-code assertion at row 23 |
| `format.semantic-highlight` | `markdown-shortcut` | exercised: passing highlight assertion at row 15 |
| `extension.history` | `toolbar` | exercised: passing bold detach/restore assertions at rows 16 and 18 |
| `authoring.autocomplete` | `selection` | exercised: passing touch-swipe row 37, ghost-detached row 38, and exact completion row 39 |
| `table.column-reorder` | `context-menu` | waived by scope: the pinned menu has no reorder or move-column item |
| `document.read-only` | `read-only` | waived by scope: the pinned app has no mount input, and rows 19-24 prove that runtime lock state resets on remount |
| `interchange.canonical-json` | `importer` | waived by scope: P1/P2 own the product-host canonical import lifecycle |

The atlas still records 35 paths with `evidenceStatus: unverified`, but none
opens the live gate. Twenty-two are `programmatic`, so verified source evidence
or P1 resolver tests prove them. Ten belong to the original entry-level waiver
scopes, and the other three are the P0.5 scope waivers above. A
`verified-source` or `verified-live` entry does not hide a user-visible gap;
the gate closes only when the path is exercised or its exact capability scope
has a user-approved Exception Ledger row.

## Completion rule

The verifier's exit code proves schema validity, stable-ID reconciliation,
dependency/path integrity, pinned inventory counts, exact waiver scope and
owner resolution, and both P0 evidence gates. A manifest may declare P0
`complete` only when the entry gate and activation-path gate are closed.
