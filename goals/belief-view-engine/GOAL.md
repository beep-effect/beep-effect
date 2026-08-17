# GOAL: Belief View Engine — first vertical slice

> **PAUSED — queue goal.** Lifecycle is `paused` (authored-but-not-started;
> no free lane at graduation). A `/goal` launch before the roadmap pulls this
> packet must stop here and report.

Repo root: the current working directory. All paths repo-relative.

Outcome: One working belief per contention set, on demand: BeliefContentionKey v1, the total selection-policy contract, the content-addressed BeliefViewRevision with digest-encoding v1, the same-policy typed delta, and the capped, indexed scope-wide EdgeAuthority read.

The packet files are the contract: `goals/belief-view-engine/README.md`, `SPEC.md`,
`PLAN.md`, `ops/manifest.json`. Read those, then `AGENTS.md`, `CLAUDE.md`,
and the standards `SPEC.md` names. Repo standards outrank packet prose.

Scope:

- In: `packages/epistemic` domain/use-cases/server (+ its tables/db-admin migration for the new index); focused tests.
- Out: materialization/lineage (gated candidate 2), cross-policy delta, any UI, any triage change, any authority write.

Non-negotiable constraints:

1. Schema first, then `Context.Service`, then implementation. Effect v4
   validated against the Effect reference checkout, never priors.
2. `LiteralKit` for literal families; `HashMap`/`HashSet` only;
   `Effect.fn`/`Effect.fnUntraced` for generator services.
3. The MAP's adversarial amendments are binding SPEC content — do not
   regress them.
4. New concepts via `bun run beep architecture`; never `mkdir` packages.

Acceptance:

- [ ] All SPEC acceptance boxes check (replay-across-supersession is the
      load-bearing one).
- [ ] `bun run beep yeet verify` green; shipped via /yeet to mergeable.

Stop and report when:

- The digest cannot be replay-stable without storing state.
- The scope read cannot meet the cap contract under the new index.
- The same blocker repeats after reasonable investigation.
