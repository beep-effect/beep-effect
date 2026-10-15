/**
 * The small set of Windows facts the setup probes read: known folders, file
 * presence, registry values, BitLocker protection and running processes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import { Fn, LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { GatewaySettings } from "./GatewaySettings.ts";
import { WindowsHostFailure } from "./PracticeGateway.errors.ts";

const $I = $PracticeGatewayId.create("WindowsHost");

/**
 * Environment-backed folders the probes resolve paths under.
 *
 * **Example** (Check a known folder)
 *
 * ```ts
 * import { KnownFolder } from "@beep/practice-gateway/WindowsHost"
 *
 * console.log(KnownFolder.is.ProgramFiles("ProgramFiles")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnownFolder = LiteralKit(["ProgramFiles", "LOCALAPPDATA", "APPDATA", "USERPROFILE"]).pipe(
  $I.annoteSchema("KnownFolder", {
    description: "An environment-backed Windows folder the setup probes resolve paths under.",
  })
);

/**
 * Decoded type of {@link KnownFolder}.
 *
 * **Example** (Type a known folder)
 *
 * ```ts
 * import type { KnownFolder } from "@beep/practice-gateway/WindowsHost"
 *
 * const folder: KnownFolder = "USERPROFILE"
 * console.log(folder)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KnownFolder = typeof KnownFolder.Type;

/**
 * Whether BitLocker protects a drive, as far as an unelevated process can
 * tell.
 *
 * **Example** (Check a protection state)
 *
 * ```ts
 * import { BitLockerProtection } from "@beep/practice-gateway/WindowsHost"
 *
 * console.log(BitLockerProtection.is.on("on")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BitLockerProtection = LiteralKit(["on", "off", "unknown"]).pipe(
  $I.annoteSchema("BitLockerProtection", {
    description: "Whether BitLocker protects a drive, as far as an unelevated process can tell.",
  })
);

/**
 * Decoded type of {@link BitLockerProtection}.
 *
 * **Example** (Type a protection state)
 *
 * ```ts
 * import type { BitLockerProtection } from "@beep/practice-gateway/WindowsHost"
 *
 * const state: BitLockerProtection = "unknown"
 * console.log(state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BitLockerProtection = typeof BitLockerProtection.Type;

/**
 * Declare the `Effect` a {@link WindowsHost} method returns as a `Fn` output
 * schema.
 *
 * **Details**
 *
 * Only "is an Effect" is checked at runtime. The success channel exists for
 * the type checker; the failure channel is always {@link WindowsHostFailure}.
 *
 * **Example** (Guard a host answer)
 *
 * ```ts
 * import { WindowsHostOutput } from "@beep/practice-gateway/WindowsHost"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const isHostOutput = S.is(WindowsHostOutput<boolean>())
 * console.log(isHostOutput(Effect.succeed(true))) // true
 * console.log(isHostOutput(true)) // false
 * ```
 *
 * @returns A schema accepting any Effect, typed to the host's channels.
 * @category schemas
 * @since 0.0.0
 */
export const WindowsHostOutput = <A>() =>
  S.declare(
    (u): u is Effect.Effect<A, WindowsHostFailure> => Effect.isEffect(u),
    $I.annote("WindowsHostOutput", {
      description: "An Effect returned by a Windows host method; its channels are not checked at runtime.",
    })
  );

