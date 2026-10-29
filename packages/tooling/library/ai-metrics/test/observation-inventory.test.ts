import {
  decodeObservationInventory,
  ObservationCapability,
  ObservationHarness,
  ObservationHeartbeat,
  ObservationHost,
  ObservationIdentity,
  ObservationInventory,
  ObservationPolicy,
  ObservationPopulation,
  ObservationRoot,
  ObservationRootBinding,
  ObservationRoute,
  observationRouteStatus,
  summarizeObservationInventory,
} from "@beep/repo-ai-metrics/observation-inventory";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const now = DateTime.makeUnsafe("2026-10-27T12:00:00Z");
const host = ObservationHost.make({ hostId: id("a"), identityNamespaceId: id("b") });
const route = (routeId = id("c"), harness: ObservationHarness = "codex-cli") =>
  ObservationRoute.make({
    routeId,
    hostId: host.hostId,
    harness,
    surface: "cli",
    transport: "native-otlp",
    root: ObservationRootBinding.cases.Unknown.make({}),
    capability: ObservationCapability.cases.Unknown.make({}),
    policy: ObservationPolicy.cases.Included.make({}),
    heartbeat: ObservationHeartbeat.cases.Unknown.make({}),
    knownLaunches: ObservationPopulation.cases.Unknown.make({}),
    expectedEvents: ObservationPopulation.cases.Unknown.make({}),
  });
const inventory = (routes: ReadonlyArray<ObservationRoute>) =>
  ObservationInventory.make({
    observedAt: now,
    populationWindowStart: DateTime.makeUnsafe("2026-10-27T11:00:00Z"),
    populationWindowEnd: now,
    boundaryEvidenceId: id("d"),
    hosts: [host],
    roots: [],
    routes,
  });
const supported = ObservationCapability.cases.Supported.make({ signals: ["traces"], evidenceId: id("e") });
const heartbeat = (activity: "active" | "idle" | "failed") =>
  ObservationHeartbeat.cases.Observed.make({
    observedAt: DateTime.makeUnsafe("2026-10-27T11:59:00Z"),
    validUntil: DateTime.makeUnsafe("2026-10-27T12:01:00Z"),
    activity,
    evidenceId: id("f"),
  });
const population = (ids: ReadonlyArray<Sha256Hex>) =>
  ObservationPopulation.cases.Enumerated.make({ ids, evidenceId: id("e") });
const encodeRaw = S.encodeEffect(S.fromJsonString(S.Unknown));

