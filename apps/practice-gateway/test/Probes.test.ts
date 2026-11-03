import {
  ProbeMissing,
  ProbeResult,
  ProbeSatisfied,
  SetupRequirement,
  SetupRequirementId,
} from "@beep/law-practice-domain";
import {
  makeSetupApprovals,
  SetupApprovals,
  SetupDoctor,
  SetupProbes,
  SetupProbeUnavailable,
  SetupRepairFailed,
  SetupRepairRefused,
} from "@beep/law-practice-use-cases/PracticeSetup";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { ElicitedApprovals } from "@beep/practice-gateway/Approvals";
import { M365SignInFailure } from "@beep/practice-gateway/PracticeGateway.errors";
import { PracticeKgModuleLoader } from "@beep/practice-gateway/PracticeKgProvider";
import { CLAUDE_UNINSTALL_KEY, GatewaySetupProbes } from "@beep/practice-gateway/Probes";
import { requirementFromCatalog, requirementsFor } from "@beep/practice-gateway/Requirements";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { WindowsSecretStore } from "@beep/windows-secrets";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as McpSchema from "effect/ai/McpSchema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { fakeHost, fakeM365SignIn, fullProfile, m365NotConfigured, settingsLayer } from "./fixtures.ts";
import type { M365SignIn, M365SignInOutcome } from "@beep/practice-gateway/M365SignIn";
import type { GatewayRequirementId } from "@beep/practice-gateway/Requirements";
import type { FakeMachine } from "./fixtures.ts";

const Platform = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);

const probesFor = (
  machine: FakeMachine,
  settings: Parameters<typeof settingsLayer>[0] = {},
  secrets: Layer.Layer<WindowsSecretStore> | Layer.Layer<never> = WindowsSecretStore.layerMemory,
  m365: Layer.Layer<M365SignIn> = fakeM365SignIn({})
) =>
  GatewaySetupProbes.pipe(
    Layer.provide(
      Layer.mergeAll(fakeHost(machine), settingsLayer(settings), Platform, secrets, m365, PracticeKgModuleLoader.layer)
    )
  );

const probeRequirement = (requirement: SetupRequirement, layer: Layer.Layer<SetupProbes>) =>
  SetupProbes.use((probes) => probes.probe(requirement)).pipe(provideScopedLayer(layer));

const probe = (id: GatewayRequirementId, layer: Layer.Layer<SetupProbes>) =>
  probeRequirement(requirementFromCatalog(id, "documents"), layer);

const layerTimeout = "30 seconds";

const satisfied = ProbeSatisfied.make({});

