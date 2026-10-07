/**
 * The `Audit` service: one method per runner subcommand, composed from the
 * copy, gate and ledger modules.
 *
 * **Details**
 *
 * The layer captures the platform services it needs once, at construction,
 * and provides them to every method, so callers see methods with no
 * requirements; the service surface names what it does, not what it uses.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import type * as Config from "effect/Config";
import type * as PlatformError from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/process";
import type { AuditError } from "./Audit.errors.ts";
import { type CopyReport, copyModule, registerExisting, upstreamEntries } from "./Copy.ts";
import { readExportFacets } from "./Exports.ts";
import { check, docgen, gatePlan, lint, type ParityReport, parity, test } from "./Gates.ts";
import {
  type AuditTarget,
  exportKindCovers,
  type Ledger,
  type LedgerRow,
  type ModuleName,
  type Stage,
} from "./Ledger.schema.ts";
import {
  backfillCommits,
  blockRow,
  findRow,
  findStageCommit,
  initLedger,
  noteRow,
  openRows,
  readLedger,
  setStage,
} from "./LedgerStore.ts";
import { isModuleTarget, labPaths, type RunnerConfig, resolveRunnerConfig } from "./Paths.ts";
import { capture } from "./Process.ts";

const $I = $ScratchpadId.create("effected/runner/Audit.service");

/**
 * Platform services the live runner captures at construction.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuditRequirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

/**
 * Every failure a runner method can raise: its own tagged errors and
 * untranslated platform failures.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunnerError = AuditError | PlatformError.PlatformError;

/**
 * The verdict of `audit`: the gates that ran green.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface AuditVerdict {
  readonly target: AuditTarget;
  readonly stage: number;
  readonly gates: ReadonlyArray<string>;
}

/**
 * What `ledger --verify` found.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface VerifyReport {
  readonly done: number;
  readonly total: number;
  readonly blocked: ReadonlyArray<string>;
  readonly stale: ReadonlyArray<string>;
  readonly open: ReadonlyArray<string>;
  readonly ok: boolean;
}

/**
 * The runner's operations, one per subcommand.
 *
 * @category services
 * @since 0.0.0
 */
export interface AuditShape {
  /** Resolved repository and upstream roots. @since 0.0.0 */
  readonly config: RunnerConfig;
  /** HEAD of the upstream checkout. @since 0.0.0 */
  readonly upstreamCommit: Effect.Effect<string, RunnerError>;
  /** S0 verbatim copy of one module. @since 0.0.0 */
  readonly copy: (module: ModuleName) => Effect.Effect<CopyReport, RunnerError>;
  /** Export parity, foreign specifiers and D15 assertions. @since 0.0.0 */
  readonly parity: (module: ModuleName, strict: boolean) => Effect.Effect<ParityReport, RunnerError>;
  /** tsgo gate. @since 0.0.0 */
  readonly check: (target: AuditTarget) => Effect.Effect<void, RunnerError>;
  /** oxlint and laws gate. @since 0.0.0 */
  readonly lint: (target: AuditTarget) => Effect.Effect<void, RunnerError>;
  /** vitest gate. @since 0.0.0 */
  readonly test: (target: AuditTarget, coverage: boolean) => Effect.Effect<void, RunnerError>;
  /** docgen gate. @since 0.0.0 */
  readonly docgen: (target: AuditTarget) => Effect.Effect<void, RunnerError>;
  /** Every gate in order for the target's stage, stopping at the first red. @since 0.0.0 */
  readonly audit: (target: AuditTarget) => Effect.Effect<AuditVerdict, RunnerError>;
  /** Create the ledger. @since 0.0.0 */
  readonly ledgerInit: Effect.Effect<Ledger, RunnerError>;
  /** Print the ledger, or one row with its notes. @since 0.0.0 */
  readonly ledgerShow: (module: O.Option<ModuleName>) => Effect.Effect<void, RunnerError>;
  /** Verify completion and print `ledger: <done>/<total> done`. @since 0.0.0 */
  readonly ledgerVerify: Effect.Effect<VerifyReport, RunnerError>;
  /** Move a row to the stage it reached. @since 0.0.0 */
  readonly ledgerSet: (module: ModuleName, stage: Stage, note: string) => Effect.Effect<LedgerRow, RunnerError>;
  /** Block a row at its stage. @since 0.0.0 */
  readonly ledgerBlock: (
    module: ModuleName,
    reason: string,
    findings: ReadonlyArray<string>
  ) => Effect.Effect<LedgerRow, RunnerError>;
  /** Append a note to a row. @since 0.0.0 */
  readonly ledgerNote: (module: ModuleName, note: string) => Effect.Effect<LedgerRow, RunnerError>;
  /** Fill a row from upstream without copying files. @since 0.0.0 */
  readonly ledgerAdd: (module: ModuleName) => Effect.Effect<LedgerRow, RunnerError>;
}

