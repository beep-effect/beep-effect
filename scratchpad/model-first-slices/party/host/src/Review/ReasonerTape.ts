import { Assessed, AssessRequest } from "@proto/party-model/Review/Reasoner.external";
import { $PartyHostId } from "@proto/kernel/Identity";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import type * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";

const $I = $PartyHostId.create("Review/ReasonerTape");

/**
 * One recorded Reasoner call: the request and the answer, keyed by prompt
 * version and idempotency key. Replayable: a replay adapter serves it back.
 *
 * @category models
 * @since 0.0.0
 */
export const TapeEntry = S.Struct({ request: AssessRequest, result: Assessed });
/**
 * @category models
 * @since 0.0.0
 */
export type TapeEntry = typeof TapeEntry.Type;

/**
 * A tape as fixture text: the JSON form a recording writes and a replay reads.
 *
 * @category models
 * @since 0.0.0
 */
export const TapeJson = TapeEntry.pipe(S.Array, S.fromJsonString);

/**
 * Where recorded Reasoner calls are kept.
 *
 * @category services
 * @since 0.0.0
 */
export class ReasonerTape extends Context.Service<
  ReasonerTape,
  {
    readonly record: (entry: TapeEntry) => Effect.Effect<void>;
    /** The entry recorded for a request, by its prompt version and idempotency key. */
    readonly find: (request: Pick<AssessRequest, "promptVersion" | "idempotencyKey">) => Effect.Effect<O.Option<TapeEntry>>;
    readonly entries: Effect.Effect<ReadonlyArray<TapeEntry>>;
  }
>()($I`ReasonerTape`) {}

const keyOf = (promptVersion: string, idempotencyKey: string) => `${promptVersion}\u0000${idempotencyKey}`;

/**
 * A tape in memory, optionally loaded from recorded entries.
 *
 * **Example** (A tape loaded from fixture text)
 * ```ts
 * import { memoryTape, TapeJson } from "@proto/party-host/Review/ReasonerTape";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * import * as S from "effect/Schema";
 *
 * const tape = Layer.unwrap(Effect.map(S.decodeUnknownEffect(TapeJson)("[]"), memoryTape));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const memoryTape = (entries: ReadonlyArray<TapeEntry> = []) =>
  Layer.effect(
    ReasonerTape,
    Effect.gen(function* () {
      const tape = yield* Ref.make(
        HashMap.fromIterable(A.map(entries, (entry) => [keyOf(entry.request.promptVersion, entry.request.idempotencyKey), entry] as const)),
      );
      return {
        record: Effect.fn("ReasonerTape.record")((entry: TapeEntry) =>
          Ref.update(tape, HashMap.set(keyOf(entry.request.promptVersion, entry.request.idempotencyKey), entry)),
        ),
        find: Effect.fn("ReasonerTape.find")(({ promptVersion, idempotencyKey }: Pick<AssessRequest, "promptVersion" | "idempotencyKey">) =>
          Effect.map(Ref.get(tape), HashMap.get(keyOf(promptVersion, idempotencyKey))),
        ),
        entries: Effect.map(Ref.get(tape), (map) => map.pipe(HashMap.values, A.fromIterable)),
      };
    }),
  );
