import { SetupDoctor } from "@beep/law-practice-use-cases/PracticeSetup";
import { ElicitedApprovals } from "@beep/practice-gateway/Approvals";
import { GatewaySettings } from "@beep/practice-gateway/GatewaySettings";
import { SelfCheckFailure } from "@beep/practice-gateway/PracticeGateway.errors";
import { PracticeKgModuleLoader } from "@beep/practice-gateway/PracticeKgProvider";
import { GatewaySetupProbes } from "@beep/practice-gateway/Probes";
import { PROFILE_FILE_NAME, ProfileStore } from "@beep/practice-gateway/ProfileStore";
import {
  GatewaySelfCheckRefusal,
  GatewaySelfCheckReport,
  printGatewaySelfCheck,
  runGatewaySelfCheck,
} from "@beep/practice-gateway/SelfCheck";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { WindowsSecretStore } from "@beep/windows-secrets";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { fakeHost, fakeM365SignIn, fullProfile, settingsLayer } from "./fixtures.ts";

const Platform = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);
const isString = S.is(S.String);
const layerTimeout = "30 seconds";

// Gateway services over a fresh temporary data directory and a bare fake Windows machine.
const GatewayServices = Layer.unwrap(
  FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped({ prefix: "practice-gateway-" })).pipe(
    Effect.map((dataDir) => {
      const settings = settingsLayer({ dataDir });
      const probes = GatewaySetupProbes.pipe(
        Layer.provide(
          Layer.mergeAll(
            fakeHost({ bitLocker: "on" }),
            settings,
            Platform,
            WindowsSecretStore.layerMemory,
            fakeM365SignIn({}),
            PracticeKgModuleLoader.layer
          )
        )
      );
      return Layer.mergeAll(
        SetupDoctor.layer.pipe(Layer.provide(Layer.merge(probes, ElicitedApprovals))),
        ProfileStore.layer.pipe(Layer.provide(Layer.merge(settings, Platform))),
        settings
      );
    })
  )
).pipe(Layer.provideMerge(Platform));

const profilePath = Effect.gen(function* () {
  const { dataDir } = yield* GatewaySettings;
  const path = yield* Path.Path;
  return path.join(dataDir, PROFILE_FILE_NAME);
});

const printed = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  Effect.all({ value: self, lines: TestConsole.logLines.pipe(Effect.map(A.filter(isString))) }).pipe(
    Effect.provideServiceEffect(Console.Console, TestConsole.make)
  );

describe("ProfileStore", () => {
  it.layer(GatewayServices, { timeout: layerTimeout })("on an empty data directory", (it) => {
    it.effect("reads none before saving and round-trips a saved profile", () =>
      Effect.gen(function* () {
        const store = yield* ProfileStore;
        assertNone(yield* store.get);
        yield* store.save(fullProfile);
        const saved = yield* store.get;
        assertSome(
          O.map(saved, (profile) => profile.choices.length),
          3
        );
        const fs = yield* FileSystem.FileSystem;
        expect(yield* fs.exists(`${yield* profilePath}.tmp`)).toBe(false);
      })
    );
  });

  it.layer(GatewayServices, { timeout: layerTimeout })("on a corrupt profile file", (it) => {
    it.effect("fails with a typed error", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(yield* profilePath, "{not json");
        const error = yield* ProfileStore.use((store) => store.get).pipe(Effect.flip);
        expect(error._tag).toBe("ProfileStoreFailure");
      })
    );
  });
});

describe("--self-check", () => {
  it.layer(GatewayServices, { timeout: layerTimeout })("with a saved profile", (it) => {
    it.effect("prints one decodable report line for the saved profile", () =>
      Effect.gen(function* () {
        yield* ProfileStore.use((store) => store.save(fullProfile));
        const { lines } = yield* printGatewaySelfCheck(runGatewaySelfCheck).pipe(printed);
        expect(lines).toHaveLength(1);
        const line = yield* S.decodeEffect(S.fromJsonString(GatewaySelfCheckReport))(lines[0] ?? "");
        expect(line.profileSaved).toBe(true);
        expect(line.report.checks).toHaveLength(10);
        expect(line.summary).toContain("You need to: Open Claude and sign in with your Claude account.");
      })
    );
  });

  it.layer(GatewayServices, { timeout: layerTimeout })("with an unreadable profile", (it) => {
    it.effect("prints a refusal line and fails when the profile cannot be read", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(yield* profilePath, "{}");
        const { lines, value } = yield* printGatewaySelfCheck(runGatewaySelfCheck).pipe(Effect.flip, printed);
        expect(value).toBeInstanceOf(SelfCheckFailure);
        expect(lines).toHaveLength(1);
        const refusal = yield* S.decodeEffect(S.fromJsonString(GatewaySelfCheckRefusal))(lines[0] ?? "");
        expect(refusal.message).toContain("could not be read");
      })
    );
  });
});
