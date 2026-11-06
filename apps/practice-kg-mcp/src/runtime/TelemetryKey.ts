/**
 * The practice KG host's telemetry root key: where it lives, how DPAPI wraps
 * it on Windows, the layer that loads or creates it, and the read-only look
 * the privacy receipt takes at it.
 *
 * **Details**
 *
 * On Windows the root key is 32 random bytes wrapped with DPAPI for the
 * current user, through `crypt32` over `bun:ffi` or, when that path is
 * unavailable, through PowerShell's `ProtectedData`. The key travels to
 * PowerShell over stdin and back over stdout, never through argv, the
 * environment or a log. Elsewhere the key is stored unwrapped in an
 * owner-only file and marked `dev-file`: that layer is for development and
 * tests, never production.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeKgMcpId } from "@beep/identity/packages";
import { StrictKeyProtection, StrictSpoolKey, writeOwnerOnlyFile } from "@beep/observability/strict";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { TelemetryKeyFailure } from "../PracticeKgMcp.errors.ts";
import type * as PlatformError from "effect/PlatformError";

const $I = $PracticeKgMcpId.create("runtime/TelemetryKey");

const rootKeyBytes = 32;
const ownerOnlyDirectory = 0o700;
// DPAPI optional entropy: a blob wrapped by one path unwraps only with the
// same entropy, so the FFI and PowerShell paths share it.
const dpapiEntropy = "beep/practice-kg/telemetry/v1";
const cryptprotectUiForbidden = 0x1;
const dataBlobBytes = 16;
const textEncoder = new TextEncoder();

const keyFailure =
  (message: string) =>
  (cause: unknown): TelemetryKeyFailure =>
    TelemetryKeyFailure.make({ cause, message });

/**
 * Wraps and unwraps the telemetry root key for the current user.
 *
 * **Details**
 *
 * `protection` names the path the port uses, so the host can record it. The
 * Windows ports are DPAPI; `layerDevPlaintextDpapi` is an identity
 * port marked `dev-file` for development and tests.
 *
 * **Example** (Provide a fake port)
 *
 * ```ts
 * import { DpapiPort } from "../../src/runtime/TelemetryKey.ts"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const fake = Layer.succeed(
 *   DpapiPort,
 *   DpapiPort.of({ protection: "dpapi-ffi", protect: Effect.succeed, unprotect: Effect.succeed })
 * )
 * console.log(Layer.isLayer(fake)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DpapiPort extends Context.Service<
  DpapiPort,
  {
    readonly protection: StrictKeyProtection;
    readonly protect: (plaintext: Uint8Array) => Effect.Effect<Uint8Array, TelemetryKeyFailure>;
    readonly unprotect: (wrapped: Uint8Array) => Effect.Effect<Uint8Array, TelemetryKeyFailure>;
  }
>()($I`DpapiPort`) {}

/**
 * The stored telemetry root key: its epoch, the path that wrapped it, and
 * the wrapped bytes.
 *
 * **Example** (Describe a key file)
 *
 * ```ts
 * import { PracticeKgTelemetryKeyFile } from "../../src/runtime/TelemetryKey.ts"
 *
 * const file = PracticeKgTelemetryKeyFile.make({ version: 1, epoch: 1, protection: "dpapi-ffi", wrappedBase64: "AA==" })
 * console.log(file.epoch) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgTelemetryKeyFile extends S.Opaque<
  PracticeKgTelemetryKeyFile,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag(1),
    epoch: S.Int.check(S.isGreaterThan(0)),
    protection: StrictKeyProtection,
    wrappedBase64: S.String,
  }).pipe(
    $I.annoteSchema("PracticeKgTelemetryKeyFile", {
      description: "Stored telemetry root key: epoch, wrapping path and wrapped bytes.",
    })
  )
) {}

const decodeKeyFile = S.decodeUnknownEffect(S.fromJsonString(PracticeKgTelemetryKeyFile));
const encodeKeyFile = S.encodeEffect(S.fromJsonString(PracticeKgTelemetryKeyFile));

// Identity `DpapiPort` marked `dev-file`: the root key is stored
// unwrapped. Not for production.
const layerDevPlaintextDpapi: Layer.Layer<DpapiPort> = Layer.succeed(
  DpapiPort,
  DpapiPort.of({ protection: StrictKeyProtection.Enum["dev-file"], protect: Effect.succeed, unprotect: Effect.succeed })
);

// DATA_BLOB on x64: a 32-bit length, 4 bytes of padding, then a pointer.
const dataBlob = (pointerOf: (bytes: Uint8Array) => number, bytes: Uint8Array): Uint8Array => {
  const blob = new Uint8Array(dataBlobBytes);
  const view = new DataView(blob.buffer);
  view.setUint32(0, bytes.byteLength, true);
  view.setBigUint64(8, BigInt(pointerOf(bytes)), true);
  return blob;
};

const crypt32Signature = {
  args: ["ptr", "ptr", "ptr", "ptr", "ptr", "u32", "ptr"],
  returns: "i32",
} as const;

const loadCrypt32 = Effect.tryPromise({
  try: () => import("bun:ffi"),
  catch: keyFailure("bun:ffi is not available."),
}).pipe(
  Effect.flatMap((ffi) =>
    Effect.try({
      try: () => {
        const crypt32 = ffi.dlopen("crypt32.dll", {
          CryptProtectData: crypt32Signature,
          CryptUnprotectData: crypt32Signature,
        });
        const kernel32 = ffi.dlopen("kernel32.dll", { LocalFree: { args: ["ptr"], returns: "ptr" } });
        const entropy = textEncoder.encode(dpapiEntropy);
        const call = (protect: boolean, input: Uint8Array): O.Option<Uint8Array> => {
          const output = new Uint8Array(dataBlobBytes);
          const inputBlob = dataBlob(ffi.ptr, input);
          const entropyBlob = dataBlob(ffi.ptr, entropy);
          const ok = protect
            ? crypt32.symbols.CryptProtectData(
                inputBlob,
                null,
                entropyBlob,
                null,
                null,
                cryptprotectUiForbidden,
                output
              )
            : crypt32.symbols.CryptUnprotectData(
                inputBlob,
                null,
                entropyBlob,
                null,
                null,
                cryptprotectUiForbidden,
                output
              );
          if (ok === 0) {
            return O.none<Uint8Array>();
          }
          const view = new DataView(output.buffer);
          const pointer = view.getBigUint64(8, true);
          // Copy the result out, then zero DPAPI's buffer before freeing it.
          const native = new Uint8Array(ffi.toArrayBuffer(pointer, 0, view.getUint32(0, true)));
          const copy = native.slice();
          native.fill(0);
          kernel32.symbols.LocalFree(pointer);
          return O.some(copy);
        };
        return call;
      },
      catch: keyFailure("crypt32 could not be loaded through bun:ffi."),
    })
  )
);

// One crypt32 call; `None` is the call returning FALSE.
const dpapiCall = (
  call: (protect: boolean, input: Uint8Array) => O.Option<Uint8Array>,
  protect: boolean,
  input: Uint8Array
): Effect.Effect<Uint8Array, TelemetryKeyFailure> => {
  const message = protect ? "DPAPI could not wrap the key." : "DPAPI could not unwrap the key.";
  return Effect.try({ try: () => call(protect, input), catch: keyFailure(message) }).pipe(
    Effect.flatMap(
      O.match({ onNone: () => Effect.fail(TelemetryKeyFailure.make({ message })), onSome: Effect.succeed })
    )
  );
};

// DPAPI `DpapiPort` over `bun:ffi`, calling
// `crypt32.CryptProtectData` / `CryptUnprotectData` for the current user
// with the UI forbidden. Windows only; building it elsewhere fails.
const layerDpapiFfi: Layer.Layer<DpapiPort, TelemetryKeyFailure> = Layer.effect(
  DpapiPort,
  Effect.map(loadCrypt32, (call) =>
    DpapiPort.of({
      protection: StrictKeyProtection.Enum["dpapi-ffi"],
      protect: Effect.fn("DpapiPort.protect")((plaintext: Uint8Array) => dpapiCall(call, true, plaintext)),
      unprotect: Effect.fn("DpapiPort.unprotect")((wrapped: Uint8Array) => dpapiCall(call, false, wrapped)),
    })
  )
);

const powerShellScript = (method: "Protect" | "Unprotect"): string =>
  A.join(
    [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName System.Security",
      "$data = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())",
      `$entropy = [Text.Encoding]::UTF8.GetBytes('${dpapiEntropy}')`,
      `$out = [System.Security.Cryptography.ProtectedData]::${method}($data, $entropy, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)`,
      "[Console]::Out.Write([Convert]::ToBase64String($out))",
    ],
    "; "
  );

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (text, chunk) => `${text}${chunk}`
    )
  );

/**
 * DPAPI {@link DpapiPort} through Windows PowerShell's
 * `System.Security.Cryptography.ProtectedData`, for the current user.
 *
 * **Details**
 *
 * The key goes to PowerShell as Base64 on stdin and comes back as Base64 on
 * stdout; argv carries only the fixed script, and nothing is logged.
 *
 * **Example** (Reference the PowerShell port)
 *
 * ```ts
 * import { layerDpapiPowerShell } from "../../src/runtime/TelemetryKey.ts"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerDpapiPowerShell)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerDpapiPowerShell: Layer.Layer<DpapiPort, never, ChildProcessSpawner.ChildProcessSpawner> =
  Layer.effect(
    DpapiPort,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const run = (method: "Protect" | "Unprotect") =>
        Effect.fnUntraced(function* (input: Uint8Array) {
          const [output, exitCode] = yield* Effect.scoped(
            Effect.gen(function* () {
              const handle = yield* spawner.spawn(
                ChildProcess.make(
                  "powershell.exe",
                  ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", powerShellScript(method)],
                  {
                    stdin: { stream: Stream.make(textEncoder.encode(Base64.encode(input))) },
                    stdout: "pipe",
                    stderr: "ignore",
                    windowsHide: true,
                  }
                )
              );
              return yield* Effect.all([collectText(handle.stdout), handle.exitCode], { concurrency: "unbounded" });
            })
          ).pipe(Effect.mapError(keyFailure(`PowerShell DPAPI ${method} could not run.`)));
          const decoded = Base64.decode(Str.trim(output));
          if (exitCode !== 0 || Result.isFailure(decoded)) {
            return yield* TelemetryKeyFailure.make({ message: `PowerShell DPAPI ${method} failed.` });
          }
          return decoded.success;
        });
      return DpapiPort.of({
        protection: StrictKeyProtection.Enum["dpapi-powershell"],
        protect: run("Protect"),
        unprotect: run("Unprotect"),
      });
    })
  );

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean => Base64.encode(left) === Base64.encode(right);

/**
 * Wraps a random secret and unwraps it again through the port, failing when
 * the round trip does not return the same bytes or the wrapped form equals
 * the plaintext on a DPAPI path.
 *
 * **Example** (Round-trip a fake port)
 *
 * ```ts
 * import { DpapiPort, roundTripDpapi } from "../../src/runtime/TelemetryKey.ts"
 * import * as Effect from "effect/Effect"
 *
 * const port = DpapiPort.of({ protection: "dev-file", protect: Effect.succeed, unprotect: Effect.succeed })
 * console.log(Effect.isEffect(roundTripDpapi(port))) // true
 * ```
 *
 * @param port - The DPAPI port to exercise.
 * @returns The port's protection path once the round trip passes.
 * @category use-cases
 * @since 0.0.0
 */
