/**
 * Numeric-only public USPTO adapter.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  IdentificationError,
  UsptoRecordFacts,
  UsptoRecordLookup,
  UsptoRecordLookupShape,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import { Uspto } from "@beep/uspto";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { UsptoApplicationMetadata, UsptoError } from "@beep/uspto";

const facts = (r: UsptoApplicationMetadata) =>
  UsptoRecordFacts.make({ docketNumber: r.docketNumber, firstApplicant: r.firstApplicantName });
const unavailable = () => IdentificationError.make({ operation: "uspto-lookup", reason: "unavailable" });
const numberOnly = (number: string) =>
  /^[0-9]+$/u.test(number)
    ? Effect.succeed(number)
    : Effect.fail(IdentificationError.make({ operation: "uspto-query", reason: "invalid-input" }));
const missing = <T>(effect: Effect.Effect<T, UsptoError>) =>
  effect.pipe(
    Effect.asSome,
    Effect.catchTag("UsptoError", (error) =>
      O.contains(404)(error.status) ? Effect.succeedNone : Effect.fail(unavailable())
    )
  );
const makeUsptoRecordLookupLive = Effect.fn("DocumentIdentification.Identification.uspto.make")(function* () {
  const uspto = yield* Uspto;
  return UsptoRecordLookupShape.make({
    byApplication: Effect.fn("Identification.byApplication")(function* (number: string) {
      yield* numberOnly(number);
      return O.map(yield* missing(uspto.getApplication(number)), facts);
    }),
    byPatent: Effect.fn("Identification.byPatent")(function* (number: string) {
      yield* numberOnly(number);
      const records = yield* missing(uspto.searchApplications(`applicationMetaData.patentNumber:"${number}"`));
      const exact = A.filter(
        O.getOrElse(records, () => []),
        (r) => O.exists(r.patentNumber, (p) => Str.replace(/\D/gu, "")(p) === number)
      );
      if (exact.length > 1)
        return yield* IdentificationError.make({ operation: "uspto-patent", reason: "conflicting-records" });
      return O.map(A.head(exact), facts);
    }),
  });
});

/**
 * Maps USPTO application metadata and patent-number searches into optional docket/applicant facts.
 * A 404 is None; transport, throttle and authentication failures remain failures.
 * **Example** (Inspect the adapter layer)
 *
 * ```ts
 * import { UsptoRecordLookupLive } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(UsptoRecordLookupLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const UsptoRecordLookupLive = Layer.effect(UsptoRecordLookup, makeUsptoRecordLookupLive());
