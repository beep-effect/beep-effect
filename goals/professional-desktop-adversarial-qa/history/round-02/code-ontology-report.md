Found four defects: one potential data-loss path, two stale/incorrect state races, and one mutation-queue UX regression.

### Findings

#### R02-ONT-01 — P0 — Seed can overwrite an existing user document after any read failure

[OntologyWorkspaceSeed.ts:53](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/ontology/OntologyWorkspaceSeed.ts:53)

`Effect.option` converts every `OntologyFileStore.read` failure into `None`. The file-store collapses missing files, permission errors, transient I/O errors, and canonicalization failures into the same `readFailed` error. The seed consequently treats “could not verify” as “absent” and proceeds to an atomic replacement write.

Failure scenario: `pizza-tutorial.ttl` contains user edits → startup read transiently fails → `existing` becomes `None` → seed writes the tutorial → user content is replaced. A second process or external writer can also create/update the file between the read and write because this is a check-then-write sequence.

Recommended fix: add a typed `notFound` reason and recover only that case. Add a create-if-absent operation using exclusive-create semantics so the absence check and creation are atomic. All other read failures should be logged and leave the file untouched.

#### R02-ONT-02 — P1 — Reads can publish results for a session that has already changed

[Session.atoms.ts:1287](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1287), [Session.atoms.ts:1338](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1338)

The semaphore protects authoring operations from each other, but SPARQL and validation capture a session outside it and publish their results without checking whether that session is still current.

Failure scenario: validation starts against session S → user applies a triple, producing S+1 and resetting validation → the older validation completes afterward → its result is stored as `complete` and displayed as the verdict for S+1. SPARQL has the same race and can show rows from S after S+1 is visible.

Recommended fix: capture a session revision/signature and compare it immediately before committing the result. Discard stale completions or rerun against the latest session. An interruptible latest-wins request atom would also solve this without serializing read-only work behind mutations.

#### R02-ONT-03 — P2 — Semaphore queues user actions invisibly while permits cover inference and validation

[Session.atoms.ts:1385](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1385), [Session.atoms.ts:1405](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1405), [Session.atoms.ts:1606](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1606), [Session.workbench.tsx:479](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:479)

Permits are held beyond the whole-session mutation, including inference and, for repairs, full revalidation. The UI has no shared mutation-pending state and leaves Apply, gestures, undo/redo, save, and open enabled.

Failure scenario: inferred view is enabled → Apply commits quickly but inference takes several seconds → the user sees no pending indication and clicks Apply/Undo/Open repeatedly → those actions silently accumulate behind the semaphore and execute later, potentially producing a surprising sequence against newer sessions.

Recommended fix: restrict the critical section to reading the current session, applying the mutation, and committing the returned session. Run derived inference/validation afterward with revision guards. Expose queued/running mutation state and disable or label authoring controls while a mutation is pending.

#### R02-ONT-04 — P2 — Successful Open is reported as a document failure when optional inference fails

[Session.atoms.ts:1493](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1493), [Session.atoms.ts:1511](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1511), [Session.atoms.ts:1519](/home/elpresidank/YeeBois/projects/beep-effect6/packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1519)

Open commits the new session, path, and source before refreshing inferred view. If inference fails, the outer `tapCause` writes the inference cause into `ontologyDocumentErrorAtom`, even though opening succeeded. `ensureOntologyInference` also records the failure in the inference error atom, so the same underlying failure appears in two unrelated UI channels.

Failure scenario: inferred view is enabled → document loads successfully → inference RPC fails → the loaded document is visible, but the global banner says the document operation failed and the inference panel also reports failure.

Recommended fix: end the document-open error boundary after committing the opened document. Run inference as a separate phase whose failure only updates `ontologyInferenceErrorAtom`; optionally disable inferred view or retain the asserted view.

### Findings table

| id | severity | file:line | summary | failure scenario | fix |
|---|---|---|---|---|---|
| R02-ONT-01 | P0 | `OntologyWorkspaceSeed.ts:53` | Any read error is treated as file absence | Transient read failure causes starter seed to replace user content | Recover only typed not-found and use atomic create-if-absent |
| R02-ONT-02 | P1 | `Session.atoms.ts:1287,1338` | SPARQL/validation can publish stale-session results | Read starts on S, mutation commits S+1, old result lands afterward | Revision-check or cancel stale read completions |
| R02-ONT-03 | P2 | `Session.atoms.ts:1385,1405,1606`; `Session.workbench.tsx:479` | Long semaphore holds create an invisible action queue | Inference/revalidation holds permit while enabled controls enqueue actions | Shorten critical section and expose pending state |
| R02-ONT-04 | P2 | `Session.atoms.ts:1493,1511,1519` | Inference failure is misreported as Open failure | File opens, inference fails, document and inference errors both appear | Separate open and inference error boundaries |

### Clean areas

- Add Triple rejects blank and whitespace-only subjects through every workbench action path inspected: `iriFieldValid` trims before schema validation, `canApplyTriple` gates the button, and `runAddTriple` repeats the guard.
- The LIMIT scanner terminates on unterminated strings, IRIs, comments, and unbalanced braces.
- Escaped characters and triple-quoted literals are skipped without treating embedded braces or `LIMIT` as syntax.
- `#` inside `<IRI>` is safe because IRI scanning begins at `<` and consumes through `>` before the inner hash is visited.
- Nested subquery limits do not suppress the outer injected limit.
- Negative or positive brace imbalance produces a conservative false negative and injected limit, rather than an unsafe false positive.
- `tapCause` does not double-set the same SPARQL, document, or validation error atom. The problematic duplication is specifically Open’s inference failure crossing into two different error channels.
- React renders SPARQL terms, validation messages, and document errors as escaped text; no raw HTML injection surface was found in scope.
- Seed and file writes use the workspace-constrained file-store path rather than arbitrary filesystem paths.


Codex session ID: 019f553c-1eb3-7c30-a222-690e820ff482
Resume in Codex: codex resume 019f553c-1eb3-7c30-a222-690e820ff482
