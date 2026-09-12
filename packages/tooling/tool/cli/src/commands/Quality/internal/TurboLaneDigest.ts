import { createHash } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/internal/TurboLaneDigest");

/**
 * Cache verdict Turbo records for one task in a run summary.
 *
 * **Example** (Check a cache status)
 *
 * ```ts
 * import { TurboSummaryCacheStatus } from "@beep/repo-cli/test/Quality"
 *
 * console.log(TurboSummaryCacheStatus.is("HIT")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboSummaryCacheStatus = LiteralKit(["HIT", "MISS"]).annotate(
  $I.annote("TurboSummaryCacheStatus", { description: "Turbo run-summary cache status for one task." })
);

const TurboSummaryExecution = S.Struct({ exitCode: S.Finite.pipe(S.NullOr, S.optionalKey) }).annotate(
  $I.annote("TurboSummaryExecution", { description: "Exit code Turbo recorded for one executed task." })
);

/**
 * The slice of one `tasks[]` entry a lane digest needs: identity, hash, cache verdict, exit code.
 *
 * **Example** (Decode a task entry)
 *
 * ```ts
 * import { TurboSummaryTask } from "@beep/repo-cli/test/Quality"
 *
 * const task = TurboSummaryTask.make({
 *   taskId: "//#lint:schema-first",
 *   task: "lint:schema-first",
 *   hash: "0d5970886d36b416",
 *   cache: { status: "MISS" },
 *   execution: { exitCode: 0 },
 * })
 * console.log(task.task) // "lint:schema-first"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboSummaryTask extends S.Class<TurboSummaryTask>($I`TurboSummaryTask`)(
  {
    taskId: S.String,
    task: S.String,
    hash: S.String,
    cache: S.Struct({ status: TurboSummaryCacheStatus }),
    execution: TurboSummaryExecution.pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("TurboSummaryTask", {
    description: "One Turbo run-summary task row: id, bare name, hash, cache status, exit.",
  })
) {}

/**
 * The slice of a `.turbo/runs/<id>.json` summary a lane digest reads.
 *
 * **Example** (Decode a run summary)
 *
 * ```ts
 * import { TurboRunSummary } from "@beep/repo-cli/test/Quality"
 *
 * const summary = TurboRunSummary.make({
 *   id: "3JCkNZQUJ1YQQRevyz15nJdJnHE",
 *   execution: { startTime: 1_789_178_636_688, endTime: 1_789_178_649_774, exitCode: 0 },
 *   tasks: [],
 * })
 * console.log(summary.tasks.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboRunSummary extends S.Class<TurboRunSummary>($I`TurboRunSummary`)(
  {
    id: S.String,
    execution: S.Struct({ startTime: S.Finite, endTime: S.Finite, exitCode: S.Finite }),
    tasks: S.Array(TurboSummaryTask),
  },
  $I.annote("TurboRunSummary", { description: "Turbo run summary subset: id, execution window and task rows." })
) {}

/**
 * One task's contribution to a lane digest.
 *
 * **Example** (Describe a folded task)
 *
 * ```ts
 * import { TurboLaneTaskHash } from "@beep/repo-cli/test/Quality"
 *
 * const row = TurboLaneTaskHash.make({ taskId: "//#lint:typos", hash: "b2", cacheStatus: "HIT" })
 * console.log(row.cacheStatus) // "HIT"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboLaneTaskHash extends S.Class<TurboLaneTaskHash>($I`TurboLaneTaskHash`)(
  { taskId: S.String, hash: S.String, cacheStatus: TurboSummaryCacheStatus },
  $I.annote("TurboLaneTaskHash", { description: "Task id, Turbo hash and cache status folded into a lane digest." })
) {}

/**
 * A lane's Turbo-derived input digest: the summaries it came from and the task hashes it folds.
 *
 * **Details**
 *
 * The digest is the SHA-256 of the sorted `taskId=hash` lines, so it does not depend on Turbo's
 * task ordering and changes whenever any folded task hash changes. Only tasks that passed
 * (`execution.exitCode === 0`) or replayed from cache (`HIT`) fold in; a failed task yields no
 * digest, so a lane never records a reusable digest for a red run. A lane that ran several Turbo
 * invocations (the Fallow CI lane writes one summary per sublane) folds every summary it wrote.
 *
 * **Example** (Build a digest by hand)
 *
 * ```ts
 * import { TurboLaneDigest } from "@beep/repo-cli/test/Quality"
 *
 * const digest = TurboLaneDigest.make({ digest: "ab12", summaryIds: ["run"], tasks: [] })
 * console.log(digest.summaryIds.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboLaneDigest extends S.Class<TurboLaneDigest>($I`TurboLaneDigest`)(
  { digest: S.String, summaryIds: S.Array(S.String), tasks: S.Array(TurboLaneTaskHash) },
  $I.annote("TurboLaneDigest", { description: "Lane input digest folded from one Turbo run summary's task hashes." })
) {}

const decodeSummary = S.decodeUnknownEffect(S.fromJsonString(TurboRunSummary));

const bareTaskName = (taskId: string): string =>
  pipe(
    Str.split(taskId, "#"),
    A.last,
    O.getOrElse(() => taskId)
  );

const taskPassed = (task: TurboSummaryTask): boolean =>
  task.cache.status === "HIT" || (task.execution?.exitCode ?? null) === 0;

const rowOrder = Order.mapInput(Order.String, (row: TurboLaneTaskHash) => row.taskId);

const selectedRows = (tasks: ReadonlyArray<TurboSummaryTask>): ReadonlyArray<TurboLaneTaskHash> =>
  A.map(tasks, (task) =>
    TurboLaneTaskHash.make({ taskId: task.taskId, hash: task.hash, cacheStatus: task.cache.status })
  );

const digestRows = (summaryIds: ReadonlyArray<string>, rows: ReadonlyArray<TurboLaneTaskHash>): TurboLaneDigest => {
  const sorted = pipe(rows, A.sortBy(rowOrder));
  const digest = createHash("sha256")
    .update(
      A.join(
        A.map(sorted, (row) => `${row.taskId}=${row.hash}`),
        "\n"
      )
    )
    .digest("hex");
  return TurboLaneDigest.make({ digest, summaryIds, tasks: sorted });
};

const selectTasks = (summary: TurboRunSummary, taskNames: ReadonlyArray<string>): ReadonlyArray<TurboSummaryTask> => {
  const wanted = HashSet.fromIterable(taskNames);
  return A.isReadonlyArrayEmpty(taskNames)
    ? summary.tasks
    : A.filter(summary.tasks, (task) => HashSet.has(wanted, bareTaskName(task.taskId)));
};

/**
 * Fold the task hashes of one summary into a lane digest, selecting tasks by bare name.
 *
 * **Example** (Digest two root tasks)
 *
 * ```ts
 * import { TurboRunSummary, turboLaneDigestFromSummary } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const summary = TurboRunSummary.make({
 *   id: "run",
 *   execution: { startTime: 1, endTime: 2, exitCode: 0 },
 *   tasks: [
 *     { taskId: "//#lint:allowlist", task: "lint:allowlist", hash: "a1", cache: { status: "MISS" }, execution: { exitCode: 0 } },
 *     { taskId: "//#lint:typos", task: "lint:typos", hash: "b2", cache: { status: "HIT" } },
 *   ],
 * })
 * const digest = turboLaneDigestFromSummary(summary, ["lint:allowlist", "lint:typos"])
 * console.log(O.isSome(digest)) // true
 * ```
 *
 * **Gotchas**
 *
 * An empty task list selects every task in the summary. Any selected task that neither passed
 * nor replayed from cache makes the result `None`.
 *
 * @param summary - A decoded Turbo run summary.
 * @param taskNames - Bare task names (`lint:allowlist`, never `//#lint:allowlist`) to fold.
 * @returns The digest, or `None` when no selected task exists or one of them failed.
 * @category digests
 * @since 0.0.0
 */
