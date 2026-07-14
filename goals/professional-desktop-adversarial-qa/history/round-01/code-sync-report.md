Found 7 actionable defects. The highest-risk issues are concurrent sync execution, unbounded Base64 intake, and stale Box authentication state.

### Findings

1. **SYNC-01 — P1: concurrent sync passes can requeue and duplicate active work**

   [VaultSyncPanel.tsx:173](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/sync/VaultSyncPanel.tsx:173), [VaultSyncEngine.service.ts:1303](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1303)

   The client guard is only React state. Two clicks before the next render, a second window, or another RPC caller can invoke `syncOnce` concurrently. Every pass begins by requeueing all leased operations. Pass B can therefore turn an operation actively being uploaded by pass A back into `queued`, lease it again, and execute the same remote mutation concurrently.

   Add a server-side per-workspace lock or atomic “acquire sync lease” operation. Requeue only leases older than a timeout/owner heartbeat, not every leased row. The UI guard should remain merely an optimization.

2. **INTAKE-01 — P1: dropped files are copied and Base64-expanded without any size limit**

   [DocumentIntakeTarget.tsx:265](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:265), [Intake.atoms.ts:153](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/intake/Intake.atoms.ts:153)

   A large drop is materialized as an `ArrayBuffer`, copied into a `Uint8Array`, encoded as Base64 for RPC, decoded by the server, then retained during extraction and materialization. Base64 alone adds roughly 33%, while serialization can create further string copies. A sufficiently large filing—or several queued batches—can freeze or terminate the renderer/sidecar.

   Enforce explicit per-file and per-batch limits before `arrayBuffer()`. Prefer a streaming/file-handle transport or a Tauri/sidecar-local staged-file path with validated ownership. Show the rejected size and allowed limit in the results panel.

3. **SYNC-02 — P1: Box token expiry remains falsely “connected” and sync can appear successful**

   [DmsMirrorBox.ts:733](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:733), [VaultSyncEngine.service.ts:1311](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1311)

   After the first successful probe, `rootRef` permanently satisfies later probes without touching Box. If the token expires, status continues reporting `connected: true`. Push failures are converted into operation state, and poll failures are caught into cursor state, so `TriggerVaultSync` can return a normal status instead of an authentication failure. The UI can show a completed sync with only counters changing.

   Give availability results a TTL and invalidate the cached success on 401/403. Model authentication failure separately from generic disconnection, propagate it in sync status, and show reconnect/re-authentication guidance. A sync pass with provider-wide auth failure should not look successful.

4. **SYNC-03 — P1: “Mark reviewed” hides the conflict but leaves the item permanently conflicted**

   [VaultSyncEngine.service.ts:1030](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1030), [VaultSyncEngine.service.ts:1289](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1289)

   Remote drift sets the tracked item to `syncState: conflict`. `markConflictReviewed` only updates the conflict record. After review, the record disappears from the UI while `conflictItems` stays nonzero. An unchanged local scan does not transition that item, so users have neither a visible conflict row nor a resolution action.

   Define explicit resolution semantics. At minimum, reviewing should transition the associated item to a deliberate next state such as `pending` and enqueue convergence, or the UI must retain reviewed-but-unresolved records and offer keep-local/accept-remote actions. Add a regression assertion for status after review.

5. **SYNC-04 — P2: conflict-query failures are rendered as “no conflicts”**

   [VaultSyncPanel.tsx:109](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/sync/VaultSyncPanel.tsx:109)

   `VaultSyncConflictsList` renders content only for a successful, non-empty result. Initial loading, an empty result, and RPC failure all become `null`. If conflict loading fails during an otherwise healthy status request, the operator sees no indication that conflicts may be unavailable.

   Use `AsyncResult.match`: render loading state, explicit empty state, and a visible failure with retry/revalidation. Do not equate query failure with an empty collection.

