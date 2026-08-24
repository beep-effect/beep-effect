# P0 evidence gaps

Date: 2026-08-24

This ledger is the live-interaction remainder for
`editor-capability-atlas/v1`. The regenerated judge pass leaves 10 entries
unverified: six pinned Playground defects and four capabilities unavailable in
the pinned Playground. The other 152 exercised entries are `verified-live`.

P0's live-evidence gate is closed by exercise (152) plus 10 user-approved waivers.

## Remaining unverified entries

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

## Approved waivers

The approved owners, rationales, and removal conditions are recorded once in
the [`SPEC.md` Exception Ledger](../SPEC.md#exception-ledger).

## Completion rule

The verifier's exit code proves schema validity, stable-ID reconciliation,
dependency/path integrity, and the pinned inventory counts. It does not replace
the live-evidence gate. That gate closed after exercise covered 152 entries and
the user approved owner-backed Exception Ledger waivers for all 10 remaining
unverified rows.