export const turboLaneDigestFromSummary: {
  (taskNames: ReadonlyArray<string>): (summary: TurboRunSummary) => O.Option<TurboLaneDigest>;
  (summary: TurboRunSummary, taskNames: ReadonlyArray<string>): O.Option<TurboLaneDigest>;
} = dual(2, (summary: TurboRunSummary, taskNames: ReadonlyArray<string>): O.Option<TurboLaneDigest> => {
  const selected = selectTasks(summary, taskNames);
  if (A.isReadonlyArrayEmpty(selected) || !A.every(selected, taskPassed)) {
    return O.none();
  }
  return O.some(digestRows([summary.id], selectedRows(selected)));
});

const summaryStartOrder = Order.mapInput(Order.Number, (summary: TurboRunSummary) => summary.execution.startTime);

// Rows arrive oldest first: a later row for the same task id overwrites the earlier hash.
const newestRowsByTask = (rows: ReadonlyArray<TurboLaneTaskHash>): ReadonlyArray<TurboLaneTaskHash> =>
  A.fromIterable(
    HashMap.values(
      A.reduce(rows, HashMap.empty<string, TurboLaneTaskHash>(), (acc, row) => HashMap.set(acc, row.taskId, row))
    )
  );

/**
 * Fold the task hashes of every run summary the current attempt wrote into one lane digest.
 *
 * **Details**
 *
 * Only summaries whose `execution.startTime` is at or after `startedAtIso` count as this
 * attempt's own (§7.1.5 freshness); older summaries in `.turbo/runs` are ignored, and files that
 * fail to decode are skipped rather than failing the lane. When a task id appears in several fresh
 * summaries (a re-run inside the lane) the newest summary's hash wins; any selected task that
 * neither passed nor replayed from cache yields `None`.
 *
 * **Example** (Digest after a lane step)
 *
 * ```ts
 * import { readTurboLaneDigest } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const program = readTurboLaneDigest("/repo", "2026-09-12T04:00:00.000Z", ["lint:allowlist"])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Repository root that owns `.turbo/runs`.
 * @param startedAtIso - ISO timestamp the lane step started at; older summaries are ignored.
 * @param taskNames - Bare task names the lane invoked.
 * @returns The folded digest, or `None` when no fresh passing summary covers the tasks.
 * @category digests
 * @since 0.0.0
 */
