import { ObservationCoverageInput, reconcileObservationCoverage } from "@beep/repo-ai-metrics/observation-coverage";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const id = (value: string) => Str.repeat(64)(value);
const unknown = { _tag: "Unknown" };
const population = (ids: ReadonlyArray<string>) => ({ _tag: "Enumerated", ids, evidenceId: id("e") });
const snapshot = (ids: ReadonlyArray<string>, exhaustive = true) => ({
  _tag: "Observed",
  ids,
  evidenceId: id("f"),
  exhaustive,
});
const route = (routeId = id("c")) => ({
  routeId,
  hostId: id("a"),
  harness: "codex-cli",
  surface: "cli",
  transport: "native-otlp",
  root: unknown,
  capability: unknown,
  policy: { _tag: "Included" },
  heartbeat: unknown,
  knownLaunches: population([id("1")]),
  expectedEvents: population([id("2"), id("3")]),
});
const window = { populationWindowStart: "2026-10-27T11:00:00Z", populationWindowEnd: "2026-10-27T12:00:00Z" };
const input = () => ({
  version: "observation-coverage/v1",
  ...window,
  boundaryEvidenceId: id("d"),
  observedAt: "2026-10-27T12:01:00Z",
  inventory: {
    schemaVersion: "agent-observation-inventory/v1",
    ...window,
    observedAt: "2026-10-27T12:00:00Z",
    boundaryEvidenceId: id("d"),
    hosts: [{ hostId: id("a"), identityNamespaceId: id("b") }],
    roots: [],
    routes: [route()],
  },
  routes: [
    {
      routeId: id("c"),
      launches: snapshot([id("1")]),
      acceptedEvents: snapshot([id("2"), id("3")]),
      visibleEvents: snapshot([id("2"), id("4")], false),
    },
  ],
});
const report = (value: unknown) =>
  S.decodeUnknownEffect(ObservationCoverageInput)(value).pipe(Effect.map(reconcileObservationCoverage));

describe("independent coverage reconciliation", () => {
  it.effect("separates local acceptance from partial backend visibility and unexpected IDs", () =>
    Effect.gen(function* () {
      expect((yield* report(input())).routes[0]).toEqual({
        routeId: id("c"),
        launches: {
          _tag: "Compared",
          expected: 1,
          observed: 1,
          matched: 1,
          notObserved: 0,
          unexpected: 0,
          exhaustive: true,
        },
        acceptedEvents: {
          _tag: "Compared",
          expected: 2,
          observed: 2,
          matched: 2,
          notObserved: 0,
          unexpected: 0,
          exhaustive: true,
        },
        visibleEvents: {
          _tag: "Compared",
          expected: 2,
          observed: 2,
          matched: 1,
          notObserved: 1,
          unexpected: 1,
          exhaustive: false,
        },
      });
    })
  );
  it.effect("never derives denominators from arrivals, or absence from unassessed routes", () =>
    Effect.gen(function* () {
      const value = input();
      expect((yield* report({ ...value, routes: [] })).routes[0]?.acceptedEvents).toEqual({
        _tag: "ObservationUnknown",
        expected: 2,
      });
      const undeclared = {
        ...value,
        inventory: { ...value.inventory, routes: [{ ...route(), knownLaunches: unknown, expectedEvents: unknown }] },
      };
      expect((yield* report(undeclared)).routes[0]?.visibleEvents).toEqual({
        _tag: "DenominatorUnknown",
        observed: 2,
        exhaustive: false,
      });
      expect((yield* report({ ...undeclared, routes: [] })).routes[0]?.visibleEvents).toEqual({ _tag: "Unassessed" });
    })
  );
  it.effect("distinguishes evidenced empty populations and preserves unexplained arrivals", () =>
    Effect.gen(function* () {
      const value = input();
      const empty = {
        ...value,
        inventory: { ...value.inventory, routes: [{ ...route(), expectedEvents: population([]) }] },
      };
      expect((yield* report(empty)).routes[0]?.visibleEvents).toEqual({
        _tag: "Compared",
        expected: 0,
        observed: 2,
        matched: 0,
        notObserved: 0,
        unexpected: 2,
        exhaustive: false,
      });
      expect((yield* report({ ...empty, routes: [] })).routes[0]?.visibleEvents).toEqual({
        _tag: "ObservationUnknown",
        expected: 0,
      });
    })
  );
  it.effect("does not let another route satisfy the same expected IDs", () =>
    Effect.gen(function* () {
      const value = input();
      const result = yield* report({ ...value, inventory: { ...value.inventory, routes: [route(), route(id("5"))] } });
      expect(result.routes[1]?.visibleEvents).toEqual({ _tag: "ObservationUnknown", expected: 2 });
    })
  );
  it.effect(
    "rejects different boundaries, mismatched windows, pre-window snapshots, duplicate and undeclared routes",
    () =>
      Effect.gen(function* () {
        const value = input();
        for (const invalid of [
          { ...value, boundaryEvidenceId: id("0") },
          { ...value, populationWindowStart: "2026-10-27T10:00:00Z" },
          { ...value, populationWindowEnd: "2026-10-27T11:59:59Z" },
          { ...value, observedAt: "2026-10-27T11:59:59Z" },
          { ...value, routes: [...value.routes, ...value.routes] },
          { ...value, routes: A.map(value.routes, (route) => ({ ...route, routeId: id("9") })) },
          {
            ...value,
            routes: A.map(value.routes, (route) => ({ ...route, visibleEvents: snapshot([id("2"), id("2")]) })),
          },
        ])
          expect(yield* report(invalid).pipe(Effect.isFailure)).toBe(true);
      })
  );
  it.effect("bounds total observation populations independently of the manifest", () =>
    Effect.gen(function* () {
      const value = input();
      const ids = A.makeBy(4096, (index) => Str.padStart(64, "0")(index.toString(16)));
      const observed = (routeId: string) => ({
        routeId,
        launches: snapshot(ids),
        acceptedEvents: snapshot(ids),
        visibleEvents: snapshot(ids),
      });
      expect(
        yield* report({
          ...value,
          inventory: { ...value.inventory, routes: [route(), route(id("5"))] },
          routes: [observed(id("c")), observed(id("5"))],
        }).pipe(Effect.isFailure)
      ).toBe(true);
    })
  );
});
