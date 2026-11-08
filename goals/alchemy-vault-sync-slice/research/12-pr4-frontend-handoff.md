# PR 4 handoff: vault-sync optimistic and offline-intents client

Branch: `goals/vault-sync-frontend`, created from `goals/vault-sync-api` (PR 3c) at
`a6eee3aafb9`, which is stacked on the domain PR #2886 and PR 3b part 1. Commits are local
only. No push, PR, Yeet, readiness check or monitor ran.

**Status: content-final for this lane.** The client implements D8 topology 2 for the
renderer-to-sidecar hop: one prediction per command, a persisted intent queue, and the
server's `decide` as the only authority. There is no CRDT and no local replica. QA closed
with zero required findings. The cutover holds below must be met before this ships live.

## What landed

| Concern | Result |
| --- | --- |
| Commands | Every slice command the panel exposes is an intent: Sync now (`RequestVaultSync`), Retry connection (`ProbeDestination`), Pause and Resume (`PauseDestination`, `ResumeDestination`, new toggle) and Mark reviewed (`ReviewConflict`). The panel has no rename, so `ClaimDestinationName` is not wired. |
| Prediction | Each action is decided first with the aggregates' own `SyncDestination.predict` or `SyncConflict.predict` from `@beep/documents-domain`. The panel renders the server state folded with every pending intent. A locally predicted rejection is shown at once and never queued, because the server would refuse the same command against the same state. |
| Persisted queue | A FIFO of intents (`commandId`, `destinationId`, `queuedAt`, typed action) in `localStorage` key `vault-sync:intent-queue:v1`, read and written synchronously through a schema-checked `KeyValueStore`. It survives reloads with the same command ids. |
| Replay | One flush at a time drains the queue in order at startup, on the browser `online` event and on "Retry now". Each intent is sent with its persisted `commandId`. An unanswered send stays at the head and is resent with the same id, so the server dedupes it. |
| Rejection | A typed `SyncRuleViolation` or `ScopeDenied` removes the intent. Because the panel always folds over the queue, that removal reverts the prediction. The refusal is shown with its rule ("Sync now was refused: destination paused.") until it is dismissed. |
| Confirmation | An accepted intent leaves the persisted queue at once, so it is never resent. It moves to an in-memory confirming list that the prediction keeps folding until a server read shows its effect: re-deciding it against the fresh state changes nothing. There is a bound of 10 reads. This removed the flash back to stale state seen in QA round 1. |
| Last known | Each successful read persists a slim snapshot (path claims dropped) per workspace. After a reload with the sidecar unreachable, the panel predicts on that snapshot. While the link is offline the row and the Box badge read "last known". |
| Transport | `VaultSyncIntentTransport` (an Effect `Context.Service`) is built on `VaultSyncApi.Client` over Effect RPC HTTP to `/vault-sync/rpc`, with the launch token as the bearer. The shell binds it with the other protocol layers. IPC sessions get the unavailable transport, so intents wait in the queue. A vite dev proxy entry for `/vault-sync` was added. |
| State | Effect Atom only: a writable queue atom, link, refusals and confirming atoms, server-state and prediction families, `runtime.fn` submit and flush, and a scoped replay atom that owns the window listeners. Fns read and write through the `AtomRegistry` service. A concurrent fn's own context is disposed when the fn is triggered again, and its later writes are dropped. That bug resent a delivered head forever. |
| Removed | The legacy panel command state machine (`vaultSyncCommandAtoms`, `VaultSyncPanelState`, `VaultSyncCommand`) and its test. The legacy status and conflict reads stay. |

## Files

- `apps/professional-desktop/src/sync/VaultSyncIntent.model.ts`: actions, the intent, the
  queue, the refusal and the link (LiteralKit unions, branded `S.Opaque` structs).
- `apps/professional-desktop/src/sync/VaultSyncIntent.prediction.ts`: `predictIntent` and
  `foldIntents` over the domain's decide and evolve, plus `VaultSyncServerState` and
  `VaultSyncPrediction`.
- `apps/professional-desktop/src/sync/VaultSyncIntent.transport.ts`: the transport service,
  the Api and unavailable layers, the URL resolver and `VaultSyncApiConnection`.
