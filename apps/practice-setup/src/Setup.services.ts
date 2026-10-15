/**
 * Service contracts of the Windows bootstrapper and their live layers: the
 * Windows host (Claude detection, installer runs, shell opens, clipboard,
 * state folder), the read-only probes of Claude Desktop's own state, the
 * pinned installer download, the bundled gateway file, and the console
 * conversation with the lawyer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeSetupId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import { HttpClient } from "effect/http";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import { SetupFailure } from "./Setup.errors.ts";
import {
  ClaudeInstall,
  GatewayInstallState,
  gatewayInstallStateOf,
  SignInState,
  signInStateOf,
} from "./Setup.models.ts";
import type { PinnedInstaller } from "./Setup.models.ts";

const $I = $PracticeSetupId.create("Setup.services");

// Package family name of the Claude Desktop MSIX.
const CLAUDE_PACKAGE_FAMILY = "Claude_pzs8sxrjxfjjc";

// Registry key Claude Setup's per-user install registers under.
const CLAUDE_UNINSTALL_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AnthropicClaude";

/**
 * Whether `Get-AppxPackage` output names the Claude Desktop package family,
 * `Claude_pzs8sxrjxfjjc`.
 *
 * **Example** (Find the family in PowerShell output)
 *
 * ```ts
 * import { appxListsClaude } from "@/Setup.services"
 *
 * console.log(appxListsClaude("Claude_pzs8sxrjxfjjc\r\n")) // true
 * console.log(appxListsClaude("")) // false
 * ```
 *
 * @param output - Standard output of `Get-AppxPackage -Name Claude`, one family name per line.
 * @category utilities
 * @since 0.0.0
 */
export const appxListsClaude = (output: string): boolean =>
  pipe(Str.linesIterator(output), A.fromIterable, A.map(Str.trim), A.contains(CLAUDE_PACKAGE_FAMILY));

// Service shape of SetupHost.
interface SetupHostShape {
  /** How Claude Desktop is installed for this Windows account, if at all. */
  readonly claudeInstall: Effect.Effect<ClaudeInstall, SetupFailure>;
  /** Put text on the Windows clipboard. */
  readonly copyToClipboard: (text: string) => Effect.Effect<void, SetupFailure>;
  /** Hand a file to Windows, as a double-click would. */
  readonly open: (target: string) => Effect.Effect<void, SetupFailure>;
  /** Hand a `claude://` link to Windows, as `start "" "<link>"` would. */
  readonly openLink: (link: string) => Effect.Effect<void, SetupFailure>;
  /** Run an installer and wait for it; succeeds with its exit code. */
  readonly runInstaller: (path: string, args: ReadonlyArray<string>) => Effect.Effect<number, SetupFailure>;
  /** The bootstrapper's own folder, created on first use. */
  readonly stateDir: Effect.Effect<string, SetupFailure>;
}

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(() => Str.empty, Str.concat)
  );