export const readTurboLaneDigest = Effect.fn("QualityTasks.readTurboLaneDigest")(function* (
  repoRoot: string,
  startedAtIso: string,
  taskNames: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runsDirectory = path.join(repoRoot, ".turbo", "runs");
  const startedAt = Date.parse(startedAtIso);
  const entries = yield* fs.readDirectory(runsDirectory).pipe(Effect.orElseSucceed(A.empty<string>));
  const summaries = yield* Effect.forEach(
    A.filter(entries, Str.endsWith(".json")),
    (entry) => fs.readFileString(path.join(runsDirectory, entry)).pipe(Effect.flatMap(decodeSummary), Effect.option),
    { concurrency: 4 }
  );
  const fresh = pipe(
    A.getSomes(summaries),
    A.filter((summary) => summary.execution.startTime >= startedAt),
    A.sortBy(summaryStartOrder)
  );
  const selected = A.flatMap(fresh, (summary) => selectTasks(summary, taskNames));
  if (A.isReadonlyArrayEmpty(selected) || !A.every(selected, taskPassed)) {
    return O.none<TurboLaneDigest>();
  }
  return O.some(
    digestRows(
      A.map(fresh, (summary) => summary.id),
      newestRowsByTask(selectedRows(selected))
    )
  );
});

/**
 * Environment variable through which a parent quality step names the JSONL ledger a wrapper
 * lane child (`bun run beep ci lane <id>`) declares its own Turbo digests to.
 *
 * **Example** (Name the ledger variable)
 *
 * ```ts
 * import { TURBO_LANE_LEDGER_ENV } from "@beep/repo-cli/test/Quality"
 *
 * console.log(TURBO_LANE_LEDGER_ENV) // "BEEP_TURBO_LANE_LEDGER"
 * ```
 *
 * @category digests
 * @since 0.0.0
 */
