import { CapabilityGap, CapabilitySupported, ItLimits, PracticeProfile } from "@beep/law-practice-domain";
import { M365ConfigInput } from "@beep/m365";
import { GatewaySettings, GatewaySettingsValues } from "@beep/practice-gateway/GatewaySettings";
import { M365Connection, M365SignIn } from "@beep/practice-gateway/M365SignIn";
import { M365SignInFailure, WindowsHostFailure } from "@beep/practice-gateway/PracticeGateway.errors";
import { BitLockerProtection, WindowsHost, WindowsHostShape } from "@beep/practice-gateway/WindowsHost";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { M365SignInOutcome } from "@beep/practice-gateway/M365SignIn";
import type { KnownFolder, RegistryValueQuery } from "@beep/practice-gateway/WindowsHost";

const folders = HashMap.make<ReadonlyArray<readonly [KnownFolder, string]>>(
  ["ProgramFiles", "/pf"],
  ["LOCALAPPDATA", "/local"],
  ["APPDATA", "/roaming"],
  ["USERPROFILE", "/home/lawyer"]
);

export interface FakeMachine {
  readonly appx?: ReadonlyArray<readonly [string, string]>;
  readonly bitLocker?: BitLockerProtection;
  readonly fileBytes?: ReadonlyArray<readonly [string, Uint8Array]>;
  readonly files?: ReadonlyArray<string>;
  readonly folders?: ReadonlyArray<readonly [KnownFolder, string]>;
  readonly isWindows?: boolean;
  readonly processes?: ReadonlyArray<string>;
  readonly registry?: ReadonlyArray<readonly [string, string]>;
  readonly registryFails?: boolean;
}

// A Windows machine described as data: paths use the folders above.
export const fakeHost = (machine: FakeMachine) => {
  const files = HashSet.fromIterable([...(machine.files ?? []), ...A.map(machine.fileBytes ?? [], ([path]) => path)]);
  const bytes = HashMap.fromIterable(machine.fileBytes ?? []);
  const registry = HashMap.fromIterable(machine.registry ?? []);
  const processes = HashSet.fromIterable(machine.processes ?? []);
  const knownFolders = HashMap.union(folders, HashMap.fromIterable(machine.folders ?? []));
  return Layer.succeed(
    WindowsHost,
    WindowsHostShape.make({
      isWindows: machine.isWindows ?? true,
      folder: Effect.fn("FakeWindowsHost.folder")((name: KnownFolder) =>
        Effect.succeed(HashMap.get(knownFolders, name))
      ),
      exists: Effect.fn("FakeWindowsHost.exists")((path: string) => Effect.succeed(HashSet.has(files, path))),
      readFile: Effect.fn("FakeWindowsHost.readFile")((path: string) => Effect.succeed(HashMap.get(bytes, path))),
      registryValue: Effect.fn("FakeWindowsHost.registryValue")(function* ({ key, name }: RegistryValueQuery) {
        if (machine.registryFails === true) {
          return yield* WindowsHostFailure.make({ message: "reg.exe could not be run." });
        }
        return HashMap.get(registry, `${key}|${name}`);
      }),
      appxPackageFamilies: Effect.fn("FakeWindowsHost.appxPackageFamilies")((name: string) =>
        Effect.succeed(
          A.map(
            A.filter(machine.appx ?? [], ([appx]) => appx === name),
            ([, family]) => family
          )
        )
      ),
      bitLocker: Effect.fn("FakeWindowsHost.bitLocker")((_drive: string) =>
        Effect.succeed(machine.bitLocker ?? BitLockerProtection.Enum.unknown)
      ),
      processRunning: Effect.fn("FakeWindowsHost.processRunning")((imageName: string) =>
        Effect.succeed(HashSet.has(processes, imageName))
      ),
    })
  );
};

export const settingsLayer = (overrides: {
  readonly dataDir?: string;
  readonly isWindows?: boolean;
  readonly bundleDir?: string;
  readonly m365ClientId?: string;
}) =>
  GatewaySettings.layerFixed(
    GatewaySettingsValues.make({
      dataDir: overrides.dataDir ?? "/data",
      isWindows: overrides.isWindows ?? true,
      bundleDir: O.fromUndefinedOr(overrides.bundleDir),
      corpusRoot: O.none(),
      m365ClientId: O.fromUndefinedOr(overrides.m365ClientId),
    })
  );

export const itLimits = ItLimits.make({ adminRights: "available", proxy: "none" });

export const fullProfile = PracticeProfile.make({
  choices: [
    CapabilitySupported.make({ capability: "documents", provider: "box-drive" }),
    CapabilitySupported.make({ capability: "mail-calendar", provider: "microsoft-365" }),
    CapabilitySupported.make({ capability: "knowledge-graph", provider: "practice-kg" }),
  ],
  itLimits,
  recordedAt: DateTime.makeUnsafe(1_760_000_000_000),
});

export const gapProfile = PracticeProfile.make({
  choices: [
    CapabilityGap.make({ capability: "documents", namedProvider: "NetDocuments", fallback: O.some("box-drive") }),
  ],
  itLimits,
  recordedAt: DateTime.makeUnsafe(1_760_000_000_000),
});

export const m365NotConfigured =
  "Microsoft 365 is not configured for this practice gateway yet: the extension settings have no Microsoft 365 app ID.";

// A Microsoft 365 sign-in without a browser: configured or not, with a fixed
// sign-in answer.
export const fakeM365SignIn = (options: {
  readonly configured?: boolean;
  readonly signIn?: Effect.Effect<M365SignInOutcome, M365SignInFailure>;
}) =>
  Layer.succeed(
    M365SignIn,
    M365SignIn.of({
      connection:
        options.configured === false
          ? Effect.fail(M365SignInFailure.make({ message: m365NotConfigured }))
          : Effect.succeed(
              M365Connection.make({
                config: M365ConfigInput.make({ tenantId: "organizations", clientId: "test-client" }),
                tokenCache: { load: Effect.succeedNone, save: () => Effect.void },
              })
            ),
      signIn: options.signIn ?? Effect.succeed("connected"),
    })
  );
