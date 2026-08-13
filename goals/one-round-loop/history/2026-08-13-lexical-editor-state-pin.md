# Ledger: Lexical editor-state property pin (#663)

Nightly property-law sweep (runs
[31480996116](https://github.com/beep-effect/beep-effect/actions/runs/31480996116)
and
[31586894585](https://github.com/beep-effect/beep-effect/actions/runs/31586894585))
timed out at 300s on:

- `packages/foundation/modeling/lexical/test/Lexical.model.test.ts`
  `round-trips schema-derived arbitrary editor states through encode/decode`
- `packages/foundation/modeling/lexical/test/Lexical.codec.test.ts`
  `projects schema-derived arbitrary editor states onto valid Md documents (totality)`

Cause: `fcRuns(50)` is env-raisable, so `BEEP_FC_NUM_RUNS=1000` expanded
unbounded `SerializedEditorState` trees 20× past the sweep timeout. No
counterexample — wall-clock only.

Disposition (SPEC stop condition: seed-exclude with a ledger note): both
sites now pass a hard `{ numRuns: 50 }` instead of `fcRuns(50)`. That is
the original inline floor and is not env-raised. Remove the pin when a
size-bounded `StateArbitrary` can finish 1000 runs inside 300s.
