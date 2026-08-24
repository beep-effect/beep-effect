# P0 evidence exercise

Start the pinned Lexical Playground in a separate terminal from a detached
worktree of the Lexical repository at the atlas baseline commit `a933222`
(0.49.0). The repository is a pnpm workspace: `npm install` resolves none of
its `workspace:*` links and the Vite script then fails with
`vite: command not found`, so install with pnpm and start the playground's
`dev` script (there is no `start` script in the pinned package):

```sh
pnpm install --frozen-lockfile
cd packages/lexical-playground
pnpm exec vite --host --port 5199
```

Port 3000 is the Playground default, but it is commonly occupied by other
local services; the evidence in this packet was captured on port 5199. The
runner reads `EXERCISE_BASE_URL` (default `http://localhost:3000`), so pass
`EXERCISE_BASE_URL=http://localhost:5199` when using the command above. Set
`EXERCISE_HEADLESS=0` for a visible Chromium window.

From the beep-effect checkout, list or execute the exercises:

```sh
bun goals/lexical-playground-capability-atlas/ops/exercise/runner.ts --list
bun goals/lexical-playground-capability-atlas/ops/exercise/runner.ts --batch toolbar
bun goals/lexical-playground-capability-atlas/ops/exercise/runner.ts --entry format.bold
bun goals/lexical-playground-capability-atlas/ops/exercise/runner.ts --all
```

Run one harness process at a time. Never run entries in parallel because every
browser context uses the same system clipboard. The runner and the dedicated
collaboration script acquire the same PID lock in the operating system's
temporary directory, keyed by a SHA-256 hash of the dated evidence root. A
second process exits with status 2 while the recorded PID is alive. A dead PID
marks a stale lock, which the next process replaces.

Evidence lands under `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/<atlas-id>/`.
Before each scripted rerun, the runner removes that entry directory and creates
it again. The resulting directory contains only the current run's artifacts.
Manual entries do not create, clear, or write an entry directory. They print
`SKIP <atlas-id> — manual: <reason>`, count toward the skipped total, and do not
make the process fail. In particular, `--all` leaves the dedicated
`collaboration.realtime/` evidence untouched.

Each scripted entry receives `observations.ndjson` and two to four labeled
screenshots. Surface lifecycles now select the whole document with two
`Control+A` presses before copying. They record `clipboard-verify`,
`paste-verify`, and `export-verify` rows, then capture the fourth
`surface-roundtrip` screenshot before clearing the editor. These rows compare
the selected text with the system clipboard, the pasted editor text, and text
nodes under the downloaded `.lexical` file's `editorState.root`. Comparisons
strip all whitespace because DOM `textContent`, clipboard text, and serialized
text nodes use different separators between cells and blocks. Observation
details retain the original readable text. `clipboard-copy` clears the system
clipboard before selecting and copying, so an empty or unsuccessful copy stays
empty instead of reusing text from the preceding sequential entry.

An `expect-selector` step with the default `visible` state waits for the first
match. Its contract is at least one visible match, so a round trip that creates
two genuine copies does not fail Playwright strict mode. Detached, hidden, and
attached checks keep their previous unmodified-locator semantics. No scenario
uses `expect-selector` as an exactly-one assertion.

Selection cadence law: Lexical applies DOM `selectionchange` asynchronously.
Under Playwright's key cadence, a caret key (`End`, `ArrowRight`) sent within
about 50 ms of a select-all collapses the DOM caret while Lexical's own
selection still covers the document, so the next `Enter` deletes the selected
content and a following paste restores exactly one copy. The original sweep's
copy → `End` → `Enter` → paste tail therefore wiped and re-pasted instead of
duplicating, which is how one parallel run's clipboard ended up in another
run's export. The `clipboard-copy` step now collapses the selection through the
DOM (`Selection.collapseToEnd()`) when a DOM range exists. If no DOM selection
exists, it focuses the root editor and presses `End`. It then waits 150 ms
before the lifecycle continues; `paste-verify` polls for the settled document.
A 1 s pause or one typed character also resyncs Lexical, so this is a harness
cadence artifact, not a Playground defect.