export const TURBO_LANE_LEDGER_ENV = "BEEP_TURBO_LANE_LEDGER";

/**
 * Fold the digests a wrapper lane child declared, in declaration order, into one lane digest.
 *
 * **Example** (A later declaration overrides an earlier hash)
 *
 * ```ts
 * import { TurboLaneDigest, foldTurboLaneDigests } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const row = (hash: string, cacheStatus: "HIT" | "MISS") => ({ taskId: "//#lint:typos", hash, cacheStatus })
 * const first = TurboLaneDigest.make({ digest: "a", summaryIds: ["run-1"], tasks: [row("h1", "MISS")] })
 * const second = TurboLaneDigest.make({ digest: "b", summaryIds: ["run-2"], tasks: [row("h2", "HIT")] })
 * const folded = foldTurboLaneDigests([first, second])
 * console.log(O.getOrElse(O.map(folded, (digest) => digest.tasks[0]?.hash), () => "none")) // "h2"
 * ```
 *
 * **Gotchas**
 *
 * An empty declaration list folds to `None`, so a child that ran no direct Turbo step reports no
 * digest rather than an empty one.
 *
 * @param digests - Digests in the order the child declared them.
 * @returns The folded digest, or `None` when nothing was declared.
 * @category digests
 * @since 0.0.0
 */
export const foldTurboLaneDigests = (digests: ReadonlyArray<TurboLaneDigest>): O.Option<TurboLaneDigest> =>
  A.isReadonlyArrayEmpty(digests)
    ? O.none()
    : O.some(
        digestRows(
          A.flatMap(digests, (digest) => digest.summaryIds),
          newestRowsByTask(A.flatMap(digests, (digest) => digest.tasks))
        )
      );

const encodeLedgerLine = S.encodeSync(S.fromJsonString(TurboLaneDigest));
const decodeLedgerLine = S.decodeUnknownEffect(S.fromJsonString(TurboLaneDigest));

/**
 * Append one declared digest to a wrapper lane ledger, creating the ledger directory on demand.
 *
 * **Example** (Declare a digest)
 *
 * ```ts
 * import { TurboLaneDigest, appendTurboLaneLedger } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const digest = TurboLaneDigest.make({ digest: "a", summaryIds: ["run-1"], tasks: [] })
 * console.log(Effect.isEffect(appendTurboLaneLedger("/tmp/lane-ledger.jsonl", digest))) // true
 * ```
 *
 * @param ledgerPath - The JSONL file the parent named through `TURBO_LANE_LEDGER_ENV`.
 * @param digest - The digest of one direct Turbo step the child ran.
 * @category digests
 * @since 0.0.0
 */
export const appendTurboLaneLedger = Effect.fn("QualityTasks.appendTurboLaneLedger")(function* (
  ledgerPath: string,
  digest: TurboLaneDigest
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(ledgerPath), { recursive: true });
  yield* fs.writeFileString(ledgerPath, `${encodeLedgerLine(digest)}\n`, { flag: "a" });
});

/**
 * Read a wrapper lane ledger and fold every digest the child declared.
 *
 * **Example** (Read a ledger)
 *
 * ```ts
 * import { readTurboLaneLedger } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readTurboLaneLedger("/tmp/lane-ledger.jsonl"))) // true
 * ```
 *
 * **Gotchas**
 *
 * A missing ledger reads as no declarations. A malformed line fails the read, so a corrupt
 * ledger never yields a partial digest.
 *
 * @param ledgerPath - The JSONL file the parent named through `TURBO_LANE_LEDGER_ENV`.
 * @returns The folded digest, or `None` when the child declared nothing.
 * @category digests
 * @since 0.0.0
 */
export const readTurboLaneLedger = Effect.fn("QualityTasks.readTurboLaneLedger")(function* (ledgerPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(ledgerPath).pipe(Effect.orElseSucceed(() => ""));
  const rows = yield* Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) => decodeLedgerLine(line));
  return foldTurboLaneDigests(rows);
});