/**
 * The Windows facts and actions the bootstrapper needs.
 *
 * **Details**
 *
 * The live layer reads `LOCALAPPDATA` through `Config`, checks files through
 * `FileSystem`, and shells out to `reg.exe`, `powershell.exe` and
 * `explorer.exe` through `ChildProcessSpawner`. `open` uses `explorer.exe`, the
 * shell's own double-click path, so a `.mcpb` reaches whatever Windows has
 * registered for it. `openLink` and `copyToClipboard` use PowerShell's
 * `Start-Process` (ShellExecute, the documented `start` route) and
 * `Set-Clipboard`, passing the text through an environment variable so it is
 * never parsed as PowerShell.
 *
 * **Example** (A fake host for tests)
 *
 * ```ts
 * import { SetupHost } from "@/Setup.services"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const fake = Layer.succeed(SetupHost, {
 *   claudeInstall: Effect.succeed("per-user"),
 *   runInstaller: () => Effect.succeed(0),
 *   open: () => Effect.void,
 *   openLink: () => Effect.void,
 *   copyToClipboard: () => Effect.void,
 *   stateDir: Effect.succeed("/tmp/practice-setup"),
 * })
 * console.log(Layer.isLayer(fake))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SetupHost extends Context.Service<SetupHost, SetupHostShape>()($I`SetupHost`) {
  /**
   * Live Windows host.
   *
   * **Example** (Compose the live host)
   *
   * ```ts
   * import { SetupHost } from "@/Setup.services"
   *
   * console.log(typeof SetupHost.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    SetupHost,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

      const failWith = (message: string) => (cause: unknown) => SetupFailure.make({ cause, message });

      const run = Effect.fnUntraced(
        function* (command: string, args: ReadonlyArray<string>, env?: Record<string, string>) {
          const child = yield* spawner.spawn(
            ChildProcess.make(command, args, {
              stdin: "ignore",
              stderr: "ignore",
              stdout: "pipe",
              env,
              extendEnv: true,
            })
          );
          const [stdout, exitCode] = yield* Effect.all([collectText(child.stdout), child.exitCode], {
            concurrency: "unbounded",
          });
          return { stdout, exitCode: Number(exitCode) };
        },
        Effect.scoped,
        (effect, command) => Effect.mapError(effect, failWith(`${command} could not be run.`))
      );

      const localAppData = Config.String("LOCALAPPDATA").pipe(
        Effect.mapError(failWith("This Windows account has no local application data folder."))
      );

      const perUserInstalled = Effect.gen(function* () {
        const executable = path.join(yield* localAppData, "AnthropicClaude", "claude.exe");
        const present = yield* fs
          .exists(executable)
          .pipe(Effect.mapError(failWith("Claude's folder could not be checked.")));
        // reg.exe exits 1 when the key is absent.
        return present || (yield* run("reg.exe", ["query", CLAUDE_UNINSTALL_KEY])).exitCode === 0;
      });

      const msixInstalled = run("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-AppxPackage -Name Claude | Select-Object -ExpandProperty PackageFamilyName",
      ]).pipe(Effect.map(({ stdout }) => appxListsClaude(stdout)));

      // Runs one PowerShell command that reads its only input from `BEEP_SETUP_TEXT`.
      const powershellWith = Effect.fnUntraced(function* (command: string, text: string, failure: string) {
        const { exitCode } = yield* run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
          BEEP_SETUP_TEXT: text,
        });
        if (exitCode !== 0) {
          return yield* SetupFailure.make({ message: failure });
        }
      });

      const claudeInstall = Effect.gen(function* () {
        if (yield* perUserInstalled) {
          return ClaudeInstall.Enum["per-user"];
        }
        return (yield* msixInstalled) ? ClaudeInstall.Enum.msix : ClaudeInstall.Enum.missing;
      });

      return SetupHost.of({
        claudeInstall,
        runInstaller: Effect.fn("SetupHost.runInstaller")(function* (installer, args) {
          return (yield* run(installer, args)).exitCode;
        }),
        // explorer.exe exits 1 even when it opened the target, so the code is ignored.
        open: Effect.fn("SetupHost.open")(function* (target) {
          yield* run("explorer.exe", [target]);
        }),
        openLink: Effect.fn("SetupHost.openLink")(function* (link) {
          yield* powershellWith("Start-Process -FilePath $env:BEEP_SETUP_TEXT", link, "Claude could not be opened.");
        }),
        copyToClipboard: Effect.fn("SetupHost.copyToClipboard")(function* (text) {
          yield* powershellWith(
            "Set-Clipboard -Value $env:BEEP_SETUP_TEXT",
            text,
            "The message could not be copied to the clipboard."
          );
        }),
        stateDir: Effect.gen(function* () {
          const dir = path.join(yield* localAppData, "beep", "practice-setup");
          yield* fs
            .makeDirectory(dir, { recursive: true })
            .pipe(Effect.mapError(failWith("The setup folder could not be created.")));
          return dir;
        }),
      });
    })
  );
}

// Service shape of InstallerDownload.
interface InstallerDownloadShape {
  /** Download a pinned installer to `destination`, refusing it when its SHA-256 differs. */
  readonly fetch: (installer: PinnedInstaller, destination: string) => Effect.Effect<void, SetupFailure>;
}

