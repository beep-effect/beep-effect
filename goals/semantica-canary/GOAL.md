# GOAL: run the Semantica canary in a headless lab

Repo root: the current working directory. All paths are repo-relative.

Outcome: a headless-first Tauri lab (the future apps/labs/semantica) runs the
staged canary C0 → C1 → C2 over F1 + W1 under the probe breaker, emitting
replay-identical `EvalReport`s; each passing stage flips its families from
park-pending-canary to a verdict in the exploration's `DECISIONS.md`.

Read these as the contract:

- `goals/semantica-canary/{README,SPEC,PLAN}.md`
- `goals/semantica-canary/ops/manifest.json`
- `goals/semantica-canary/research/SOURCES.md`
- `explorations/semantica-lab/{BRIEF,MAP,DECISIONS}.md` (Current law table
  and M1-M6 win over any prose)
- `explorations/semantica-lab/research/{shared-schema,workload-contract}.md`

Then `AGENTS.md`, `CLAUDE.md`, `standards/architecture/15-lab-apps.md`, and
the skills `SPEC.md` names.

Scope:

- In: the lab (fixtures, W1 manifest, lab-local schemas, services, Layers,
  tests, headless entry and runtime layer); this packet's evidence; family
  verdicts in the exploration's `DECISIONS.md`; final park/drop atlas values.
- Out: every `SPEC.md` non-goal — window/sidecar/UI, local models,
  consumption-side retrieval, atlas backlog, NET-NEW reasoning runtime,
  reusable lab exports, brick fixes outside cleanup-on-touch.

Execution:

1. P1 step 1 on its own PR: mint with
   `bun run beep create-package semantica --type app --app-kind tauri --lab --description "..."`,
   run one local `cargo check`, freeze `src-tauri`, hand-write server/main.ts +
   src/runtime/Layer.ts per Professional Desktop's split. Then F1 fixtures +
   the W1 manifest (first 25 of the 76 on-disk PDFs by id; sha256 + bytes) +
   `gold/v1`.
2. P2 C0: first vertical slice (F1 + one G-relation paper, live then
   `--offline`), then all three G-relation papers, then the R2 gate (5). Schemas
   first, then `Context.Service` contracts, then first-probe Layers.
3. P3 C1 only after the sibling `openai-driver` packet is merged: vector table
   + RDF rebuild; `G-projection` expectations first, then rebuild identity;
   alternate-dimension fixture; then the R2 gate.
4. P4 C2: ρdf closure + EYE oracle, crash injection, Tier-L bars read from
   the live run's `EvalRunTelemetry`; then the R2 gate.
5. R2 gate before any verdict: full W1 (25 papers) + F1 live then
   `--offline`, equal `reportDigest`s, zero unexpected typed-degraded document
   failures (F1 malformed specimens degrade as declared; a W1 paper degrading
   fails). Then write the verdict entry to `DECISIONS.md` before touching the
   atlas. Yeet each stage to `merge-ready: yes`.
6. P5: `/reflect`, evidence under `history/`, state flip in the final PR.

Non-negotiable:

- `CanonicalText` = `ResolvedSourceText`; spans = `TextAnchor`; every span
  passes `verifyTextAnchor`. No loss map.
- The provider cache is the determinism; network-off replay must reproduce
  the `reportDigest` (telemetry sidecar excluded). Typed degraded states,
  never success-shaped fallbacks.
- Gold proposer's provider family ≠ extractor's (schema refinement).
- Dimension-keyed vectors; no DDL names a dimension; no id brand truncates.
- Closure equality + per-event rule validation at C2, never premise-set
  identity. EYE is an oracle, not the runtime.
- `HashSet`/`HashMap`, `Effect.fn`, decode at boundaries, Effect v4 verified
  against the reference checkout.

Acceptance: every `SPEC.md` criterion, all `ops/manifest.json`
`verificationCommands` green, no unrelated churn.

Stop on the probe breaker (first probe, one retry, then park and drop the
exploration to `decompose`) — never on a calendar; on any No-Go crossing; on
an unmeasurable pass criterion; on an atlas write before its stage passes.
