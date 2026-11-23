/**
 * Generation: one activity's generation of one annotation content.
 *
 * **Details**
 *
 * An annotation document keys attribution by content id and holds one
 * {@link Generation} per activity. Its `run` is the {@link RunEntityId} of the
 * (content, activity) pair, and its `at` is the time the producer stated: a
 * native run always states one, a third-party annotation may not.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AnnotationId } from "@beep/identity/packages";
import { ActivityId } from "@beep/schema/ContentHash";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AnnotationId, GenerationPreimage, RunEntityId } from "./AnnotationId.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type * as Digest from "effect/crypto/Digest";

const $I = $AnnotationId.create("Generation");

/**
 * One generation of one annotation content by one activity, unique per
 * (content, activity) pair in a document.
 *
 * **Details**
 *
 * Encoded `{ run, content, activity, at? }`, `at` in epoch milliseconds and
 * absent when the producer stated no time.
 *
 * **Example** (Decode a generation without a stated time)
 *
 * ```ts import.meta.vitest name="Decode a generation without a stated time"
 * import { Generation } from "@beep/annotation/Generation"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const generation = S.decodeUnknownSync(Generation)({
 *   run: "sha256:e1303854ed5d9fddcba55d0d0ae4e4dd5d9ca20c4e4738e0ba643f5696575acd",
 *   content: "sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9",
 *   activity: "sha256:2a2b259a63e6402ee336c2e1d4f1023b98bee9880bfa586fface844bca277388",
 * })
 * O.isNone(generation.at) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Generation extends S.Opaque<Generation, { readonly brand: unique symbol }>()(
  S.Struct({
    run: RunEntityId.annotateKey({ description: "The run entity: the hash of (content, activity)." }),
    content: AnnotationId.annotateKey({ description: "The annotation content the activity generated." }),
    activity: ActivityId.annotateKey({ description: "The activity that generated it." }),
    at: S.OptionFromOptionalKey(S.DateTimeUtcFromMillis).annotateKey({
      description: "The stated generation time, canonical per (content, activity); absent when none was stated.",
    }),
  }).pipe(
    $I.annoteSchema("Generation", {
      description: "A prov:Generation of a run-specific annotation entity by one activity.",
    })
  )
) {}

/**
 * Mint the run-entity id of one (annotation content, activity) pair under
 * `generation/v1`.
 *
 * **Details**
 *
 * Requires core's `Digest.Digest` service. `GenerationPreimage.mintResult`
 * is the synchronous twin.
 *
 * **Example** (Mint the generation golden)
 *
 * ```ts
 * import { mintRunEntityId } from "@beep/annotation/Generation"
 * import { AnnotationId } from "@beep/annotation/AnnotationId"
 * import { ActivityId } from "@beep/schema/ContentHash"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const run = mintRunEntityId(
 *   AnnotationId.make("sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9"),
 *   ActivityId.make("sha256:2a2b259a63e6402ee336c2e1d4f1023b98bee9880bfa586fface844bca277388")
 * ).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof run)
 * ```
 *
 * @param content - The annotation content id.
 * @param activity - The generating activity's id.
 * @returns The run-entity id of the pair.
 * @category constructors
 * @since 0.0.0
 */
export const mintRunEntityId = Effect.fn("Generation.mintRun")(function* (
  content: AnnotationId,
  activity: ActivityId
): Effect.fn.Return<RunEntityId, PreimageMintError, Digest.Digest> {
  const hash = yield* GenerationPreimage.mint([content, activity]);
  return RunEntityId.make(hash);
});