/**
 * Downloads a pinned installer and checks its SHA-256 before writing it.
 *
 * **Details**
 *
 * A mismatched download is never written, so it can never run. The live layer
 * needs `HttpClient`, `Crypto` and `FileSystem`.
 *
 * **Example** (Compose the live download)
 *
 * ```ts
 * import { InstallerDownload } from "@/Setup.services"
 *
 * console.log(typeof InstallerDownload.layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class InstallerDownload extends Context.Service<InstallerDownload, InstallerDownloadShape>()(
  $I`InstallerDownload`
) {
  /**
   * Live download over `HttpClient`.
   *
   * **Example** (Read the layer)
   *
   * ```ts
   * import { InstallerDownload } from "@/Setup.services"
   *
   * console.log(typeof InstallerDownload.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    InstallerDownload,
    Effect.gen(function* () {
      const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
      const crypto = yield* Crypto.Crypto;
      const fs = yield* FileSystem.FileSystem;

      return InstallerDownload.of({
        fetch: Effect.fn("PracticeSetup.InstallerDownload.fetch")(function* (installer, destination) {
          const unreachable = SetupFailure.make({
            message: "The Claude installer could not be downloaded. Check the internet connection and try again.",
          });
          const response = yield* client.get(installer.url).pipe(Effect.mapError(() => unreachable));
          const bytes = new Uint8Array(yield* response.arrayBuffer.pipe(Effect.mapError(() => unreachable)));
          const digest = yield* crypto.digest("SHA-256", bytes).pipe(Effect.map(Hex.encode), Effect.orDie);
          if (digest !== installer.sha256) {
            return yield* SetupFailure.make({
              message: "The downloaded Claude installer did not match its expected fingerprint, so it was not run.",
            });
          }
          yield* fs
            .writeFile(destination, bytes)
            .pipe(
              Effect.mapError((cause) =>
                SetupFailure.make({ cause, message: "The Claude installer could not be saved." })
              )
            );
        }),
      });
    })
  );
}

// Service shape of GatewayBundle.
interface GatewayBundleShape {
  /** Copy the gateway `.mcpb` into `dir` and return the copy's path, ready to open. */
  readonly materialize: (dir: string) => Effect.Effect<string, SetupFailure>;
  /** The bundle's manifest version, when the build stamped it in. */
  readonly version: O.Option<string>;
}

/**
 * The practice gateway `.mcpb` the bootstrapper hands to Claude.
 *
 * **Details**
 *
 * The compiled bootstrapper embeds the bundle, which lives in Bun's virtual
 * file system; Windows can only open a real file with the `.mcpb` extension,
 * so the bundle is copied out first. `version` lets the probe tell an
 * up-to-date install from one that needs the bundle opened again.
 *
 * **Example** (Bundle from a file)
 *
 * ```ts
 * import { GatewayBundle } from "@/Setup.services"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * console.log(Layer.isLayer(GatewayBundle.fromFile("practice-gateway-windows-x64.mcpb", O.some("0.1.0"))))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GatewayBundle extends Context.Service<GatewayBundle, GatewayBundleShape>()($I`GatewayBundle`) {
  /**
   * The bundle read from `source`, an embedded asset or a file beside the
   * executable.
   *
   * **Example** (Read the constructor)
   *
   * ```ts
   * import { GatewayBundle } from "@/Setup.services"
   *
   * console.log(typeof GatewayBundle.fromFile)
   * ```
   *
   * @param source - Path of the bundle to copy out.
   * @param version - The bundle's manifest version, if known.
   * @category layers
   * @since 0.0.0
   */
  static readonly fromFile = (source: string, version: O.Option<string>) =>
    Layer.effect(
      GatewayBundle,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        return GatewayBundle.of({
          version,
          materialize: Effect.fn("GatewayBundle.materialize")(function* (dir) {
            const target = path.join(dir, "practice-gateway.mcpb");
            yield* fs.readFile(source).pipe(
              Effect.flatMap((bytes) => fs.writeFile(target, bytes)),
              Effect.mapError((cause) =>
                SetupFailure.make({ cause, message: "The Practice Gateway file is missing from this setup program." })
              )
            );
            return target;
          }),
        });
      })
    );
}