- `apps/professional-desktop/src/sync/VaultSyncIntent.atoms.ts`: the atoms described above.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx`, `Sync.atoms.ts`, `src/App.tsx`,
  `vite.config.ts`, `package.json` (`@alchemy.run/domain` dev dependency for the in-process
  Api test host), `bun.lock`.
- Tests: `test/vault-sync-intents.test.ts` (new), `test/vault-sync-disconnected-note.test.tsx`
  (updated); `test/sync-atoms.test.ts` was removed with the atoms it covered.
- Generated or ratchet files: the instrumentation and schema catalogs (pre-commit), coverage
  rows for the four new modules, and two effect-vitest inventory rows removed for the deleted
  test.
- `research/OPPORTUNITIES.md`: PR 4 friction receipts.

## Tests and results

- `test/vault-sync-intents.test.ts` (12) runs the real `VaultSyncApi`, hosted in-process on
  `Domain.InMemory` with the sidecar session adapter, behind a switchable renderer-to-sidecar
  hop. It covers prediction through decide and evolve, ordered folding and revert by drop,
  persistence across a registry reload, ordered replay on the `online` event, dedupe of a
  resent command whose answer was lost (checked against the aggregate state after an
  out-of-band resume), server rejection reverting a prediction with a typed rule, local
  predicted rejection, confirmation without flashing back to stale state, and the
  last-known snapshot after a reload.
- `test/vault-sync-disconnected-note.test.tsx` (17) covers the panel: refusals, the offline
  queue and retry, the pause prediction, Sync now and conflict review intents, the probe
  intent with the forced legacy re-probe, last-known labels and the disabled-reason title.
- The whole desktop unit suite ran under coverage: 301 tests, coverage ratchet ok, no floor
  lowered. The panel is at 93.4% lines against its 85.71% floor.
- `bun run beep quality package-verify @beep/professional-desktop`: ok (lint, audit, docgen).
- `bun run lint:shadcn`: ok. Desktop `lint:jsdoc`: ok. `tsrs -p tsconfig.check.json`: clean.
- Scoped scans over this lane's files (the packet's `pr3c-scoped-lints.py` adapter pointed at
  `apps/professional-desktop`, base `a6eee3aafb9`): schema-first 0 introduced, 0 parity,
  0 LiteralKit; effect-vitest 0 findings.

## QA recording

The `browser-qa-loop` Lane A ran with `bun run beep qa record --lane playwright --scenario
.beep/qa-capture.mjs --url https://professional-desktop-pr4.beep.localhost:1355`. The vision
judge was an Opus 5.5 Agent subagent; each verdict was ingested with `qa judge-ingest`.

**What was exercised.** The real renderer, served by vite through portless as the
lane-suffixed route `professional-desktop-pr4.beep`, ran against the real fixture sidecar
(`CHAT_AGENT=fixture`, port 3940). In front of the sidecar on the port the vite proxy targets
(3939) sat a gitignored harness, `.beep/qa-vault-sync-host.ts`. It serves PR 3c's
`VaultSyncRpcHttp` (`/vault-sync/rpc`) over the hosted `VaultSyncModel` on `Domain.InMemory`,
with the sidecar launch-token session adapter, the desktop binding and a static member
grant. It forwards every other path to the sidecar and exposes `/qa/pause` as the
out-of-band actor. The sidecar itself does not mount the Api yet; that is the cutover
lane's work. Offline is Playwright's `setOffline`. The "sidecar unreachable during reload"
case aborts the Api route only.

| Round | Session id | Head | Required | Findings |
| --- | --- | --- | --- | --- |
| 1 | `qa-round-1-1794055808703` | `79e5cfb2c40` | n/a | Capture red: the panel flashed back to stale state after a confirmed replay. Fixed in `2560716ff9c`; not judged. |
| 2 | `qa-round-2-1794056108472` | `2560716ff9c` | 1 | R2-01 P1: the reload lost the destination row and prediction. R2-02 P2: disabled contrast. R2-03 P2: refusal layout. Fixed in `f429928ae4b`. |
| 3 | `qa-round-3-1794056394087` | `041fcd08cde` | 0 | R3-01 P2: Box badge live while offline. Fixed in `aca071211fc`. |
| 4 | `qa-round-4-1794056554691` | `aca071211fc` | 0 | R4-01 P2: row "last known" only after a reload. Fixed in `d18506e7368`. |
| 5 | `qa-round-5-1794056705740` | `aca071211fc` + the `d18506e7368` change (dirty) | **0** | none |

**Judge verdict (final, round 5):** `requiredCount: 0`, no findings; `qa judge-lint`
cross-check ok. The later commits `509154d3dde` and `4f1af7a5cda` are docgen and
schema-shape refactors. The capture harness re-ran CAPTURE-GREEN against `4f1af7a5cda`,
unrecorded.

**Evidence** (gitignored, in this worktree; nothing committed):
`.beep/qa/round-5/{session.json,inventory.json,inventory.md,manifest.json,events.ndjson,report.md}`,
`.beep/qa/round-5/judge/{prompt.md,timeline.md,stdout.txt}`, `frames/`, `sheets/`, `clips/`
and `video/capture.webm`. Rounds 1 to 4 sit beside it. The harness files are
`.beep/qa-capture.mjs` and `.beep/qa-vault-sync-host.ts`.

## Skipped gates

- No repo-wide gate, hosted CI, `yeet` (publish, final-check, ready) or real Postgres ran.
  Lint scans were lane-scoped; host memory is tight.
- No `vite build`. The renderer now bundles `@beep/documents-use-cases/aggregates/VaultSync`
  for the Api client. Vite dev served it without error, but production bundle size and
  tree-shaking are unmeasured.
- The jsdoc inventory still lists removed `Sync.atoms.ts` exports. Desktop `lint:jsdoc`
  passes. A full inventory refresh is a repo-wide write this lane did not run.

