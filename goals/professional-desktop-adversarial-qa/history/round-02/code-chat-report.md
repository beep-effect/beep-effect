Found five issues: two P1 lifecycle/data-consistency defects and three P2 robustness/UX defects.

### Findings

1. P1 — partial persistence is incorrectly treated as a rejected turn

[ChatOrchestrator.ts:304](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ChatOrchestrator.ts:304), [Chat.atoms.ts:833](/home/elpresidank/YeeBois/projects/beep-effect6/packages/agents/client/src/Chat.atoms.ts:833)

`persisted` is set before either persistence operation succeeds. More importantly, assistant-row persistence and usage-record persistence are separate operations.

Failure scenario:

- Model completes normally.
- `store.appendTurn(...)` successfully commits the assistant response.
- `usage.append(...)` fails.
- The stream exits as a failure.
- The second `onExit` persistence attempt is suppressed because `persisted` is already `true`.
- The client clears the streamed answer, reports failure, restores the original prompt as a draft, and encourages a retry.
- Reloading reveals that the supposedly rejected answer was actually committed; retrying creates a duplicate user request and response.

Recommended fix: define a transactional finalization boundary for assistant turn plus usage record, or classify usage-record failure as post-commit telemetry that must not fail the chat stream. Track persistence state as a structured phase (`unclaimed`, `assistantCommitted`, `finalized`) instead of a boolean claimed before work begins.

2. P1 — the write semaphore does not protect against multiple sidecar processes

[ThreadStore.repo.ts:420](/home/elpresidank/YeeBois/projects/beep-effect6/packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:420), [ThreadStore.repo.ts:507](/home/elpresidank/YeeBois/projects/beep-effect6/packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:507)

The semaphore protects only one `ThreadStore` instance. IDs are still allocated with `max(existing) + 1`, including maxima read across the entire tables.

Failure scenario:

- Two desktop processes, test runtimes, or sidecars point at the same Postgres database.
- Each constructs its own semaphore.
- Both transactions read the same maximum turn/message ID.
- Both choose the same next IDs.
- One transaction loses to a unique-key failure, so a valid send fails despite the new “race fix.”

The comment’s assertion that the sidecar is the only writer is not enforced by the repository or database.

Recommended fix: use database-generated identity/sequence values. If that is temporarily impossible, take a database advisory lock or lock a shared allocator row inside the transaction. A process-local semaphore can remain as an optimization but cannot be the correctness mechanism.

3. P2 — interrupted-turn refresh can race server-side exit persistence

[ChatOrchestrator.ts:388](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ChatOrchestrator.ts:388), [Chat.atoms.ts:857](/home/elpresidank/YeeBois/projects/beep-effect6/packages/agents/client/src/Chat.atoms.ts:857)

The client invalidates the timeline as soon as its RPC fiber is interrupted, while the remote stream’s `onExit` finalizer still needs to append `(stopped)`.

Failure scenario:

- User presses Stop.
- Client interruption clears optimistic state and starts `GetTimeline`.
- That read completes before the sidecar’s interruption finalizer commits the marker.
- The transcript displays the persisted user prompt without an answer.
- The marker arrives afterward, but nothing performs another invalidation.
- It remains missing until an unrelated refresh or reload.

Recommended fix: introduce a cancellation RPC that acknowledges durable stopped-turn finalization before invalidation, or add a server completion signal the client awaits. At minimum, perform a bounded follow-up invalidation after cancellation persistence has had a chance to settle.

4. P2 — `activeBranchTurns` silently accepts forward/self parents and produces the wrong branch

[ThreadTimeline.ts:274](/home/elpresidank/YeeBois/projects/beep-effect6/packages/workspace/use-cases/src/aggregates/Thread/ThreadTimeline.ts:274)

The reducer only recognizes a parent already present in the accumulated branch. It terminates on cycles and self-parenting, but treats unresolvable parent references as ordinary root-like turns.

Failure scenario:

