# @beep/docket-intake

Runnable home of the docket intake service (goal packet
`practice-docket-intake`). The app owns no docketing logic: it reads the
environment, composes layers and runs `poll`, `run` and `smoke`.

## Surface

- This app publishes no `@beep/docket-intake` source exports — do not add package root exports or docgen unless it is intentionally converted to a runtime proof package.
- `src/Config.ts` reads the environment; `src/runtime/Layer.ts` holds the live
  wiring; `src/Cycle.ts` is the poll cycle; `src/Smoke.ts` is the live
  connection check; `src/Commands.ts` builds the commands over injected
  wiring; `src/Main.ts` binds them to the live wiring; `src/bin.ts` only runs
  `main`.
- Tests run the commands over the real pipeline with in-memory ports
  (`test/support/`). Keep `src/bin.ts` to its one statement: it is the only
  line the tests cannot reach.
- The pipeline is `@beep/law-practice-use-cases/DocketIntake`; its adapters
  are `@beep/law-practice-server/DocketIntake`. Change behavior there.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this app; record only genuinely app-specific deltas here.
- No date logic here. The only date the app derives is today's practice day.
- Logs and spans carry ids, counts and stage names only. Fixtures are
  synthetic (`*.invalid` hosts, `FIX-0001` style references).
- Never run `smoke --write`, `poll` or `run` against a live mailbox from an
  agent session unless the operator asked for that run.
