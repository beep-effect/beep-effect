/**
 * Derivation of the candor gate's narrow read seam from the durable
 * append-and-read-only repository.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Layer } from "effect";
import { CandorRecordReadError } from "../CandorPolicy/CandorPolicy.errors.ts";
import { CandorRecordReader, CandorRecordReaderShape } from "../CandorPolicy/CandorPolicy.ports.ts";
import { CandorRecordRepository } from "./CandorRecord.ports.ts";
import type { CitingApplicationIdentity } from "@beep/law-practice-domain";
import type { CandorRecordRepositoryShape } from "./CandorRecord.ports.ts";

const readerFromRepository = (repository: CandorRecordRepositoryShape): CandorRecordReaderShape =>
  CandorRecordReaderShape.make({
    dispositionsForFiling: Effect.fn("CandorRecord.dispositionsForFiling")(function* (
      citingApplication: CitingApplicationIdentity
    ) {
      return yield* repository
        .listDispositions(citingApplication)
        .pipe(
          Effect.mapError((cause) =>
            CandorRecordReadError.fromReason(
              "dispositions-unavailable",
              `Recorded dispositions could not be read: ${cause.reason}`
            )
          )
        );
    }),
    eventsForFiling: Effect.fn("CandorRecord.eventsForFiling")(function* (
      citingApplication: CitingApplicationIdentity
    ) {
      return yield* repository
        .listEvents(citingApplication)
        .pipe(
          Effect.mapError((cause) =>
            CandorRecordReadError.fromReason("events-unavailable", `Recorded events could not be read: ${cause.reason}`)
          )
        );
    }),
  });

/**
 * Layer deriving the candor gate's read seam from the durable repository.
 *
 * **When to use**
 *
 * Use when composing a runtime that already provides
 * `CandorRecordRepository` and needs to evaluate the candor gate against
 * durable records rather than fixtures.
 *
 * **Details**
 *
 * The gate deliberately depends on the two reads it performs rather than on the
 * whole repository, which is what lets the rung-1 proof run against in-memory
 * fixtures without standing up a database. This layer is the single place the
 * narrow seam is mapped onto the durable surface, so the two never drift.
 *
 * A repository failure becomes a typed read failure rather than an empty
 * result: a gate that treated an unreadable store as empty would report "not
 * blocked" for a filing it never checked.
 *
 * **Example** (Compose the gate over durable records)
 *
 * ```ts
 * import { CandorRecordReaderFromRepository } from "@beep/law-practice-use-cases/CandorRecord"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(CandorRecordReaderFromRepository)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CandorRecordReaderFromRepository: Layer.Layer<CandorRecordReader, never, CandorRecordRepository> =
  Layer.effect(CandorRecordReader, Effect.map(CandorRecordRepository, readerFromRepository));