export const roundTripDpapi = Effect.fn("PracticeKgTelemetryKey.roundTrip")(function* (
  port: Context.Service.Shape<typeof DpapiPort>
) {
  const secret = globalThis.crypto.getRandomValues(new Uint8Array(rootKeyBytes));
  const wrapped = yield* port.protect(secret);
  const unwrapped = yield* port.unprotect(wrapped);
  const wrapsForReal = StrictKeyProtection.is["dev-file"](port.protection) || !sameBytes(wrapped, secret);
  if (!sameBytes(unwrapped, secret) || !wrapsForReal) {
    return yield* TelemetryKeyFailure.make({ message: "The DPAPI round trip did not return the secret." });
  }
  return port.protection;
});

// The production DPAPI port: the `bun:ffi` path when it loads and passes a
// round trip, otherwise the PowerShell path.
const layerDpapiProduction: Layer.Layer<DpapiPort, TelemetryKeyFailure, ChildProcessSpawner.ChildProcessSpawner> =
  Layer.effect(
    DpapiPort,
    Effect.gen(function* () {
      const port = yield* DpapiPort;
      yield* roundTripDpapi(port);
      return port;
    })
  ).pipe(
    Layer.provide(layerDpapiFfi),
    Layer.catch(() => layerDpapiPowerShell)
  );

