# Boolean-Creep Eradication — ratified decisions

Ratified by Benjamin 2026-08-17 (from the three-lane sample session and the
operator-prompt grill). These are binding for the campaign; changes require a
new ratification line with a date.

1. **Qualifier**: cardinality gap + cited evidence class (E1–E4), never bare
   count; scanner net ≥2 booleans/scope. Rejected: ≥3 threshold (misses the
   `{loading,error}` pair), ungated ≥2 (floods design with D1 false positives).
2. **Sweep scope**: types/interfaces + `S.Struct` + React props/sibling state.
   Rejected for this campaign: function flag params (different refactor shape),
   driver wire shapes (transformation-risk class, census only).
3. **Target shape**: per-instance taxonomy (literalkit / tagged-union /
   option-literal). Rejected: TaggedUnion-everywhere — violates the LiteralKit
   repo law; sample showed ~10 of 12 instances want literals, not unions.
4. **Venue**: Fable orchestrates; grok CLI inventory, codex Sol medium
   design/apply, Fable review. Rejected: claudex Workflow venue (loses
   independent Fable judgment). Note "grok-build" is not an agent type — it was
   always a session/CLI lane.
5. **Artifacts**: goal packet `goals/boolean-creep/` with schema-validated
   JSONL inventory (jsdoc-carrier-migration precedent). Rejected: loose
   `.beep/` files, exploration-packet ceremony.
6. **Gates**: two user gates — inventory ratification before design; design
   ratification before apply. Rejected: fully autonomous run.
7. **Corpus**: `packages/**/src` + `apps/**/src`, excluding tests/generated/
   labs/scratchpad/.repos. Sample: ~80 raw clusters, dominant mass D1/D2
   config/wire; expected confirmed inventory 15–30.
8. **Landing**: risk-tiered batched PRs (Tier 1 internal/derived by package;
   Tier 2 persisted/wire one-PR-each with encoded-compat proof). Rejected: one
   campaign PR, per-instance PRs.
9. **Operator prompt**: crisp operator prompt; essay intro dropped (write the
   blog post from the packet's evidence afterwards, if wanted).

## Gate rulings

- **GATE 1 (2026-08-17): Benjamin ratified all 46 confirmed instances.** No
  strikes, no demotions, Tier 2 not parked. P2 design is authorized for the
  full confirmed inventory.

## Evidence classes (gate)

A suspect is CONFIRMED only with at least one cited evidence class, proven by
reading the surrounding code (file:line proof in the inventory entry):

- **E1 exclusive-write** — a write site sets one flag true and siblings false
  in the same operation.
- **E2 exclusive-read** — `if/else-if` or match over the flags that never
  handles a combined-true case.
- **E3 flag↔payload** — a boolean duplicating a sibling field's presence
  (`{ isError: boolean, error?: E }`).
- **E4 phase implication** — ordered flags where one implies another
  (`finished ⇒ started`): a state machine flattened into bits.

Disqualified (recorded for the census, never designed against):

- **D1 independent flags** — all `2^n` combos legal: config toggles,
  permissions, independently observed facts.
- **D2 encoded/wire mirror** — the shape mirrors an external SDK/DB/API
  contract at a driver boundary.

## Design law riders

- `derived` instances (parallel booleans projected from ONE upstream source —
  an AsyncResult, a date, draft strings) are fixed by deriving a single literal
  (or keeping the source type in the view), never by inventing stored state.
- Every design must include **guard-deletion accounting**: the runtime
  coherence checks, if-chains, legacy normalizers, and comment-only invariants
  the new type deletes (crispen doctrine). A design that deletes nothing is
  suspect — the instance was misqualified or the design missed the point.
- All PRs through yeet; commit messages cite the `boolean-creep` slug;
  **never merge — Benjamin merges.**
