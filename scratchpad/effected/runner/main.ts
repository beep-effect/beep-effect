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
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CliUsageError, LedgerIncomplete } from "./Audit.errors.ts";
import { Audit, AuditLive } from "./Audit.service.ts";
import { AUDIT_TARGETS, MODULE_NAMES, ModuleName, Stage } from "./Ledger.schema.ts";
import { AppendField } from "./LedgerStore.ts";

const moduleArgument = Argument.Literals("module", MODULE_NAMES);
const targetArgument = Argument.Literals("target", AUDIT_TARGETS);
const decodeModule = S.decodeUnknownEffect(ModuleName);
const decodeStage = S.decodeUnknownEffect(S.FiniteFromString.pipe(S.decodeTo(Stage)));

const copy = Command.make("copy", { module: moduleArgument }, Effect.fnUntraced(function* ({ module }) {
    const audit = yield* Audit;
    const report = yield* audit.copy(module);
    const deps = A.isReadonlyArrayNonEmpty(report.newDeps) ? A.join(report.newDeps, ",") : "none";
    yield* Console.log(
      `[effected] ${module} copy: ${report.sourceFiles} source file(s), ${report.testFiles} test file(s), ${report.fixturesBytes} fixture byte(s), ${report.exportsExpected} expected export(s), deps ${deps}, ${report.notices} header notice(s)`
    );
  })
).pipe(Command.withDescription("S0: copy a module verbatim from upstream and fill its ledger row"));

const carry = Command.make("carry", { module: moduleArgument }, Effect.fnUntraced(function* ({ module }) {
    const audit = yield* Audit;
    const report = yield* audit.carry(module);
    yield* Console.log(
      `[effected] ${module} carry: KNOWLEDGE.md (${report.knowledgeSections} sections), README ${report.wroteReadme ? "written" : "kept"}, LICENSE ${report.wroteLicense ? "written" : "kept or absent upstream"}`
    );
  })
).pipe(Command.withDescription("Reassemble KNOWLEDGE.md; write LICENSE, README and tsconfig only when absent"));