describe("gateway probes", () => {
  it.effect("finds Claude Desktop by executable, uninstall entry or MSIX package", () =>
    Effect.gen(function* () {
      const probe1 = yield* probe(
        "claude-desktop-installed",
        probesFor({ files: ["/local/AnthropicClaude/claude.exe"] })
      );
      expect(probe1).toEqual(satisfied);
      const probe2 = yield* probe(
        "claude-desktop-installed",
        probesFor({ registry: [[`${CLAUDE_UNINSTALL_KEY}|DisplayVersion`, "0.14.10"]] })
      );
      expect(probe2).toEqual(satisfied);
      const probe3 = yield* probe(
        "claude-desktop-installed",
        probesFor({ appx: [["Claude", "Claude_pzs8sxrjxfjjc"]] })
      );
      expect(probe3).toEqual(satisfied);
      const probe4 = yield* probe("claude-desktop-installed", probesFor({ appx: [["Claude", "Claude_other"]] }));
      expect(probe4).toEqual(
        ProbeMissing.make({ detail: "Claude Desktop is not installed for this Windows account." })
      );
      const probe5 = yield* probe("claude-desktop-installed", probesFor({}));
      expect(probe5).toEqual(
        ProbeMissing.make({ detail: "Claude Desktop is not installed for this Windows account." })
      );
    })
  );

  it.effect("reports a failed registry query as an unavailable probe", () =>
    Effect.gen(function* () {
      const error = yield* probe("claude-desktop-installed", probesFor({ registryFails: true })).pipe(Effect.flip);
      expect(error).toBeInstanceOf(SetupProbeUnavailable);
      expect(error.reason).toBe("reg.exe could not be run.");
    })
  );

  it.effect("counts a calling MCP client as a signed-in Claude session", () =>
    Effect.gen(function* () {
      const layer = probesFor({});
      const probe6 = yield* probe("claude-signed-in", layer);
      expect(probe6).toEqual(ProbeMissing.make({ detail: "Claude Desktop is not signed in to a Claude account." }));
      const inSession = yield* probe("claude-signed-in", layer).pipe(
        Effect.provideService(
          McpSchema.McpRequestContext,
          McpSchema.McpRequestContext.of({ clientId: 1, protocolVersion: "2026-07-28", clientCapabilities: {} })
        )
      );
      expect(inSession).toEqual(satisfied);
    })
  );

  it.effect("reads Claude Desktop's sign-in marker outside an MCP call", () =>
    Effect.gen(function* () {
      const encode = (text: string) => new TextEncoder().encode(text);
      const msixConfig = "/local/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude/config.json";
      for (const [path, text, expected] of [
        ["/roaming/Claude/config.json", '{"locale":"en-US","lastKnownAccountUuid":"x"}', satisfied],
        [msixConfig, '{"lastKnownAccountUuid":"x"}', satisfied],
        ["/roaming/Claude/config.json", '{"lastKnownAccountUuid":""}', undefined],
        ["/roaming/Claude/config.json", "not json", undefined],
      ] as const) {
        const result = yield* probe("claude-signed-in", probesFor({ fileBytes: [[path, encode(text)]] }));
        expect(result).toEqual(
          expected ?? ProbeMissing.make({ detail: "Claude Desktop is not signed in to a Claude account." })
        );
      }
    })
  );

  it.effect("probes Box Drive install, process and folder", () =>
    Effect.gen(function* () {
      const ready = probesFor({ files: ["/pf/Box/Box/Box.exe", "/home/lawyer/Box"], processes: ["Box.exe"] });
      const probe7 = yield* probe("box-drive-installed", ready);
      expect(probe7).toEqual(satisfied);
      const probe8 = yield* probe("box-drive-signed-in", ready);
      expect(probe8).toEqual(satisfied);
      const probe9 = yield* probe("box-drive-folder-available", ready);
      expect(probe9).toEqual(satisfied);
      const bare = probesFor({});
      const probe10 = yield* probe("box-drive-installed", bare);
      expect(probe10).toEqual(ProbeMissing.make({ detail: "Box Drive is not installed." }));
      const probe11 = yield* probe("box-drive-signed-in", bare);
      expect(probe11).toEqual(ProbeMissing.make({ detail: "Box Drive is not running, so it cannot be signed in." }));
      const probe12 = yield* probe("box-drive-folder-available", bare);
      expect(probe12).toEqual(ProbeMissing.make({ detail: "The Box folder is not in your user folder yet." }));
    })
  );

  it.effect("checks the Microsoft 365 token cache with the secret store", () =>
    Effect.gen(function* () {
      const cache = "/data/m365/token-cache.dpapi";
      const cached = probesFor({ fileBytes: [[cache, new Uint8Array([1, 2, 3])]] });
      const probe13 = yield* probe("m365-consented", cached);
      expect(probe13).toEqual(satisfied);
      const probe14 = yield* probe("m365-token-cached", cached);
      expect(probe14).toEqual(satisfied);
      const probe15 = yield* probe("m365-token-cached", probesFor({}));
      expect(probe15).toEqual(ProbeMissing.make({ detail: "No saved Microsoft 365 sign-in was found." }));
      const noStore = yield* probe(
        "m365-token-cached",
        probesFor({ fileBytes: [[cache, new Uint8Array([1])]] }, {}, Layer.empty)
      ).pipe(Effect.flip);
      expect(noStore.reason).toBe("The Windows secret store could not be opened.");
    })
  );

  it.effect("reports Microsoft 365 as not configured without an app id", () =>
    Effect.gen(function* () {
      const cache = "/data/m365/token-cache.dpapi";
      const unconfigured = probesFor(
        { fileBytes: [[cache, new Uint8Array([1])]] },
        {},
        WindowsSecretStore.layerMemory,
        fakeM365SignIn({ configured: false })
      );
      const probe16 = yield* probe("m365-app-configured", unconfigured);
      expect(probe16).toEqual(ProbeMissing.make({ detail: m365NotConfigured }));
      const probe17 = yield* probe("m365-app-configured", probesFor({}));
      expect(probe17).toEqual(satisfied);
    })
  );

  it.effect("reads BitLocker protection", () =>
    Effect.gen(function* () {
      const probe18 = yield* probe("bitlocker-on", probesFor({ bitLocker: "on" }));
      expect(probe18).toEqual(satisfied);
      const probe19 = yield* probe("bitlocker-on", probesFor({ bitLocker: "off" }));
      expect(probe19).toEqual(ProbeMissing.make({ detail: "BitLocker is off for drive C:." }));
    })
  );

  it.effect("answers 'only on Windows' for Windows facts elsewhere", () =>
    Effect.gen(function* () {
      const linux = probesFor({ isWindows: false, bitLocker: "on" }, { isWindows: false });
      const onlyWindows = ProbeMissing.make({ detail: "This check runs only on Windows." });
      for (const id of [
        "claude-desktop-installed",
        "box-drive-installed",
        "m365-token-cached",
        "bitlocker-on",
      ] as const) {
        const probe20 = yield* probe(id, linux);
        expect(probe20).toEqual(onlyWindows);
      }
    })
  );

  it.effect("checks the practice knowledge-graph bundle", () =>
    Effect.gen(function* () {
      const probe21 = yield* probe("practice-kg-bundle-present", probesFor({}));
      expect(probe21).toEqual(
        ProbeMissing.make({ detail: "No knowledge-graph bundle folder is set in the extension settings." })
      );
      const configured = probesFor({ files: ["/bundle/bundle.manifest.json"] }, { bundleDir: "/bundle" });
      const probe22 = yield* probe("practice-kg-bundle-present", configured);
      expect(probe22).toEqual(satisfied);
      // The real self-check reads the file system, where /bundle does not exist.
      const selfCheck = yield* probe("practice-kg-self-check", configured);
      expect(ProbeResult.guards.broken(selfCheck)).toBe(true);
    })
  );

  it.effect("has no probe for an id outside the catalog", () =>
    Effect.gen(function* () {
      const requirement = requirementFromCatalog("bitlocker-on", "workstation");
      const error = yield* probeRequirement(
        SetupRequirement.make({ ...requirement, id: SetupRequirementId.make("unknown-thing") }),
        probesFor({})
      ).pipe(Effect.flip);
      expect(error.reason).toBe("The practice gateway has no check for this requirement.");
    })
  );
});

