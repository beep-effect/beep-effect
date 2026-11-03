import {
  AdmissionSlotsInput,
  HostMemoryInput,
  HostPressureInput,
  HostPressureSource,
  HostPressureStall,
  layerParcels,
  ParcelEnvelope,
  ParcelItem,
  Parcels,
  PressureFile,
  PressureSourceInput,
  parsePressureFile,
  parsePressureLine,
  reduceHostPressure,
} from "@beep/palantiri";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { failingSources } from "./fixtures/Sources.ts";
import type { Freshness } from "@beep/palantiri";

const NOW = DateTime.makeUnsafe("2026-10-15T12:00:00.000Z");

// Shaped like a Linux 6.x workstation's /proc/pressure files.
const CPU = "some avg10=2.13 avg60=1.05 avg300=0.48 total=987654321\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n";
const MEMORY =
  "some avg10=0.00 avg60=0.12 avg300=0.30 total=4433221\nfull avg10=0.00 avg60=0.05 avg300=0.11 total=2211\n";
const IO =
  "some avg10=4.30 avg60=3.90 avg300=2.10 total=55443322\nfull avg10=1.20 avg60=1.00 avg300=0.70 total=33221100\n";

const encodeParcelEnvelopeJson = S.encodeEffect(S.fromJsonString(ParcelEnvelope));
const reasonOf = (freshness: Freshness): string => (freshness._tag === "Unknown" ? freshness.reason : "fresh");

const inputWith = (files: ReadonlyArray<PressureFile>, readAt = NOW) =>
  HostPressureInput.make({
    readAt,
    pressure: PressureSourceInput.cases.Read.make({ files }),
    memory: O.some(HostMemoryInput.make({ availableGib: 40.04, totalGib: 62.5 })),
    admission: O.some(
      AdmissionSlotsInput.make({ capacityTokens: 3, activeTokens: 1, queued: 0, dead: 0, hardFloorEngaged: false })
    ),
  });

const healthy = inputWith([
  PressureFile.make({ resource: "cpu", text: CPU }),
  PressureFile.make({ resource: "memory", text: MEMORY }),
  PressureFile.make({ resource: "io", text: IO }),
]);

describe("parsePressureLine", () => {
  it("parses some and full lines", () => {
    assertSome(
      O.map(parsePressureLine("some avg10=2.13 avg60=1.05 avg300=0.48 total=987654321"), (line) => [
        line.scope,
        line.avg10,
        line.total,
      ]),
      ["some", 2.13, 987654321]
    );
    assertSome(
      O.map(parsePressureLine("  full avg10=0.00 avg60=0.00 avg300=0.00 total=0  "), (line) => line.scope),
      "full"
    );
  });

  it("rejects malformed lines", () => {
    assertNone(parsePressureLine("partial avg10=1.00 avg60=1.00 avg300=1.00 total=1"));
    assertNone(parsePressureLine("some avg10=abc avg60=1.00 avg300=1.00 total=1"));
    assertNone(parsePressureLine("some avg10=101.00 avg60=1.00 avg300=1.00 total=1"));
    assertNone(parsePressureLine("some avg10=1.00 avg60=1.00 total=1"));
    assertNone(parsePressureLine(""));
  });
});

describe("parsePressureFile", () => {
  it("reads both scopes and counts malformed lines", () => {
    const reading = parsePressureFile(`${IO}garbage line\nsome avg10=x avg60=0 avg300=0 total=0\n\n`);
    assertSome(
      O.map(reading.some, (stats) => stats.avg10),
      4.3
    );
    assertSome(
      O.map(reading.full, (stats) => stats.avg300),
      0.7
    );
    expect(reading.malformedLines).toBe(2);
  });

  it("reads a kernel that only reports some", () => {
    const reading = parsePressureFile("some avg10=0.50 avg60=0.40 avg300=0.30 total=10\n");
    assertNone(reading.full);
    expect(reading.malformedLines).toBe(0);
  });
});

