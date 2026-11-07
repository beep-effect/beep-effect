import * as Cloudflare from "@alchemy.run/cloudflare";
import { makeBucketBinding } from "@alchemy.run/cloudflare/R2/BucketBinding";

/**
 * Binds an R2 bucket to the hosting Worker as a read-write client.
 *
 * `makeBucketBinding` registers the `r2_bucket` binding at deploy time and
 * builds the client at runtime, which is exactly what
 * `Cloudflare.R2.ReadWriteBucketBinding` wraps in a Layer. Yielding it directly
 * keeps the Worker implementation free of a nested `Effect.provide`.
 */
export const bindReadWriteBucket = makeBucketBinding({ makeClient: Cloudflare.R2.makeReadWrite });