- Turn 2 at index 1 claims parent turn 3 at index 2, whether through corrupt import, migration, or malformed persisted data.
- Turn 2 is appended because turn 3 has not appeared.
- Turn 3 is then appended normally.
- Both remain active, although turn 2 claims to replace turn 3.
- A self-parent behaves similarly.
- History and UI agree with each other, but both send/render a semantically invalid conversation.

An edit of an edit with a valid backward parent works; the missing cases are forward parents, self-parenting, duplicate IDs/indices, and cycles.

Recommended fix: validate timeline graph invariants at decode/repository projection time: unique IDs and indices, parent exists, parent differs from child, and parent index is strictly smaller. Return a typed corruption error rather than silently treating malformed references as no edit. Add adversarial tests for these cases.

5. P2 — stopped/failed state is indistinguishable from model-authored text

[ChatOrchestrator.ts:74](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ChatOrchestrator.ts:74), [ChatOrchestrator.ts:307](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/chat/ChatOrchestrator.ts:307)

Lifecycle state is encoded as an ordinary assistant `Document` containing `(stopped)` or `(failed)`.

Failure scenario:

- A model legitimately responds with exactly `(failed)`, or a user asks it to output `(stopped)`.
- Persisted data is byte-for-byte indistinguishable from an interrupted or failed generation.
- UI, history projection, analytics, export, and retry behavior cannot identify which event occurred.
- These strings are also sent back to the model as if they were model-generated conversational content.

Recommended fix: persist a typed turn outcome such as `completed | stopped | failed`, with optional assistant content and failure metadata. Render status as UI chrome and project it into model history using an explicit policy instead of synthetic assistant prose.

### Findings table

| id | severity | file:line | summary | failure scenario | fix |
|---|---|---|---|---|---|
| R02-01 | P1 | `ChatOrchestrator.ts:304`; `Chat.atoms.ts:833` | Assistant commit plus usage failure is reported as a rejected send | Answer commits, usage append fails, client restores prompt and retry duplicates it | Transactional finalization or make post-commit usage failure non-fatal; replace boolean with phase state |
| R02-02 | P1 | `ThreadStore.repo.ts:420,507` | Process-local semaphore cannot protect `max + 1` IDs across sidecars | Two processes allocate identical IDs and one valid send fails | Database sequence/identity, advisory lock, or locked allocator row |
| R02-03 | P2 | `ChatOrchestrator.ts:388`; `Chat.atoms.ts:857` | Stop invalidation races durable stopped-marker persistence | Refresh wins race and orphaned prompt remains visible until later reload | Await cancellation acknowledgment or perform a post-finalization invalidation |
| R02-04 | P2 | `ThreadTimeline.ts:274` | Invalid forward/self parent links are silently retained | Replacement precedes its target, so both appear in active history | Validate graph invariants and fail with typed corruption; add adversarial tests |
| R02-05 | P2 | `ChatOrchestrator.ts:74,307` | Lifecycle markers are ordinary model content | Literal model output cannot be distinguished from interruption/failure | Persist a structured turn outcome and render/project it explicitly |

### Clean areas

- Normal successful completion is protected from a second stopped/failed append by the `Ref` guard.
- Valid backward edits, including an edit of an edit, reduce correctly.
- Cyclic/self-parent input does not cause nontermination; the defect is silent semantic acceptance.
- Reads are not serialized by the new semaphore.
- `setTitleIfEmpty` uses a conditional update and does not require the ID-allocation semaphore.
- Draft restoration is scoped by thread and revision, and edit-target content is not mirrored into the normal draft.
- Streaming links remain sanitized and external links use `noopener`/`noreferrer`.
- React text/code rendering does not directly inject LLM-controlled HTML.
- Persisted-message codec failure retains readable plain text.
- `git diff --check main...HEAD` was clean.
- No files were edited.


Codex session ID: 019f553c-1e3c-71a0-8b99-915aa2a736e2
Resume in Codex: codex resume 019f553c-1e3c-71a0-8b99-915aa2a736e2
