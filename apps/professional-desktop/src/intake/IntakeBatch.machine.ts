/**
 * Statechart for one intake batch: the files of one drop, filed one at a time.
 *
 * **Details**
 *
 * The document intake machine spawns one of these per drop, so a batch outlives
 * whatever the vault region does meanwhile. It refuses empty and oversized
 * files before reading them, reads and submits the rest sequentially, emits a
 * `file.result` after each file, and completes with every outcome as output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { fromEffect, setupEffect } from "@xstate/effect";
import * as Effect from "effect/Effect";
import { Reactivity } from "effect/reactivity";
import { failureMessageOr } from "@/lib/failureMessage";
import { DesktopIntakeClient, workspaceVaultKey } from "./DesktopIntake.client.ts";
import {
  BrowserFileReadError,
  DroppedDocumentInput,
  IntakeBatchContext,
  IntakeBatchEmitted,
  IntakeBatchInput,
  IntakeBatchOutput,
  IntakeCurrentFileContext,
  IntakeLogRequest,
  IntakeRefusedStateInput,
  IntakeResultEntry,
  IntakeSubmittingStateInput,
  intakeDroppedFilePayload,
  intakeRefusal,
  nonEmptyFileName,
  ReadFileInput,
} from "./DocumentIntake.models.ts";
import { logIntakeCause } from "./Intake.telemetry.ts";
import type { EffectSourceArgs } from "@xstate/effect";
import type { SnapshotFrom } from "xstate";

const intakeFailureMessage = failureMessageOr("Intake failed.");

const failureEntry = (file: File, message: string): IntakeResultEntry =>
  IntakeResultEntry.cases.failure.make({ fileName: nonEmptyFileName(file), message });

const recordEntry = (
  context: Pick<IntakeBatchContext, "cursor" | "entries">,
  entry: IntakeResultEntry
): Pick<IntakeBatchContext, "cursor" | "entries"> => ({
  cursor: context.cursor + 1,
  entries: A.append(context.entries, entry),
});

const readFile = fromEffect({
  schemas: { input: ReadFileInput },
  effect: Effect.fn("professional_desktop.intake.read_file")(function* ({ input }: EffectSourceArgs<ReadFileInput>) {
    const buffer = yield* Effect.tryPromise({
      try: () => input.file.arrayBuffer(),
      catch: (cause) => BrowserFileReadError.make({ cause }),
    });
    return new Uint8Array(buffer);
  }),
});

const submitFile = fromEffect({
  schemas: { input: DroppedDocumentInput },
  effect: Effect.fn("professional_desktop.intake.submit_file")(function* ({
    input,
  }: EffectSourceArgs<DroppedDocumentInput>) {
    const client = yield* DesktopIntakeClient;
    return yield* Reactivity.mutation(client("IntakeDroppedFile", intakeDroppedFilePayload(input)), [
      workspaceVaultKey(input.workspaceId),
    ]);
  }),
});

/**
 * Actor logic for one intake batch.
 *
 * **Details**
 *
 * - `next` is transient: its eventless transition routes to `done`, `refused`
 *   or `reading` and puts the file under the cursor into context.
 * - `refused`, `reading` and `submitting` narrow context so `current` is always
 *   a file there; `submitting` receives the bytes as state input, so bytes
 *   never enter the context that snapshots and inspection read.
 * - `readFile` and `submitFile` are invoked Effect actors; leaving their state
 *   interrupts them.
 *
 * **Example** (Run a batch to completion)
 *
 * ```ts
 * import { intakeBatchMachine } from "@/intake/IntakeBatch.machine"
 * import { createEffectActor, join } from "@xstate/effect"
 * import * as Effect from "effect/Effect"
 * import type { IntakeBatchInput } from "@/intake/DocumentIntake.models"
 *
 * declare const input: IntakeBatchInput
 * const program = Effect.gen(function* () {
 *   const actor = yield* createEffectActor(intakeBatchMachine, { input })
 *   return yield* join(actor)
 * })
 * console.log(program)
 * ```
 *
 * @category machines
 * @since 0.0.0
 */
export const intakeBatchMachine = setupEffect({
  schemas: {
    input: IntakeBatchInput,
    context: IntakeBatchContext,
    output: IntakeBatchOutput,
    emitted: IntakeBatchEmitted,
  },
  states: {
    refused: { schemas: { context: IntakeCurrentFileContext, input: IntakeRefusedStateInput } },
    reading: { schemas: { context: IntakeCurrentFileContext } },
    submitting: { schemas: { context: IntakeCurrentFileContext, input: IntakeSubmittingStateInput } },
  },
  actors: { readFile, submitFile },
  actions: { logIntakeCause },
}).createMachine({
  id: "intakeBatch",
  context: ({ input }) => ({ ...input, cursor: 0, entries: [] }),
  initial: "next",
  output: ({ context }) => ({ intakeBatchId: context.intakeBatchId, entries: context.entries }),
  states: {
    next: {
      always: ({ context }) => {
        const file = context.files[context.cursor];
        if (P.isUndefined(file)) {
          return { target: "done" };
        }
        const refusal = intakeRefusal(file);
        if (O.isSome(refusal)) {
          return { target: "refused", context: { current: file }, input: { message: refusal.value } };
        }
        return { target: "reading", context: { current: file } };
      },
    },
    refused: {
      entry: ({ context, input }, enq) => {
        const entry = failureEntry(context.current, input.message);
        enq.emit({ type: "file.result", entry });
        return { context: recordEntry(context, entry) };
      },
      always: { target: "next" },
    },
    reading: {
      invoke: {
        src: "readFile",
        input: ({ context }) => ({ file: context.current }),
        onDone: ({ context, event }) => ({
          target: "submitting",
          context: { current: context.current },
          input: { content: event.output },
        }),
        onError: (args, enq) => {
          const entry = failureEntry(args.context.current, intakeFailureMessage(args.event.error));
          enq.emit({ type: "file.result", entry });
          enq(args.actions.logIntakeCause, {
            ...args,
            params: IntakeLogRequest.make({
              action: "intake_file",
              cause: args.event.error,
              message: "document intake could not read the file",
            }),
          });
          return { target: "next", context: recordEntry(args.context, entry) };
        },
      },
    },
    submitting: {
      invoke: {
        src: "submitFile",
        input: ({ context, input }) =>
          DroppedDocumentInput.make({
            content: input.content,
            intakeBatchId: context.intakeBatchId,
            originalFileName: nonEmptyFileName(context.current),
            workspaceId: context.workspaceId,
          }),
        onDone: ({ context, event }, enq) => {
          const entry = IntakeResultEntry.cases.document.make({ document: event.output });
          enq.emit({ type: "file.result", entry });
          return { target: "next", context: recordEntry(context, entry) };
        },
        onError: (args, enq) => {
          const entry = failureEntry(args.context.current, intakeFailureMessage(args.event.error));
          enq.emit({ type: "file.result", entry });
          enq(args.actions.logIntakeCause, {
            ...args,
            params: IntakeLogRequest.make({
              action: "intake_file",
              cause: args.event.error,
              message: "document intake failed",
            }),
          });
          return { target: "next", context: recordEntry(args.context, entry) };
        },
      },
    },
    done: { type: "final" },
  },
});

/**
 * Snapshot type of {@link intakeBatchMachine}.
 *
 * @category models
 * @since 0.0.0
 */
export type IntakeBatchSnapshot = SnapshotFrom<typeof intakeBatchMachine>;