/**
 * The DPAPI port for a platform: production DPAPI on Windows, the dev
 * plaintext port elsewhere.
 *
 * **Example** (Pick the Linux port)
 *
 * ```ts
 * import { layerPracticeKgDpapi } from "../../src/runtime/TelemetryKey.ts"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerPracticeKgDpapi("linux"))) // true
 * ```
 *
 * @param platform - `process.platform` of the host.
 * @category layers
 * @since 0.0.0
 */
export const layerPracticeKgDpapi = (
  platform: string
): Layer.Layer<DpapiPort, TelemetryKeyFailure, ChildProcessSpawner.ChildProcessSpawner> =>
  Match.value(platform).pipe(
    Match.when("win32", () => layerDpapiProduction),
    Match.orElse(() => layerDevPlaintextDpapi)
  );

const optionalEnv = (name: string): Effect.Effect<O.Option<string>> =>
  Effect.gen(function* () {
    const option1 = yield* Config.option(Config.String(name));
    return O.filter(option1, Str.isNonEmpty);
  }).pipe(Effect.orElseSucceed(O.none));

/**
 * Resolves the telemetry directory once.
 *
 * **Details**
 *
 * `PRACTICE_KG_TELEMETRY_DIR` wins when set. Otherwise Windows uses
 * `%LOCALAPPDATA%\beep\practice-kg\telemetry` and other platforms use
 * `$XDG_STATE_HOME/beep/practice-kg/telemetry`, falling back to
 * `~/.local/state/beep/practice-kg/telemetry`. `None` means no base
 * directory is known.
 *
 * **Gotchas**
 *
 * The Microsoft Store build of Claude Desktop virtualises `AppData` for the
 * processes it starts, so the files may land under
 * `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Local\...`;
 * `--self-check-telemetry` prints the directory the host resolved.
 *
 * **Example** (Resolve the directory)
 *
 * ```ts
 * import { resolvePracticeKgTelemetryDir } from "../../src/runtime/TelemetryKey.ts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolvePracticeKgTelemetryDir("win32"))) // true
 * ```
 *
 * @param platform - `process.platform` of the host.
 * @category use-cases
 * @since 0.0.0
 */
