# GOAL: Route verification by change kind, proven by replay

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: given a change, run only the checks its kind can affect, cheapest
first, with a total footprint record keyed by `CiLaneId`, `classify` and
`route` in repo-cli, `beep ci route plan|census|replay` over a digest-pinned
corpus of hosted heads, at least one refinement enforced in `yeet final-check`
by mutation fixture plus 100% replay recall, its file-grain half compiled into
turbo inputs, and hosted lanes completing `skip-satisfied` with a receipt.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/verification-route/README.md`
- `goals/verification-route/SPEC.md`
- `goals/verification-route/PLAN.md`
- `goals/verification-route/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the effect-first,
schema-first and yeet skills, and the exploration's `DECISIONS.md`
(`explorations/verification-route`, 16 rulings). Higher-priority repo standards
outrank packet prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Ci/**` (schemas, record,
  classify, route, corpus fetch, `beep ci route`), `commands/Yeet/internal/
  FinalCheck*.ts` (receipt, shadow, enforcement), `turbo.json` and package-local
  `turbo.json` (layer 1), the prepare-phase projection writer and its tracked
  generated files, `.github/workflows/heavy.yml` (slice 3), this packet.
- Out: `goals/time-to-certainty/**`, `ProofFact.ts`, `ProofDigest.ts`,
  `WaveOrder` ordering, the ontology tree, `apps/labs/ciops`, rulesets,
  scheduler and locks, any measurement window or sample-size gate.

Workflow:

1. P0 slice 1: schema → `Context.Service` → implementation; the record at
   `unknown` everywhere; `classify` total; `route` = `WaveOrder.order(Required)`;
   corpus fetch pinned and resumable; census and replay printed. One PR.
2. P1 slice 2: refine in census rank, each with fixtures and 100% recall;
   compile file/field-grain rows to turbo inputs plus root `package.json`
   projections (negation never lands without the `scripts` projection); sweep
   package-local `turbo.json`; final-check shadow then enforced. One PR.
3. P2 slice 3: `HeavyAdmission` per lane; job starts, routes, completes
   `skip-satisfied` with the receipt; contexts unchanged. One PR.
4. Preserve unrelated worktree changes; tie decisions to evidence; record
   friction receipts as they happen; `package-verify @beep/repo-cli` before
   any handoff.
5. At Close, write the reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied, slice 1 at minimum (the
      census is the cut line).
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/verification-route/GOAL.md)" -le 4000
jq . goals/verification-route/ops/manifest.json
git diff --check -- goals/verification-route
bun run beep quality package-verify @beep/repo-cli
```

Decide schema, generated-file, workflow and turbo-config changes yourself when
the goal needs them: record each in SPEC.md's Decision Log with its reason and
how to reverse it, then continue. Escalate only what AGENTS.md "Autonomy"
lists.

Ship proposedCloseout and the reflection in the final implementation PR while
initiative.status stays active or paused. A proposal never reports achievement.
Done only when exact-head hosted readiness and merge evidence verify the proposal
through `bun run beep goals completion refresh --slug verification-route`, or
when a blocker that needs the operator is reported with file/command evidence.
