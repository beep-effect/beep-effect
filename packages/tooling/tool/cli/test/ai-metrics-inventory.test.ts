import { ObservationHarness, ObservationInventoryReport } from "@beep/repo-ai-metrics/observation-inventory";
import { ObservationRootProbeResult } from "@beep/repo-ai-metrics/observation-root-probe";
import { aiMetricsCommand } from "@beep/repo-cli/commands/AIMetrics";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";

const run = Command.runWith(aiMetricsCommand, { version: "0.0.0" });
const id = (digit: string) => Str.repeat(64)(digit);
const manifest = {
  schemaVersion: "agent-observation-inventory/v1",
  observedAt: "2026-10-27T12:00:00Z",
  populationWindowStart: "2026-10-27T11:00:00Z",
  populationWindowEnd: "2026-10-27T12:00:00Z",
  boundaryEvidenceId: id("d"),
  hosts: [{ hostId: id("a"), identityNamespaceId: id("b") }],
  roots: [],
  routes: A.map(ObservationHarness.literals, (harness, index) => ({
    routeId: id(globalThis.String(index + 1)),
    hostId: id("a"),
    harness,
    surface: "unknown",
    transport: "native-otlp",
    root: { _tag: "Unknown" },
    capability: { _tag: "Unknown" },
    policy: { _tag: "Included" },
    heartbeat: { _tag: "Unknown" },
    knownLaunches: { _tag: "Unknown" },
    expectedEvents: { _tag: "Unknown" },
  })),
};
const temporaryDirectory = FileSystem.FileSystem.use((fs) =>
  Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
    fs.remove(directory, { recursive: true, force: true }).pipe(Effect.orDie)
  )
);
const logged = Effect.map(TestConsole.logLines, (lines) =>
  A.join(
    A.filter(lines, (line): line is string => typeof line === "string"),
    "\n"
  )
);
const failureText = (input: string) =>
  run(["inventory", "report", "--input", input]).pipe(
    Effect.matchCause({ onFailure: Cause.pretty, onSuccess: () => "unexpected success" })
  );

it.layer(NodeServices.layer, { concurrent: false, timeout: "10 seconds" })("ai-metrics inventory command", (it) => {
  it.effect("reports all declared harnesses with explicit unknown denominators", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const input = `${directory}/inventory.json`;
      yield* fs.writeFileString(input, yield* S.encodeEffect(S.fromJsonString(S.Unknown))(manifest));
      yield* run(["inventory", "report", "--input", input, "--json"]);
      const output = yield* logged;
      const report = yield* S.decodeEffect(S.fromJsonString(ObservationInventoryReport))(output);
      expect(report.summary.declaredRoutes).toBe(7);
      expect(report.summary.knownLaunches).toBe(0);
      expect(report.summary.unknownLaunchRoutes).toBe(7);
      expect(report.summary.unknownEventRoutes).toBe(7);
      expect(A.every(report.routeStatuses, (route) => route.status === "unknown")).toBe(true);
      expect(output).not.toContain(directory);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
  it.effect("explains the declared scope in human output", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const input = `${directory}/inventory.json`;
      yield* fs.writeFileString(input, yield* S.encodeEffect(S.fromJsonString(S.Unknown))(manifest));
      yield* run(["inventory", "report", "--input", input]);
      const output = yield* logged;
      expect(output).toContain("Population window: [2026-10-27T11:00:00.000Z, 2026-10-27T12:00:00.000Z)");
      expect(output).toContain("7 routes have unknown launch populations");
      expect(output).toContain("Launch population: unknown; 0 distinct launch IDs enumerated");
      expect(output).toContain("Expected event population: unknown; 0 distinct event IDs enumerated");
      expect(output).toContain("do not establish capture of all activity");
      for (const harness of ObservationHarness.literals)
        expect(output).toContain(`${harness} / unknown / native-otlp: unknown`);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
  it.effect("refuses oversize, invalid UTF-8 and unexpected fields without leaking content", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const input = `${directory}/private-inventory.json`;
      yield* fs.writeFileString(input, Str.repeat(4_194_305)("x"));
      expect(yield* failureText(input)).toContain("exceeds its byte limit");
      yield* fs.writeFile(input, new Uint8Array([0xff, 0xfe]));
      expect(yield* failureText(input)).toContain("Invalid observation inventory encoding");
      yield* fs.writeFileString(
        input,
        yield* S.encodeEffect(S.fromJsonString(S.Unknown))({ ...manifest, secret: "synthetic-private-content" })
      );
      const rejected = yield* failureText(input);
      expect(rejected).toContain("Invalid observation inventory");
      expect(rejected).not.toContain("synthetic-private-content");
      expect(rejected).not.toContain(directory);
      yield* fs.remove(input);
      const absent = yield* failureText(input);
      expect(absent).toContain("Unable to read observation inventory");
      expect(absent).not.toContain(directory);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
});

it.layer(NodeServices.layer, { concurrent: false, timeout: "10 seconds" })("ai-metrics inventory root probe", (it) => {
  it.effect("runs the declared probe command and emits only pseudonymous evidence", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(1000);
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const input = `${directory}/private-declaration.json`;
      yield* fs.writeFileString(
        input,
        yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
          schemaVersion: "agent-observation-root-declaration/v1",
          hostKey: "synthetic-private-host",
          populationWindowStart: "1970-01-01T00:00:00Z",
          populationWindowEnd: "1970-01-01T00:00:01Z",
          roots: [{ path: `${directory}/retired-root`, state: "retired" }],
        })
      );
      yield* run(["inventory", "probe-roots", "--input", input, "--json"]).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ BEEP_AI_METRICS_HASH_SALT: "synthetic-private-salt" })
        )
      );
      const output = yield* logged;
      const result = yield* S.decodeEffect(S.fromJsonString(ObservationRootProbeResult))(output);
      expect(result.inventory.roots[0]?.availability).toBe("retired");
      expect(result.rootReceipts).toHaveLength(1);
      expect(result.inventory.routes).toHaveLength(7);
      expect(A.every(result.inventory.routes, (route) => route.transport === "unknown")).toBe(true);
      for (const privateValue of [directory, "synthetic-private-host", "synthetic-private-salt"])
        expect(output).not.toContain(privateValue);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
  it.effect("refuses a missing salt without leaking declaration values", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const input = `${directory}/private-declaration.json`;
      yield* fs.writeFileString(
        input,
        yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
          schemaVersion: "agent-observation-root-declaration/v1",
          hostKey: "synthetic-private-host",
          populationWindowStart: "1970-01-01T00:00:00Z",
          populationWindowEnd: "1970-01-01T00:00:01Z",
          roots: [],
        })
      );
      const output = yield* run(["inventory", "probe-roots", "--input", input]).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
        Effect.matchCause({ onFailure: Cause.pretty, onSuccess: () => "unexpected success" })
      );
      expect(output).toContain("require BEEP_AI_METRICS_HASH_SALT");
      expect(output).not.toContain(directory);
      expect(output).not.toContain("synthetic-private-host");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
});

