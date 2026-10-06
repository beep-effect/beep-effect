# Session ledger main-delta repair — 2026-10-06

Main commit `6f0cbeb021` added `session-ledger.test.ts` after this goal's
frozen CLI inventory. On the rebased follow-up branch, `beep lint
effect-vitest` reported ten introduced rows from that file. The original
source-bound rows were captured before repair. Source fix
`1ab5877e5e1e14c72a2c067795c11c494290c7d3` moves the harness test to `it.effect`, runs the four native
service and command cases under a fresh `it.layer`, and asserts harness
fields directly. The nine-case suite passes on Node and Bun.

Seven original findings are fixed (four EV002 layer-provision calls and
three EV006 object assertions). The current detector retains three reviewed
exceptions: a short acquired/released process-cwd override (EV003), a scoped
native Git clone and linked worktree (EV004), and NodeServices for real Git and
filesystem semantics (EV010). The original ten rows and two additional
current identities remain in the CLI detector ledger. The current baseline
adds the three reviewed exceptions, moving from 1,929 to 1,932. This is a
bounded integration of the new main delta, not the complete P1 human-lens
review. Full combined `@beep/repo-cli` package verification passed on the
current source (audit 704.0 seconds; docgen 25.6 seconds). Hosted checks
remain pending.

The same main commit added three exported pure-data interfaces that failed
`lint:schema-first` on this branch. `StateRepository`,
`SessionCheckoutFacts`, and `SessionNoteInput` are now annotated `S.Struct`
values with derived types. They remain structural because generic state
helpers and command callers exchange plain objects; three reviewed
class-preference exceptions are recorded in the schema-first inventory.
The JSON Lines decoder now returns an internal annotated `S.Class` for its
row/count result, eliminating the new inline-contract advisory. A full
package audit passed on this exact source with the combined CLI changes.

PR #1460 review found two service-case temporary directories that survived
their test scopes. Both now use `makeTempDirectoryScoped()`; the focused
nine-case suite passes on Node and Bun. The inventory location review was
answered without changing source-bound identities: the recorded host
`provideScopedLayer` remains at line 1239 and the session `assertTrue`
was at line 199 when the review was answered. The other read-back call is a
separate occurrence. Subsequent test-project typechecking found an Effect
pipeable-form diagnostic on that assertion; replacing it with canonical
`assertNone(unknown.sessionId)` preserved the expectation and fixed the
historical EV006 row. The current test-project typecheck now passes.
