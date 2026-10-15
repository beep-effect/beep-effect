import { ProbeBroken, RequirementCheck } from "@beep/law-practice-domain";
import { SetupDoctor } from "@beep/law-practice-use-cases/PracticeSetup";
import { ElicitedApprovals } from "@beep/practice-gateway/Approvals";
import { OnboardingGuide } from "@beep/practice-gateway/OnboardingGuide";
import { ProviderUnavailable } from "@beep/practice-gateway/PracticeGateway.errors";
import { PracticeKgModuleLoader, PracticeKgProviderLayer } from "@beep/practice-gateway/PracticeKgProvider";
import { GatewaySetupProbes } from "@beep/practice-gateway/Probes";
import { ProfileStore } from "@beep/practice-gateway/ProfileStore";
import { SetupStatus, SetupToolkit, SetupToolkitHandlers } from "@beep/practice-gateway/SetupTools";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { WindowsSecretStore } from "@beep/windows-secrets";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as McpServer from "effect/ai/McpServer";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { fakeHost, fakeM365SignIn, fullProfile, settingsLayer } from "./fixtures.ts";

// The knowledge-graph modules cannot load, as on a machine without the DuckDB
// native sidecar: the import rejects the way the runtime reports it.
const missingEngine = PracticeKgModuleLoader.fromImport(() =>
  Promise.reject(new Error("Cannot find module '@duckdb/node-bindings-win32-x64/duckdb.node'"))
);
const MissingEngine = Layer.succeed(PracticeKgModuleLoader, missingEngine);

const Platform = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);
const layerTimeout = "30 seconds";
const unavailableMessage = "The practice knowledge-graph engine could not be loaded on this computer.";

// Setup services over a temporary data directory with a profile that selects
// practice-kg and a bundle folder, the case where the provider must load.
const GatewayServices = Layer.unwrap(
  FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped({ prefix: "practice-gateway-" })).pipe(
    Effect.map((dataDir) => {
      const settings = settingsLayer({ dataDir, bundleDir: "/bundles/practice" });
      const probes = GatewaySetupProbes.pipe(
        Layer.provide(
          Layer.mergeAll(
            fakeHost({ bitLocker: "on", files: ["/bundles/practice/bundle.manifest.json"] }),
            settings,
            Platform,
            WindowsSecretStore.layerMemory,
            fakeM365SignIn({}),
            MissingEngine
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
).pipe(Layer.provideMerge(Layer.merge(Platform, MissingEngine)));

const GatewayWithTools = SetupToolkitHandlers.pipe(
  Layer.provideMerge(Layer.merge(GatewayServices, OnboardingGuide.layer))
);

const statusOf = (check: RequirementCheck) =>
  RequirementCheck.match(check, { probed: (probed) => O.some(probed.result), blocked: () => O.none() });

describe("practice-kg provider without the DuckDB sidecar", () => {
  it.effect("reports the missing engine as a typed provider failure", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(missingEngine.load);
      expect(error).toBeInstanceOf(ProviderUnavailable);
      expect(error.provider).toBe("practice-kg");
      expect(error.message).toBe(unavailableMessage);
    })
  );

  it.layer(GatewayWithTools, { timeout: layerTimeout })("with practice-kg selected", (it) => {
    it.effect("skips the provider, keeps the setup tools and answers setup_status", () =>
      Effect.gen(function* () {
        yield* ProfileStore.use((store) => store.save(fullProfile));
        // The provider builds to nothing, logging why, instead of failing the gateway.
        const services = yield* Layer.build(Layer.merge(McpServer.McpServer.layer, PracticeKgProviderLayer));
        expect(Context.get(services, McpServer.McpServer).tools).toEqual([]);

        const toolkit = yield* SetupToolkit;
        const stream = yield* toolkit.handle("setup_status", {});
        const first = O.getOrThrow(yield* Stream.runHead(stream));
        expect(first.isFailure).toBe(false);
        const status = yield* S.decodeUnknownEffect(SetupStatus)(first.encodedResult);
        const selfCheck = A.findFirst(status.report.checks, (check) => check.requirement === "practice-kg-self-check");
        assertSome(O.flatMap(selfCheck, statusOf), ProbeBroken.make({ detail: unavailableMessage }));
        expect(status.report.checks).toHaveLength(10);
      })
    );
  });
});
