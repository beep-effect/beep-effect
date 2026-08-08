/**
 * Progress rendering and bounded concurrency helpers for Files commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import defaultChalk from "@beep/chalk";
import defaultColors from "@beep/colors";
import { A } from "@beep/utils";
import { Effect, Ref, Semaphore, Terminal } from "effect";
import { dual } from "effect/Function";
import {
  clearLine,
  isProgressEnabled,
  progressFraction,
  progressPercent,
  renderProgressBar,
} from "../../internal/cli/Progress.ts";
import type { Chalk } from "@beep/chalk";
import type { Colors } from "@beep/colors";

const defaultBarWidth = 28;

/**
 * Shared concurrency caps for Files command phases.
 *
 * **Example** (Import concurrency caps)
 *
 * ```ts
 * import { FilesConcurrency } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof FilesConcurrency = FilesConcurrency
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FilesConcurrency = {
  ffmpeg: 2,
  image: 4,
  metadata: 8,
  scan: 16,
} as const;

/**
 * Render options for a Files progress bar.
 *
 * @category models
 * @since 0.0.0
 */
interface FilesProgressRenderOptions {
  readonly chalk?: Chalk;
  readonly colors?: Colors;
  readonly completed: number;
  readonly label: string;
  readonly total: number;
  readonly width?: number;
}

/**
 * Runtime options for progress-tracked concurrent work.
 *
 * @category models
 * @since 0.0.0
 */
interface FilesProgressRunOptions {
  readonly concurrency: number;
  readonly enabled?: boolean;
  readonly label: string;
}

const progressConcurrency = (total: number, concurrency: number): number =>
  Math.max(1, Math.min(Math.max(1, Math.floor(concurrency)), Math.max(1, total)));

/**
 * Return true when live Files progress should be rendered.
 *
 * **Example** (Check progress enabled)
 *
 * ```ts
 * import { isFilesProgressEnabled } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof isFilesProgressEnabled = isFilesProgressEnabled
 * ```
 *
 * @param enabled - Explicit caller opt-in for live progress rendering.
 * @returns True when progress is enabled and stdout is attached to a TTY.
 * @category utilities
 * @since 0.0.0
 */
export const isFilesProgressEnabled = isProgressEnabled;

/**
 * Render a single-line ASCII progress bar.
 *
 * **Example** (Render progress bar)
 *
 * ```ts
 * import { renderFilesProgressBar } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof renderFilesProgressBar = renderFilesProgressBar
 * ```
 *
 * @param options - Progress bar rendering options.
 * @returns Rendered single-line progress text.
 * @category utilities
 * @since 0.0.0
 */
export const renderFilesProgressBar = (options: FilesProgressRenderOptions): string => {
  const { chalk = defaultChalk, colors = defaultColors, completed, label, total, width = defaultBarWidth } = options;
  const safeTotal = Math.max(0, Math.floor(total));
  const safeCompleted = Math.min(Math.max(0, Math.floor(completed)), safeTotal);
  const bar = renderProgressBar({
    colorEmpty: colors.gray,
    colorFilled: colors.greenBright,
    fraction: progressFraction(safeCompleted, safeTotal),
    width,
  });
  const title = chalk.cyan.bold(`files ${label}`);
  const count = chalk.gray(`${safeCompleted}/${safeTotal}`);
  const percent = colors.yellow(`${progressPercent(safeCompleted, safeTotal)}%`);

  return `${title} ${colors.gray("<")}${bar}${colors.gray(">")} ${count} ${percent}`;
};

/**
 * Run an array of effects with bounded concurrency and optional TTY progress.
 *
 * **Example** (Run effects with progress)
 *
 * ```ts
 * import { runFilesProgressAll } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof runFilesProgressAll = runFilesProgressAll
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runFilesProgressAll: {
  <A2, E, R>(
    options: FilesProgressRunOptions
  ): (effects: ReadonlyArray<Effect.Effect<A2, E, R>>) => Effect.Effect<ReadonlyArray<A2>, E, R | Terminal.Terminal>;
  <A2, E, R>(
    effects: ReadonlyArray<Effect.Effect<A2, E, R>>,
    options: FilesProgressRunOptions
  ): Effect.Effect<ReadonlyArray<A2>, E, R | Terminal.Terminal>;
} = dual(
  2,
  Effect.fnUntraced(function* <A2, E, R>(
    effects: ReadonlyArray<Effect.Effect<A2, E, R>>,
    options: FilesProgressRunOptions
  ): Effect.fn.Return<ReadonlyArray<A2>, E, R | Terminal.Terminal> {
    const total = A.length(effects);
    const concurrency = progressConcurrency(total, options.concurrency);

    if (!isFilesProgressEnabled(options.enabled) || total === 0) {
      return yield* Effect.all(effects, { concurrency });
    }

    const terminal = yield* Terminal.Terminal;
    const completedRef = yield* Ref.make(0);
    const finishedRef = yield* Ref.make(false);
    const renderAt = (completed: number, newline: boolean) =>
      terminal
        .display(
          `${clearLine}${renderFilesProgressBar({
            completed,
            label: options.label,
            total,
          })}${newline ? "\n" : ""}`
        )
        .pipe(Effect.ignore);
    const renderLock = yield* Semaphore.make(1);
    const renderLocked = (completed: number, newline: boolean) => renderLock.withPermit(renderAt(completed, newline));
    const trackedEffects = A.map(effects, (effect) =>
      effect.pipe(
        Effect.tap(() =>
          Ref.updateAndGet(completedRef, (value) => Math.min(total, value + 1)).pipe(
            Effect.flatMap((completed) => renderLocked(completed, false))
          )
        )
      )
    );

    yield* renderLocked(0, false);
    return yield* Effect.all(trackedEffects, { concurrency }).pipe(
      Effect.tap(
        Effect.fnUntraced(function* () {
          yield* Ref.set(finishedRef, true);
          yield* renderLocked(total, true);
        })
      ),
      Effect.ensuring(
        Ref.get(finishedRef).pipe(
          Effect.flatMap((finished) => (finished ? Effect.void : terminal.display("\n").pipe(Effect.ignore)))
        )
      )
    );
  })
);
/**
 * Map items to effects, then run them with bounded concurrency and optional TTY progress.
 *
 * **Example** (Map and run with progress)
 *
 * ```ts
 * import { runFilesProgressForEach } from "@beep/repo-cli/commands/Files"
 *
 * const example: typeof runFilesProgressForEach = runFilesProgressForEach
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runFilesProgressForEach: {
  <A2, B, E, R>(
    f: (item: A2, index: number) => Effect.Effect<B, E, R>,
    options: FilesProgressRunOptions
  ): (items: ReadonlyArray<A2>) => Effect.Effect<ReadonlyArray<B>, E, R | Terminal.Terminal>;
  <A2, B, E, R>(
    items: ReadonlyArray<A2>,
    f: (item: A2, index: number) => Effect.Effect<B, E, R>,
    options: FilesProgressRunOptions
  ): Effect.Effect<ReadonlyArray<B>, E, R | Terminal.Terminal>;
} = dual(
  3,
  <A2, B, E, R>(
    items: ReadonlyArray<A2>,
    f: (item: A2, index: number) => Effect.Effect<B, E, R>,
    options: FilesProgressRunOptions
  ): Effect.Effect<ReadonlyArray<B>, E, R | Terminal.Terminal> => runFilesProgressAll(A.map(items, f), options)
);