it.layer(NodeServices.layer, { concurrent: false, timeout: "10 seconds" })("ai-metrics coverage command", (it) => {
  const evidence = {
    version: "observation-coverage/v1",
    inventory: manifest,
    boundaryEvidenceId: manifest.boundaryEvidenceId,
    populationWindowStart: manifest.populationWindowStart,
    populationWindowEnd: manifest.populationWindowEnd,
    observedAt: "2026-10-27T12:01:00Z",
    routes: [
      {
        routeId: id("1"),
        launches: { _tag: "Unknown" },
        acceptedEvents: { _tag: "Observed", ids: [id("a")], evidenceId: id("f"), exhaustive: false },
        visibleEvents: { _tag: "Unknown" },
      },
    ],
  };
  it.effect("preserves unknown denominators through the actual command and explains partial queries", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const input = `${directory}/coverage.json`;
      yield* fs.writeFileString(input, yield* S.encodeEffect(S.fromJsonString(S.Unknown))(evidence));
      yield* run(["inventory", "coverage", "--input", input]);
      const output = yield* logged;
      expect(output).toContain("acceptedEvents: 1 observed; denominator unknown; snapshot partial");
      expect(output).toContain("visibleEvents: denominator and observations unknown");
      expect(output).toContain("Not observed does not prove loss");
      expect(output).not.toContain(directory);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
  it.effect("rejects mismatched scope and private excess fields without printing either", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const input = `${directory}/coverage.json`;
      for (const invalid of [
        { ...evidence, boundaryEvidenceId: id("0") },
        { ...evidence, secret: "synthetic-coverage-private" },
      ]) {
        yield* fs.writeFileString(input, yield* S.encodeEffect(S.fromJsonString(S.Unknown))(invalid));
        const result = yield* run(["inventory", "coverage", "--input", input, "--json"]).pipe(
          Effect.matchCause({ onFailure: Cause.pretty, onSuccess: () => "unexpected success" })
        );
        expect(result).toContain("Invalid observation coverage boundary or evidence");
        expect(result).not.toContain("synthetic-coverage-private");
        expect(result).not.toContain(directory);
      }
    })
  );
});