/**
 * The runner service.
 *
 * **Example** (Read the resolved roots)
 *
 * ```ts
 * import { Audit } from "@beep/scratchpad/effected/runner/Audit.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(Audit, (audit) => audit.config.repoRoot)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Audit extends Context.Service<Audit, AuditShape>()($I`Audit`) {}

const renderRow = (row: LedgerRow): string => {
  const commits = A.map(
    row.commits,
    (commit) => `S${commit.stage}=${commit.sha === null ? "pending" : Str.slice(0, 10)(commit.sha)}`
  );
  return `${Str.padEnd(22, " ")(row.id)} stage ${row.stage} ${Str.padEnd(11, " ")(row.status)} ${A.join(commits, " ")}`;
};

const STAGES: ReadonlyArray<Stage> = [0, 1, 2, 3, 4, 5];

const verifyExports = Effect.fn("Audit.verifyExports")(function* (config: RunnerConfig, row: LedgerRow) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* upstreamEntries(config.upstreamRoot, row.module);
  const perEntry = yield* Effect.forEach(entries, ([entry, srcRelative]) =>
    Effect.map(fs.exists(path.join(config.repoRoot, labPaths(row.module).sourceDir, srcRelative)), (present) =>
      present ? readExportFacets(path.join(config.repoRoot, labPaths(row.module).sourceDir, srcRelative), entry) : []
    )
  );
  const actual = A.flatten(perEntry);
  return A.flatMap(row.exportsExpected, (expected) =>
    O.match(
      A.findFirst(actual, (candidate) => candidate.entry === expected.entry && candidate.name === expected.name),
      {
        onNone: () => [`${row.module} no longer exports ${expected.entry} ${expected.name}`],
        onSome: (found) =>
          exportKindCovers(found.kind, expected.kind)
            ? []
            : [`${row.module} export ${expected.name} kind ${found.kind} does not cover ${expected.kind}`],
      }
    )
  );
});

const verifyRow = Effect.fn("Audit.verifyRow")(function* (config: RunnerConfig, row: LedgerRow) {
  const missingCommits =
    row.status === "done"
      ? A.getSomes(
          yield* Effect.forEach(STAGES, (stage) =>
            Effect.map(findStageCommit(config.repoRoot, row.module, stage), (sha) =>
              O.isNone(sha) ? O.some(`no (effected-port S${stage}) commit for ${row.module}`) : O.none<string>()
            )
          )
        )
      : [];
  const exportProblems = row.status === "done" ? yield* verifyExports(config, row) : [];
  const backfilled = yield* backfillCommits(config.repoRoot, row);
  const unresolved = A.some(backfilled.commits, (commit) => commit.sha === null)
    ? [`${row.module} has stage commits git cannot resolve`]
    : [];
  return [...missingCommits, ...exportProblems, ...unresolved];
});

const makeAudit = Effect.fn("Audit.make")(function* () {
  const config = yield* resolveRunnerConfig();
  const context = yield* Effect.context<AuditRequirements>();
  const provided = <A, E>(effect: Effect.Effect<A, E, AuditRequirements>): Effect.Effect<A, E> =>
    Effect.provideContext(effect, context);

  const upstreamCommit = provided(capture({ command: "git", args: ["rev-parse", "HEAD"], cwd: config.upstreamRoot }));

  const audit = Effect.fn("Audit.audit")(function* (target: AuditTarget) {
    const stage = isModuleTarget(target) ? (yield* findRow(yield* readLedger(config), target)).stage : 0;
    const plan = gatePlan(target, stage);
    const gates: Array<string> = [];
    if (plan.parity && isModuleTarget(target)) {
      yield* parity(config, target, plan.strict);
      gates.push("parity");
    }
    yield* check(config, target);
    gates.push("check");
    yield* lint(config, target);
    gates.push("lint");
    yield* test(config, target, plan.coverage);
    gates.push(plan.coverage ? "test --coverage" : "test");
    if (plan.docgen) {
      yield* docgen(config, target);
      gates.push("docgen");
    }
    yield* Console.log(`[effected] ${target} audit: green (${A.join(gates, ", ")})`);
    const verdict: AuditVerdict = { target, stage, gates };
    return verdict;
  });

  const ledgerVerify = Effect.gen(function* () {
    const ledger = yield* readLedger(config);
    const total = ledger.rows.length;
    const done = A.filter(ledger.rows, (row) => row.status === "done").length;
    const blocked = A.map(
      A.filter(ledger.rows, (row) => row.status === "blocked"),
      (row) => `${row.id} blocked at S${row.blocked?.stage ?? row.stage}: ${row.blocked?.reason ?? "unknown"}`
    );
    const open = A.map(
      A.filter(openRows(ledger), (row) => row.status !== "blocked"),
      (row) => `${row.id} ${row.status} at stage ${row.stage}`
    );
    const stale = A.flatten(yield* Effect.forEach(ledger.rows, (row) => verifyRow(config, row)));
    const ok = done === total && A.isReadonlyArrayEmpty(blocked) && A.isReadonlyArrayEmpty(stale);
    yield* Console.log(`ledger: ${done}/${total} done`);
    yield* Effect.forEach(blocked, (line) => Console.log(`blocked: ${line}`));
    yield* Effect.forEach(stale, (line) => Console.log(`stale: ${line}`));
    yield* Effect.forEach(open, (line) => Console.log(`open: ${line}`));
    const report: VerifyReport = { done, total, blocked, stale, open, ok };
    return report;
  });

  const ledgerShow = Effect.fn("Audit.ledgerShow")(function* (module: O.Option<ModuleName>) {
    const ledger = yield* readLedger(config);
    yield* Console.log(`effectedCommit ${ledger.effectedCommit} startedAt ${ledger.startedAt}`);
    const rows = O.match(module, {
      onNone: () => ledger.rows,
      onSome: (name) => A.filter(ledger.rows, (row) => row.module === name),
    });
    yield* Effect.forEach(rows, (row) => Console.log(renderRow(row)));
    if (O.isSome(module)) {
      yield* Effect.forEach(rows, (row) => Effect.forEach(row.notes, (note) => Console.log(`  note: ${note}`)));
    }
  });

  const provide = Effect.provideContext(context);
  return Audit.of({
    config,
    upstreamCommit,
    copy: Effect.fn("Audit.copy")(function* (module: ModuleName) {
      return yield* copyModule(config, module, yield* upstreamCommit);
    }, provide),
    parity: Effect.fn("Audit.parity")(function* (module: ModuleName, strict: boolean) {
      return yield* parity(config, module, strict);
    }, provide),
    check: Effect.fn("Audit.check")(function* (target: AuditTarget) {
      return yield* check(config, target);
    }, provide),
    lint: Effect.fn("Audit.lint")(function* (target: AuditTarget) {
      return yield* lint(config, target);
    }, provide),
    test: Effect.fn("Audit.test")(function* (target: AuditTarget, coverage: boolean) {
      return yield* test(config, target, coverage);
    }, provide),
    docgen: Effect.fn("Audit.docgen")(function* (target: AuditTarget) {
      return yield* docgen(config, target);
    }, provide),
    audit: Effect.fn("Audit.auditTarget")(function* (target: AuditTarget) {
      return yield* audit(target);
    }, provide),
    ledgerInit: provided(Effect.flatMap(upstreamCommit, (commit) => initLedger(config, commit))),
    ledgerShow: Effect.fn("Audit.show")(function* (module: O.Option<ModuleName>) {
      return yield* ledgerShow(module);
    }, provide),
    ledgerVerify: provided(ledgerVerify),
    ledgerSet: Effect.fn("Audit.ledgerSet")(function* (module: ModuleName, stage: Stage, note: string) {
      return yield* setStage(config, module, stage, note);
    }, provide),
    ledgerBlock: Effect.fn("Audit.ledgerBlock")(function* (
      module: ModuleName,
      reason: string,
      findings: ReadonlyArray<string>
    ) {
      return yield* blockRow(config, module, reason, findings);
    }, provide),
    ledgerNote: Effect.fn("Audit.ledgerNote")(function* (module: ModuleName, note: string) {
      return yield* noteRow(config, module, note);
    }, provide),
    ledgerAdd: Effect.fn("Audit.ledgerAdd")(function* (module: ModuleName) {
      return yield* registerExisting(config, module);
    }, provide),
  });
});

/**
 * The live runner, built from the platform services it captures.
 *
 * **Example** (Build the runner on Bun)
 *
 * ```ts
 * import { AuditLive } from "@beep/scratchpad/effected/runner/Audit.service"
 * import { BunServices } from "@effect/platform-bun"
 * import * as Layer from "effect/Layer"
 *
 * const live = AuditLive.pipe(Layer.provide(BunServices.layer))
 * console.log(Layer.isLayer(live)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AuditLive: Layer.Layer<
  Audit,
  Config.ConfigError | PlatformError.BadArgument,
  AuditRequirements
> = Layer.effect(Audit, makeAudit());
