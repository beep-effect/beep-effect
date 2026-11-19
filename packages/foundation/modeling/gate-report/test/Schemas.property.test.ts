import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CauseFoldRule, FoldResult } from "@beep/gate-report/CauseFold";
import {
  CapLine,
  ConsoleBudget,
  ConsoleDocument,
  ConsoleEntry,
  FoldLine,
  GatePointers,
  PointerLine,
  PointerTable,
  RecordPaths,
  RunDelta,
  VerdictLine,
} from "@beep/gate-report/ConsoleDocument";
import { CellContext, ConsoleInput } from "@beep/gate-report/Dispatch";
import { FailureSignatureInput } from "@beep/gate-report/FailureSignature";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateRecord, GateRecordFromJson } from "@beep/gate-report/GateRecord";
import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { CtrfTest, SarifResult } from "@beep/gate-report/Interchange";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { ItemKey, SeriesKey } from "@beep/gate-report/ItemKey";
import { PolicyBreach, PolicyRenderState } from "@beep/gate-report/Policy";
import { IncompleteRunError } from "@beep/gate-report/Reducer";
import { StrayOutput } from "@beep/gate-report/StrayOutput";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(50) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves its value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assert.isTrue(equivalent(decoded, value));
        const reencoded = yield* encode(decoded);
        assert.deepStrictEqual(reencoded, encoded);
      }),
    runs
  );
};

describe("schema round trips", () => {
  roundTrips("ItemKey", ItemKey);
  roundTrips("SeriesKey", SeriesKey);
  roundTrips("Location", Location);
  roundTrips("ItemDetail", ItemDetail);
  roundTrips("Item", Item);
  roundTrips("Unit", Unit);
  roundTrips("Totals", Totals);
  roundTrips("PolicyBreach", PolicyBreach);
  roundTrips("PolicyRenderState", PolicyRenderState);
  roundTrips("StrayOutput", StrayOutput);
  roundTrips("GateReport", GateReport);
  roundTrips("GateEvent", GateEvent);
  roundTrips("GateRecord", GateRecord);
  roundTrips("GateRecordFromJson", GateRecordFromJson);
  roundTrips("ConsoleBudget", ConsoleBudget);
  roundTrips("GatePointers", GatePointers);
  roundTrips("PointerTable", PointerTable);
  roundTrips("RunDelta", RunDelta);
  roundTrips("RecordPaths", RecordPaths);
  roundTrips("VerdictLine", VerdictLine);
  roundTrips("ConsoleEntry", ConsoleEntry);
  roundTrips("FoldLine", FoldLine);
  roundTrips("CapLine", CapLine);
  roundTrips("PointerLine", PointerLine);
  roundTrips("ConsoleDocument", ConsoleDocument);
  roundTrips("CauseFoldRule", CauseFoldRule);
  roundTrips("FoldResult", FoldResult);
  roundTrips("ConsoleInput", ConsoleInput);
  roundTrips("CellContext", CellContext);
  roundTrips("FailureSignatureInput", FailureSignatureInput);
  roundTrips("CtrfTest", CtrfTest);
  roundTrips("SarifResult", SarifResult);
  roundTrips("IncompleteRunError", IncompleteRunError);
});
