/**
 * The gateway's `SetupProbes`: one probe per slice 1 requirement id, and the
 * automatic repairs, over the injectable {@link WindowsHost}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ProbeBroken, ProbeMissing, ProbeSatisfied, SetupRequirementId } from "@beep/law-practice-domain";
import {
  SetupProbes,
  SetupProbesShape,
  SetupProbeUnavailable,
  SetupRepairFailed,
} from "@beep/law-practice-use-cases/PracticeSetup";
import { WindowsSecretStore } from "@beep/windows-secrets";
import * as A from "effect/Array";
import * as McpSchema from "effect/ai/McpSchema";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { GatewaySettings } from "./GatewaySettings.ts";
import { M365_TOKEN_CACHE_SEGMENTS, M365SignIn, M365SignInOutcome } from "./M365SignIn.ts";
import { PracticeKgModuleLoader } from "./PracticeKgProvider.ts";
import { GatewayRequirementId } from "./Requirements.ts";
import { PRACTICE_GATEWAY_VERSION } from "./Version.ts";
import { BitLockerProtection, RegistryValueQuery, WindowsHost } from "./WindowsHost.ts";
import type { ProbeResult, SetupRequirement } from "@beep/law-practice-domain";
import type * as FileSystem from "effect/FileSystem";
import type { WindowsHostFailure } from "./PracticeGateway.errors.ts";

/**
 * Registry key Claude Desktop's per-user installer registers under.
 *
 * **Example** (Read the uninstall key)
 *
 * ```ts
 * import { CLAUDE_UNINSTALL_KEY } from "@beep/practice-gateway/Probes"
 *
 * console.log(CLAUDE_UNINSTALL_KEY.startsWith("HKCU")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CLAUDE_UNINSTALL_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AnthropicClaude";

/**
 * Package family of Claude Desktop's MSIX install (admin and MDM deployments).
 *
 * **Example** (Read the family)
 *
 * ```ts
 * import { CLAUDE_MSIX_PACKAGE_FAMILY } from "@beep/practice-gateway/Probes"
 *
 * console.log(CLAUDE_MSIX_PACKAGE_FAMILY) // "Claude_pzs8sxrjxfjjc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CLAUDE_MSIX_PACKAGE_FAMILY = "Claude_pzs8sxrjxfjjc";

/**
 * One requirement's probe and, for automatic remediations, its repair.
 *
 * @category models
 * @since 0.0.0
 */
export interface GatewayProbe {
  /**
   * Check the requirement on this machine.
   */
  readonly probe: Effect.Effect<ProbeResult, SetupProbeUnavailable>;
  /**
   * Perform the requirement's automatic remediation, when it has one.
   */
  readonly repair: O.Option<Effect.Effect<void, SetupRepairFailed>>;
}

/**
 * One probe per catalog id; the mapped type makes a missing probe a compile
 * error.
 *
 * @category models
 * @since 0.0.0
 */
export type GatewayProbeRegistry = { readonly [Id in GatewayRequirementId]: GatewayProbe };

const satisfied = ProbeSatisfied.make({});
const missing = (detail: string): ProbeResult => ProbeMissing.make({ detail });
const broken = (detail: string): ProbeResult => ProbeBroken.make({ detail });

const readOnly = (probe: Effect.Effect<ProbeResult, SetupProbeUnavailable>): GatewayProbe => ({
  probe,
  repair: O.none(),
});

