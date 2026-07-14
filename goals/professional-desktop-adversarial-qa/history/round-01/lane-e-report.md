# Lane E — Vault sync + document intake

| id | severity | summary | repro | location | recommended fix | screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| lane-e-01 | P2 | Vault navigation uses write-only hash links, so reload and browser history can render a surface that disagrees with the URL. A reload at `#sync` renders Chat, and Back from Vault sync to `#chat` leaves Vault sync rendered and marked active. | 1. Open **Vault sync**. 2. Reload the tab: the URL remains `#sync`, but Chat renders. 3. Alternatively, click **Chat**, then **Vault sync**, then browser Back. 4. Observe URL `#chat` while Vault sync remains rendered and its nav item remains active. | react-grab clipboard capture returned empty. Read-only source fallback: `apps/professional-desktop/src/App.tsx:166-194` — `desktopSurfaceAtom` drives rendering, nav clicks update it, but there is no initial hash parse or `hashchange`/history subscription. | Make the URL the navigation source of truth: initialize the surface from a validated `window.location.hash`, subscribe to `hashchange`/`popstate`, and update history and atom state through one routing function. Add reload/back/forward tests for every desktop surface. | [lane-e-01-reload-loses-vault-route.png](screenshots/lane-e-01-reload-loses-vault-route.png) |
| lane-e-02 | P3 | Successful **Sync now** has no completion feedback or last-sync timestamp. When counts stay unchanged, the panel returns to its pre-click state and users cannot tell whether sync succeeded or silently did nothing. | 1. Open **Vault sync** with Box connected and all counters at zero. 2. Click **Sync now**. 3. Observe the disabled **Syncing** state. 4. After completion, observe that the panel only returns to **Sync now** with no success toast, inline confirmation, or last-run time. | react-grab clipboard capture returned empty. Read-only source fallback: `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:173-184,238-253` — success explicitly sets `actionMessage` to `null`, and the only inline message is the failure path. | Persist and display a successful completion state such as “Synced just now” (ideally backed by the server-reported last sync time) and announce it through an `aria-live` region or toast. Keep the existing error message path. | [lane-e-02-sync-no-success-feedback.png](screenshots/lane-e-02-sync-no-success-feedback.png) |

## Clean areas

- Vault was already configured; the onboarding/native folder-picker state did not appear.
- Box connection resolved to **connected** and the provider label was **box**.
- Initial count grid was internally consistent: Pending 0, Current 0, Errors 0, Conflicts 0, Queued ops 0, Failed ops 0, Open conflicts 0.
- **Sync now** entered a disabled **Syncing** state and returned to idle without an app console error.
- Rapid double-clicking **Sync now** did not start an obvious duplicate UI operation; the button disabled during the in-flight sync.
- Navigating to Chat during a sync and returning to Vault sync did not leave a stuck busy state.
- No conflict rows existed, so **Mark reviewed** could not be exercised.
- App-origin console inspection showed no warnings or errors during the tested sync flows. Observed warnings came from an unrelated browser extension content script and were excluded.

## Coverage limitation

The Chrome control surface available for this run does not permit injecting filesystem-backed drag events: raw `Input.dispatchDragEvent` is explicitly rejected and the app-wide `DocumentIntakeTarget` exposes no file input/file-chooser fallback. I created fixtures for `.txt`, `.md`, empty, unsupported binary, long-name, Unicode-name, duplicate, and 12-file batch cases, but did not claim runtime results for drop overlay, intake busy/results/toasts, duplicate drops, drop-during-sync, navigation-during-intake, filing quality, or post-drop counter accuracy. Source inspection confirmed that intake is drop-only at `apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:308-340`; exercising those cases requires an OS/native drag-capable harness or a test-only file chooser surface.