/**
 * One registry value to read: the key path and the value name under it.
 *
 * **Example** (Name a registry value)
 *
 * ```ts
 * import { RegistryValueQuery } from "@beep/practice-gateway/WindowsHost"
 *
 * const query = RegistryValueQuery.make({ key: "HKCU\\Software\\Example", name: "DisplayVersion" })
 * console.log(query.name) // "DisplayVersion"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryValueQuery extends S.Opaque<RegistryValueQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String.annotateKey({ description: "Registry key path, such as `HKCU\\Software\\Example`." }),
    name: S.String.annotateKey({ description: "Value name under the key." }),
  }).pipe(
    $I.annoteSchema("RegistryValueQuery", {
      description: "One registry value to read: the key path and the value name under it.",
    })
  )
) {}

/**
 * Service shape of {@link WindowsHost}.
 *
 * **Example** (Build a host shape)
 *
 * ```ts
 * import { WindowsHostShape } from "@beep/practice-gateway/WindowsHost"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const shape = WindowsHostShape.make({
 *   isWindows: false,
 *   folder: () => Effect.succeedNone,
 *   exists: () => Effect.succeed(false),
 *   readFile: () => Effect.succeedNone,
 *   registryValue: () => Effect.succeed(O.none()),
 *   appxPackageFamilies: () => Effect.succeed([]),
 *   bitLocker: () => Effect.succeed("unknown"),
 *   processRunning: () => Effect.succeed(false),
 * })
 * console.log(shape.isWindows) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WindowsHostShape extends S.Opaque<WindowsHostShape, { readonly brand: unique symbol }>()(
  S.Struct({
    appxPackageFamilies: Fn({
      input: S.String,
      output: WindowsHostOutput<ReadonlyArray<string>>(),
    }).annotateKey({
      description: "Package family names of the MSIX (Appx) packages with this name installed for the current user.",
    }),
    bitLocker: Fn({
      input: S.String,
      output: WindowsHostOutput<BitLockerProtection>(),
    }).annotateKey({ description: "Read a drive's BitLocker protection without administrator rights." }),
    exists: Fn({
      input: S.String,
      output: WindowsHostOutput<boolean>(),
    }).annotateKey({ description: "Whether a file or directory exists." }),
    folder: Fn({
      input: KnownFolder,
      output: WindowsHostOutput<O.Option<string>>(),
    }).annotateKey({ description: "Resolve a known folder from the environment." }),
    isWindows: S.Boolean.annotateKey({
      description:
        'True on Windows. Probes for Windows-only facts answer "only on Windows" instead of querying when this is false.',
    }),
    processRunning: Fn({
      input: S.String,
      output: WindowsHostOutput<boolean>(),
    }).annotateKey({ description: "Whether a process with this image name runs for the current user." }),
    readFile: Fn({
      input: S.String,
      output: WindowsHostOutput<O.Option<Uint8Array>>(),
    }).annotateKey({ description: "Read a file's bytes; `None` when it does not exist." }),
    registryValue: Fn({
      input: RegistryValueQuery,
      output: WindowsHostOutput<O.Option<string>>(),
    }).annotateKey({
      description: "Read one registry value through `reg.exe query`; `None` when the key or value does not exist.",
    }),
  }).pipe(
    $I.annoteSchema("WindowsHostShape", {
      description: "The Windows facts the setup probes read.",
    })
  )
) {}

/**
 * Pick one value out of `reg.exe query <key> /v <name>` output.
 *
 * **Example** (Parse a registry line)
 *
 * ```ts
 * import { parseRegistryValue } from "@beep/practice-gateway/WindowsHost"
 *
 * const output = "\r\nHKEY_CURRENT_USER\\Software\\Example\r\n    DisplayVersion    REG_SZ    1.2.3\r\n"
 * console.log(parseRegistryValue(output, "DisplayVersion")) // { _id: "Option", _tag: "Some", value: "1.2.3" }
 * ```
 *
 * @param output - Standard output of `reg.exe query`.
 * @param name - Value name that was queried.
 * @category utilities
 * @since 0.0.0
 */
export const parseRegistryValue: {
  (name: string): (output: string) => O.Option<string>;
  (output: string, name: string): O.Option<string>;
} = dual(
  2,
  (output: string, name: string): O.Option<string> =>
    pipe(
      Str.linesIterator(output),
      A.fromIterable,
      A.map(Str.trim),
      A.findFirst(Str.startsWith(`${name} `)),
      O.flatMap(Str.match(/\sREG_[A-Z0-9_]+\s+(.*)$/)),
      O.flatMap((match) => O.fromNullishOr(match[1])),
      O.map(Str.trim)
    )
);

