import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { computeCommand } from "@beep/repo-cli/commands/Compute";
import {
  ComputeProfile,
  ComputeProfileError,
  ComputeProfileProbe,
  ComputeProfileResolution,
  ComputeProfileSource,
  constrainedCeilingGib,
  GateRouteId,
  gateRouteFor,
  liveComputeMemorySource,
  makeComputeProfileProbe,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import * as NodeTerminal from "@effect/platform-node/NodeTerminal";
import { describe, expect, vi } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import type { ComputeMemorySource } from "@beep/repo-cli/test/RepoRun";

const GIB = 1024 * 1024 * 1024;

const workerSource: ComputeMemorySource = {
  constrainedMemoryBytes: () => 7 * GIB,
  totalMemoryBytes: () => 15 * GIB,
  residentBytes: () => 0,
};

const runCompute = Command.runWith(computeCommand, { version: "0.0.0" });

const commandLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  NodePath.layer,
  NodeStdio.layer,
  NodeTerminal.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("compute profile must not spawn"))
  )
);

const decodeResolutionJson = S.decodeUnknownEffect(S.fromJsonString(ComputeProfileResolution));

const pinned =
  (env: Record<string, string> = {}) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.provideService(ComputeProfileProbe, makeComputeProfileProbe(workerSource)),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    );

it.layer(commandLayer, { timeout: "10 seconds" })("beep compute profile", (it) => {
  it.effect("prints the profile name", () =>
    Effect.gen(function* () {
      yield* runCompute(["profile"]);
      const lines = yield* TestConsole.logLines;
      expect(lines).toEqual(["worker"]);
    }).pipe(pinned())
  );

  it.effect("prints the encoded resolution with --json", () =>
    Effect.gen(function* () {
      yield* runCompute(["profile", "--json"]);
      const lines = yield* TestConsole.logLines;
      expect(lines).toHaveLength(1);
      const resolution = yield* decodeResolutionJson(lines[0]);
      expect(resolution.profile).toBe("worker");
      expect(resolution.source).toBe("probe");
      expect(resolution.envelopeGib).toBe(20);
      assertSome(resolution.ceilingGib, 7);
    }).pipe(pinned())
  );

  it.effect("exits 0 silently when --is matches", () =>
    Effect.gen(function* () {
      yield* runCompute(["profile", "--is", "worker"]);
      const lines = yield* TestConsole.logLines;
      expect(lines).toEqual([]);
    }).pipe(pinned())
  );

  it.effect("fails with a reported exit 1 when --is differs", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(runCompute(["profile", "--is", "workstation"]));
      const lines = yield* TestConsole.logLines;
      expect(Runtime.getErrorExitCode(error)).toBe(1);
      expect(lines).toEqual([]);
    }).pipe(pinned())
  );

  it.effect("fails with ComputeProfileError on an invalid override", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(runCompute(["profile"]));
      expect(error).toBeInstanceOf(ComputeProfileError);
    }).pipe(pinned({ BEEP_COMPUTE_PROFILE: "mainframe" }))
  );
});

describe("compute profile live source", () => {
  it.effect("resolves through the default reference", () =>
    Effect.gen(function* () {
      const probe = yield* ComputeProfileProbe;
      const resolution = yield* probe.resolve;
      expect(ComputeProfile.is[resolution.profile](resolution.profile)).toBe(true);
      expect(resolution.envelopeGib).toBe(20);
      expect(ComputeProfileSource.literals).toContain(resolution.source);
      expect(liveComputeMemorySource.residentBytes()).toBeGreaterThan(0);
    }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
  );

  it("returns undefined when a live reading throws", () => {
    const spy = vi.spyOn(process, "constrainedMemory").mockImplementation(() => {
      throw new Error("unavailable");
    });
    try {
      expect(liveComputeMemorySource.constrainedMemoryBytes()).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps a usable ceiling when installed memory is unreadable", () => {
    assertSome(
      constrainedCeilingGib({
        constrainedMemoryBytes: () => 7 * GIB,
        totalMemoryBytes: () => undefined,
        residentBytes: () => 0,
      }),
      7
    );
  });

  it.effect("resolves against an explicit envelope", () =>
    Effect.gen(function* () {
      const resolution = yield* makeComputeProfileProbe(workerSource).resolveFor(4);
      expect(resolution.profile).toBe("workstation");
      expect(resolution.envelopeGib).toBe(4);
    }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
  );
});

describe("gate route fallback", () => {
  it("routes a gate missing from the table locally everywhere", () => {
    const unknownGate = "not-a-gate" as GateRouteId;
    expect(GateRouteId.literals).not.toContain(unknownGate);
    expect(gateRouteFor(unknownGate, "worker")).toBe("local");
  });
});
