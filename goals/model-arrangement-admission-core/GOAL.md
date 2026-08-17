# GOAL: Model Arrangement Admission Core — first vertical slice

> **PAUSED — queue goal.** Lifecycle is `paused` (authored-but-not-started;
> no free lane at graduation). A `/goal` launch before the roadmap pulls this
> packet must stop here and report.

Repo root: the current working directory. All paths repo-relative.

Outcome: Content-addressed model-arrangement identity, qualification evidence, and five-status immutable dispositions with a two-axis as-of eligibility query — proven by admitting the repo's live chat arrangement as a restricted fixture.

The packet files are the contract: `goals/model-arrangement-admission-core/README.md`, `SPEC.md`,
`PLAN.md`, `ops/manifest.json`. Read those, then `AGENTS.md`, `CLAUDE.md`,
and the standards `SPEC.md` names. Repo standards outrank packet prose.

Scope:

- In: `packages/agents` domain/use-cases/server (+ tables/db-admin migration); the server-side fixture builder; focused tests.
- Out: eval-harness authoring (gated candidate 2), runtime enforcement wiring (gated candidate 3), any requalification automation, any UI.

Non-negotiable constraints:

1. Schema first, then `Context.Service`, then implementation. Effect v4
   validated against the Effect reference checkout, never priors.
2. `LiteralKit` for literal families; `HashMap`/`HashSet` only;
   `Effect.fn`/`Effect.fnUntraced` for generator services.
3. The MAP's adversarial amendments are binding SPEC content — do not
   regress them.
4. New concepts via `bun run beep architecture`; never `mkdir` packages.

Acceptance:

- [ ] All SPEC acceptance boxes check (digest stability and no-inheritance
      are the load-bearing pair).
- [ ] `bun run beep yeet verify` green; shipped via /yeet to mergeable.

Stop and report when:

- The component set cannot close without digesting volatile runtime state.
- Eligibility cannot derive from immutable records alone.
- The same blocker repeats after reasonable investigation.