export const resolvePracticeKgTelemetryDir = Effect.fn("PracticeKgTelemetryKey.resolveDir")(function* (
  platform: string
) {
  const path = yield* Path.Path;
  const override = yield* optionalEnv("PRACTICE_KG_TELEMETRY_DIR");
  const suffix = ["beep", "practice-kg", "telemetry"] as const;
  const base = yield* Match.value(platform).pipe(
    Match.when("win32", () => optionalEnv("LOCALAPPDATA")),
    Match.orElse(() =>
      Effect.map(Effect.all([optionalEnv("XDG_STATE_HOME"), optionalEnv("HOME")]), ([state, home]) =>
        O.orElse(state, () => O.map(home, (dir) => path.join(dir, ".local", "state")))
      )
    )
  );
  return O.orElse(override, () => O.map(base, (dir) => path.join(dir, ...suffix)));
});

const unwrapStored = Effect.fnUntraced(function* (
  port: Context.Service.Shape<typeof DpapiPort>,
  file: PracticeKgTelemetryKeyFile
) {
  const wrapped = Base64.decode(file.wrappedBase64);
  if (Result.isFailure(wrapped)) {
    return O.none<Uint8Array>();
  }
  return yield* port
    .unprotect(wrapped.success)
    .pipe(
      Effect.map(O.liftPredicate((material) => material.byteLength === rootKeyBytes)),
      Effect.orElseSucceed(O.none)
    );
});

// Key files are `key.<epoch>.dpapi`; a file is published once and never
// overwritten, so the highest epoch on disk is the current key.
const keyFilePattern = /^key\.(\d+)\.dpapi$/;
const keyFileNameFor = (epoch: number): string => `key.${epoch}.dpapi`;
const keyAttempts = 5;
const pendingNameBytes = 6;

const isAlreadyExists = (error: PlatformError.PlatformError): boolean => error.reason._tag === "AlreadyExists";

// The highest epoch present in the directory and its decoded file, if it decodes.
const latestKeyFile = Effect.fnUntraced(function* (telemetryDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(telemetryDir).pipe(Effect.orElseSucceed(A.empty<string>));
  const latest = A.last(
    A.sort(
      A.getSomes(
        A.map(entries, (entry) => O.flatMap(Str.match(keyFilePattern)(entry), (match) => N.parse(match[1] ?? "")))
      ),
      Order.Number
    )
  );
  return yield* O.match(latest, {
    onNone: () => Effect.succeedNone,
    onSome: (epoch) =>
      fs.readFileString(path.join(telemetryDir, keyFileNameFor(epoch))).pipe(
        Effect.flatMap(decodeKeyFile),
        Effect.option,
        Effect.map((file) => O.some({ epoch, file: O.filter(file, (decoded) => decoded.epoch === epoch) }))
      ),
  });
});