/**
 * Map the Shell `System.Volume.BitLockerProtection` property to a protection
 * state.
 *
 * **Details**
 *
 * The property reads `1` (on) or `6` (on, locked) for a protected drive and
 * `2` (off), `3` (encrypting), `4` (decrypting) or `5` (suspended) for an
 * unprotected one; anything else, including an empty answer, is `unknown`.
 *
 * **Example** (Parse a protected drive)
 *
 * ```ts
 * import { parseBitLockerProtection } from "@beep/practice-gateway/WindowsHost"
 *
 * console.log(parseBitLockerProtection("1\r\n")) // "on"
 * ```
 *
 * @param output - Standard output of the PowerShell property read.
 * @category utilities
 * @since 0.0.0
 */
export const parseBitLockerProtection = (output: string): BitLockerProtection => {
  const value = Str.trim(output);
  if (A.contains(["1", "6"], value)) {
    return BitLockerProtection.Enum.on;
  }
  if (A.contains(["2", "3", "4", "5"], value)) {
    return BitLockerProtection.Enum.off;
  }
  return BitLockerProtection.Enum.unknown;
};

/**
 * Package family names in `Get-AppxPackage ... | ForEach-Object PackageFamilyName`
 * output, one per non-empty line.
 *
 * **Example** (Read Claude's MSIX family)
 *
 * ```ts
 * import { parseAppxPackageFamilies } from "@beep/practice-gateway/WindowsHost"
 *
 * console.log(parseAppxPackageFamilies("Claude_pzs8sxrjxfjjc\r\n")) // ["Claude_pzs8sxrjxfjjc"]
 * ```
 *
 * @param output - Standard output of the PowerShell query.
 * @category utilities
 * @since 0.0.0
 */
export const parseAppxPackageFamilies = (output: string): ReadonlyArray<string> =>
  pipe(Str.linesIterator(output), A.fromIterable, A.map(Str.trim), A.filter(Str.isNonEmpty));

/**
 * Whether `tasklist /FO CSV /NH` output lists a process image.
 *
 * **Example** (Find Box Drive in the task list)
 *
 * ```ts
 * import { tasklistHasImage } from "@beep/practice-gateway/WindowsHost"
 *
 * console.log(tasklistHasImage('"Box.exe","4120","Console","1","120,000 K"\r\n', "Box.exe")) // true
 * ```
 *
 * @param output - Standard output of `tasklist`.
 * @param imageName - Image name to look for, such as `Box.exe`.
 * @category utilities
 * @since 0.0.0
 */
export const tasklistHasImage: {
  (imageName: string): (output: string) => boolean;
  (output: string, imageName: string): boolean;
} = dual(2, (output: string, imageName: string): boolean =>
  pipe(
    Str.linesIterator(output),
    A.fromIterable,
    A.map(flow(Str.trim, Str.toLowerCase)),
    A.some(Str.startsWith(`"${Str.toLowerCase(imageName)}"`))
  )
);

// The package name comes from the gateway's own constants, never from input.
const AppxFamilyScript = (name: string) => `Get-AppxPackage -Name '${name}' | ForEach-Object { $_.PackageFamilyName }`;

const BitLockerScript = (drive: string) =>
  `(New-Object -ComObject Shell.Application).NameSpace('${drive}').Self.ExtendedProperty('System.Volume.BitLockerProtection')`;

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(() => Str.empty, Str.concat)
  );

const notWindows = (operation: string) =>
  Effect.fail(WindowsHostFailure.make({ message: `${operation} is only available on Windows.` }));