const repairM365 = SetupProbes.use((probes) =>
  probes.repair(requirementFromCatalog("m365-consented", "mail-calendar"))
);

const probesWithSignIn = (signIn: Effect.Effect<M365SignInOutcome, M365SignInFailure>) =>
  probesFor({}, {}, WindowsSecretStore.layerMemory, fakeM365SignIn({ signIn }));

describe("Microsoft 365 consent repair", () => {
  it.layer(probesWithSignIn(Effect.succeed("connected")), { timeout: layerTimeout })(
    "after a finished sign-in",
    (it) => {
      it.effect("succeeds", () => repairM365);
    }
  );

  it.layer(probesWithSignIn(Effect.succeed("waiting-for-browser")), { timeout: layerTimeout })(
    "while the sign-in page is still open",
    (it) => {
      it.effect("tells the lawyer to finish in the browser", () =>
        Effect.gen(function* () {
          const waiting = yield* Effect.flip(repairM365);
          expect(waiting).toBeInstanceOf(SetupRepairFailed);
          expect(waiting.reason).toContain("Finish signing in there");
        })
      );
    }
  );

  it.layer(
    probesWithSignIn(
      M365SignInFailure.make({ message: "Access to Microsoft 365 was not approved." }).pipe(Effect.fail)
    ),
    { timeout: layerTimeout }
  )("after a declined consent", (it) => {
    it.effect("passes the sign-in's plain reason through", () =>
      Effect.gen(function* () {
        expect((yield* Effect.flip(repairM365)).reason).toBe("Access to Microsoft 365 was not approved.");
      })
    );
  });
});