Requests to `fonts.googleapis.com`, `fonts.gstatic.com`, and
`va.vercel-scripts.com` are expected Playground defaults from D9/D14. The
harness records them as passing `baseline-egress` rows and excludes them from
the capability-request count in `network-summary`. It judges every other
non-localhost HTTP(S) request against the entry's network expectation. An
uncaught page exception adds a failing `page-error` row with its error
name/message and first stack frame.

Browser `error` events without an exception object never reach Playwright's
`pageerror` event. Both scripts forward those events through a console marker
and record a passing `window-error` row. One example is `ResizeObserver loop
completed with undelivered notifications`. Vite's development ErrorOverlay can
then throw a `TypeError` while trying to render that exception-less event. A
first stack frame under `/@vite/client` records a passing `dev-client-error`
row because it is the development client failing to display the preceding
browser event, not a Playground exception. Other `pageerror` events remain
failing `page-error` rows. Before writing any observation, both scripts redact
the recorder's absolute home-directory prefix from its detail (with or without
Vite's `/@fs/` filesystem-serving prefix in front of it), replacing it with `~`.

## Two-peer collaboration

Start the pinned Playground's `pnpm run collab` server on `ws://localhost:1234`, then run the dedicated exercise from the goal packet directory. It opens two isolated browser contexts, pairs them in the same Yjs room for each phase, and defaults to a Playground at `http://localhost:5199`.

```sh
cd goals/lexical-playground-capability-atlas
bun run ops/exercise/collab-peers.ts
```

Override the Playground origin with `EXERCISE_BASE_URL`. The script writes the collaboration lifecycle, four peer-labeled screenshots, and one `.lexical` export under `history/p0-exercise/2026-08-24/collaboration.realtime/`. Each step records its own result, so a failed assertion does not stop later lifecycle checks. It uses the same `window-error`, `dev-client-error`, and `page-error` classification as the main runner.

The pinned v1 collaboration binding has two distinct undo results. If peer B appends inside the simple TextNode created by peer A, undoing peer A's capture also removes peer B's merged append. The exercise records the empty result as the expected pinned behavior. It then creates peer B's edit in a separate paragraph and proves that peer A's undo preserves that paragraph.

The Playground enables block-scoped select-all. Its first `Control+A` selects the current paragraph, and a second press expands the selection to the document (`packages/lexical-playground/src/App.tsx:280-282`; `packages/lexical-extension/src/SelectBlockExtension.ts:46-50,136-174`). The strict `phase-reset` row therefore expects peer A's replacement plus peer B's untouched paragraph, `peerA peerB peerB`, on both peers. Core Lexical's `$selectAll` spans the root, and text insertion removes a non-collapsed selection before inserting its replacement (`packages/lexical/src/LexicalUtils.ts:1361-1412`; `packages/lexical/src/LexicalSelection.ts:894-924`; `packages/lexical/src/caret/LexicalCaretUtils.ts:227-240,295-377`). The surviving paragraph is a Playground selection result, not the v1 dangling-text reconciler (`packages/lexical-yjs/src/CollabElementNode.ts:130-220`).

No later phase uses that document as a reset. Clipboard, offline/reconnect, export, narrow, keyboard-only, and touch checks each navigate both peers to a fresh room and type a clean converged baseline into the bootstrapped empty paragraph. Peer A completes v1 bootstrap before peer B joins, so the two clients cannot both append an initial empty paragraph while the shared root is empty (`packages/lexical-react/src/shared/useYjsCollaboration.tsx:108-113,638-688`). One run UUID prefixes deterministic phase suffixes, so the rooms are distinct within a run while network and WebSocket observations remain attributable to that run.

Playwright's browser-context offline emulation suppresses traffic on the existing WebSocket without explicitly disconnecting the y-websocket provider. The pinned ActionsPlugin changes its label only after `CONNECTED_COMMAND`, which reflects provider `status` events, or an explicit collaboration toggle (`packages/lexical-react/src/shared/useYjsCollaboration.tsx:352-450`; `packages/lexical-playground/src/plugins/ActionsPlugin/index.tsx:233-248,383-397`). The offline step therefore expects the label to remain `Disconnect from a collaborative editing server`; the stale peer document and later convergence prove transport isolation and recovery.
