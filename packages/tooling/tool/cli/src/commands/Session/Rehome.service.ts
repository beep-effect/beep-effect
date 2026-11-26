/**
 * `session rehome`: copy a checkout's session history (ledger, presence,
 * register, rulings) from one repository partition to another, rewriting each
 * row's `repository`. The source files are never modified; they stay as the
 * backup, and deleting the target files reverses an apply.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { CheckoutRepository } from "../../internal/state/WorkstationState.ts";
import { SessionPresenceStore, sessionPresenceFileName } from "./Presence.service.ts";
import { RegisterRow, RegisterRowJson } from "./Register.schemas.ts";
import { OrchestratorRegister, orchestratorStateDirectory, registerFileName } from "./Register.service.ts";
import { SessionRehomeReport, SessionRehomeStorePlan } from "./Rehome.schemas.ts";
import { SessionPresence, SessionPresenceJson } from "./Route.schemas.ts";
import { RulingRow, RulingRowJson } from "./Rulings.schemas.ts";
import { OrchestratorRulings, rulingsFileName } from "./Rulings.service.ts";
import { SessionLedgerError, sessionUsageError } from "./Session.errors.ts";
import { SessionLedgerRow, SessionLedgerRowJson } from "./Session.schemas.ts";
import { SessionLedger, sessionLedgerFileName, sessionStateDirectory } from "./SessionLedger.service.ts";
import type { SessionRehomeRequest, SessionStoreName } from "./Rehome.schemas.ts";

const equivalentRepository = S.toEquivalence(CheckoutRepository);

interface RehomeStoreBinding<Row> {
  readonly append: (row: Row) => Effect.Effect<void, SessionLedgerError>;
  readonly directory: string;
  readonly encode: (row: Row) => Effect.Effect<string, S.SchemaError>;
  readonly fileName: (repository: CheckoutRepository) => string;
  readonly list: (repository: CheckoutRepository) => Effect.Effect<ReadonlyArray<Row>, SessionLedgerError>;
  readonly rewrite: (row: Row, to: CheckoutRepository) => Row;
  readonly store: SessionStoreName;
}

const rehomeStore = Effect.fnUntraced(function* <Row>(binding: RehomeStoreBinding<Row>, request: SessionRehomeRequest) {
  const path = yield* Path.Path;
  const encodeRow = flow(
    binding.encode,
    Effect.mapError((cause) =>
      SessionLedgerError.make({ reason: "decode", message: `Failed to encode a ${binding.store} row.`, cause })
    )
  );
  const source = yield* binding.list(request.from);
  const target = yield* binding.list(request.to);
  const targetLines = yield* Effect.forEach(target, encodeRow, { concurrency: 1 });
  const held = HashSet.fromIterable(targetLines);
  const fresh = yield* Effect.filter(
    A.map(source, (row) => binding.rewrite(row, request.to)),
    flow(
      encodeRow,
      Effect.map((line) => !HashSet.has(held, line))
    )
  );
  if (request.apply) {
    yield* Effect.forEach(fresh, binding.append, { concurrency: 1, discard: true });
  }
  return SessionRehomeStorePlan.make({
    store: binding.store,
    sourceFile: path.join(binding.directory, binding.fileName(request.from)),
    sourceRows: A.length(source),
    targetFile: path.join(binding.directory, binding.fileName(request.to)),
    targetRows: A.length(target),
    newRows: A.length(fresh),
  });
});

const stateDirectoryError = (cause: unknown) =>
  SessionLedgerError.make({ reason: "io", message: "Failed to resolve the session state directory.", cause });

/**
 * Plan, and with `apply` perform, a rehome of every session store.
 *
 * **Details**
 *
 * Each store's rows for `from` are read, their `repository` rewritten to `to`,
 * and the ones the `to` partition does not already hold (compared as encoded
 * JSON lines) are appended there, so a repeated apply copies nothing. Corrupt
 * source lines are skipped with the store's usual warning. Source files are
 * only read. `from` equal to `to` fails as a usage error.
 *
 * **Example** (Build a dry run)
 *
 * ```ts
 * import { CheckoutRepository, rehomeSessionStores, SessionRehomeRequest } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const run = rehomeSessionStores(
 *   SessionRehomeRequest.make({
 *     from: CheckoutRepository.make({ host: "github.com", owner: "o", name: "r" }),
 *     to: CheckoutRepository.make({ host: "gitlab.example.com", owner: "o", name: "r" }),
 *     apply: false,
 *   })
 * )
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @param request - The source and target repositories and whether to write.
 * @returns One plan per store, in ledger, presence, register, rulings order.
 * @category commands
 * @since 0.0.0
 */
