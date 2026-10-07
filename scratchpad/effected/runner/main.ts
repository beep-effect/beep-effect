/**
 * The `audit:effected` command surface (goal section 8), built on
 * `effect/cli` and run on the Bun runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime, BunServices } from "@effect/platform-bun";
import * as A from "effect/Array";
import { Argument, Command, Flag } from "effect/cli";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Audit, AuditLive } from "./Audit.service.ts";
import { AUDIT_TARGETS, MODULE_NAMES, Stage } from "./Ledger.schema.ts";

const moduleArgument = Argument.Literals("module", MODULE_NAMES);
const targetArgument = Argument.Literals("target", AUDIT_TARGETS);
const decodeStage = S.decodeUnknownEffect(Stage);

const copy = Command.make("copy", { module: moduleArgument }, ({ module }) =>
  Effect.gen(function* () {
    const audit = yield* Audit;
    const report = yield* audit.copy(module);
    yield* Console.log(
      `[effected] ${module} copy: ${report.sourceFiles} source file(s), ${report.testFiles} test file(s), ${report.fixturesBytes} fixture byte(s), ${report.exportsExpected} expected export(s), deps ${A.join(report.newDeps, ",") || "none"}, ${report.notices} header notice(s)`
    );
  })
).pipe(Command.withDescription("S0: copy a module verbatim from upstream and fill its ledger row"));

const parity = Command.make(
  "parity",
  { module: moduleArgument, strict: Flag.Boolean("strict").pipe(Flag.withDefault(false)) },
  ({ module, strict }) =>
    Effect.gen(function* () {
      const audit = yield* Audit;
      const report = yield* audit.parity(module, strict);
      yield* Effect.forEach(report.added, (entry) => Console.log(`  added: ${entry.entry} ${entry.name} (${entry.kind})`));
      yield* Effect.forEach(report.unsafe, (line) => Console.log(`  unsafe: ${line}`));
    })
).pipe(Command.withDescription("Export parity, foreign specifiers and D15 assertions"));

const check = Command.make("check", { target: targetArgument }, ({ target }) =>
  Effect.flatMap(Audit, (audit) => audit.check(target))
).pipe(Command.withDescription("tsgo: zero TypeScript and Effect diagnostics"));

const lint = Command.make("lint", { target: targetArgument }, ({ target }) =>
  Effect.flatMap(Audit, (audit) => audit.lint(target))
).pipe(Command.withDescription("oxlint plus the effect-imports, effect-fn, terse-effect and native-runtime laws"));

const test = Command.make(
  "test",
  { target: targetArgument, coverage: Flag.Boolean("coverage").pipe(Flag.withDefault(false)) },
  ({ target, coverage }) => Effect.flatMap(Audit, (audit) => audit.test(target, coverage))
).pipe(Command.withDescription("Node vitest through the shared effected config"));

const docgen = Command.make("docgen", { target: targetArgument }, ({ target }) =>
  Effect.flatMap(Audit, (audit) => audit.docgen(target))
).pipe(Command.withDescription("docgen with every enforcement flag, then doctest verify"));

const audit = Command.make("audit", { target: targetArgument }, ({ target }) =>
  Effect.flatMap(Audit, (service) => Effect.asVoid(service.audit(target)))
).pipe(Command.withDescription("Every gate in order for the target's stage; stops at the first red"));

const ledger = Command.make(
  "ledger",
  {
    init: Flag.Boolean("init").pipe(Flag.withDefault(false)),
    show: Flag.Boolean("show").pipe(Flag.withDefault(false)),
    verify: Flag.Boolean("verify").pipe(Flag.withDefault(false)),
    set: Flag.Boolean("set").pipe(Flag.withDefault(false)),
    block: Flag.Boolean("block").pipe(Flag.withDefault(false)),
    note: Flag.Boolean("note").pipe(Flag.withDefault(false)),
    add: Flag.Boolean("add").pipe(Flag.withDefault(false)),
    finding: Flag.String("finding").pipe(Flag.optional),
    rest: Argument.String("args").pipe(Argument.variadic),
  },
  ({ init, show, verify, set, block, note, add, finding, rest }) =>
    Effect.gen(function* () {
      const service = yield* Audit;
      const moduleAt = (index: number) =>
        S.decodeUnknownEffect(S.Literals(MODULE_NAMES))(rest[index]).pipe(
          Effect.mapError(() => new Error(`ledger: expected a module name at position ${index + 1}, got ${rest[index] ?? "nothing"}`))
        );
      if (init) {
        const created = yield* service.ledgerInit;
        return yield* Console.log(`ledger: initialized ${created.rows.length} rows at ${created.effectedCommit}`);
      }
      if (verify) {
        const report = yield* service.ledgerVerify;
        return report.ok ? undefined : yield* Effect.fail(new Error("ledger: not complete"));
      }
      if (set) {
        const module = yield* moduleAt(0);
        const stage = yield* decodeStage(Number(rest[1])).pipe(
          Effect.mapError(() => new Error(`ledger: expected a stage 0..5, got ${rest[1] ?? "nothing"}`))
        );
        const row = yield* service.ledgerSet(module, stage, A.join(A.drop(rest, 2), " "));
        return yield* Console.log(`ledger: ${row.id} now at stage ${row.stage} (${row.status})`);
      }
      if (block) {
        const module = yield* moduleAt(0);
        const row = yield* service.ledgerBlock(module, A.join(A.drop(rest, 1), " "), O.toArray(finding));
        return yield* Console.log(`ledger: ${row.id} blocked at stage ${row.stage}`);
      }
      if (note) {
        const module = yield* moduleAt(0);
        const row = yield* service.ledgerNote(module, A.join(A.drop(rest, 1), " "));
        return yield* Console.log(`ledger: ${row.id} noted (${row.notes.length} notes)`);
      }
      if (add) {
        const module = yield* moduleAt(0);
        const row = yield* service.ledgerAdd(module);
        return yield* Console.log(`ledger: ${row.id} registered with ${row.exportsExpected.length} expected export(s)`);
      }
      void show;
      const module = A.isNonEmptyReadonlyArray(rest) ? O.some(yield* moduleAt(0)) : O.none();
      return yield* service.ledgerShow(module);
    })
).pipe(
  Command.withDescription(
    "--init | --show [module] | --verify | --set <module> <stage> [note...] | --block <module> <reason...> [--finding id] | --note <module> <text...> | --add <module>"
  )
);

const root = Command.make("audit:effected").pipe(
  Command.withDescription("Gates and ledger of the @effected/* port lab (scratchpad/EFFECTED_PORT_GOAL.md)"),
  Command.withSubcommands([copy, parity, check, lint, test, docgen, audit, ledger])
);

/**
 * Runs the CLI with the Bun platform services and the live runner.
 *
 * **Example** (Reference the entry point)
 *
 * ```ts
 * import { main } from "@beep/scratchpad/effected/runner/main"
 *
 * console.log(typeof main) // "function"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const main = (): void =>
  BunRuntime.runMain(
    Command.run(root, { version: "0.0.0" }).pipe(
      Effect.provide(AuditLive.pipe(Layer.provideMerge(BunServices.layer)))
    )
  );
