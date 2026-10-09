/**
 * The pass runner the commands call: one freshly built mail-tagging service
 * per pass.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeMailTaggingId } from "@beep/identity/packages";
import { TaggingRunId } from "@beep/law-practice-domain/values/MailTagging";
import {
  MailTaggingJob,
  MailTaggingUndo,
  RunMailTaggingRequest,
  UndoMailTaggingRequest,
} from "@beep/law-practice-use-cases/MailTagging";
import { Fn, LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeMailTaggingError } from "./PracticeMailTagging.errors.ts";
import type { TaggingRunReport, TaggingUndoReport } from "@beep/law-practice-domain/values/MailTagging";
import type { MailTaggingPassFailure } from "./PracticeMailTagging.errors.ts";

const $I = $PracticeMailTaggingId.create("PracticeMailTagging.passes");

/**
 * When passes start from and how a `watch` process paces them.
 *
 * **Example** (Pace a watch process)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 * import { MailTaggingPassSchedule } from "@/PracticeMailTagging.passes"
 *
 * const schedule = MailTaggingPassSchedule.make({
 *   since: DateTime.makeUnsafe("2026-07-01T00:00:00Z"),
 *   pollInterval: Duration.minutes(5),
 *   maxBackoff: Duration.hours(1)
 * })
 * console.log(Duration.toMinutes(schedule.pollInterval)) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailTaggingPassSchedule extends S.Class<MailTaggingPassSchedule>($I`MailTaggingPassSchedule`)(
  {
    since: S.DateTimeUtcFromString.annotateKey({
      description: "Instant a pass starts from when no checkpoint exists and no flag overrides it.",
    }),
    pollInterval: S.Duration.annotateKey({
      description: "Pause between two watch passes.",
    }),
    maxBackoff: S.Duration.annotateKey({
      description: "Longest pause after consecutive failed watch passes.",
    }),
  },
  $I.annote("MailTaggingPassSchedule", {
    description: "When passes start from and how a watch process paces them.",
  })
) {}

/**
 * The service one pass runs with, as a layer that is built for that pass
 * only.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MailTaggingPassLayer = Layer.Layer<MailTaggingJob | MailTaggingUndo, MailTaggingPassFailure>;

/**
 * Answers the service layer of the pass with the given run id.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MailTaggingPassLayerOf = (runId: TaggingRunId) => MailTaggingPassLayer;

/**
 * Schema of what a pass runner method returns: an Effect.
 *
 * **Gotchas**
 *
 * Only "is an Effect" is checked at runtime. The success and failure channels
 * exist for the type checker.
 *
 * **Example** (Guard a pass result)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MailTaggingPassOutput } from "@/PracticeMailTagging.passes"
 *
 * const isPassOutput = S.is(MailTaggingPassOutput<number>())
 * console.log(isPassOutput(Effect.succeed(1))) // true
 * console.log(isPassOutput(1)) // false
 * ```
 *
 * @returns A schema accepting any Effect, typed to the pass runner's channels.
 * @category schemas
 * @since 0.0.0
 */
export const MailTaggingPassOutput = <A>() =>
  S.declare(
    (u): u is Effect.Effect<A, PracticeMailTaggingError> => Effect.isEffect(u),
    $I.annote("MailTaggingPassOutput", {
      description: "An Effect returned by the pass runner; its channels are not checked at runtime.",
    })
  );

// The contract of the pass runner; `MailTaggingPasses` is its service.
class MailTaggingPassesShape extends S.Class<MailTaggingPassesShape>($I`MailTaggingPassesShape`)(
  {
    schedule: MailTaggingPassSchedule.annotateKey({
      description: "When passes start from and how a watch process paces them.",
    }),
    runJob: Fn({
      input: RunMailTaggingRequest,
      output: MailTaggingPassOutput<TaggingRunReport>(),
    }).annotateKey({
      description: "Run one tagging pass over a freshly built service and answer its counts.",
    }),
    runUndo: Fn({
      input: UndoMailTaggingRequest,
      output: MailTaggingPassOutput<TaggingUndoReport>(),
    }).annotateKey({
      description: "Undo one run over a freshly built service and answer its counts.",
    }),
  },
  $I.annote("MailTaggingPassesShape", {
    description: "Pass runner: one freshly built mail-tagging service per job or undo call.",
  })
) {}