// Draws a new root key and publishes it as `key.<epoch>.dpapi`: the wrapped key
// is written owner-only to a pending name, then hard-linked into place, which
// fails when the name already exists. `None` means another process published
// that epoch first.
const publishKey = Effect.fnUntraced(function* (
  port: Context.Service.Shape<typeof DpapiPort>,
  telemetryDir: string,
  epoch: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const material = globalThis.crypto.getRandomValues(new Uint8Array(rootKeyBytes));
  const wrapped = yield* port.protect(material);
  const text = yield* encodeKeyFile(
    PracticeKgTelemetryKeyFile.make({
      version: 1,
      epoch,
      protection: port.protection,
      wrappedBase64: Base64.encode(wrapped),
    })
  ).pipe(Effect.mapError(keyFailure("The telemetry key file could not be encoded.")));
  const target = path.join(telemetryDir, keyFileNameFor(epoch));
  const pending = `${target}.${Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(pendingNameBytes)))}.pending`;
  const published = yield* writeOwnerOnlyFile(pending, text).pipe(
    Effect.andThen(fs.link(pending, target)),
    Effect.as(true),
    Effect.catchIf(isAlreadyExists, () => Effect.succeed(false)),
    Effect.ensuring(Effect.ignore(fs.remove(pending, { force: true }))),
    Effect.mapError(keyFailure("The telemetry key file could not be written."))
  );
  return published ? O.some({ epoch, material }) : O.none<{ readonly epoch: number; readonly material: Uint8Array }>();
});

// Uses the highest-epoch key when it unwraps; otherwise publishes the next
// epoch, and when another process wins that epoch, starts over and uses its key.
const resolveKey = Effect.fnUntraced(function* (
  port: Context.Service.Shape<typeof DpapiPort>,
  telemetryDir: string,
  attempt: number
): Effect.fn.Return<
  { readonly epoch: number; readonly material: Uint8Array },
  TelemetryKeyFailure,
  FileSystem.FileSystem | Path.Path
> {
  const latest = yield* latestKeyFile(telemetryDir);
  const loaded = yield* O.match(
    O.flatMap(latest, ({ file }) => file),
    {
      onNone: () => Effect.succeedNone,
      onSome: (file) =>
        Effect.map(
          unwrapStored(port, file),
          O.map((material) => ({ epoch: file.epoch, material }))
        ),
    }
  );
  if (O.isSome(loaded)) {
    return loaded.value;
  }
  const published = yield* publishKey(
    port,
    telemetryDir,
    O.getOrElse(
      O.map(latest, ({ epoch }) => epoch + 1),
      () => 1
    )
  );
  if (O.isSome(published)) {
    return published.value;
  }
  if (attempt >= keyAttempts) {
    return yield* TelemetryKeyFailure.make({
      message: "The telemetry key kept changing while it was being created.",
    });
  }
  return yield* resolveKey(port, telemetryDir, attempt + 1);
});

/**
 * Loads the telemetry root key from `<telemetryDir>/key.<epoch>.dpapi`, or
 * creates one, and provides it as the {@link StrictSpoolKey}.
 *
 * **Details**
 *
 * - The directory is created owner-only (`0700`). Each key file is written
 *   owner-only (`0600`) to a pending name and published by a hard link,
 *   which fails when the name exists, so a key file is never overwritten
 *   and never seen half-written.
 * - The highest epoch on disk is the current key. With no key file the host
 *   publishes epoch 1; when the current one does not decode or unwrap
 *   (another user, a reset profile) it publishes the next epoch, and the old
 *   spool then replays as `spool-segment-invalid`.
 * - Concurrent hosts cannot fork the key: when another process publishes the
 *   same epoch first, this one re-reads the directory and uses that key.
 * - The key's `protection` is the path the port used.
 *
 * **Example** (Load the key with the dev port)
 *
 * ```ts
 * import { layerPracticeKgDpapi, layerPracticeKgSpoolKey } from "../../src/runtime/TelemetryKey.ts"
 * import * as Layer from "effect/Layer"
 *
 * const key = layerPracticeKgSpoolKey("/state/telemetry").pipe(Layer.provide(layerPracticeKgDpapi("linux")))
 * console.log(Layer.isLayer(key)) // true
 * ```
 *
 * @param telemetryDir - The resolved telemetry directory.
 * @category layers
 * @since 0.0.0
 */
