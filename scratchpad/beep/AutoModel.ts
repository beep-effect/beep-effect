/**
 * Response shape for `/v1/auto/model-pick`.
 *
 * **Details**
 *
 * The daily-cached pick is derived from Artificial Analysis quality and speed
 * data. Routers build a document matching these fields.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Model, pg, text } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/AutoModel");

/**
 * Current best realtime-voice provider for Auto users.
 *
 * **Details**
 *
 * `provider` is a desktop provider id such as `geminiFlashLive`. The string
 * stays open. `updatedAt` is the Unix timestamp, in seconds, when the cached
 * pick was last refreshed. `detail` is provenance and may contain a `reason`
 * string and a `scores` map of provider id to score. `attribution` is the
 * required attribution URL for the data source.
 *
 * **Gotchas**
 *
 * `updatedAt` is a finite Unix-seconds number, not a datetime. `detail` is an
 * untyped JSON object, not a tagged union. `provider` is not a closed set.
 *
 * **Example** (Decode a cached pick)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AutoModelPick } from "@beep/scratchpad/beep/AutoModel"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(AutoModelPick)({
 *     provider: "geminiFlashLive",
 *     updatedAt: 1_700_000_000,
 *     detail: { reason: "quality" },
 *     attribution: "https://artificialanalysis.ai/",
 *   }),
 * )
 * console.log(decoded.provider) // "geminiFlashLive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AutoModelPick extends Model<AutoModelPick>("AutoModelPick")(
  {
    provider: text("provider"),
    updatedAt: S.Finite.pipe(pg.doublePrecision(), pg.columnName("updated_at")),
    detail: S.JsonObject.pipe(pg.jsonb(), pg.columnName("detail")),
    attribution: text("attribution"),
  },
  $I.annote("AutoModelPick", {
    description: "Daily-cached realtime-voice provider chosen for Auto users.",
  }),
) {}

/**
 * Encoded form of {@link AutoModelPick}.
 *
 * @see {@link AutoModelPick} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AutoModelPick {
  export type Encoded = S.Codec.Encoded<typeof AutoModelPick>;
}
