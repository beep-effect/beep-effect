import { aiMetricsCommand } from "@beep/repo-cli/commands/AIMetrics";
import {
  ObservationDeploymentPlan,
  ObservationDeploymentRequest,
  renderObservationDeployment,
} from "@beep/repo-cli/commands/AIMetrics/internal/ObservationDeployment";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const input = {
  version: "observation-deployment-request/v1",
  unitBase: "beep-observation-proof",
  stateDirectory: "/tmp/private-state",
  artifactDirectory: "/tmp/private-artifacts",
  bunPath: "/usr/bin/bun",
  hashSaltFile: "/tmp/private-hash-salt",
  intakePort: 14318,
  runtimeMaxSeconds: 60,
};
const run = Command.runWith(aiMetricsCommand, { version: "proof", renderErrors: false });
const directory = FileSystem.FileSystem.use((fs) =>
  Effect.acquireRelease(fs.makeTempDirectory(), (path) => fs.remove(path, { recursive: true }).pipe(Effect.orDie))
);

it.layer(NodeServices.layer, { concurrent: false })("Observation deployment plan", (it) => {
  it.effect("renders through the registered command without installing or resuming services", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* directory;
      const request = `${root}/request.json`;
      yield* fs.writeFileString(request, yield* S.encodeEffect(S.fromJsonString(S.Unknown))(input));
      yield* run(["install", "observation-plan", "--input", request]);
      const lines = yield* TestConsole.logLines;
      const text = A.join(A.filter(lines, S.is(S.String)), "\n");
      const plan = yield* S.decodeEffect(S.fromJsonString(ObservationDeploymentPlan))(text);
      expect(plan.workerUnit).toContain("RuntimeMaxSec=60");
      expect(plan.workerUnit).toContain("--nonblock --no-fork --conflict-exit-code 73");
      expect(plan.workerUnit).toContain("MemorySwapMax=0");
      expect(plan.workerUnit).toContain("LimitFSIZE=2097152");
      expect(plan.workerUnit).toContain("--check --status");
      expect(plan.workerUnit).toContain("LoadCredential=hash-salt:/tmp/private-hash-salt");
      expect(plan.workerUnit).toContain(
        '/usr/bin/env --ignore-environment PATH=/usr/bin:/bin "CREDENTIALS_DIRECTORY=%d"'
      );
      expect(plan.workerUnit).not.toContain("EnvironmentFile=");
      expect(plan.intakeUnit).toContain("/usr/bin/env --ignore-environment");
      expect(plan.workerUnit).not.toContain("[Install]");
      expect(plan.workerUnit).not.toContain("resume");
      expect(plan.intakeUnit).toContain("BindsTo=beep-observation-proof.service");
      const config = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(plan.intakeConfig);
      expect(config).toMatchObject({
        admin: { disabled: true, config: { persist: false } },
        logging: { logs: { default: { writer: { output: "discard" } } } },
        apps: {
          http: {
            servers: {
              intake: {
                listen: ["127.0.0.1:14318"],
                read_header_timeout: "2s",
                max_header_bytes: 16384,
                routes: [
                  { match: [{ path: ["/v1/traces"], method: ["POST"] }], handle: [{ status_code: 413 }] },
                  { match: [{ path: ["/v1/traces"], method: ["POST"] }], terminal: true },
                  { handle: [{ status_code: 404 }] },
                ],
              },
            },
          },
        },
      });
      expect(yield* fs.readDirectory(root)).toEqual(["request.json"]);
    })
  );

  it.effect("sizes the worker file ceiling from the declared non-minimal journal budget", () =>
    Effect.gen(function* () {
      for (const pages of [1024, 8192]) {
        const request = yield* S.decodeUnknownEffect(ObservationDeploymentRequest)({
          ...input,
          journalMaxDatabasePages: pages,
          phoenixApiKeyFile: "/tmp/private-api-key",
        });
        const plan = yield* renderObservationDeployment(request);
        expect(plan.workerUnit).toContain(`LimitFSIZE=${pages * 8192}`);
        expect(plan.workerUnit).toContain("LoadCredential=phoenix-api-key:/tmp/private-api-key");
        expect(plan.intakeUnit).toContain("LimitFSIZE=2097152");
      }
      for (const pages of [255, 8193]) {
        expect(
          yield* S.decodeUnknownEffect(ObservationDeploymentRequest)({
            ...input,
            journalMaxDatabasePages: pages,
          }).pipe(Effect.isFailure)
        ).toBe(true);
      }
    })
  );

  it.effect("refuses interpolation, overlap, unsafe lifetimes and path traversal", () =>
    Effect.gen(function* () {
      for (const changes of [
        { artifactDirectory: "/tmp/%h" },
        { hashSaltFile: "/tmp/$SECRET" },
        { hashSaltFile: "/tmp/unsupported space" },
        { phoenixApiKeyFile: "/tmp/$SECRET" },
        { bunPath: "/tmp/line\nExecStart=/bin/false" },
        { unitBase: "beep-ai-metrics-forwarder" },
        { runtimeMaxSeconds: 0 },
        { runtimeMaxSeconds: 3601 },
        { intakePort: 80 },
      ]) {
        expect(
          yield* S.decodeUnknownEffect(ObservationDeploymentRequest)({ ...input, ...changes }).pipe(Effect.isFailure)
        ).toBe(true);
      }
      for (const changes of [
        { artifactDirectory: input.stateDirectory },
        { artifactDirectory: `${input.stateDirectory}/nested` },
        { hashSaltFile: `${input.stateDirectory}/secret` },
        { stateDirectory: "/tmp/root/../state" },
        { bunPath: "relative/bun" },
      ]) {
        const request = yield* S.decodeUnknownEffect(ObservationDeploymentRequest)({ ...input, ...changes });
        expect(yield* renderObservationDeployment(request).pipe(Effect.isFailure)).toBe(true);
      }
    })
  );

  it.effect("rejects oversized, invalid UTF-8 and extra fields without emitting input content", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* directory;
      const request = `${root}/request.json`;
      const bodies = [
        new TextEncoder().encode(Str.repeat(17000)("PRIVATE")),
        new Uint8Array([255]),
        new TextEncoder().encode(
          yield* S.encodeEffect(S.fromJsonString(S.Unknown))({ ...input, credential: "PRIVATE" })
        ),
      ];
      for (const body of bodies) {
        yield* fs.writeFile(request, body);
        const result = yield* run(["install", "observation-plan", "--input", request]).pipe(
          Effect.matchCause({ onFailure: Cause.pretty, onSuccess: () => "unexpected success" })
        );
        expect(result).not.toContain("unexpected success");
        expect(result).not.toContain("PRIVATE");
      }
    })
  );
});
