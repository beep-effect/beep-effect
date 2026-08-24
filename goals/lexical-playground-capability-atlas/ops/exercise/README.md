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

Evidence lands under `goals/lexical-playground-capability-atlas/history/p0-exercise/2026-08-24/<atlas-id>/`. Each entry receives `observations.ndjson`; scripted entries also receive two to four labeled screenshots. Every non-localhost HTTP(S) request is an observation and is judged against the entry's network expectation. An uncaught page exception adds a failing `page-error` row with its error name/message and first stack frame. Evidence captured before this change does not contain `page-error` rows.

## Two-peer collaboration

Start the pinned Playground's `pnpm run collab` server on `ws://localhost:1234`, then run the dedicated exercise from the goal packet directory. It opens two isolated browser contexts, pairs them in the same Yjs room for each phase, and defaults to a Playground at `http://localhost:5199`.

```sh
cd goals/lexical-playground-capability-atlas
bun run ops/exercise/collab-peers.ts
```

Override the Playground origin with `EXERCISE_BASE_URL`. The script writes the collaboration lifecycle, four peer-labeled screenshots, and one `.lexical` export under `history/p0-exercise/2026-08-24/collaboration.realtime/`. Each step records its own result, so a failed assertion does not stop later lifecycle checks. Uncaught errors from either peer page are recorded as `page-error` failures.

The pinned v1 collaboration binding has two distinct undo results. If peer B appends inside the simple TextNode created by peer A, undoing peer A's capture also removes peer B's merged append. The exercise records the empty result as the expected pinned behavior. It then creates peer B's edit in a separate paragraph and proves that peer A's undo preserves that paragraph.

The Playground enables block-scoped select-all. Its first `Control+A` selects the current paragraph, and a second press expands the selection to the document (`packages/lexical-playground/src/App.tsx:280-282`; `packages/lexical-extension/src/SelectBlockExtension.ts:46-50,136-174`). The strict `phase-reset` row therefore expects peer A's replacement plus peer B's untouched paragraph, `peerA peerB peerB`, on both peers. Core Lexical's `$selectAll` spans the root, and text insertion removes a non-collapsed selection before inserting its replacement (`packages/lexical/src/LexicalUtils.ts:1361-1412`; `packages/lexical/src/LexicalSelection.ts:894-924`; `packages/lexical/src/caret/LexicalCaretUtils.ts:227-240,295-377`). The surviving paragraph is a Playground selection result, not the v1 dangling-text reconciler (`packages/lexical-yjs/src/CollabElementNode.ts:130-220`).

No later phase uses that document as a reset. Clipboard, offline/reconnect, export, narrow, keyboard-only, and touch checks each navigate both peers to a fresh room and type a clean converged baseline into the bootstrapped empty paragraph. Peer A completes v1 bootstrap before peer B joins, so the two clients cannot both append an initial empty paragraph while the shared root is empty (`packages/lexical-react/src/shared/useYjsCollaboration.tsx:108-113,638-688`). One run UUID prefixes deterministic phase suffixes, so the rooms are distinct within a run while network and WebSocket observations remain attributable to that run.

Playwright's browser-context offline emulation suppresses traffic on the existing WebSocket without explicitly disconnecting the y-websocket provider. The pinned ActionsPlugin changes its label only after `CONNECTED_COMMAND`, which reflects provider `status` events, or an explicit collaboration toggle (`packages/lexical-react/src/shared/useYjsCollaboration.tsx:352-450`; `packages/lexical-playground/src/plugins/ActionsPlugin/index.tsx:233-248,383-397`). The offline step therefore expects the label to remain `Disconnect from a collaborative editing server`; the stale peer document and later convergence prove transport isolation and recovery.