/**
 * Pass runner of the mail-tagging commands.
 *
 * **Details**
 *
 * Every `runJob` and `runUndo` call builds the mail-tagging service anew and
 * closes it when the call ends. That is what re-reads the folder-id map, the
 * known-documents index, and the contacts overlay for each pass, and what
 * writes one Box call-ledger line per pass.
 *
 * **Example** (Read the pass schedule)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { MailTaggingPasses } from "@/PracticeMailTagging.passes"
 *
 * const program = Effect.map(MailTaggingPasses, (passes) => passes.schedule.pollInterval)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MailTaggingPasses extends Context.Service<MailTaggingPasses, MailTaggingPassesShape>()(
  $I`MailTaggingPasses`
) {}

/**
 * Builds the pass runner over a function from a run id to that pass's service
 * layer.
 *
 * **Gotchas**
 *
 * The layer is built with `Layer.fresh` in a scope of its own, so two passes
 * never share an instance even when the function answers the same layer.
 *
 * **Example** (Reference the constructor)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { makeMailTaggingPasses } from "@/PracticeMailTagging.passes"
 *
 * console.log(P.isFunction(makeMailTaggingPasses)) // true
 * ```
 *
 * @param schedule - When passes start from and how a watch process paces them.
 * @param passLayer - Answers the service layer of the pass with the given run id.
 * @returns The pass runner.
 * @category constructors
 * @since 0.0.0
 */
export const makeMailTaggingPasses: {
  (passLayer: MailTaggingPassLayerOf): (schedule: MailTaggingPassSchedule) => MailTaggingPassesShape;
  (schedule: MailTaggingPassSchedule, passLayer: MailTaggingPassLayerOf): MailTaggingPassesShape;
} = dual(2, (schedule: MailTaggingPassSchedule, passLayer: MailTaggingPassLayerOf): MailTaggingPassesShape => {
  // `Layer.build` runs in the pass's own scope, so the service is closed when the pass ends.
  const inFreshPass =
    (runId: TaggingRunId) =>
    <A>(use: Effect.Effect<A, MailTaggingPassFailure, MailTaggingJob | MailTaggingUndo>) =>
      Layer.build(Layer.fresh(passLayer(runId))).pipe(
        Effect.flatMap((services) => Effect.provide(use, services)),
        Effect.scoped,
        Effect.mapError(PracticeMailTaggingError.fromPass)
      );

  return MailTaggingPassesShape.make({
    schedule,
    runJob: Effect.fn("MailTaggingPasses.runJob")((request: RunMailTaggingRequest) =>
      inFreshPass(request.runId)(MailTaggingJob.use((job) => job.run(request)))
    ),
    runUndo: Effect.fn("MailTaggingPasses.runUndo")((request: UndoMailTaggingRequest) =>
      inFreshPass(request.runId)(MailTaggingUndo.use((undo) => undo.run(request)))
    ),
  });
});

/**
 * Leading word of a generated run id: a tagging pass or an undo.
 *
 * **Example** (Guard a run id prefix)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RunIdPrefix } from "@/PracticeMailTagging.passes"
 *
 * console.log(S.is(RunIdPrefix)("undo")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunIdPrefix = LiteralKit(["tag", "undo"]).pipe(
  $I.annoteSchema("RunIdPrefix", {
    description: "Leading word of a generated run id: a tagging pass or an undo.",
  })
);

/**
 * Type-level union produced by {@link RunIdPrefix}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunIdPrefix = typeof RunIdPrefix.Type;

const compactInstant = Str.replace(/[-:.]/g, "");

/**
 * Generates the id of one pass from the current instant.
 *
 * **Details**
 *
 * The id reads `tag-20260701T093000123Z`: a prefix and the UTC instant to the
 * millisecond. Ledger lines and `undo --run` are keyed by it.
 *
 * **Example** (Generate a tagging run id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { makeRunId } from "@/PracticeMailTagging.passes"
 *
 * console.log(Effect.isEffect(makeRunId("tag"))) // true
 * ```
 *
 * @param prefix - Whether the run tags or undoes.
 * @returns An effect answering a fresh run id.
 * @category constructors
 * @since 0.0.0
 */
export const makeRunId = (prefix: RunIdPrefix): Effect.Effect<TaggingRunId> =>
  Effect.map(DateTime.now, (now) => TaggingRunId.make(`${prefix}-${now.pipe(DateTime.formatIso, compactInstant)}`));