export const rehomeSessionStores = Effect.fn("SessionRehome.run")(function* (request: SessionRehomeRequest) {
  if (equivalentRepository(request.from, request.to)) {
    return yield* sessionUsageError("--from and --to name the same repository; nothing to rehome.");
  }
  const ledger = yield* SessionLedger;
  const presence = yield* SessionPresenceStore;
  const register = yield* OrchestratorRegister;
  const rulings = yield* OrchestratorRulings;
  const sessions = yield* Effect.mapError(sessionStateDirectory, stateDirectoryError);
  const orchestrator = yield* Effect.mapError(orchestratorStateDirectory, stateDirectoryError);
  const ledgerPlan = yield* rehomeStore(
    {
      store: "ledger",
      directory: sessions,
      fileName: sessionLedgerFileName,
      list: ledger.list,
      append: ledger.append,
      encode: SessionLedgerRowJson.encode,
      rewrite: (row: SessionLedgerRow, to) => SessionLedgerRow.make({ ...row, repository: to }),
    },
    request
  );
  const presencePlan = yield* rehomeStore(
    {
      store: "presence",
      directory: sessions,
      fileName: sessionPresenceFileName,
      list: presence.list,
      append: presence.append,
      encode: SessionPresenceJson.encode,
      rewrite: (row: SessionPresence, to) => SessionPresence.make({ ...row, repository: to }),
    },
    request
  );
  const registerPlan = yield* rehomeStore(
    {
      store: "register",
      directory: orchestrator,
      fileName: registerFileName,
      list: register.list,
      append: register.append,
      encode: RegisterRowJson.encode,
      rewrite: (row: RegisterRow, to) => RegisterRow.make({ ...row, repository: to }),
    },
    request
  );
  const rulingsPlan = yield* rehomeStore(
    {
      store: "rulings",
      directory: orchestrator,
      fileName: rulingsFileName,
      list: rulings.list,
      append: rulings.append,
      encode: RulingRowJson.encode,
      rewrite: (row: RulingRow, to) => RulingRow.make({ ...row, repository: to }),
    },
    request
  );
  return SessionRehomeReport.make({
    from: request.from,
    to: request.to,
    applied: request.apply,
    stores: [ledgerPlan, presencePlan, registerPlan, rulingsPlan],
  });
});

const slug = (repository: CheckoutRepository): string => `${repository.host}/${repository.owner}/${repository.name}`;

/**
 * Render a rehome report as the operator reads it: a header, one line per
 * store, and a closing line saying what was written.
 *
 * **Example** (Render an empty dry run)
 *
 * ```ts
 * import { CheckoutRepository, renderSessionRehomeReport, SessionRehomeReport } from "@beep/repo-cli/test/Session"
 *
 * const report = SessionRehomeReport.make({
 *   from: CheckoutRepository.make({ host: "github.com", owner: "o", name: "r" }),
 *   to: CheckoutRepository.make({ host: "gitlab.example.com", owner: "o", name: "r" }),
 *   applied: false,
 *   stores: [],
 * })
 * console.log(renderSessionRehomeReport(report).split("\n")[0])
 * // "[session] rehome github.com/o/r -> gitlab.example.com/o/r (dry run; pass --apply to copy)"
 * ```
 *
 * @param report - The rehome outcome.
 * @returns The report text.
 * @category formatting
 * @since 0.0.0
 */
export const renderSessionRehomeReport = (report: SessionRehomeReport): string =>
  A.join(
    [
      `[session] rehome ${slug(report.from)} -> ${slug(report.to)}${report.applied ? "" : " (dry run; pass --apply to copy)"}`,
      ...A.map(
        report.stores,
        (plan) =>
          `- ${plan.store}: ${plan.sourceRows} row(s) in ${plan.sourceFile} -> ${plan.targetFile} (${plan.targetRows} already there, ${plan.newRows} ${report.applied ? "copied" : "to copy"})`
      ),
      report.applied
        ? `[session] copied ${A.reduce(report.stores, 0, (total, plan) => total + plan.newRows)} row(s); the source files stay in place as the backup.`
        : "[session] dry run: nothing written.",
    ],
    "\n"
  );
