# Desktop residual scope, Result, and module-mock judgments

Four remaining detector candidates are intentional boundaries, now recorded
with specific reasons in the root inventory and Desktop detector ledger.

## Tauri acquisition failure scope

The socket service already belongs to public it.layer. Its failing reader
acquisition has a deliberately shorter scope, closed before Effect.flip exposes
the error for inspection. A temporary control made the first listener register
and the second registration fail, then required the first unlisten callback to
have run before the error assertions. The scoped case passed; removing only the
short scope failed that count assertion. Both probe variants were removed.
This is distinct from the neighboring test that closes a reader scope before
joining a suspended pull; the finding here concerns partial acquisition cleanup.

## Contradiction seed failure outcomes

Both conflict tests intentionally capture Effect.result, assert the failed
branch, assert the ContradictionQaSeedError family and exact conflict reason,
and continue with file-preservation and database assertions. Their contract
requires those post-failure observations. A complete expected error payload is
not supplied by the original tests and should not be invented just to use a
payload-equality helper. The prior source-conflict wrong-error-family control
is recorded in desktop-seed-error-family-proof.md. No outcome assertion is
removed or weakened by these judgments.

## Chat UI toast mock

The React component imports the imperative toast.error module export directly.
The hoisted Vitest mock observes that external UI side effect while the actual
component and atoms run. An Effect Layer does not replace that module export.
The real tests assert the safe message and clearing of the error atom. The
existing serial-suite change and cleanup/clearAllMocks ownership are proven in
desktop-chat-ui-concurrency-proof.md. Retain the module mock at this boundary.

Node and Bun each passed eighteen Tauri/chat-UI cases and all four seed
integration cases. The only source change in this batch is the separate IPC
public fixture migration; these three files retain their original test bodies.
The four remaining open live detector candidates are ontology HTTP resource
wrapper calls, which still require implementation review. This is not final
Desktop lens-ledger reconciliation or completion.