export const layerPracticeKgSpoolKey = (
  telemetryDir: string
): Layer.Layer<StrictSpoolKey, TelemetryKeyFailure, DpapiPort | FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    StrictSpoolKey,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const port = yield* DpapiPort;
      yield* fs
        .makeDirectory(telemetryDir, { recursive: true, mode: ownerOnlyDirectory })
        .pipe(
          Effect.andThen(fs.chmod(telemetryDir, ownerOnlyDirectory)),
          Effect.mapError(keyFailure("The telemetry directory could not be created."))
        );
      const key = yield* resolveKey(port, telemetryDir, 1);
      return StrictSpoolKey.of({
        epoch: `${key.epoch}`,
        protection: port.protection,
        material: Redacted.make(key.material),
      });
    })
  );

// What a read-only look at the telemetry key found: a key that unwrapped, no
// key file, or a key file that does not decode or unwrap.
const PracticeKgKeyStatus = LiteralKit(["loaded", "missing", "unreadable"]).pipe(
  $I.annoteSchema("PracticeKgKeyStatus", {
    description: "Read-only telemetry key status: loaded, missing, or present but not decodable or unwrappable.",
  })
);

/**
 * The telemetry key as a read-only look describes it: its status and, when
 * the key file decoded, the path that wrapped it and its epoch. It never
 * carries key material.
 *
 * **Example** (Describe a loaded key)
 *
 * ```ts
 * import { PracticeKgKeyReport } from "../../src/runtime/TelemetryKey.ts"
 *
 * const report = PracticeKgKeyReport.make({ status: "loaded", protection: "dpapi-ffi", epoch: 2 })
 * console.log(report.epoch) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgKeyReport extends S.Opaque<PracticeKgKeyReport, { readonly brand: unique symbol }>()(
  S.Struct({
    status: PracticeKgKeyStatus,
    protection: S.optionalKey(StrictKeyProtection),
    epoch: S.optionalKey(S.Int.check(S.isGreaterThan(0))),
  }).pipe(
    $I.annoteSchema("PracticeKgKeyReport", {
      description: "Read-only telemetry key description: status, wrapping path and epoch, never key material.",
    })
  )
) {}

/**
 * Looks at the current `<telemetryDir>/key.<epoch>.dpapi` (the highest epoch,
 * found the way the host finds it) without creating, rotating or writing
 * anything, and returns its {@link PracticeKgKeyReport} with the unwrapped
 * key when it loaded.
 *
 * **Details**
 *
 * Unlike {@link layerPracticeKgSpoolKey}, a missing or unreadable key file
 * is reported, not replaced.
 *
 * **Example** (Look at the key with the dev port)
 *
 * ```ts
 * import { layerPracticeKgDpapi, readPracticeKgSpoolKey } from "../../src/runtime/TelemetryKey.ts"
 * import * as Effect from "effect/Effect"
 *
 * const look = readPracticeKgSpoolKey("/state/telemetry").pipe(Effect.provide(layerPracticeKgDpapi("linux")))
 * console.log(Effect.isEffect(look)) // true
 * ```
 *
 * @param telemetryDir - The resolved telemetry directory.
 * @category use-cases
 * @since 0.0.0
 */
export const readPracticeKgSpoolKey = Effect.fn("PracticeKgTelemetryKey.read")(function* (telemetryDir: string) {
  const port = yield* DpapiPort;
  // The same highest-epoch scan the host uses; it only lists and reads.
  const latest = yield* latestKeyFile(telemetryDir);
  return yield* O.match(latest, {
    onNone: () => Effect.succeed([PracticeKgKeyReport.make({ status: "missing" }), O.none()] as const),
    onSome: ({ epoch, file: stored }) =>
      O.match(stored, {
        onNone: () => Effect.succeed([PracticeKgKeyReport.make({ status: "unreadable", epoch }), O.none()] as const),
        onSome: (file) =>
          Effect.map(unwrapStored(port, file), (material) => {
            const report = PracticeKgKeyReport.make({
              status: O.isSome(material) ? "loaded" : "unreadable",
              protection: file.protection,
              epoch: file.epoch,
            });
            const key = O.map(material, (bytes) =>
              StrictSpoolKey.of({ epoch: `${file.epoch}`, protection: file.protection, material: Redacted.make(bytes) })
            );
            return [report, key] as const;
          }),
      }),
  });
});
