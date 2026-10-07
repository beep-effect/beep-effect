/**
 * The `Audit` service: one method per runner subcommand, composed from the
 * copy, gate and ledger modules.
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
import type { PlatformError } from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/process";
import type { AuditError } from "./Audit.errors.ts";
import { type CopyReport, copyModule, registerExisting, upstreamEntries } from "./Copy.ts";
import { readExportFacets } from "./Exports.ts";
import { check, docgen, gatePlan, lint, parity, type ParityReport, test } from "./Gates.ts";
import { DONE_STAGE, exportKindCovers, type AuditTarget, type Ledger, type LedgerRow, type ModuleName, type Stage } from "./Ledger.schema.ts";
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
  writeLedger,
} from "./LedgerStore.ts";
import { isModuleTarget, labPaths, type RunnerConfig, resolveRunnerConfig, upstreamPaths } from "./Paths.ts";
import { capture } from "./Process.ts";

const $I = $ScratchpadId.create("effected/runner/Audit.service");

/**
 * Services every runner method needs.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AuditRequirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

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
 * The runner's operations.
 *
 * @category services
 * @since 0.0.0
 */
export interface AuditShape {
  /** Resolved roots. @since 0.0.0 */
  readonly config: RunnerConfig;
  /** HEAD of the upstream checkout. @since 0.0.0 */
  readonly upstreamCommit: Effect.Effect<string, AuditError, AuditRequirements>;
  /** S0 verbatim copy. @since 0.0.0 */
  readonly copy: (module: ModuleName) => Effect.Effect<CopyReport, AuditError | PlatformError, AuditRequirements>;
  /** Export parity, foreign specifiers and D15. @since 0.0.0 */
  readonly parity: (module: ModuleName, strict: boolean) => Effect.Effect<ParityReport, AuditError | PlatformError, AuditRequirements>;
  /** tsgo gate. @since 0.0.0 */
  readonly check: (target: AuditTarget) => Effect.Effect<void, AuditError | PlatformError, AuditRequirements>;
  /** oxlint and laws gate. @since 0.0.0 */
  readonly lint: (target: AuditTarget) => Effect.Effect<void, AuditError | PlatformError, AuditRequirements>;
  /** vitest gate. @since 0.0.0 */
  readonly test: (target: AuditTarget, coverage: boolean) => Effect.Effect<void, AuditError | PlatformError, AuditRequirements>;
  /** docgen gate. @since 0.0.0 */
  readonly docgen: (target: AuditTarget) => Effect.Effect<void, AuditError | PlatformError, AuditRequirements>;
  /** Every gate in order, stage-aware, stopping at the first red. @since 0.0.0 */
  readonly audit: (target: AuditTarget) => Effect.Effect<AuditVerdict, AuditError | PlatformError, AuditRequirements>;
  /** Create the ledger. @since 0.0.0 */
  readonly ledgerInit: Effect.Effect<Ledger, AuditError | PlatformError, AuditRequirements>;
  /** Print the ledger. @since 0.0.0 */
  readonly ledgerShow: (module: O.Option<ModuleName>) => Effect.Effect<void, AuditError | PlatformError, AuditRequirements>;
  /** Verify completion. @since 0.0.0 */
  readonly ledgerVerify: Effect.Effect<VerifyReport, AuditError | PlatformError, AuditRequirements>;
  /** Move a row to a stage. @since 0.0.0 */
  readonly ledgerSet: (module: ModuleName, stage: Stage, note: string) => Effect.Effect<LedgerRow, AuditError | PlatformError, AuditRequirements>;
  /** Block a row. @since 0.0.0 */
  readonly ledgerBlock: (module: ModuleName, reason: string, findings: ReadonlyArray<string>) => Effect.Effect<LedgerRow, AuditError | PlatformError, AuditRequirements>;
  /** Note a row. @since 0.0.0 */
  readonly ledgerNote: (module: ModuleName, note: string) => Effect.Effect<LedgerRow, AuditError | PlatformError, AuditRequirements>;
  /** Fill a row from upstream without copying. @since 0.0.0 */
  readonly ledgerAdd: (module: ModuleName) => Effect.Effect<LedgerRow, AuditError | PlatformError, AuditRequirements>;
}