const parity = Command.make(
  "parity",
  { module: moduleArgument, strict: Flag.Boolean("strict").pipe(Flag.withDefault(false)) },
  Effect.fnUntraced(function* ({ module, strict }) {
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

const moduleAt = (rest: ReadonlyArray<string>, index: number) =>
  decodeModule(rest[index]).pipe(
    Effect.mapError(() =>
      CliUsageError.make({ detail: `expected a module name at position ${index + 1}, got ${rest[index] ?? "nothing"}` })
    )
  );

const tail = (rest: ReadonlyArray<string>, from: number): string => A.join(A.drop(rest, from), " ");

const ledger = Command.make(
  "ledger",
  {
    init: Flag.Boolean("init").pipe(Flag.withDefault(false)),
    verify: Flag.Boolean("verify").pipe(Flag.withDefault(false)),
    set: Flag.Boolean("set").pipe(Flag.withDefault(false)),
    block: Flag.Boolean("block").pipe(Flag.withDefault(false)),
    note: Flag.Boolean("note").pipe(Flag.withDefault(false)),
    add: Flag.Boolean("add").pipe(Flag.withDefault(false)),
    show: Flag.Boolean("show").pipe(Flag.withDefault(false)),
    finding: Flag.String("finding").pipe(Flag.optional),
    rest: Argument.String("args").pipe(Argument.variadic()),
  },
  Effect.fnUntraced(function* ({ init, verify, set, block, note, add, finding, rest }) {
      const service = yield* Audit;
      if (init) {
        const created = yield* service.ledgerInit;
        return yield* Console.log(`ledger: initialized ${created.rows.length} rows at ${created.effectedCommit}`);
      }
      if (verify) {
        const report = yield* service.ledgerVerify;
        return report.ok ? undefined : yield* LedgerIncomplete.make({ done: report.done, total: report.total });
      }
      if (set) {
        const module = yield* moduleAt(rest, 0);
        const stage = yield* decodeStage(rest[1]).pipe(
          Effect.mapError(() => CliUsageError.make({ detail: `expected a stage 0..5, got ${rest[1] ?? "nothing"}` }))
        );
        const row = yield* service.ledgerSet(module, stage, tail(rest, 2));
        return yield* Console.log(`ledger: ${row.id} now at stage ${row.stage} (${row.status})`);
      }
      if (block) {
        const module = yield* moduleAt(rest, 0);
        const row = yield* service.ledgerBlock(module, tail(rest, 1), O.toArray(finding));
        return yield* Console.log(`ledger: ${row.id} blocked at stage ${row.stage}`);
      }
      if (note) {
        const module = yield* moduleAt(rest, 0);
        const row = yield* service.ledgerNote(module, tail(rest, 1));
        return yield* Console.log(`ledger: ${row.id} noted (${row.notes.length} notes)`);
      }
      if (add) {
        const module = yield* moduleAt(rest, 0);
        const row = yield* service.ledgerAdd(module);
        return yield* Console.log(`ledger: ${row.id} registered with ${row.exportsExpected.length} expected export(s)`);
      }
      const selected = A.isReadonlyArrayNonEmpty(rest) ? O.some(yield* moduleAt(rest, 0)) : O.none<ModuleName>();
      return yield* service.ledgerShow(selected);
    })
).pipe(
  Command.withDescription(
    "--init | --show [module] | --verify | --set <module> <stage> [note...] | --block <module> <reason...> [--finding id] | --note <module> <text...> | --add <module>"
  )
);

const review = Command.make(
  "review",
  {
    module: moduleArgument,
    round: Argument.Int("round"),
    seats: Flag.Boolean("seats").pipe(Flag.withDefault(false)),
  },
  Effect.fnUntraced(function* ({ module, round, seats }) {
    const service = yield* Audit;
    const brief = yield* service.reviewBrief(module, round);
    yield* Console.log(`[effected] ${module} review round ${round}: brief ${brief.brief} on ${brief.commit}`);
    if (seats) {
      const result = yield* service.reviewSeats(module, round);
      if (A.isReadonlyArrayNonEmpty(result.edits)) {
        return yield* CliUsageError.make({
          detail: `reviewers changed files outside ${result.directory}: ${A.join(result.edits, ", ")} (revert them and file a receipt)`,
        });
      }
    }
  })
).pipe(Command.withDescription("Write the round's reviewer brief; with --seats also run the Grok and Sol seats"));

const append = Command.make(
  "append",
  {
    module: moduleArgument,
    field: Argument.Literals("field", AppendField.literals),
    file: Argument.String("json-file"),
  },
  Effect.fnUntraced(function* ({ module, field, file }) {
    const service = yield* Audit;
    const fs = yield* FileSystem.FileSystem;
    const json = yield* fs.readFileString(file);
    const row = yield* service.ledgerAppend(module, { field, json });
    yield* Console.log(`[effected] ${row.id}: appended ${field} from ${file}`);
  })
).pipe(Command.withDescription("Append a JSON array of deviations, backlog, reviewRounds or exportsAdded to a ledger row"));

const root = Command.make("audit:effected").pipe(
  Command.withDescription("Gates and ledger of the @effected/* port lab (scratchpad/EFFECTED_PORT_GOAL.md)"),
  Command.withSubcommands([copy, carry, parity, check, lint, test, docgen, audit, ledger, review, append])
);

const RunnerLayers = AuditLive.pipe(Layer.provideMerge(BunServices.layer));

/**
 * The CLI program: builds the runner's layers once and runs the command tree
 * against the process arguments.
 *
 * **Example** (Reference the program)
 *
 * ```ts
 * import { program } from "@beep/scratchpad/effected/runner/main"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const program = RunnerLayers.pipe(
  Layer.build,
  Effect.flatMap((context) => Command.run(root, { version: "0.0.0" }).pipe(Effect.provideContext(context))),
  Effect.scoped
);

/**
 * Runs {@link program} on the Bun runtime.
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
export const main = (): void => BunRuntime.runMain(program);