6. **INTAKE-02 — P2: native Tauri picker failures are silently treated as cancellation**

   [DocumentIntakeTarget.tsx:41](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:41)

   Any import, IPC, permission, or command failure is converted to `null`. `configureSelectedWorkspaceVault` treats `null` as user cancellation and returns without setting status. Clicking “Choose folder” can consequently do nothing with no diagnostic or recovery path.

   Preserve cancellation as the command’s successful `null` result, but map invocation failure to a typed error and display it in onboarding status. Log a sanitized cause at the boundary.

7. **BOX-01 — P2: `pruneUndefined` is unsafe for `__proto__` keys and eagerly clones entire responses**

   [Box.runtime.ts:23](/home/elpresidank/YeeBois/projects/beep-effect6/packages/drivers/box/src/internal/Box.runtime.ts:23)

   The normalizer writes arbitrary keys into `{}`. An own `__proto__` property invokes the legacy prototype setter rather than creating a normal data property, altering the prototype of the normalized object and dropping the original field. Separately, every array and plain object is recursively cloned even when no `undefined` exists; large listings pay a full traversal/allocation before schema decoding. Deep or cyclic SDK values can also overflow or recurse forever.

   Build outputs with `Object.create(null)` or `Object.defineProperty`, add cycle/depth protection, and use copy-on-write normalization so unchanged branches retain their identity. Prefer limiting normalization to SDK DTO shapes known to materialize optional fields. Add tests for nested arrays, null-prototype objects, `__proto__`, deep structures, and unchanged large listings.

### Findings table

| id | severity | file:line | summary | failure scenario | fix |
|---|---|---|---|---|---|
| SYNC-01 | P1 | `VaultSyncPanel.tsx:173`; `VaultSyncEngine.service.ts:1303` | No server-side single-flight sync guard | Two callers overlap; pass B requeues pass A’s active lease and repeats remote work | Per-workspace lock plus stale-lease-only recovery |
| INTAKE-01 | P1 | `DocumentIntakeTarget.tsx:265`; `Intake.atoms.ts:153` | Unbounded whole-file Base64 RPC | Large/multiple drops exhaust renderer or sidecar memory | Size limits and streaming/staged-file transport |
| SYNC-02 | P1 | `DmsMirrorBox.ts:733`; `VaultSyncEngine.service.ts:1311` | Cached probe masks expired token | Token expires after first probe; UI stays connected and sync returns normally | TTL/invalidate probe; surface typed auth state |
| SYNC-03 | P1 | `VaultSyncEngine.service.ts:1030,1289` | Review hides record but strands item in conflict | User reviews conflict; row disappears while conflict count remains permanently | Implement explicit resolution transition/actions |
| SYNC-04 | P2 | `VaultSyncPanel.tsx:109` | Conflict-load failure looks empty | Conflict RPC fails; panel silently shows no conflicts | Render all `AsyncResult` states and retry |
| INTAKE-02 | P2 | `DocumentIntakeTarget.tsx:41` | Tauri picker errors become cancellation | IPC/plugin failure makes Choose folder appear inert | Preserve typed invocation failure and show status |
| BOX-01 | P2 | `Box.runtime.ts:23` | Unsafe key assignment and eager deep clone | `__proto__` mutates result prototype; large listings incur avoidable allocation | Null-prototype/copy-on-write traversal with cycle guards |

### Clean areas

- Drag overlay uses `pointer-events-none`, so it does not steal the eventual drop.
- Root `dragleave` checks containment, preventing ordinary child-transition flicker.
- Empty drops are ignored safely and active-batch accounting is finalized with `Effect.ensuring`.
- Per-file intake failures are surfaced without aborting the remaining batch.
- Intake filenames and filing rationales use React text rendering; no scoped XSS sink was found.
- No iframe/embed handling or `dangerouslySetInnerHTML` exists in the reviewed scope.
- Sync mutations invalidate both status and conflict query keys appropriately.
- Conflict review is workspace-scoped before repository mutation.
- Vault scanning explicitly skips symlinks, preventing traversal outside the configured vault.
- Box name-conflict recovery paginates folder listings and handles concurrent remote creation.

Codex session ID: 019f5491-79c0-7383-8af6-135015c7ad27
Resume in Codex: codex resume 019f5491-79c0-7383-8af6-135015c7ad27