/**
 * The runner service tag.
 *
 * **Example** (Acquire the service)
 *
 * ```ts
 * import { Audit } from "@beep/scratchpad/effected/runner/Audit.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const audit = yield* Audit
 *   return audit.config.repoRoot
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Audit extends Context.Service<Audit, AuditShape>()($I`Audit`) {}

const stageOf = Effect.fn("Audit.stageOf")(function* (config: RunnerConfig, target: AuditTarget) {
  if (!isModuleTarget(target)) return 0;
  const ledger = yield* readLedger(config);
  const row = yield* findRow(ledger, target);
  return row.stage;
});

const renderRow = (row: LedgerRow): string => {
  const commits = A.map(row.commits, (commit) => `S${commit.stage}=${commit.sha === null ? "pending" : Str.slice(0, 10)(commit.sha)}`);
  return `${row.id.padEnd(22)} stage ${row.stage} ${row.status.padEnd(11)} ${A.join(commits, " ")}`;
};

const verifyRow = Effect.fn("Audit.verifyRow")(function* (config: RunnerConfig, row: LedgerRow) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const problems: Array<string> = [];
  if (row.status === "done") {
    for (const stage of [0, 1, 2, 3, 4, 5] as const) {
      const sha = yield* findStageCommit(config.repoRoot, row.module, stage);
      if (O.isNone(sha)) problems.push(`no (effected-port S${stage}) commit for ${row.module}`);
    }
    const entries = yield* upstreamEntries(config.upstreamRoot, row.module);
    const actual = A.flatMap(
      yield* Effect.forEach(entries, ([entry, srcRelative]) =>
        Effect.gen(function* () {
          const file = path.join(config.repoRoot, labPaths(row.module).sourceDir, srcRelative);
          return (yield* fs.exists(file)) ? readExportFacets(file, entry) : [];
        })
      ),
      (facets) => facets
    );
    for (const expected of row.exportsExpected) {
      const found = A.findFirst(actual, (candidate) => candidate.entry === expected.entry && candidate.name === expected.name);
      if (O.isNone(found)) problems.push(`${row.module} no longer exports ${expected.entry} ${expected.name}`);
      else if (!exportKindCovers(found.value.kind, expected.kind)) problems.push(`${row.module} export ${expected.name} kind ${found.value.kind} does not cover ${expected.kind}`);
    }
  }
  if (A.some(row.commits, (commit) => commit.sha === null)) {
    const backfilled = yield* backfillCommits(config.repoRoot, row);
    if (A.some(backfilled.commits, (commit) => commit.sha === null)) problems.push(`${row.module} has stage commits git cannot resolve`);
    else problems.push(`${row.module} has resolvable pending shas (run any ledger write to backfill)`);
  }
  void upstreamPaths;
  return problems;
});

const makeAudit = Effect.fn("Audit.make")(function* () {
  const config = yield* resolveRunnerConfig();
  const upstreamCommit = capture({ command: "git", args: ["rev-parse", "HEAD"], cwd: config.upstreamRoot });
  const audit = Effect.fn("Audit.audit")(function* (target: AuditTarget) {
    const stage = yield* stageOf(config, target);
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
    return { target, stage, gates } satisfies AuditVerdict;
  });
  const ledgerVerify = Effect.gen(function* () {
    const ledger = yield* readLedger(config);
    const total = ledger.rows.length;
    const doneRows = A.filter(ledger.rows, (row) => row.status === "done");
    const blocked = A.map(
      A.filter(ledger.rows, (row) => row.status === "blocked"),
      (row) => `${row.id} blocked at S${row.blocked?.stage ?? row.stage}: ${row.blocked?.reason ?? "unknown"}`
    );
    const open = A.map(
      A.filter(openRows(ledger), (row) => row.status !== "blocked"),
      (row) => `${row.id} ${row.status} at stage ${row.stage}`
    );
    const stale = A.flatten(yield* Effect.forEach(ledger.rows, (row) => verifyRow(config, row)));
    const ok = doneRows.length === total && A.isEmptyReadonlyArray(blocked) && A.isEmptyReadonlyArray(stale);
    yield* Console.log(`ledger: ${doneRows.length}/${total} done`);
    yield* Effect.forEach(blocked, (line) => Console.log(`blocked: ${line}`));
    yield* Effect.forEach(stale, (line) => Console.log(`stale: ${line}`));
    yield* Effect.forEach(open, (line) => Console.log(`open: ${line}`));
    return { done: doneRows.length, total, blocked, stale, open, ok } satisfies VerifyReport;
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
      yield* Effect.forEach(rows, (row) => Console.log(A.join(A.map(row.notes, (note) => `  note: ${note}`), "\n")));
    }
  });
  const service: AuditShape = {
    config,
    upstreamCommit,
    copy: (module) => Effect.flatMap(upstreamCommit, (commit) => copyModule(config, module, commit)),
    parity: (module, strict) => parity(config, module, strict),
    check: (target) => check(config, target),
    lint: (target) => lint(config, target),
    test: (target, coverage) => test(config, target, coverage),
    docgen: (target) => docgen(config, target),
    audit,
    ledgerInit: Effect.flatMap(upstreamCommit, (commit) => initLedger(config, commit)),
    ledgerShow,
    ledgerVerify,
    ledgerSet: (module, stage, note) => setStage(config, module, stage, note),
    ledgerBlock: (module, reason, findings) => blockRow(config, module, reason, findings),
    ledgerNote: (module, note) => noteRow(config, module, note),
    ledgerAdd: (module) => registerExisting(config, module),
  };
  void DONE_STAGE;
  void writeLedger;
  return Audit.of(service);
});

/**
 * The live runner service.
 *
 * **Example** (Provide the runner)
 *
 * ```ts
 * import { Audit, AuditLive } from "@beep/scratchpad/effected/runner/Audit.service"
 * import { BunServices } from "@effect/platform-bun"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const audit = yield* Audit
 *   return audit.config.upstreamRoot.length > 0
 * }).pipe(Effect.provide(AuditLive.pipe(Layer.provide(BunServices.layer))))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AuditLive: Layer.Layer<Audit, never, Path.Path> = Layer.effect(Audit, makeAudit());