// Service shape of Lawyer.
interface LawyerShape {
  /** Wait for Enter without showing anything; interruptible, for racing a probe. */
  readonly awaitEnter: Effect.Effect<void, SetupFailure>;
  /** Show one plain-language line. */
  readonly tell: (text: string) => Effect.Effect<void>;
  /** Show an instruction and wait until the lawyer presses Enter. */
  readonly waitFor: (instruction: string) => Effect.Effect<void, SetupFailure>;
}

/**
 * The bootstrapper's console conversation with the lawyer.
 *
 * **Example** (Compose the console conversation)
 *
 * ```ts
 * import { Lawyer } from "@/Setup.services"
 *
 * console.log(typeof Lawyer.layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Lawyer extends Context.Service<Lawyer, LawyerShape>()($I`Lawyer`) {
  /**
   * Live conversation over `Terminal`.
   *
   * **Example** (Read the layer)
   *
   * ```ts
   * import { Lawyer } from "@/Setup.services"
   *
   * console.log(typeof Lawyer.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    Lawyer,
    Effect.gen(function* () {
      const terminal = yield* Terminal.Terminal;
      const tell = (text: string) => terminal.display(`${text}\n`).pipe(Effect.ignore);
      const awaitEnter = terminal.readLine.pipe(
        Effect.asVoid,
        Effect.mapError((cause) => SetupFailure.make({ cause, message: "Setup was stopped before it finished." }))
      );
      return Lawyer.of({
        tell,
        awaitEnter,
        waitFor: Effect.fn("Lawyer.waitFor")(function* (instruction) {
          yield* tell(`\n${instruction}\nPress Enter when you are done.`);
          yield* awaitEnter;
        }),
      });
    })
  );
}

/**
 * How long the bootstrapper waits for Claude Desktop to appear after its
 * installer returns: every 2 seconds for up to 3 minutes.
 *
 * **Example** (Override the wait in a test)
 *
 * ```ts
 * import { InstallWaitSchedule } from "@/Setup.services"
 * import * as Effect from "effect/Effect"
 * import * as Schedule from "effect/Schedule"
 *
 * const fast = Effect.provideService(InstallWaitSchedule, Schedule.recurs(1))
 * console.log(typeof fast)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const InstallWaitSchedule = Context.Reference<Schedule.Schedule<unknown>>($I`InstallWaitSchedule`, {
  defaultValue: (): Schedule.Schedule<unknown> => Schedule.max([Schedule.spaced("2 seconds"), Schedule.recurs(90)]),
});

// Service shape of ClaudeState.
interface ClaudeStateShape {
  /** Whether Claude Desktop lists the gateway at `expected` (any version when `None`). */
  readonly gateway: (expected: O.Option<string>) => Effect.Effect<GatewayInstallState>;
  /** Whether Claude Desktop has a signed-in account. */
  readonly signIn: Effect.Effect<SignInState>;
}