const doctorWith = (approvals: Layer.Layer<SetupApprovals>) =>
  SetupDoctor.layer.pipe(Layer.provide(Layer.merge(probesFor({ bitLocker: "on" }), approvals)));

const repairBoxDrive = SetupDoctor.use((doctor) =>
  doctor.repair({
    requirements: requirementsFor(fullProfile),
    requirement: SetupRequirementId.make("box-drive-installed"),
  })
);

const approveAll = Layer.succeed(
  SetupApprovals,
  makeSetupApprovals(() => Effect.succeed("approved"))
);

describe("setup doctor over the gateway probes", () => {
  it.layer(doctorWith(ElicitedApprovals), { timeout: layerTimeout })(
    "with approvals elicited from the client",
    (it) => {
      it.effect("reports the full profile with the lawyer's steps batched", () =>
        Effect.gen(function* () {
          const report = yield* SetupDoctor.use((doctor) => doctor.check(requirementsFor(fullProfile)));
          expect(report.complete).toBe(false);
          expect(A.map(report.checks, (check) => `${check.requirement}:${check.state}`)).toContain(
            "box-drive-signed-in:blocked"
          );
          expect(A.map(report.humanSteps, (step) => step.requirement)).toContain("claude-signed-in");
        })
      );

      it.effect("declines a repair when no MCP client can show the approval prompt", () =>
        Effect.gen(function* () {
          const error = yield* repairBoxDrive.pipe(Effect.flip);
          expect(error).toBeInstanceOf(SetupRepairRefused);
          expect(error._tag === "SetupRepairRefused" && error.refusal).toBe("declined");
        })
      );
    }
  );

  it.layer(doctorWith(approveAll), { timeout: layerTimeout })("with every repair approved", (it) => {
    it.effect("fails the approved Box Drive install with a plain reason", () =>
      Effect.gen(function* () {
        const error = yield* repairBoxDrive.pipe(Effect.flip);
        expect(error).toBeInstanceOf(SetupRepairFailed);
        expect(error._tag === "SetupRepairFailed" && error.reason).toContain("box.com/drive");
      })
    );
  });
});

it.layer(probesFor({}), { timeout: layerTimeout })("automatic repair refusals", (it) => {
  it.effect("refuses automatic repair for manual-only and unknown requirements", () =>
    Effect.gen(function* () {
      const manual = requirementFromCatalog("claude-desktop-installed", "documents");
      const unknown = SetupRequirement.make({ ...manual, id: SetupRequirementId.make("unknown-thing") });
      for (const requirement of [manual, unknown]) {
        const error = yield* SetupProbes.use((probes) => probes.repair(requirement)).pipe(Effect.flip);
        expect(error).toBeInstanceOf(SetupRepairFailed);
        expect(error.requirement).toBe(requirement.id);
        expect(error.reason).toBe("The practice gateway has no automatic repair for this requirement.");
      }
    })
  );
});
