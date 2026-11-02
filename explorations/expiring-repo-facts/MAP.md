# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `hold-ledger` | Record every dependency-shaped temporary decision as a probe-backed hold on the claim envelope. Derive the configs from the ledger. Re-check holds in `deps:update`. Renew only with fresh evidence. | none | Reuse `makeClaimEnvelope` (`packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts`). Follow the research ledger laws (`research/README.md`). Repo CLI command groups (`packages/tooling/tool/cli/src/commands/`). `syncpack.config.ts`. `osv-scanner.toml`. Root `package.json` `deps:update`. The manual register `goals/repository-simplification-residue/history/receipts/hold-register.md`, to migrate. The `HoldProposition` schema, `beep holds` commands and the `lint --write` renderer are NET-NEW. |
| `wake-service` | An Effect port of skulk: durable watches (timer, npm, gh-run, pr-checks) on a workstation daemon. Wakes are delivered once through the agent-message router to the live orchestrator. When none is live, a dispatcher launches a hold lane through the quota-only fallback chain. | `hold-ledger` (first producer) | Reuse the agent-message router (`packages/tooling/tool/cli/src/commands/AgentMessage/`). Reuse the provider session adapters (`@beep/ai-provider-cli`, `packages/drivers/ai-provider-cli/src/AiProviderCliSession.*.service.ts`). Extend the systemd unit rendering (`packages/tooling/tool/cli/src/commands/Research/`, `docs/runbooks/systemd-timers.md`). Follow the agent-pool pins (`docs/runbooks/agent-pools.md`). Port with attribution from kitlangton/skulk (MIT). The new tooling library, reconciler, dispatcher and dead-man workflow are NET-NEW. |

## Gated Re-entry Points

These stay in this MAP. When a gate fires, the exploration reopens at
`decompose`.

- **Junie adapter.**
  - Gate: the dispatcher's first real lane, with JetBrains credits left in the
    cycle.
  - Change: add a Junie session service to `@beep/ai-provider-cli`.
  - Until then the dispatcher starts at the fallback chain.
- **Wave 2: test skips.**
  - Gate: `hold-ledger` completed-retained, with at least one probe-driven
    unpin merged.
  - Change: anchor `it.skip`, `describe.skip` and `it.todo` with a
    `[hold:<id>]` title, plus a GritQL rule.
- **yeet and orchestrator wait adoption.**
  - Gate: `wake-service` completed-retained.
  - Change: move `yeet monitor`, `job wait` and orchestrator sleeps onto
    watches.
- **`llm-runtime-dispatch`.**
  - The dispatcher is that candidate's first consumer, so its demand gate in
    `explorations/multi-provider-llm-dispatch-fallback` fires when
    `wake-service` reaches the dispatcher phase.
  - Reopen that packet then. Don't build a parallel dispatch policy.

## Sequencing

1. **`hold-ledger` first.**
   - The wake service needs something to wake for.
   - The ledger alone already pays off through `deps:update` and
     `lint --write`.
   - Order: the jsdom slice, then the wave 1 migration of the register's
     rows, then the `deps:update` re-check.
2. **`wake-service` second.** Order:
   - the schema-first `Condition` and `Watch` records, plus the engine's
     check rules;
   - timer and npm triggers, with router delivery to the orchestrator;
   - the reconciler over live holds;
   - gh-run and pr-checks triggers;
   - the dispatcher, then the daemon unit and the dead-man workflow.

## First Vertical Slice

The jsdom hold, end to end, in `hold-ledger`:

- **Schema.** A `HoldProposition` schema, instantiated with
  `makeClaimEnvelope`.
- **Record.** One hand-written jsdom record carrying:
  - the subject (`jsdom`, pinned at 30.0.1);
  - the falsifier: a Scripted probe with a pinned `vitest --bun` runtime and
    the recorded `EventTarget` failure signature;
  - the watch targets: npm `jsdom` latest, and the vitest release feed;
  - a deadline.
- **Probe command.** `beep holds probe jsdom-vitest-eventtarget` builds a
  scratch install under `~/.cache/beep/`. It runs the control at 30.1.0, which
  must reproduce the signature, and the candidate at npm latest. It prints
  `StillHolds`, `Flipped` or `ProbeBroken`.
- **Derived config.** syncpack's held list is derived from the ledger, and
  `syncpack lint` passes byte-identical before and after.
- **Proof:**
  - the probe command's receipts on today's versions;
  - a unit test of the verdict rules (control pass gives `ProbeBroken`; one
    pass is not a flip);
  - `beep holds lint` failing when a syncpack entry has no record.

## Open Risks Inherited From The Brief

- A probe that has rotted can look like a fix. The control run, the pinned
  runtime and the two-pass rule are acceptance criteria, not options.
- Probes must resolve Bun `catalog:` references themselves.
- Lockstep families (`@lexical/**`, tsgo with tsrs) need group subjects and
  group probes.
- A Judgement hold's renewal needs a diff-bound judge verdict, not a free
  "still true".
- GritQL can't do the completeness join. It is a TypeScript census in
  `beep holds lint`.
- The dispatcher must not become a second orchestrator. It launches only hold
  lanes, under the standard pins and gates.
- Daemon outages are silent without the dead-man check.
