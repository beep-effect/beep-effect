import { SetupDoctor } from "@beep/law-practice-use-cases/PracticeSetup";
import { ElicitedApprovals } from "@beep/practice-gateway/Approvals";
import {
  BUILT_IN_ONBOARDING_GUIDE,
  ONBOARD_PRACTICE_PROMPT,
  OnboardingGuide,
  OnboardingPromptLayer,
} from "@beep/practice-gateway/OnboardingGuide";
import { PracticeKgModuleLoader } from "@beep/practice-gateway/PracticeKgProvider";
import { GatewaySetupProbes } from "@beep/practice-gateway/Probes";
import { ProfileStore } from "@beep/practice-gateway/ProfileStore";
import { PRACTICE_GATEWAY_INSTRUCTIONS } from "@beep/practice-gateway/Server";
import { SetupOnboardingGuide, SetupToolkit, SetupToolkitHandlers } from "@beep/practice-gateway/SetupTools";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { WindowsSecretStore } from "@beep/windows-secrets";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as McpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { fakeHost, fakeM365SignIn, settingsLayer } from "./fixtures.ts";

const Platform = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);
const guide = "1. Call setup_status.\n2. Relay the summary.";
const settings = settingsLayer({});

const Handlers = SetupToolkitHandlers.pipe(
  Layer.provide(
    Layer.mergeAll(
      SetupDoctor.layer.pipe(
        Layer.provide(
          Layer.merge(
            GatewaySetupProbes.pipe(
              Layer.provide(
                Layer.mergeAll(
                  fakeHost({}),
                  settings,
                  Platform,
                  WindowsSecretStore.layerMemory,
                  fakeM365SignIn({}),
                  PracticeKgModuleLoader.layer
                )
              )
            ),
            ElicitedApprovals
          )
        )
      ),
      ProfileStore.layer.pipe(Layer.provide(Layer.merge(settings, Platform))),
      OnboardingGuide.layerText(guide)
    )
  )
);

describe("onboarding guide", () => {
  it("tells Claude to start setup from the guide", () => {
    expect(PRACTICE_GATEWAY_INSTRUCTIONS).toContain("call setup_onboarding_guide first and follow it");
    expect(BUILT_IN_ONBOARDING_GUIDE).toContain("setup_status");
  });

  it.layer(Handlers, { timeout: "30 seconds" })("as a tool", (it) => {
    it.effect("returns the injected guide text", () =>
      Effect.gen(function* () {
        const toolkit = yield* SetupToolkit;
        const stream = yield* toolkit.handle("setup_onboarding_guide", {});
        const result = O.getOrThrow(yield* Stream.runHead(stream));
        const view = yield* S.decodeUnknownEffect(SetupOnboardingGuide)(result.encodedResult);
        expect(view.guide).toBe(guide);
      })
    );
  });

  it.layer(
    Layer.merge(McpServer.McpServer.layer, OnboardingPromptLayer).pipe(Layer.provide(OnboardingGuide.layerText(guide))),
    { timeout: "30 seconds" }
  )("as a prompt", (it) => {
    it.effect("registers onboard_practice on the shared server", () =>
      Effect.gen(function* () {
        const server = yield* McpServer.McpServer;
        expect(A.map(server.prompts, (entry) => entry.prompt.name)).toEqual([ONBOARD_PRACTICE_PROMPT]);
      })
    );
  });
});
