/** Authenticated original eyecite operation and assertion captures, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationOracleOperations } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";

const Capture = S.fromJsonString(S.Struct({ events: S.Array(S.Struct({ id: S.String, payload: S.String })) }));
const Operations = S.fromJsonString(CitationOracleOperations);
/** Read both pinned captures and index original assertions by source event identity.
 * @internal @category testing @since 0.0.0
 */
export const readCitationCanonicalCaptures = Effect.fn("CanonicalCaptureTest.read")(function* () {
  const operations = yield* readCitationOracleFixture(
    "operation-cases",
    "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
  ).pipe(Effect.flatMap(S.decodeEffect(Operations)));
  const capture = yield* readCitationOracleFixture(
    "assertion-cases",
    "c7ea12ec5ba0d66257affc4c6e54e8b2fa2ffdd0d79f41c1b701000e0edaf33f"
  ).pipe(Effect.flatMap(S.decodeEffect(Capture)));
  const assertions = HashMap.fromIterable(A.map(capture.events, (row) => Tuple.make(row.id, row)));
  return { operations, assertions };
});