describe("reduceHostPressure", () => {
  it("is Fresh with every reading, and summarizes stall, memory and admission", () => {
    const parcel = reduceHostPressure(healthy, NOW, 20);
    expect(parcel.freshness._tag).toBe("Fresh");
    expect(A.map(parcel.items, (item) => item._tag)).toEqual([
      "PressureStall",
      "PressureStall",
      "PressureStall",
      "HostMemory",
      "AdmissionSlots",
    ]);
    expect(parcel.summary).toBe(
      "5 of 5 readings fresh; cpu 2.1%, memory 0%, io 4.3% stalled (some, avg10); 40 of 62.5 GiB available; admission 1 of 3 tokens active, 0 queued"
    );
  });

  it("is Unknown{stale} when the readings are older than a minute", () => {
    const parcel = reduceHostPressure(healthy, DateTime.add(NOW, { minutes: 2 }), 20);
    expect(reasonOf(parcel.freshness)).toBe("stale");
    expect(parcel.summary).toContain("0 of 5 readings fresh; 5 stale (cpu, memory, io, meminfo, admission)");
  });

  it("is Unknown{attribution-incomplete} for a malformed file or a missing reading", () => {
    const input = HostPressureInput.make({
      ...inputWith([
        PressureFile.make({ resource: "cpu", text: CPU }),
        PressureFile.make({ resource: "memory", text: "not a pressure file\n" }),
      ]),
      admission: O.none(),
    });
    const parcel = reduceHostPressure(input, NOW, 20);
    expect(reasonOf(parcel.freshness)).toBe("attribution-incomplete");
    const stalls = A.filter(parcel.items, ParcelItem.guards.PressureStall);
    expect(A.map(stalls, (stall) => [stall.resource, reasonOf(stall.freshness)])).toEqual([
      ["cpu", "fresh"],
      ["memory", "unreachable"],
      ["io", "unreachable"],
    ]);
    expect(parcel.summary).toBe(
      "2 of 4 readings fresh; 2 unreachable (memory, io); cpu 2.1% stalled (some, avg10); 40 of 62.5 GiB available"
    );
  });

  it("is Unknown{unreachable} on a host without pressure stall information", () => {
    const parcel = reduceHostPressure(
      HostPressureInput.make({
        ...healthy,
        pressure: PressureSourceInput.cases.Missing.make({ detail: "no /proc/pressure (vendor cloud VM)" }),
      }),
      NOW,
      20
    );
    expect(reasonOf(parcel.freshness)).toBe("unreachable");
    expect(parcel.summary).toContain("no pressure stall information (no /proc/pressure (vendor cloud VM))");
    expect(parcel.receipt).toEqual({ shown: 2, total: 2 });
  });

  it.effect("encodes without addresses or home paths, and caps at the budget", () =>
    Effect.gen(function* () {
      const parcel = reduceHostPressure(healthy, NOW, 2);
      expect(parcel.receipt).toEqual({ shown: 2, total: 5 });
      const json = yield* encodeParcelEnvelopeJson(parcel);
      expect(pipe(json, Str.includes("@"))).toBe(false);
      expect(pipe(json, Str.includes("/home/"))).toBe(false);
    })
  );
});

describe("Parcels.read host-pressure", () => {
  const withSource = (input: HostPressureInput) =>
    layerParcels.pipe(
      Layer.provide(Layer.merge(failingSources, Layer.succeed(HostPressureSource, { snapshot: Effect.succeed(input) })))
    );

  it.layer(withSource(healthy), { timeout: "30 seconds" })("with fresh readings", (it) => {
    it.effect("records the pressure gauge per resource", () =>
      Effect.gen(function* () {
        yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
        yield* Parcels.use((parcels) => parcels.read("host-pressure"));
        const snapshot1 = yield* Metric.snapshot;
        const gauges = A.filter(snapshot1, (metric) => metric.id === HostPressureStall.name);
        expect(A.map(gauges, (metric) => metric.attributes?.["beep.resource"]).sort()).toEqual(["cpu", "io", "memory"]);
        const io = A.findFirst(gauges, (metric) => metric.attributes?.["beep.resource"] === "io");
        assertSome(
          O.map(io, (metric) => metric.state),
          { value: 4.3 }
        );
      }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
    );
  });

  it.effect("drops each resource's series once its reading is stale, read twice in one process", () =>
    Effect.gen(function* () {
      const parcels = yield* withSource(healthy).pipe(Layer.build, Effect.map(Context.get(Parcels)));
      const resources = Effect.map(Metric.snapshot, (snapshot) =>
        A.filter(snapshot, (metric) => metric.id === HostPressureStall.name)
      );
      yield* NOW.pipe(DateTime.toEpochMillis, TestClock.setTime);
      yield* parcels.read("host-pressure");
      const resources2 = yield* resources;
      expect(resources2).toHaveLength(3);
      yield* TestClock.adjust("5 minutes");
      yield* parcels.read("host-pressure");
      const resources3 = yield* resources;
      expect(resources3).toEqual([]);
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
  );

  it.layer(withSource(healthy), { timeout: "30 seconds" })("with stale readings", (it) => {
    it.effect("records no gauge", () =>
      Effect.gen(function* () {
        yield* DateTime.add(NOW, { minutes: 5 }).pipe(DateTime.toEpochMillis, TestClock.setTime);
        const parcel = yield* Parcels.use((parcels) => parcels.read("host-pressure"));
        expect(reasonOf(parcel.freshness)).toBe("stale");
        const snapshot4 = yield* Metric.snapshot;
        const gauges = A.filter(snapshot4, (metric) => metric.id === HostPressureStall.name);
        expect(gauges).toEqual([]);
      }).pipe(Effect.provideService(Metric.MetricRegistry, new Map()))
    );
  });
});
