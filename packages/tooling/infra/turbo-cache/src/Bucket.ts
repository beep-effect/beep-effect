/**
 * The R2 binding the cache Worker reads and writes artifacts through.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import { makeBucketBinding } from "@alchemy.run/cloudflare/R2/BucketBinding";

/**
 * Binds an R2 bucket to the hosting Worker as a read-write client.
 *
 * **Details**
 *
 * `makeBucketBinding` registers the `r2_bucket` binding at deploy time and
 * builds the client at runtime, which is exactly what
 * `Cloudflare.R2.ReadWriteBucketBinding` wraps in a Layer. Yielding it directly
 * keeps the Worker implementation free of a nested `Effect.provide`.
 *
 * **Example** (Bind a bucket inside a Worker implementation)
 *
 * ```ts
 * import * as Cloudflare from "@alchemy.run/cloudflare"
 * import { bindReadWriteBucket } from "@beep/infra-turbo-cache/Bucket"
 * import * as Effect from "effect/Effect"
 *
 * const storage = Effect.gen(function* () {
 *   const bucket = yield* Cloudflare.R2.Bucket("Artifacts")
 *   const bind = yield* bindReadWriteBucket
 *   return yield* bind(bucket)
 * })
 * console.log(Effect.isEffect(storage)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const bindReadWriteBucket = makeBucketBinding({ makeClient: Cloudflare.R2.makeReadWrite });
