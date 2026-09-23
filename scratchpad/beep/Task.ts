/**
 * Legacy Hume processing task.
 *
 * **Details**
 *
 * This is not an action item. Action-item status is a different closed set.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { Model, optionalText, optionalTimestamp, optionalUserId, pg, text, timestamp } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Task");

/**
 * Provider named by the legacy Hume task API.
 *
 * **Details**
 *
 * The only member is `hume`. No task field stores it; the action literal does.
 *
 * **Example** (Decode the Hume provider)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskActionProvider } from "./Task.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskActionProvider)("hume"))
 * console.log(decoded) // "hume"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskActionProvider = LiteralKit(["hume"]).pipe(
  $I.annoteSchema("TaskActionProvider", {
    description: "Legacy Hume task provider. No persisted field stores this value.",
  }),
);

/**
 * Decoded Hume task provider.
 *
 * @see {@link TaskActionProvider} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type TaskActionProvider = typeof TaskActionProvider.Type;

/**
 * Encoded Hume task provider.
 *
 * @see {@link TaskActionProvider} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskActionProvider {
  export type Encoded = S.Codec.Encoded<typeof TaskActionProvider>;
}

/**
 * Work a Hume task can request.
 *
 * **Gotchas**
 *
 * The wire value is `hume_mersure_user_expression`. The misspelling is frozen.
 *
 * **Example** (Decode the expression action)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskAction } from "./Task.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskAction)("hume_mersure_user_expression"))
 * console.log(decoded) // "hume_mersure_user_expression"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskAction = LiteralKit(["hume_mersure_user_expression"]).pipe(
  $I.annoteSchema("TaskAction", {
    description: "Frozen Hume action. The wire spelling mersure is intentional.",
  }),
);

/**
 * Decoded Hume task action.
 *
 * @see {@link TaskAction} for the frozen wire spelling.
 * @category type-level
 * @since 0.0.0
 */
export type TaskAction = typeof TaskAction.Type;

/**
 * Encoded Hume task action.
 *
 * @see {@link TaskAction} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskAction {
  export type Encoded = S.Codec.Encoded<typeof TaskAction>;
}

/**
 * Processing state of a legacy Hume task.
 *
 * **Gotchas**
 *
 * These three values are not action-item status. Action items use
 * `active`, `completed`, `cancelled`, and `superseded`.
 *
 * **Example** (Decode a finished task)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TaskStatus } from "./Task.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TaskStatus)("done"))
 * console.log(decoded) // "done"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskStatus = LiteralKit(["processing", "done", "error"]).pipe(
  $I.annoteSchema("TaskStatus", {
    description: "Legacy Hume task state: processing, done, or error.",
  }),
);

/**
 * Decoded Hume task status.
 *
 * @see {@link TaskStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type TaskStatus = typeof TaskStatus.Type;

/**
 * Encoded Hume task status.
 *
 * @see {@link TaskStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskStatus {
  export type Encoded = S.Codec.Encoded<typeof TaskStatus>;
}

/**
 * One Hume processing task.
 *
 * **Details**
 *
 * `executedAt` stays empty until the task runs. A class-body clock read would
 * stamp every task with process start and make it look already executed.
 * `updatedAt` uses the same empty default. Plain datetimes are UTC instants;
 * a naive ISO string is read as UTC and encoded with a `Z` offset.
 *
 * **Gotchas**
 *
 * This row is not an action item. Do not reuse {@link TaskStatus} for workflow
 * tasks.
 *
 * **Example** (Decode a task that has not run)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { Task } from "./Task.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(Task))({
 *     id: "task-1",
 *     action: "hume_mersure_user_expression",
 *     status: "processing",
 *     created_at: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(decoded.id) // "task-1"
 * console.log(O.isNone(decoded.executedAt)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Task extends Model<Task>("Task")(
  {
    id: text("id"),
    action: TaskAction.pipe(pg.text(), pg.columnName("action")),
    status: TaskStatus.pipe(pg.text(), pg.columnName("status")),
    createdAt: timestamp("created_at"),
    executedAt: optionalTimestamp("executed_at"),
    updatedAt: optionalTimestamp("updated_at"),
    requestId: optionalText("request_id"),
    memoryId: optionalText("memory_id"),
    userUid: optionalUserId("user_uid"),
  },
  $I.annote("Task", {
    description: "Legacy Hume processing task. executed_at stays empty until the task runs.",
  }),
) {}

/**
 * Encoded Hume task row.
 *
 * **Details**
 *
 * The class encodes camelCase keys. `toWire` renames those keys to snake_case.
 *
 * @see {@link Task} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Task {
  export type Encoded = S.Codec.Encoded<typeof Task>;
}