/**
 * Read-only probes of Claude Desktop's own state files.
 *
 * **Details**
 *
 * Both files are undocumented Claude Desktop internals: `config.json`
 * (`lastKnownAccountUuid` once signed in) and `extensions-installations.json`
 * (installed extensions by id). They live in `%APPDATA%\Claude` for the
 * per-user install and under the package's `LocalCache\Roaming\Claude` for
 * the MSIX. A missing file means "not yet"; a file that cannot be read or
 * decoded is `unknown`, and the bootstrapper then asks the lawyer. Values are
 * never logged. Probes never fail.
 *
 * **Example** (A fake probe for tests)
 *
 * ```ts
 * import { ClaudeState } from "@/Setup.services"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const fake = Layer.succeed(ClaudeState, {
 *   signIn: Effect.succeed("signed-in"),
 *   gateway: () => Effect.succeed("current"),
 * })
 * console.log(Layer.isLayer(fake))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ClaudeState extends Context.Service<ClaudeState, ClaudeStateShape>()($I`ClaudeState`) {
  /**
   * Live probes over `FileSystem`, choosing the data folder from
   * `SetupHost.claudeInstall`.
   *
   * **Example** (Read the layer)
   *
   * ```ts
   * import { ClaudeState } from "@/Setup.services"
   *
   * console.log(typeof ClaudeState.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    ClaudeState,
    Effect.gen(function* () {
      const host = yield* SetupHost;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const dataDir = Effect.gen(function* () {
        return (yield* host.claudeInstall) === ClaudeInstall.Enum.msix
          ? path.join(
              yield* Config.String("LOCALAPPDATA"),
              "Packages",
              CLAUDE_PACKAGE_FAMILY,
              "LocalCache",
              "Roaming",
              "Claude"
            )
          : path.join(yield* Config.String("APPDATA"), "Claude");
      });

      // None when the file does not exist yet; fails when it cannot be located or read.
      const readClaudeFile = Effect.fnUntraced(function* (name: string) {
        const file = path.join(yield* dataDir, name);
        return (yield* fs.exists(file)) ? O.some(yield* fs.readFileString(file)) : O.none();
      });

      return ClaudeState.of({
        signIn: readClaudeFile("config.json").pipe(
          Effect.map(O.match({ onNone: () => SignInState.Enum["signed-out"], onSome: signInStateOf })),
          Effect.orElseSucceed(() => SignInState.Enum.unknown)
        ),
        gateway: Effect.fn("ClaudeState.gateway")(function* (expected) {
          return yield* readClaudeFile("extensions-installations.json").pipe(
            Effect.map(
              O.match({ onNone: () => GatewayInstallState.Enum.missing, onSome: gatewayInstallStateOf(expected) })
            ),
            Effect.orElseSucceed(() => GatewayInstallState.Enum.unknown)
          );
        }),
      });
    })
  );
}

/**
 * How often and how long the bootstrapper watches Claude Desktop's state after
 * opening it: every 3 seconds for up to 10 minutes.
 *
 * **Example** (Override the watch in a test)
 *
 * ```ts
 * import { ClaudeStatePollSchedule } from "@/Setup.services"
 * import * as Effect from "effect/Effect"
 * import * as Schedule from "effect/Schedule"
 *
 * const fast = Effect.provideService(ClaudeStatePollSchedule, Schedule.recurs(1))
 * console.log(typeof fast)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const ClaudeStatePollSchedule = Context.Reference<Schedule.Schedule<unknown>>($I`ClaudeStatePollSchedule`, {
  defaultValue: (): Schedule.Schedule<unknown> => Schedule.max([Schedule.spaced("3 seconds"), Schedule.recurs(200)]),
});

/**
 * Everything the live bootstrapper needs besides the platform services.
 *
 * **Example** (Compose the live services)
 *
 * ```ts
 * import { liveSetupServices } from "@/Setup.services"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * console.log(Layer.isLayer(liveSetupServices("practice-gateway.mcpb", O.none())))
 * ```
 *
 * @param bundleSource - Path of the gateway `.mcpb` to hand to Claude.
 * @param bundleVersion - The bundle's manifest version, if known.
 * @category layers
 * @since 0.0.0
 */
export const liveSetupServices = flow(GatewayBundle.fromFile, (bundle) =>
  Layer.mergeAll(ClaudeState.layer, InstallerDownload.layer, Lawyer.layer, bundle).pipe(
    Layer.provideMerge(SetupHost.layer)
  )
);