## Holds and open questions

1. **Cutover dependency (blocking for live use).** Until the cutover lane mounts
   `makeVaultSyncTransportLayer` in the sidecar's HTTP router, the shipped renderer's intents
   stay queued: `/vault-sync/rpc` returns 404, which the client reads as unreachable. Merge
   this PR after the cutover, or with it.
2. **Double probe after the flip.** "Retry connection" sends `ProbeDestination` and, once it
   is accepted, re-reads the legacy status with `forceProbe: true`. The PR 3c compat
   `GetVaultSyncStatus` sends its own `ProbeDestination` for that, so after the flip one
   click runs two probe workflows. The cutover lane should either drop the compat probe
   dispatch or this client should stop forcing.
3. **IPC sessions.** An IPC sidecar serves no HTTP, so intents never deliver there. IPC is a
   spike flag today (`?ipc`). Serving the Api group over the IPC protocol is follow-on work.
4. **Packaged origin.** In packaged builds the renderer calls
   `http://127.0.0.1:3939/vault-sync/rpc` directly. CORS for the packaged origin on that
   route is the cutover's mount responsibility; it was not exercised here.
5. **Rename.** `ClaimDestinationName` has no panel affordance, so no rename intent exists.
6. **Conflict review state.** The predicted review shows "Review queued" from the queue
   only. `ConflictReviewRequested` does not change `OpenConflicts` until the policy confirms.

## Rebased stack on `goals/vs-frontend-2` (2026-11-07)

Branch `goals/vs-frontend-2` was cut from `goals/vault-sync-frontend` (`fa75f605e59`)
and merges `goals/vs-cutover-2`, which carries the final PR 3a head `e2bd335249e`,
PR 3c `e864bf44bb4` and the cutover.

- **Conflicts.** `Sync.atoms.ts` keeps this PR's split (panel state and commands live in
  `VaultSyncIntent.*`) and takes the cutover's `WatchVaultSyncStatus` stream for
  `vaultSyncStatusAtom`. `sync-atoms.test.ts`, deleted here, is restored with only the
  cutover's status-stream test. The coverage baseline took the cutover side and the four
  `VaultSyncIntent.*` rows were re-added by measurement
  (`--write-baseline --add-missing-files-only`); every value is at or above the
  round-5 row. The goal manifest was regenerated.
- **Double probe removed (hold 2).** `vaultSyncRetryConnectionAtoms` no longer sends
  `GetVaultSyncStatus { forceProbe: true }`; after an accepted `ProbeDestination` it only
  invalidates the status key, which re-subscribes the status stream. The test "starts
  exactly one probe per Retry connection click" records every desktop RPC at call time
  and asserts one `probe` intent and zero `GetVaultSyncStatus` reads. Restoring the old
  forced read makes it fail.
- **Cutover hold (hold 1)** is met: `server/main.ts` mounts
  `makeVaultSyncTransportLayer` on the sidecar router.
- **Contract drift from the newer stack.** Intent command ids double as request ids, and
  3c bounded those to `RequestToken` (`[A-Za-z0-9_-]{1,64}`), so `vault-sync:<uuid>` was
  refused at decode. Ids are now `vault-sync_<uuidv7>` and both `commandId` fields are
  typed `V.RequestToken`. Fixtures and JSDoc examples use minted
  `documents_sync_destination_a…` ids; the paused-refusal assertion is typed by `SyncRule`.
- **Gates.** Docgen failed on four JSDoc examples with free-text destination ids (fixed).
  Fallow reported 17 unused exports and one complexity finding (`DestinationSummary`,
  cognitive 9) in this PR's files. Eleven exports are now module-private. The five
  `VaultSyncAction` member classes and `VaultSyncRefused` stay exported with a
  `fallow-ignore-next-line unused-export` reason, because declaration emit must name them
  in the exported atoms' inferred types (TS2527 otherwise). The paused badge is its own
  `DestinationStateBadge` component.
- **QA recording.** Not re-recorded. The panel renders the same states and controls; what
  changed is the transport under "Retry connection" (one probe, then a stream
  re-subscription instead of a forced status read).

Verification: desktop check clean; 299 tests in 55 files, including 31 across the intent,
panel and status-stream files. package-verify (lint, audit, docgen) passed. Coverage ratchet
ok with no floor lowered. Fallow dead-code, health and audit, entity-kit freeze,
tsconfig-sync, cache-policy (0 blocking) and docs oxlint on the touched sources exited 0.
Effect Vitest: introduced=0.

### Still open

- **Stale disconnect note after a probe.** The probe saga refreshes the sidecar's
  availability cache, but the status View does not change, so the stream pushes nothing.
  The re-subscription can read the cache before the saga's `refresh-probe` activity runs,
  leaving the old failure on screen until the next View change or re-subscription. The
  removed forced read hid this by probing synchronously. The fix is server-side: have
  `WatchVaultSyncStatus` also emit when `DmsMirrorAvailability` changes.
- Holds 3 to 6 above are unchanged.