/**
 * Windows facts for the setup probes.
 *
 * **Details**
 *
 * The live layer reads files through `FileSystem`, folders through `Config`
 * and shells out to `reg.exe`, `powershell.exe` and `tasklist.exe` through
 * `ChildProcessSpawner`. Off Windows the shell-backed queries fail with
 * {@link WindowsHostFailure}; probes check `isWindows` first and never reach
 * them. Tests provide a fake shape with `WindowsHostShape.make`.
 *
 * **Example** (A fake host for tests)
 *
 * ```ts
 * import { WindowsHost, WindowsHostShape } from "@beep/practice-gateway/WindowsHost"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * const fake = Layer.succeed(
 *   WindowsHost,
 *   WindowsHostShape.make({
 *     isWindows: true,
 *     folder: () => Effect.succeed(O.some("C:\\Users\\lawyer")),
 *     exists: () => Effect.succeed(false),
 *     readFile: () => Effect.succeed(O.none()),
 *     registryValue: () => Effect.succeed(O.none()),
 *     appxPackageFamilies: () => Effect.succeed([]),
 *     bitLocker: () => Effect.succeed("on"),
 *     processRunning: () => Effect.succeed(false),
 *   })
 * )
 * console.log(Layer.isLayer(fake))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WindowsHost extends Context.Service<WindowsHost, WindowsHostShape>()($I`WindowsHost`) {
  /**
   * Live host over the file system, environment and Windows command-line
   * tools.
   *
   * **Example** (Compose the live host)
   *
   * ```ts
   * import { WindowsHost } from "@beep/practice-gateway/WindowsHost"
   *
   * console.log(typeof WindowsHost.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    WindowsHost,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const { isWindows } = yield* GatewaySettings;

      const run = Effect.fnUntraced(
        function* (command: string, args: ReadonlyArray<string>) {
          const child = yield* spawner.spawn(
            ChildProcess.make(command, args, { stdin: "ignore", stderr: "ignore", stdout: "pipe" })
          );
          const [stdout, exitCode] = yield* Effect.all([collectText(child.stdout), child.exitCode], {
            concurrency: "unbounded",
          });
          return { stdout, exitCode: Number(exitCode) };
        },
        Effect.scoped,
        (effect, command) =>
          Effect.mapError(effect, (cause) =>
            WindowsHostFailure.make({ cause, message: `${command} could not be run.` })
          )
      );

      const folder = (name: KnownFolder) =>
        Config.option(Config.String(name)).pipe(
          Effect.map(O.filter(Str.isNonEmpty)),
          Effect.mapError((cause) => WindowsHostFailure.make({ cause, message: `${name} could not be read.` }))
        );

      const exists = (path: string) =>
        fs
          .exists(path)
          .pipe(
            Effect.mapError((cause) => WindowsHostFailure.make({ cause, message: `"${path}" could not be checked.` }))
          );

      const readFile = (path: string) =>
        exists(path).pipe(
          Effect.flatMap((present) =>
            present
              ? fs.readFile(path).pipe(
                  Effect.asSome,
                  Effect.mapError((cause) =>
                    WindowsHostFailure.make({ cause, message: `"${path}" could not be read.` })
                  )
                )
              : Effect.succeedNone
          )
        );

      const registryValue = ({ key, name }: RegistryValueQuery) =>
        isWindows
          ? run("reg.exe", ["query", key, "/v", name]).pipe(
              // reg.exe exits 1 when the key or value is absent.
              Effect.map(({ exitCode, stdout }) =>
                exitCode === 0 ? parseRegistryValue(stdout, name) : O.none<string>()
              )
            )
          : notWindows("Reading the registry");

      const bitLocker = (drive: string) =>
        isWindows
          ? run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", BitLockerScript(drive)]).pipe(
              Effect.map(({ exitCode, stdout }) =>
                exitCode === 0 ? parseBitLockerProtection(stdout) : BitLockerProtection.Enum.unknown
              )
            )
          : notWindows("Reading BitLocker protection");

      const appxPackageFamilies = (name: string) =>
        isWindows
          ? run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", AppxFamilyScript(name)]).pipe(
              Effect.map(({ exitCode, stdout }) =>
                exitCode === 0 ? parseAppxPackageFamilies(stdout) : A.empty<string>()
              )
            )
          : notWindows("Listing MSIX packages");

      const processRunning = (imageName: string) =>
        isWindows
          ? run("tasklist.exe", ["/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"]).pipe(
              Effect.map(({ stdout }) => tasklistHasImage(stdout, imageName))
            )
          : notWindows("Listing processes");

      return WindowsHostShape.make({
        isWindows,
        folder,
        exists,
        readFile,
        registryValue,
        appxPackageFamilies,
        bitLocker,
        processRunning,
      });
    })
  );
}