describe("declared observability inventory", () => {
  it("represents every requested harness without claiming capability", () => {
    const routes = A.map(ObservationHarness.literals, (harness, index) =>
      route(id(globalThis.String(index + 1)), harness)
    );
    const summary = summarizeObservationInventory(inventory(routes));
    expect(summary.declaredRoutes).toBe(7);
    expect(summary.supportedRoutes).toBe(0);
    expect(summary.unknownCapabilityRoutes).toBe(7);
    expect(summary.unknownLaunchRoutes).toBe(7);
    expect(summary.unknownEventRoutes).toBe(7);
  });
  it("keeps denominators separate and deduplicates shared launch IDs", () => {
    const first = ObservationRoute.make({
      ...route(),
      capability: supported,
      knownLaunches: population([id("1")]),
      expectedEvents: population([id("2"), id("3")]),
    });
    const second = ObservationRoute.make({
      ...route(id("4")),
      capability: supported,
      transport: "transcript",
      knownLaunches: population([id("1")]),
    });
    expect(summarizeObservationInventory(inventory([first, second]))).toEqual({
      hosts: 1,
      roots: 0,
      declaredRoutes: 2,
      supportedRoutes: 2,
      unsupportedRoutes: 0,
      unknownCapabilityRoutes: 0,
      excludedRoutes: 0,
      knownLaunches: 1,
      unknownLaunchRoutes: 0,
      expectedEvents: 2,
      unknownEventRoutes: 1,
    });
    const empty = ObservationRoute.make({ ...route(), knownLaunches: population([]), expectedEvents: population([]) });
    expect(summarizeObservationInventory(inventory([empty])).unknownEventRoutes).toBe(0);
  });
  it("scopes local root and population IDs to their host", () => {
    const secondHost = ObservationHost.make({ hostId: id("6"), identityNamespaceId: id("7") });
    const root = ObservationRoot.make({
      rootId: `root-${id("8")}`,
      hostId: host.hostId,
      repositoryId: ObservationIdentity.cases.Unknown.make({}),
      cloneId: ObservationIdentity.cases.Unknown.make({}),
      worktreeId: ObservationIdentity.cases.Unknown.make({}),
      availability: "retired",
      evidenceId: id("e"),
    });
    const first = ObservationRoute.make({
      ...route(),
      knownLaunches: population([id("1")]),
      expectedEvents: population([id("2")]),
    });
    const second = ObservationRoute.make({ ...first, routeId: id("4"), hostId: secondHost.hostId });
    const declared = ObservationInventory.make({
      ...inventory([first]),
      hosts: [host, secondHost],
      routes: [first, second],
      roots: [root, ObservationRoot.make({ ...root, hostId: secondHost.hostId })],
    });
    expect(summarizeObservationInventory(declared).knownLaunches).toBe(2);
    expect(summarizeObservationInventory(declared).expectedEvents).toBe(2);
    expect(S.is(ObservationInventory)({ ...declared, roots: [root, root] })).toBe(false);
  });
  it("distinguishes idle, stopped/stale, failed, excluded, unsupported and unknown", () => {
    const idle = ObservationRoute.make({ ...route(), capability: supported, heartbeat: heartbeat("idle") });
    expect(observationRouteStatus(now, idle)).toBe("idle");
    expect(observationRouteStatus(DateTime.makeUnsafe("2026-10-27T12:02:00Z"), idle)).toBe("stale");
    expect(observationRouteStatus(now, ObservationRoute.make({ ...idle, heartbeat: heartbeat("active") }))).toBe(
      "active"
    );
    expect(observationRouteStatus(now, ObservationRoute.make({ ...idle, heartbeat: heartbeat("failed") }))).toBe(
      "failed"
    );
    expect(
      observationRouteStatus(
        now,
        ObservationRoute.make({ ...idle, policy: ObservationPolicy.cases.Excluded.make({ evidenceId: id("5") }) })
      )
    ).toBe("excluded");
    expect(
      observationRouteStatus(
        now,
        ObservationRoute.make({
          ...idle,
          capability: ObservationCapability.cases.Unsupported.make({ evidenceId: id("5") }),
        })
      )
    ).toBe("unsupported");
    expect(observationRouteStatus(now, route())).toBe("unknown");
    expect(observationRouteStatus(DateTime.makeUnsafe("2026-10-27T11:58:00Z"), idle)).toBe("unknown");
    expect(summarizeObservationInventory(inventory([idle])).unknownEventRoutes).toBe(1);
  });
  it("rejects dangling identities, duplicate routes and cross-host binding", () => {
    const declared = inventory([route()]);
    expect(S.is(ObservationInventory)({ ...declared, hosts: [] })).toBe(false);
    expect(S.is(ObservationInventory)({ ...declared, routes: [route(), route()] })).toBe(false);
    const secondHost = ObservationHost.make({ hostId: id("6"), identityNamespaceId: host.identityNamespaceId });
    const root = ObservationRoot.make({
      rootId: `root-${id("7")}`,
      hostId: secondHost.hostId,
      repositoryId: ObservationIdentity.cases.Verified.make({ id: id("8"), evidenceId: id("b") }),
      cloneId: ObservationIdentity.cases.Unknown.make({}),
      worktreeId: ObservationIdentity.cases.Verified.make({ id: id("a"), evidenceId: id("b") }),
      availability: "retired",
      evidenceId: id("b"),
    });
    const bound = ObservationRoute.make({
      ...route(),
      root: ObservationRootBinding.cases.Verified.make({ rootId: root.rootId, evidenceId: id("b") }),
    });
    expect(S.is(ObservationInventory)({ ...declared, hosts: [host, secondHost], roots: [root], routes: [bound] })).toBe(
      false
    );
    expect(
      S.is(ObservationInventory)({
        ...declared,
        hosts: [host, secondHost],
        roots: [root],
        routes: [ObservationRoute.make({ ...bound, hostId: secondHost.hostId })],
      })
    ).toBe(true);
  });
  it("rejects backwards health windows and duplicate population entries", () => {
    expect(
      S.is(ObservationHeartbeat)({ ...heartbeat("idle"), validUntil: DateTime.makeUnsafe("2026-10-27T11:58:00Z") })
    ).toBe(false);
    expect(S.is(ObservationPopulation)({ _tag: "Enumerated", ids: [id("1"), id("1")], evidenceId: id("2") })).toBe(
      false
    );
    expect(S.is(ObservationPopulation)({ _tag: "Enumerated", ids: [], evidenceId: "raw-private-path" })).toBe(false);
  });
  it("requires a nonempty population window ending by the evidence observation", () => {
    const declared = inventory([route()]);
    expect(S.is(ObservationInventory)({ ...declared, populationWindowStart: now })).toBe(false);
    expect(
      S.is(ObservationInventory)({ ...declared, populationWindowEnd: DateTime.makeUnsafe("2026-10-27T12:01:00Z") })
    ).toBe(false);
    expect(
      S.is(ObservationInventory)({ ...declared, populationWindowEnd: DateTime.makeUnsafe("2026-10-27T10:59:00Z") })
    ).toBe(false);
  });
  it("enforces per-population and aggregate population bounds", () => {
    const ids = A.makeBy(4096, (index) => Sha256Hex.make(Str.padStart(64, "0")(globalThis.Number(index).toString(16))));
    expect(S.is(ObservationPopulation)({ _tag: "Enumerated", ids, evidenceId: id("e") })).toBe(true);
    expect(S.is(ObservationPopulation)({ _tag: "Enumerated", ids: [...ids, id("f")], evidenceId: id("e") })).toBe(
      false
    );
    const full = ObservationRoute.make({ ...route(), knownLaunches: population(ids), expectedEvents: population(ids) });
    const atLimit = inventory([full, ObservationRoute.make({ ...full, routeId: id("d") })]);
    expect(S.is(ObservationInventory)(atLimit)).toBe(true);
    expect(
      S.is(ObservationInventory)({
        ...atLimit,
        routes: [
          ...atLimit.routes,
          ObservationRoute.make({ ...route(id("e")), expectedEvents: population([id("f")]) }),
        ],
      })
    ).toBe(false);
  });
  it.effect("rejects unexpected content without exposing it in boundary errors", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(S.fromJsonString(ObservationInventory))(inventory([route()]));
      expect(summarizeObservationInventory(yield* decodeObservationInventory(encoded)).declaredRoutes).toBe(1);
      const valid = yield* S.encodeEffect(ObservationInventory)(inventory([route()]));
      const bad = yield* encodeRaw({ ...valid, secret: "synthetic-content-must-not-leak" });
      const failure = yield* decodeObservationInventory(bad).pipe(Effect.flip);
      expect(failure.message).toBe("Invalid observation inventory.");
      expect(failure).not.toHaveProperty("cause");
      const nested = yield* encodeRaw({
        ...valid,
        routes: [{ ...valid.routes[0], heartbeat: { _tag: "Unknown", prompt: "synthetic-content-must-not-leak" } }],
      });
      const nestedFailure = yield* decodeObservationInventory(nested).pipe(Effect.flip);
      expect(nestedFailure.message).toBe("Invalid observation inventory.");
      expect(nestedFailure).not.toHaveProperty("cause");
      const tooLarge = yield* decodeObservationInventory(Str.repeat(4_194_305)("x")).pipe(Effect.flip);
      expect(tooLarge.message).toContain("parsing limit");
    })
  );
});
