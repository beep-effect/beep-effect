import {
  AdmissionConfig,
  ComputeProfileProbe,
  constrainedCeilingGib,
  MemoryStats,
  makeComputeProfileProbe,
  memoryCeilingGib,
  memoryStatsLayerFor,
  resolveComputeProfileWith,
  YeetAdmissionTicket,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertDefined, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import * as TestConsole from "effect/testing/TestConsole";
import type { ComputeMemorySource } from "@beep/repo-cli/test/RepoRun";

const GIB = 1024 * 1024 * 1024;
const ENVELOPE_GIB = 20;

const source = (constrained: number | undefined, total: number | undefined): ComputeMemorySource => ({
  constrainedMemoryBytes: () => constrained,
  totalMemoryBytes: () => total,
  residentBytes: () => 0,
});

const withOverride =
  (values: Record<string, string>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

const captureWarnings = Effect.fn("captureWarnings")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const testConsole = yield* TestConsole.make;
  const warnings: Array<unknown> = [];
  const result = yield* Effect.provideService(effect, Console.Console, {
    ...testConsole,
    warn: (...args: ReadonlyArray<unknown>) => {
      warnings.push(...args);
    },
  });
  return { result, warnings };
});

describe("compute profile probe", () => {
  it.effect("resolves a 7 GiB ceiling as worker", () =>
    Effect.gen(function* () {
      const resolution = yield* resolveComputeProfileWith(source(7 * GIB, 15 * GIB), ENVELOPE_GIB);
      expect(resolution.profile).toBe("worker");
      expect(resolution.source).toBe("probe");
      assertSome(resolution.ceilingGib, 7);
      expect(resolution.envelopeGib).toBe(ENVELOPE_GIB);
    }).pipe(withOverride({}))
  );

  it.effect("resolves a 125 GiB ceiling as workstation", () =>
    Effect.gen(function* () {
      const resolution = yield* resolveComputeProfileWith(source(125 * GIB, 125 * GIB), ENVELOPE_GIB);
      expect(resolution.profile).toBe("workstation");
      expect(resolution.source).toBe("probe");
    }).pipe(withOverride({}))
  );

  it.effect("treats the 2^64 uncapped sentinel as no ceiling and uses installed memory", () =>
    Effect.gen(function* () {
      const capped = source(2 ** 64, 15 * GIB);
      assertSome(memoryCeilingGib(capped), 15);
      assertNone(constrainedCeilingGib(capped));
      const resolution = yield* resolveComputeProfileWith(capped, ENVELOPE_GIB);
      expect(resolution.profile).toBe("worker");
      assertSome(resolution.ceilingGib, 15);
    }).pipe(withOverride({}))
  );

  it.effect("falls back to workstation when no reading is usable", () =>
    Effect.gen(function* () {
      const resolution = yield* resolveComputeProfileWith(source(undefined, 0), ENVELOPE_GIB);
      expect(resolution.profile).toBe("workstation");
      expect(resolution.source).toBe("unavailable");
      assertNone(resolution.ceilingGib);
    }).pipe(withOverride({}))
  );

  it.effect("lets the worker override tighten a workstation", () =>
    Effect.gen(function* () {
      const resolution = yield* resolveComputeProfileWith(source(125 * GIB, 125 * GIB), ENVELOPE_GIB);
      expect(resolution.profile).toBe("worker");
      expect(resolution.source).toBe("override");
      assertSome(resolution.overrideRequested, "worker");
    }).pipe(withOverride({ BEEP_COMPUTE_PROFILE: "worker" }))
  );

  it.effect("ignores the workstation override with a warning", () =>
    Effect.gen(function* () {
      const { result, warnings } = yield* captureWarnings(
        resolveComputeProfileWith(source(7 * GIB, 15 * GIB), ENVELOPE_GIB)
      );
      expect(result.profile).toBe("worker");
      expect(result.source).toBe("probe");
      assertSome(result.overrideRequested, "workstation");
      expect(warnings).toHaveLength(1);
      expect(String(warnings[0])).toContain("BEEP_COMPUTE_PROFILE=workstation ignored");
    }).pipe(withOverride({ BEEP_COMPUTE_PROFILE: "workstation" }))
  );

  it.effect("fails typed on an invalid override", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(resolveComputeProfileWith(source(7 * GIB, 15 * GIB), ENVELOPE_GIB));
      expect(error._tag).toBe("ComputeProfileError");
      expect(error.message).toContain("BEEP_COMPUTE_PROFILE must be one of workstation, worker");
    }).pipe(withOverride({ BEEP_COMPUTE_PROFILE: "huge" }))
  );

  it.effect("resolves through an injected probe service", () =>
    Effect.gen(function* () {
      const resolution = yield* ComputeProfileProbe.use((probe) => probe.resolve);
      expect(resolution.profile).toBe("worker");
      expect(resolution.envelopeGib).toBe(ENVELOPE_GIB);
    }).pipe(
      Effect.provideService(ComputeProfileProbe, makeComputeProfileProbe(source(2 * GIB, 125 * GIB))),
      withOverride({})
    )
  );
});

describe("memory stats under a compute ceiling", () => {
  it.effect("traces the cgroup reservation-capacity read as MemoryStats.reservationCapacity", () =>
    Effect.gen(function* () {
      const spans = MutableRef.make<ReadonlyArray<string>>([]);
      const tracer = Tracer.make({
        span(options) {
          MutableRef.update(spans, A.append(options.name));
          return new Tracer.NativeSpan(options);
        },
      });
      const stats = yield* MemoryStats;
      assertDefined(stats.reservationCapacity);
      yield* stats.reservationCapacity([], AdmissionConfig.make({})).pipe(Effect.withTracer(tracer));
      expect(MutableRef.get(spans)).toContain("MemoryStats.reservationCapacity");
    }).pipe(
      Effect.provide(memoryStatsLayerFor(source(7 * GIB, 15 * GIB)).pipe(Layer.provide(FileSystem.layerNoop({}))))
    )
  );
});

describe("attempt facts carry the compute profile", () => {
  const encodedTicket = {
    schemaVersion: "yeet-admission-ticket/v1",
    pid: 1234,
    procStart: "8241991",
    kind: "review-fix",
    weightTokens: 1,
    priority: "verify",
    originKey: "aaaabbbbcccc",
    checkoutRoot: "/repo",
    branch: "feat/x",
    enqueuedAtMillis: 0,
    heartbeatAtMillis: 0,
    nonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206",
  };
  const decodeTicket = S.decodeUnknownEffect(YeetAdmissionTicket);

  it.effect("decodes a fact written before computeProfile existed", () =>
    Effect.gen(function* () {
      const ticket = yield* decodeTicket(encodedTicket);
      assertNone(ticket.computeProfile);
      expect(ticket.forceLocal).toBe(false);
    })
  );

  it.effect("decodes a fact that records computeProfile and forceLocal", () =>
    Effect.gen(function* () {
      const ticket = yield* decodeTicket({ ...encodedTicket, computeProfile: "worker", forceLocal: true });
      assertSome(ticket.computeProfile, "worker");
      expect(ticket.forceLocal).toBe(true);
    })
  );
});
