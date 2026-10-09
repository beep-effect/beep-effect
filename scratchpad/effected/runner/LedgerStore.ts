/**
 * Reading, writing and transitioning the ledger file, including the git-log
 * backfill of stage commit shas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { catalogEntry, MODULE_CATALOG, rowId } from "./Catalog.ts";
import { LedgerInvalid, LedgerMissing, LedgerRowMissing, LedgerStageSkip } from "./Audit.errors.ts";
import {
  BacklogItem,
  Deviation,
  DONE_STAGE,
  ExportEntry,
  Ledger,
  LedgerCheckpoint,
  LedgerJson,
  LedgerRow,
  type ModuleName,
  nextStage,
  ReviewRound,
  type Stage,
  StageCommit,
} from "./Ledger.schema.ts";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import { capture } from "./Process.ts";
import type { RunnerConfig } from "./Paths.ts";

/**
 * Repo-relative path of the ledger file.
 *
 * **Example** (Name the ledger)
 *
 * ```ts
 * import { LEDGER_PATH } from "@beep/scratchpad/effected/runner/LedgerStore"
 *
 * console.log(LEDGER_PATH) // "scratchpad/effected/PORT_LEDGER.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEDGER_PATH = "scratchpad/effected/PORT_LEDGER.json";

const decodeLedger = S.decodeUnknownEffect(LedgerJson);
const encodeLedger = S.encodeEffect(LedgerJson);

const nowIso = Effect.map(DateTime.now, DateTime.formatIso);

/**
 * A pending row for a module, from the catalog alone.
 *
 * **Example** (Seed a row)
 *
 * ```ts
 * import { pendingRow } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import * as O from "effect/Option"
 *
 * console.log(O.map(pendingRow("yaml"), (row) => row.id)) // some("w1-yaml")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pendingRow = (module: ModuleName): O.Option<LedgerRow> =>
  O.map(catalogEntry(module), (entry) =>
    LedgerRow.make({
      id: rowId(entry.wave, module),
      module,
      wave: entry.wave,
      position: entry.position,
      stage: 0,
      status: "pending",
      provisionalHome: entry.provisionalHome,
      upstreamPaths: { src: `packages/${module}/src`, test: `packages/${module}/__test__` },
      exportsExpected: [],
      exportsAdded: [],
      newDeps: [],
      fixturesBytes: 0,
      deviations: [],
      backlog: [],
      reviewRounds: [],
      commits: [],
      blocked: null,
      notes: [],
      closedAt: null,
    })
  );

/**
 * Reads and validates the ledger.
 *
 * **Example** (Read the ledger)
 *
 * ```ts
 * import { readLedger } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = readLedger(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readLedger = Effect.fn("Ledger.read")(function* (config: RunnerConfig) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(config.repoRoot, LEDGER_PATH);
  if (!(yield* fs.exists(file))) {
    return yield* LedgerMissing.make({ path: LEDGER_PATH });
  }
  const text = yield* fs.readFileString(file);
  return yield* decodeLedger(text).pipe(
    Effect.mapError((issue) => LedgerInvalid.make({ path: LEDGER_PATH, detail: String(issue) }))
  );
});

/**
 * Writes the ledger as two-space JSON with a trailing newline.
 *
 * **Example** (Write a ledger)
 *
 * ```ts
 * import { Ledger } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import { writeLedger } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const ledger = Ledger.make({ version: 1, effectedCommit: "abc", startedAt: "now", lastCheckpoint: null, rows: [], notes: [] })
 * const program = writeLedger(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), ledger)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const writeLedger = Effect.fn("Ledger.write")(function* (config: RunnerConfig, ledger: Ledger) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* encodeLedger(ledger).pipe(
    Effect.mapError((issue) => LedgerInvalid.make({ path: LEDGER_PATH, detail: String(issue) }))
  );
  yield* fs.writeFileString(path.join(config.repoRoot, LEDGER_PATH), `${text}\n`);
});

/**
 * Creates the ledger with one pending row per catalog module, recording the
 * upstream commit; refuses when a ledger already exists.
 *
 * **Example** (Initialize the ledger)
 *
 * ```ts
 * import { initLedger } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = initLedger(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "abc")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const initLedger = Effect.fn("Ledger.init")(function* (config: RunnerConfig, effectedCommit: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(config.repoRoot, LEDGER_PATH);
  if (yield* fs.exists(file)) {
    return yield* LedgerInvalid.make({ path: LEDGER_PATH, detail: "already exists; init refuses to overwrite" });
  }
  const ledger = Ledger.make({
    version: 1,
    effectedCommit,
    startedAt: yield* nowIso,
    lastCheckpoint: null,
    rows: A.getSomes(A.map(MODULE_CATALOG, (entry) => pendingRow(entry.module))),
    notes: [],
  });
  yield* writeLedger(config, ledger);
  return ledger;
});

/**
 * The row for a module, or {@link LedgerRowMissing}.
 *
 * **Example** (Find a row)
 *
 * ```ts
 * import { Ledger } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import { findRow } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import * as Effect from "effect/Effect"
 *
 * import * as Exit from "effect/Exit"
 *
 * const ledger = Ledger.make({ version: 1, effectedCommit: "abc", startedAt: "now", lastCheckpoint: null, rows: [], notes: [] })
 * console.log(Exit.isFailure(Effect.runSyncExit(findRow(ledger, "yaml")))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const findRow: {
  (module: ModuleName): (ledger: Ledger) => Effect.Effect<LedgerRow, LedgerRowMissing>;
  (ledger: Ledger, module: ModuleName): Effect.Effect<LedgerRow, LedgerRowMissing>;
} = dual(
  2,
  (ledger: Ledger, module: ModuleName): Effect.Effect<LedgerRow, LedgerRowMissing> =>
    Effect.fromOption(
      A.findFirst(ledger.rows, (row) => row.module === module),
      () => LedgerRowMissing.make({ module })
    )
);

const replaceRow = (ledger: Ledger, row: LedgerRow): Ledger =>
  Ledger.make({ ...ledger, rows: A.map(ledger.rows, (existing) => (existing.module === row.module ? row : existing)) });

/**
 * Reads the ledger, applies `update` to one row, writes the result, and
 * returns the updated row.
 *
 * **Example** (Append a note)
 *
 * ```ts
 * import { LedgerRow } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import { updateRow } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = updateRow(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "yaml", (row) =>
 *   Effect.succeed(LedgerRow.make({ ...row, notes: [...row.notes, "hello"] }))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const updateRow = Effect.fn("Ledger.updateRow")(function* <E, R>(
  config: RunnerConfig,
  module: ModuleName,
  update: (row: LedgerRow, ledger: Ledger) => Effect.Effect<LedgerRow, E, R>
) {
  const ledger = yield* readLedger(config);
  const row = yield* findRow(ledger, module);
  const next = yield* update(row, ledger);
  yield* writeLedger(config, replaceRow(ledger, next));
  return next;
});

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The newest commit whose subject names `module` as a whole word and carries
 * the `(effected-port S<stage>)` suffix, or none.
 *
 * **Example** (Look up a stage commit)
 *
 * ```ts
 * import { findStageCommit } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import * as Effect from "effect/Effect"
 *
 * const program = findStageCommit("/repo", "yaml", 0)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const findStageCommit = Effect.fn("Ledger.findStageCommit")(function* (
  repoRoot: string,
  module: ModuleName,
  stage: Stage
) {
  const sha = yield* capture({
    command: "git",
    args: [
      "log",
      "-E",
      "-n",
      "1",
      "--format=%H",
      `--grep=(^|[^a-z-])${escapeRegex(module)}([^a-z-]|$)`,
      `--grep=\\(effected-port S${stage}\\)`,
      "--all-match",
    ],
    cwd: repoRoot,
  });
  return sha.length === 0 ? O.none<string>() : O.some(sha);
});

/**
 * Fills every `sha: null` stage commit of a row that git can now resolve.
 *
 * **Example** (Backfill a row)
 *
 * ```ts
 * import { backfillCommits } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { LedgerRow } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import * as Effect from "effect/Effect"
 *
 * const row = LedgerRow.make({
 *   id: "w1-yaml", module: "yaml", wave: 1, position: 2, stage: 1, status: "in-progress",
 *   provisionalHome: "foundation/modeling", upstreamPaths: { src: "packages/yaml/src", test: "packages/yaml/__test__" },
 *   exportsExpected: [], exportsAdded: [], newDeps: [], fixturesBytes: 0, deviations: [], backlog: [],
 *   reviewRounds: [], commits: [{ stage: 0, sha: null }], blocked: null, notes: [], closedAt: null,
 * })
 * console.log(Effect.isEffect(backfillCommits("/repo", row))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const backfillCommits = Effect.fn("Ledger.backfillCommits")(function* (repoRoot: string, row: LedgerRow) {
  const commits = yield* Effect.forEach(row.commits, (commit) =>
    commit.sha === null
      ? Effect.map(findStageCommit(repoRoot, row.module, commit.stage), (sha) =>
          StageCommit.make({ stage: commit.stage, sha: O.getOrNull(sha) })
        )
      : Effect.succeed(commit)
  );
  return LedgerRow.make({ ...row, commits });
});

/**
 * Moves a row to `stage`: one step forward records a pending commit for the
 * stage being left; a step back records a rollback note; a jump past the next
 * stage is refused. Reaching stage 5 marks the row done.
 *
 * **Example** (Advance a row one stage)
 *
 * ```ts
 * import { setStage } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = setStage(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "yaml", 1, "")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const setStage = Effect.fn("Ledger.setStage")(function* (
  config: RunnerConfig,
  module: ModuleName,
  stage: Stage,
  note: string
) {
  const at = yield* nowIso;
  const updated = yield* updateRow(config, module, Effect.fnUntraced(function* (row) {
      const forward = O.getOrNull(nextStage(row.stage));
      if (stage > row.stage && stage !== forward) {
        return yield* LedgerStageSkip.make({ module, from: row.stage, to: stage });
      }
      const backfilled = yield* backfillCommits(config.repoRoot, row);
      const commits =
        stage === forward
          ? A.append(backfilled.commits, StageCommit.make({ stage: row.stage, sha: null }))
          : backfilled.commits;
      const notes = [
        ...row.notes,
        ...(stage < row.stage ? [`${at} rolled back from stage ${row.stage} to ${stage}: ${note}`] : []),
        ...(note.length > 0 && stage >= row.stage ? [`${at} S${stage}: ${note}`] : []),
      ];
      const done = stage === DONE_STAGE;
      return LedgerRow.make({
        ...backfilled,
        stage,
        status: done ? "done" : "in-progress",
        closedAt: done ? at : null,
        blocked: null,
        commits,
        notes,
      });
    })
  );
  const ledger = yield* readLedger(config);
  const checkpoint = LedgerCheckpoint.make({
    module,
    stage,
    commit: O.getOrNull(O.flatMap(A.last(updated.commits), (commit) => O.fromNullOr(commit.sha))),
    at,
  });
  yield* writeLedger(config, Ledger.make({ ...ledger, lastCheckpoint: checkpoint }));
  return updated;
});

/**
 * Marks a row blocked at its current stage with a reason and open findings.
 *
 * **Example** (Block a row)
 *
 * ```ts
 * import { blockRow } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = blockRow(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "yaml", "review-limit", [])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const blockRow = Effect.fn("Ledger.blockRow")(function* (
  config: RunnerConfig,
  module: ModuleName,
  reason: string,
  findings: ReadonlyArray<string>
) {
  return yield* updateRow(config, module, (row) =>
    Effect.succeed(
      LedgerRow.make({
        ...row,
        status: "blocked",
        blocked: { stage: row.stage, reason, findings: [...findings] },
      })
    )
  );
});

/**
 * Appends a timestamped note to a row.
 *
 * **Example** (Note a decision)
 *
 * ```ts
 * import { noteRow } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const program = noteRow(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "yaml", "kept vi.mock in S1")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const noteRow = Effect.fn("Ledger.noteRow")(function* (config: RunnerConfig, module: ModuleName, note: string) {
  const at = yield* nowIso;
  return yield* updateRow(config, module, (row) =>
    Effect.succeed(LedgerRow.make({ ...row, notes: [...row.notes, `${at} ${note}`] }))
  );
});

/**
 * The rows that are not done, in ledger order.
 *
 * **Example** (List open rows)
 *
 * ```ts
 * import { Ledger } from "@beep/scratchpad/effected/runner/Ledger.schema"
 * import { openRows } from "@beep/scratchpad/effected/runner/LedgerStore"
 *
 * const ledger = Ledger.make({ version: 1, effectedCommit: "abc", startedAt: "now", lastCheckpoint: null, rows: [], notes: [] })
 * console.log(openRows(ledger).length) // 0
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const openRows = (ledger: Ledger): ReadonlyArray<LedgerRow> =>
  A.filter(ledger.rows, (row) => row.status !== "done");

const $I = $ScratchpadId.create("effected/runner/LedgerStore");

/**
 * Row fields that accumulate records over a module's life.
 *
 * **Example** (Guard a field name)
 *
 * ```ts
 * import { AppendField } from "@beep/scratchpad/effected/runner/LedgerStore"
 *
 * console.log(AppendField.is.deviations("deviations")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AppendField = LiteralKit(["deviations", "backlog", "reviewRounds", "exportsAdded"]).annotate(
  $I.annote("AppendField", { description: "A ledger row field that accumulates records." })
);

/**
 * The union of append field literals.
 *
 * @see {@link AppendField} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type AppendField = typeof AppendField.Type;

const decodeDeviations = S.decodeUnknownEffect(S.fromJsonString(S.Array(Deviation)));
const decodeBacklog = S.decodeUnknownEffect(S.fromJsonString(S.Array(BacklogItem)));
const decodeRounds = S.decodeUnknownEffect(S.fromJsonString(S.Array(ReviewRound)));
const decodeExports = S.decodeUnknownEffect(S.fromJsonString(S.Array(ExportEntry)));

/**
 * Appends schema-validated records (a JSON array) to one accumulating field
 * of a row; review rounds replace an existing entry with the same round.
 *
 * **Example** (Record a deviation)
 *
 * ```ts
 * import { appendToRow } from "@beep/scratchpad/effected/runner/LedgerStore"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const config = RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" })
 * console.log(Effect.isEffect(appendToRow(config, "jsonc", { field: "deviations", json: "[]" }))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const appendToRow = Effect.fn("Ledger.appendToRow")(function* (
  config: RunnerConfig,
  module: ModuleName,
  payload: { readonly field: AppendField; readonly json: string }
) {
  const invalid = (issue: unknown) => LedgerInvalid.make({ path: `--append ${payload.field}`, detail: String(issue) });
  return yield* updateRow(config, module, (row) =>
    AppendField.$match(payload.field, {
      deviations: () =>
        Effect.map(decodeDeviations(payload.json).pipe(Effect.mapError(invalid)), (items) =>
          LedgerRow.make({ ...row, deviations: [...row.deviations, ...items] })
        ),
      backlog: () =>
        Effect.map(decodeBacklog(payload.json).pipe(Effect.mapError(invalid)), (items) =>
          LedgerRow.make({ ...row, backlog: [...row.backlog, ...items] })
        ),
      reviewRounds: () =>
        Effect.map(decodeRounds(payload.json).pipe(Effect.mapError(invalid)), (items) =>
          LedgerRow.make({
            ...row,
            reviewRounds: [
              ...A.filter(row.reviewRounds, (existing) => !A.some(items, (item) => item.round === existing.round)),
              ...items,
            ],
          })
        ),
      exportsAdded: () =>
        Effect.map(decodeExports(payload.json).pipe(Effect.mapError(invalid)), (items) =>
          LedgerRow.make({ ...row, exportsAdded: [...row.exportsAdded, ...items] })
        ),
    })
  );
});
