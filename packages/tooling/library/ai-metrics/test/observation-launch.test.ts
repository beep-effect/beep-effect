import {
  ObservationLaunchConfig,
  observationWorkerConfigFromLaunch,
  readObservationLaunchConfig,
} from "@beep/repo-ai-metrics/observation-launch";
import { AI_METRICS_LOCAL_INSECURE_HASH_SALT, hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { launchFixture, syntheticLaunchSalt } from "./fixtures/observation-launch-config.ts";

const services = Layer.merge(NodeServices.layer, NodeCrypto.layer);
const fixture = Effect.fn("ObservationLaunchTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "obs-launch-" });
  yield* fs.chmod(directory, 0o700);
  const config = yield* launchFixture();
  const text = yield* S.encodeEffect(S.fromJsonString(ObservationLaunchConfig))(config);
  const file = `${directory}/worker.json`;
  yield* fs.writeFileString(file, text, { mode: 0o600 });
  const uid = process.geteuid?.() ?? -1;
  return { fs, directory, config, text, file, uid };
});
it.effect("reads explicit private configuration and binds only the matching secret namespace", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    expect(yield* readObservationLaunchConfig(f.directory, f.uid)).toEqual(f.config);
    const config = yield* observationWorkerConfigFromLaunch(f.config, Redacted.make(syntheticLaunchSalt), O.none());
    expect(config.intake.namespaceId).toBe(f.config.intake.namespaceId);
    expect(config.ledger.targetId).toMatch(/^[a-f0-9]{64}$/);
    expect(
      yield* observationWorkerConfigFromLaunch(f.config, Redacted.make("different-synthetic-salt"), O.none()).pipe(
        Effect.flip
      )
    ).toMatchObject({ reason: "namespace" });
  }).pipe(Effect.scoped, provideScopedLayer(services))
);
it.effect("refuses exposed paths, wrong owners, symlink files and hardlinked configuration", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    expect(yield* readObservationLaunchConfig(`${f.directory}/../unused`, f.uid).pipe(Effect.flip)).toMatchObject({
      reason: "directory",
    });
    expect(yield* readObservationLaunchConfig(f.directory, f.uid + 1).pipe(Effect.flip)).toMatchObject({
      reason: "directory",
    });
    yield* f.fs.chmod(f.directory, 0o755);
    expect(yield* readObservationLaunchConfig(f.directory, f.uid).pipe(Effect.flip)).toMatchObject({
      reason: "directory",
    });
    yield* f.fs.chmod(f.directory, 0o700);
    yield* f.fs.chmod(f.file, 0o644);
    expect(yield* readObservationLaunchConfig(f.directory, f.uid).pipe(Effect.flip)).toMatchObject({
      reason: "configuration",
    });
    yield* f.fs.chmod(f.file, 0o600);
    yield* f.fs.rename(f.file, `${f.directory}/original`);
    yield* f.fs.symlink(`${f.directory}/original`, f.file);
    expect(yield* readObservationLaunchConfig(f.directory, f.uid).pipe(Effect.flip)).toMatchObject({
      reason: "configuration",
    });
    yield* f.fs.remove(f.file);
    yield* f.fs.link(`${f.directory}/original`, f.file);
    expect(yield* readObservationLaunchConfig(f.directory, f.uid).pipe(Effect.flip)).toMatchObject({
      reason: "configuration",
    });
    expect(yield* f.fs.readFileString(`${f.directory}/original`)).toBe(f.text);
  }).pipe(Effect.scoped, provideScopedLayer(services))
);
it.effect("bounds bytes and encoding and never includes private input in refusal", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    for (const body of [
      new Uint8Array([255]),
      new TextEncoder().encode(Str.repeat(65537)("x")),
      new TextEncoder().encode('{"private":"PRIVATE-LAUNCH-CANARY"}'),
    ]) {
      yield* f.fs.writeFile(f.file, body);
      const error = yield* readObservationLaunchConfig(f.directory, f.uid).pipe(Effect.flip);
      expect(error).toMatchObject({ reason: "configuration" });
      expect(String(error)).not.toContain("PRIVATE-LAUNCH-CANARY");
      expect(String(error)).not.toContain(f.directory);
    }
  }).pipe(Effect.scoped, provideScopedLayer(services))
);
it.effect("validates destinations before journal startup without network traffic", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const changed = ObservationLaunchConfig.make({
      ...f.config,
      destination: { ...f.config.destination, endpoint: "file:///private" },
    });
    expect(
      yield* observationWorkerConfigFromLaunch(changed, Redacted.make(syntheticLaunchSalt), O.none()).pipe(Effect.flip)
    ).toMatchObject({ reason: "configuration" });
  }).pipe(Effect.scoped, provideScopedLayer(services))
);

it.effect("keeps omitted discovery unconfigured and rejects shared single-slot discovery admission", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    expect((yield* readObservationLaunchConfig(f.directory, f.uid)).discovery).toEqual(O.none());
    const raw = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(f.text);
    const base = yield* S.decodeUnknownEffect(S.Record(S.String, S.Unknown))(raw);
    const invalid = {
      ...base,
      control: { maxActive: 1, drainTimeoutMillis: 5000 },
      discovery: {
        roots: [{ path: "/synthetic/source", source: "codex", retired: false }],
        maxDepth: 2,
        maxEntries: 3,
        maxFiles: 1,
        maxCycleEntries: 128,
        read: { maxBytes: 512, maxLineBytes: 256, maxFrames: 1 },
        runtime: { intervalMillis: 100, cycleTimeoutMillis: 2000, staleAfterMillis: 3000 },
      },
    };
    yield* f.fs.writeFileString(f.file, yield* S.encodeEffect(S.fromJsonString(S.Unknown))(invalid));
    expect(yield* readObservationLaunchConfig(f.directory, f.uid).pipe(Effect.flip)).toMatchObject({
      reason: "configuration",
    });
  }).pipe(Effect.scoped, provideScopedLayer(services))
);

it.effect("refuses insecure salt fallbacks even when their namespace was explicitly declared", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    for (const salt of ["", " ", AI_METRICS_LOCAL_INSECURE_HASH_SALT]) {
      const namespaceId = yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt));
      const config = ObservationLaunchConfig.make({
        ...f.config,
        intake: TranscriptIntakeConfig.make({ ...f.config.intake, namespaceId }),
      });
      expect(
        yield* observationWorkerConfigFromLaunch(config, Redacted.make(salt), O.none()).pipe(Effect.flip)
      ).toMatchObject({ reason: "namespace" });
    }
  }).pipe(Effect.scoped, provideScopedLayer(services))
);
