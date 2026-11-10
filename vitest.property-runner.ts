// Deep property sweep runner (BEEP_FC_NUM_RUNS > 0 only; see `propertySweepSelection` in
// vitest.shared.ts). The shared config resolves, per collected test file, the 1-based source lines
// that are provably plain registrations and provides them under `beepPropertySweepPlainLines`.
// After collection this runner marks every test whose task location is on one of those lines as
// skipped, then skips every suite (and file) whose descendants are all skipped or todo, so their
// `beforeAll`/`layer(...)` setup never runs. Files absent from the table keep every test.
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { TestRunner } from "vitest";
import type {
  RunnerTask,
  RunnerTaskEventPack,
  RunnerTaskResultPack,
  RunnerTestCase,
  RunnerTestFile,
  RunnerTestSuite,
  VitestTestRunner,
} from "vitest";

const providedKey = "beepPropertySweepPlainLines";

const isRunnable = (task: RunnerTask): boolean => task.mode === "run" || task.mode === "queued";
const isInactive = (task: RunnerTask): boolean => task.mode === "skip" || task.mode === "todo";

const log = (message: string): void => Effect.runSync(Console.info(`[property-sweep] ${message}`));

type Pruned = { readonly kept: number; readonly skipped: ReadonlyArray<RunnerTestCase> };

// Skip plain tests, then collapse suites whose children are all inactive. Counts cover the tests
// that were runnable when collection finished.
const prune = (suite: RunnerTestSuite, plainLines: ReadonlyArray<number>): Pruned => {
  const pruned = A.reduce(suite.tasks, { kept: 0, skipped: [] }, (acc: Pruned, task): Pruned => {
    if (task.type === "suite") {
      const child = prune(task, plainLines);
      return { kept: acc.kept + child.kept, skipped: A.appendAll(acc.skipped, child.skipped) };
    }
    if (!isRunnable(task)) return acc;
    const line = task.location?.line;
    if (P.isNumber(line) && A.contains(plainLines, line)) {
      task.mode = "skip";
      task.result = { state: "skip" };
      return { ...acc, skipped: A.append(acc.skipped, task) };
    }
    return { ...acc, kept: acc.kept + 1 };
  });
  if (isRunnable(suite) && A.isReadonlyArrayNonEmpty(suite.tasks) && A.every(suite.tasks, isInactive)) {
    suite.mode = "skip";
  }
  return pruned;
};

const isPlainLineTable = (value: unknown): value is Readonly<Record<string, ReadonlyArray<number>>> =>
  P.isObject(value) && A.every(R.values(value as Record<string, unknown>), (lines) => A.isArray(lines));

/** Vitest runner for the deep property sweep: skips provably plain tests after collection. */
export default class PropertySweepRunner extends TestRunner {
  // Vitest installs this RPC bridge on every runner instance after construction.
  declare onTaskUpdate?: VitestTestRunner["onTaskUpdate"];

  onCollected(files: ReadonlyArray<RunnerTestFile>): Promise<void> {
    const provided: unknown = this.injectValue(providedKey);
    const table = isPlainLineTable(provided) ? provided : {};
    const skipped = A.flatMap(files, (file): ReadonlyArray<RunnerTestCase> => {
      if (file.result?.state === "fail") return [];
      const plainLines = R.get(table, file.name);
      if (O.isNone(plainLines)) {
        log(`${file.name}: inline property file, every test kept`);
        return [];
      }
      const pruned = prune(file, plainLines.value);
      log(`${file.name}: ${pruned.kept} kept, ${A.length(pruned.skipped)} skipped`);
      return pruned.skipped;
    });
    return Effect.runPromise(
      Effect.promise(() =>
        Promise.resolve(
          this.onTaskUpdate?.(
            A.map(skipped, (test): RunnerTaskResultPack => [test.id, test.result, test.meta]),
            A.map(skipped, (test): RunnerTaskEventPack => [test.id, "test-finished", undefined])
          )
        )
      )
    );
  }
}
