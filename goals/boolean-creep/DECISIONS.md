# Boolean-Creep Eradication — ratified decisions

> Routing update (2026-09-09): new token-heavy Codex work uses `gpt-6-astra`
> with `medium` reasoning, per [root agent guidance](../../AGENTS.md#token-heavy-codex-work).
> This supersedes earlier model/effort choices below for future work. Completed
> runs retain their recorded provenance; lightweight and Grok routes retain
> their intended roles.

Ratified by Benjamin 2026-08-17 (from the three-lane sample session and the
operator-prompt grill). These are binding for the campaign; changes require a
new ratification line with a date.

Benjamin ratified the following narrow campaign amendment on 2026-09-03 after
reviewing the current-state audit. It supersedes the original two-gate cadence
only for completing this already-started campaign; it is not a standing
autonomy exception for other goals.

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
- **CURRENT-CORPUS AMENDMENT (2026-09-03): Benjamin ratified a bounded
  completion mandate against moving `origin/main`.** Revalidate the original
  46 records, admit every newly introduced current-corpus case that satisfies
  E1-E4, repair stale or incomplete designs against live source, independently
  review 100% of qualified evidence and designs, and apply reviewed designs
  without returning for another user decision. The original corpus boundary,
  exclusions, evidence gate, cardinality proof, target-shape law,
  guard-deletion accounting, architecture checks, compatibility requirements,
  and independent review remain binding. Function parameters remain out of
  scope; driver wire mirrors remain D2 census records.
- **GATE 2 (delegated transition, 2026-09-03):** the prior zero-findings claim
  is revoked. GATE 2 passes under Benjamin's delegated authority only when the
  refreshed exact-source inventory, corrected designs, and a replacement
  zero-finding independent-review receipt are complete. Qualified records may
  advance `confirmed -> designed -> reviewed` under that mandate without
  reopening GATE 1 or requesting another Benjamin decision.
- **Completion ruling (2026-09-03):** locally verified or merge-ready work is
  insufficient. Every implementation and the final closeout PR must be merged
  to `main`; the agent publishes and closes review through Yeet but never
  merges. Final acceptance also requires two consecutive no-new-qualified
  census rounds against the merged exact `main` head.

## 2026-09-03 execution riders

- Preserve schema version `boolean-creep-inventory/v1`. Archive the pre-refresh
  inventory and superseded review receipt under `history/`; keep stable ids for
  surviving file-and-symbol pairs. Historical records removed from the live
  census remain in the archived snapshot rather than gaining a new `retired`
  status.
- Resolve `origin/main` immediately before every census, review, verification,
  and publish operation. Merge it forward; do not rebase. Every census and
  review receipt records its exact source SHA.
- Tier 2 transformations preserve encoded property names, values, defaults,
  accepted legitimate inputs, persisted artifacts, and CLI/MCP/RPC behavior.
  Honest decoded unions or literals live behind those compatibility codecs.
- Exported decoded TypeScript shapes may migrate atomically inside the repo.
  Update every known consumer in the same PR and remove never-shipped,
  zero-consumer exports; do not add aliases unless an encoded or actually
  supported external contract requires them.
- The corrected historical baseline is 40 Tier 1 and 6 Tier 2 records before
  newly admitted cases. `ontology-inference-recompute-cause`,
  `runners-bake-freshness`, and `yeet-status-remote-check-phase` are Tier 2.
- The DMS internal connection union lands before the Vault compatibility codec;
  the first change temporarily projects the union to the existing Vault wire
  fields. `nlp-mcp-file-info-exists` normalizes `exists: false` plus stale
  statistics to the missing case, but rejects `exists: true` with missing or
  partial statistics.
- Gesture-bearing UI migrations require successful recorded `browser-qa-loop`
  record, extract, and judge evidence with `requiredCount: 0`, in addition to
  focused unit and component tests.
- The final closeout runs the `reflect` skill, transitions the canonical goal
  status to `completed-retained`, and permits the required ignored local
  Goals-index projection refresh without staging that projection.
- Keep `@beep/chalk` in its current capability package and repair its README's
  named-consumer placement proof when that package is touched. Record the
  pre-existing ontology `/public` export-boundary drift as a separate
  architecture opportunity; do not expand this campaign into that rewrite.

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