/**
 * Build the probe registry for the current machine.
 *
 * **Details**
 *
 * Windows-only facts (Claude Desktop, Box Drive, BitLocker, the DPAPI token
 * cache) answer `missing` with "only on Windows" off Windows, so a Linux
 * self-check still prints a full report. `claude-signed-in` is satisfied
 * while an MCP client is calling the gateway: a Claude session that reaches
 * the tool is a signed-in session. `m365-consented` reports "not configured"
 * without a Microsoft 365 app id, and its repair runs the browser sign-in
 * ({@link M365SignIn}). The Box Drive install repair is a
 * download-free placeholder that fails with a plain reason until the
 * installer route is decided.
 *
 * **Example** (Build the registry)
 *
 * ```ts
 * import { makeGatewayProbes } from "@beep/practice-gateway/Probes"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeGatewayProbes))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGatewayProbes = Effect.gen(function* () {
  const host = yield* WindowsHost;
  const settings = yield* GatewaySettings;
  const path = yield* Path.Path;
  const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
  const secrets = yield* Effect.serviceOption(WindowsSecretStore);
  const m365 = yield* M365SignIn;
  const practiceKg = yield* PracticeKgModuleLoader;

  const unavailable = (requirement: GatewayRequirementId) => (failure: WindowsHostFailure) =>
    SetupProbeUnavailable.make({ requirement: idOf(requirement), reason: failure.message });

  const windowsOnly = (
    requirement: GatewayRequirementId,
    probe: Effect.Effect<ProbeResult, WindowsHostFailure | SetupProbeUnavailable>
  ): Effect.Effect<ProbeResult, SetupProbeUnavailable> =>
    host.isWindows
      ? probe.pipe(Effect.catchTag("WindowsHostFailure", flow(unavailable(requirement), Effect.fail)))
      : Effect.succeed(missing("This check runs only on Windows."));

  const fileUnder = Effect.fnUntraced(function* (
    folder: Parameters<typeof host.folder>[0],
    ...segments: Array<string>
  ) {
    const base = yield* host.folder(folder);
    return yield* O.match(base, {
      onNone: () => Effect.succeed(false),
      onSome: (root) => host.exists(path.join(root, ...segments)),
    });
  });

  const tokenCachePath = path.join(settings.dataDir, ...M365_TOKEN_CACHE_SEGMENTS);

  const claudeDesktopInstalled = windowsOnly(
    "claude-desktop-installed",
    Effect.gen(function* () {
      const executable = yield* fileUnder("LOCALAPPDATA", "AnthropicClaude", "claude.exe");
      const registered = yield* host.registryValue(
        RegistryValueQuery.make({ key: CLAUDE_UNINSTALL_KEY, name: "DisplayVersion" })
      );
      if (executable || O.isSome(registered)) {
        return satisfied;
      }
      // Admin and MDM installs deploy the MSIX package instead of the per-user installer.
      const families = yield* host.appxPackageFamilies("Claude");
      return A.contains(families, CLAUDE_MSIX_PACKAGE_FAMILY)
        ? satisfied
        : missing("Claude Desktop is not installed for this Windows account.");
    })
  );

  const claudeSignedIn = Effect.serviceOption(McpSchema.McpRequestContext).pipe(
    Effect.map(
      O.match({
        onNone: () => missing("No signed-in Claude session is using the practice gateway right now."),
        onSome: () => satisfied,
      })
    )
  );

  const boxDriveInstalled = windowsOnly(
    "box-drive-installed",
    fileUnder("ProgramFiles", "Box", "Box", "Box.exe").pipe(
      Effect.map((present) => (present ? satisfied : missing("Box Drive is not installed.")))
    )
  );

  const boxDriveSignedIn = windowsOnly(
    "box-drive-signed-in",
    host
      .processRunning("Box.exe")
      .pipe(
        Effect.map((running) => (running ? satisfied : missing("Box Drive is not running, so it cannot be signed in.")))
      )
  );

  const boxDriveFolder = windowsOnly(
    "box-drive-folder-available",
    fileUnder("USERPROFILE", "Box").pipe(
      Effect.map((present) => (present ? satisfied : missing("The Box folder is not in your user folder yet.")))
    )
  );

  // Without a configured app id the requirement reports "not configured" in
  // plain language instead of failing.
  const m365Consented = m365.connection.pipe(
    Effect.matchEffect({
      onFailure: (failure) => Effect.succeed(missing(failure.message)),
      onSuccess: () =>
        host.exists(tokenCachePath).pipe(
          Effect.map((present) => (present ? satisfied : missing("Microsoft 365 has not been connected yet."))),
          Effect.mapError(unavailable("m365-consented"))
        ),
    })
  );

  const m365TokenCached = windowsOnly(
    "m365-token-cached",
    Effect.gen(function* () {
      const store = yield* Effect.fromOption(secrets).pipe(
        Effect.mapError(() =>
          SetupProbeUnavailable.make({
            requirement: idOf("m365-token-cached"),
            reason: "The Windows secret store could not be opened.",
          })
        )
      );
      const bytes = yield* host.readFile(tokenCachePath);
      return yield* O.match(bytes, {
        onNone: () => Effect.succeed(missing("No saved Microsoft 365 sign-in was found.")),
        onSome: (protectedBytes) =>
          store.unprotect(protectedBytes).pipe(
            Effect.as(satisfied),
            Effect.catchTag("SecretStoreFailure", () =>
              Effect.succeed(broken("The saved Microsoft 365 sign-in cannot be opened by this Windows account."))
            )
          ),
      });
    })
  );

  const noBundle = missing("No knowledge-graph bundle folder is set in the extension settings.");

  const bundlePresent = O.match(settings.bundleDir, {
    onNone: () => Effect.succeed(noBundle),
    onSome: (bundleDir) =>
      host.exists(path.join(bundleDir, "bundle.manifest.json")).pipe(
        Effect.map((present) =>
          present ? satisfied : missing(`The folder "${bundleDir}" is not a knowledge-graph bundle.`)
        ),
        Effect.mapError(unavailable("practice-kg-bundle-present"))
      ),
  });

  const bundleSelfCheck = O.match(settings.bundleDir, {
    onNone: () => Effect.succeed(noBundle),
    onSome: (bundleDir) =>
      practiceKg.load.pipe(
        Effect.flatMap((modules) =>
          modules.runPracticeKgSelfCheck({
            extensionVersion: PRACTICE_GATEWAY_VERSION,
            bundleDir,
            corpusRoot: O.getOrUndefined(settings.corpusRoot),
          })
        ),
        Effect.as(satisfied),
        Effect.catchTags({
          PracticeKgHostError: (error) => Effect.succeed(broken(error.message)),
          ProviderUnavailable: (error) => Effect.succeed(broken(error.message)),
        }),
        Effect.provideContext(services)
      ),
  });

  const bitLockerOn = windowsOnly(
    "bitlocker-on",
    host.bitLocker("C:").pipe(
      Effect.map(
        BitLockerProtection.$match({
          on: () => satisfied,
          off: () => missing("BitLocker is off for drive C:."),
          unknown: () => missing("BitLocker protection for drive C: could not be confirmed."),
        })
      )
    )
  );

  const connectM365 = m365.signIn.pipe(
    Effect.flatMap(
      M365SignInOutcome.$match({
        connected: () => Effect.void,
        "waiting-for-browser": () =>
          Effect.fail(
            SetupRepairFailed.make({
              requirement: idOf("m365-consented"),
              reason:
                "The Microsoft sign-in page is open in your web browser. Finish signing in there, then ask Claude to check the setup again.",
            })
          ),
      })
    ),
    Effect.catchTag("M365SignInFailure", (failure) =>
      Effect.fail(SetupRepairFailed.make({ requirement: idOf("m365-consented"), reason: failure.message }))
    )
  );

  const installBoxDrive = SetupRepairFailed.make({
    requirement: idOf("box-drive-installed"),
    reason: "The gateway cannot install Box Drive yet. Download Box Drive from box.com/drive and run its installer.",
  });

  const registry: GatewayProbeRegistry = {
    "claude-desktop-installed": readOnly(claudeDesktopInstalled),
    "claude-signed-in": readOnly(claudeSignedIn),
    "box-drive-installed": { probe: boxDriveInstalled, repair: installBoxDrive.pipe(Effect.fail, O.some) },
    "box-drive-signed-in": readOnly(boxDriveSignedIn),
    "box-drive-folder-available": readOnly(boxDriveFolder),
    "m365-consented": { probe: m365Consented, repair: O.some(connectM365) },
    "m365-token-cached": readOnly(m365TokenCached),
    "practice-kg-bundle-present": readOnly(bundlePresent),
    "practice-kg-self-check": readOnly(bundleSelfCheck),
    "bitlocker-on": readOnly(bitLockerOn),
  };
  return registry;
});

// The catalog ids are kebab-case slugs, so the brand always holds.
const idOf = (requirement: GatewayRequirementId): SetupRequirementId => SetupRequirementId.make(requirement);

const lookup = (registry: GatewayProbeRegistry, requirement: SetupRequirement): O.Option<GatewayProbe> =>
  A.findFirst(GatewayRequirementId.literals, (id) => id === requirement.id).pipe(O.map((id) => registry[id]));

/**
 * The gateway's `SetupProbes` over {@link makeGatewayProbes}.
 *
 * **Details**
 *
 * A requirement id outside the slice 1 catalog has no probe and reports
 * `SetupProbeUnavailable`; a repair asked of a requirement without an
 * automatic repair fails with `SetupRepairFailed`. The Windows secret store
 * is optional: provide `WindowsSecretStore.layerWindows` on Windows and
 * `layerMemory` in tests. The `practice-kg-self-check` probe loads the
 * knowledge-graph modules through {@link PracticeKgModuleLoader}.
 *
 * **Example** (Compose the probes)
 *
 * ```ts
 * import { GatewaySetupProbes } from "@beep/practice-gateway/Probes"
 *
 * console.log(typeof GatewaySetupProbes)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GatewaySetupProbes = Layer.effect(
  SetupProbes,
  Effect.map(makeGatewayProbes, (registry) =>
    SetupProbesShape.make({
      probe: (requirement) =>
        O.match(lookup(registry, requirement), {
          onNone: () =>
            Effect.fail(
              SetupProbeUnavailable.make({
                requirement: requirement.id,
                reason: "The practice gateway has no check for this requirement.",
              })
            ),
          onSome: (entry) => entry.probe,
        }).pipe(Effect.withSpan("PracticeGateway.probe", { attributes: { requirement: requirement.id } })),
      repair: (requirement) =>
        lookup(registry, requirement).pipe(
          O.flatMap((entry) => entry.repair),
          O.match({
            onNone: () =>
              Effect.fail(
                SetupRepairFailed.make({
                  requirement: requirement.id,
                  reason: "The practice gateway has no automatic repair for this requirement.",
                })
              ),
            onSome: (repair) => repair,
          }),
          Effect.withSpan("PracticeGateway.repair", { attributes: { requirement: requirement.id } })
        ),
    })
  )
);
