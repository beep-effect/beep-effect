# GOAL: Build the agent memory store as a fact log with projections

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the agent memory store the 2026-11-09 memory-architecture decision
licenses exists and reconciles the Claude Code memory folder: a set-union log
of immutable node events is the sole authority; Markdown memory files and
every index are rebuildable projections; agent writes are admitted store-side
with no CRDT merge; prevalence is an observation log that never ranks or
gates. Every spike measurement in `SPEC.md` is a green named test.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/agent-memory-store/{README,SPEC,PLAN}.md`
- `goals/agent-memory-store/ops/manifest.json`
- `goals/agent-memory-store/research/2026-11-08-validation-scoreboard.md`

Read those first, then `AGENTS.md`, `CLAUDE.md` and
`standards/memory-architecture/04-decision-log.md` (2026-11-09 entry); repo
standards outrank packet prose. Decide API, schema and dependency changes
yourself, each as a decision file with reason and reversal.

Scope:

- In: one new store package (created only via `bun run beep create-package`
  after P0's routing decision), a planned `memory` command family on
  `@beep/repo-cli`, SQLite access through the driver family, status notes in
  `standards/memory-architecture/`, an operator runbook, synthetic or
  `goals/**`-derived fixtures.
- Out: everything `SPEC.md` "Non-Goals" lists.

Workflow:

1. P0 first: confirm or reverse the six packet-decidable items in `SPEC.md`
   "Resolved Design Items for P0" by decision file; route the package home by
   specific-home-first; land schemas, then `Context.Service` contracts.
2. Follow `PLAN.md` phase order: log and L0 projection, admission, identity
   and observation, retrieval, agent loop. A phase opens only when the
   previous phase's bars are green on `main`.
3. Validate every Effect API against `.repos/effect`; `effect/HashMap` and
   `HashSet`, never `Map` or `Set`; `Effect.fn`; `LiteralKit`.
4. Each acceptance criterion is a test titled with its id (`AC-1` to `AC-8`).
   A missed bar is fixed on the current route or re-baselined by a decision
   file citing a new measurement; never a silent threshold edit.
5. One PR or stack per phase through `bun run beep yeet` (`final-check` before
   `ready`); at most three open; `quality package-verify <pkg>` before every
   handoff; `bun run beep knowledge refs --check` must stay clean (no `~`
   paths in tracked docs).
6. In the final PR (P6), write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria AC-1 to AC-9 are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/agent-memory-store/GOAL.md)" -le 4000
jq . goals/agent-memory-store/ops/manifest.json
git diff --check -- goals/agent-memory-store
bun run beep goals decisions check --slug agent-memory-store
```

Ship proposedCloseout, the gating `yeet-verdict` and the reflection in the
final PR (status stays active or paused). After that merge, verify with `bun run beep goals completion refresh --slug agent-memory-store`,
then adopt with `bun run beep goals set-status agent-memory-store <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/agent-memory-store/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
