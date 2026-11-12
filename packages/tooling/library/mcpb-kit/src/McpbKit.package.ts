/**
 * Build `.mcpb` bundles: build the app with `bun build`, ship the DuckDB
 * native bindings beside it, zip, and audit the bundle and its archive.
 *
 * **Details**
 *
 * Linux ships one `bun build --compile` executable. Windows ships the
 * official signed Bun runtime beside a script bundle: Smart App Control
 * blocks unsigned executables and has no per-file exception, and a compiled
 * executable is unsigned.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import { dual, flow } from "effect/Function";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  assertArchive,
  assertSignedBinaries,
  copyDirectory,
  ensureRuntime,
  ensureWindowsBindings,
  NativeAddonExternals,
  run,
} from "./internal/steps.ts";
import { McpbPackageFailure } from "./McpbKit.errors.ts";
import {
  McpbLaunch,
  McpbManifest,
  McpbManifestFields,
  McpbRuntimePin,
  McpbTarget,
  McpbTargetSelection,
  McpbTargetSpec,
} from "./McpbKit.models.ts";
import type { McpbCompiledLaunch, McpbPackageSpec } from "./McpbKit.models.ts";

/**
 * The official Bun runtime a Windows bundle ships.
 *
 * **Details**
 *
 * `bun.exe` in the release archive carries the Bun publisher's Authenticode
 * signature, so it starts under Smart App Control where an unsigned
 * `bun build --compile` executable is blocked. The version moves with the
 * repository's `.bun-version`; packaging fails when the two differ. Take the
 * sha256 from the release's `SHASUMS256.txt`
 * (`https://github.com/oven-sh/bun/releases/download/bun-v<version>/SHASUMS256.txt`).
 *
 * **Example** (Read the pinned runtime)
 *
 * ```ts
 * import { mcpbWindowsRuntime } from "@beep/mcpb-kit"
 *
 * console.log(mcpbWindowsRuntime.executable) // "bun.exe"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const mcpbWindowsRuntime = McpbRuntimePin.make({
  version: "1.4.4",
  asset: "bun-windows-x64",
  executable: "bun.exe",
  sha256: Sha256Hex.make("cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5"),
});

/**
 * The `bun build --compile` settings of an executable for one target.
 *
 * **Details**
 *
 * An unsigned compiled executable is blocked on Windows machines that enforce
 * Smart App Control, so `.mcpb` bundles compile only for Linux. The Windows
 * settings remain for tools that ship outside a bundle.
 *
 * **Example** (Name a compiled Windows executable)
 *
 * ```ts
 * import { mcpbCompiledLaunch } from "@beep/mcpb-kit"
 *
 * const launch = mcpbCompiledLaunch("windows-x64", "example-setup")
 * console.log(launch.executable) // "example-setup.exe"
 * ```
 *
 * @param target - Platform to compile for.
 * @param appName - Executable base name.
 * @category constructors
 * @since 0.0.0
 */
export const mcpbCompiledLaunch: {
  (appName: string): (target: McpbTarget) => McpbCompiledLaunch;
  (target: McpbTarget, appName: string): McpbCompiledLaunch;
} = dual(
  2,
  (target: McpbTarget, appName: string): McpbCompiledLaunch =>
    McpbLaunch.cases.compiled.make(
      McpbTarget.match(target, {
        "linux-x64": () => ({ bunTarget: "bun-linux-x64", executable: appName }),
        "windows-x64": () => ({ bunTarget: "bun-windows-x64", executable: `${appName}.exe` }),
      })
    )
);

/**
 * What one target ships for an app: its launch, bindings and platform.
 *
 * **Details**
 *
 * Linux ships a compiled executable named after the app. Windows ships
 * {@link mcpbWindowsRuntime} and the script bundle `<appName>.js`, started
 * with `--no-env-file` so the runtime never reads a `.env` file from the
 * launcher's working directory.
 *
 * **Example** (Read the Windows target)
 *
 * ```ts
 * import { McpbLaunch, mcpbTargetSpec } from "@beep/mcpb-kit"
 *
 * const spec = mcpbTargetSpec("windows-x64", "example-mcp")
 * const script = McpbLaunch.match(spec.launch, {
 *   compiled: ({ executable }) => executable,
 *   "runtime-script": ({ script }) => script,
 * })
 * console.log(script) // "example-mcp.js"
 * ```
 *
 * @param target - Platform to build.
 * @param appName - Executable and script base name.
 * @category constructors
 * @since 0.0.0
 */
export const mcpbTargetSpec: {
  (appName: string): (target: McpbTarget) => McpbTargetSpec;
  (target: McpbTarget, appName: string): McpbTargetSpec;
} = dual(
  2,
  (target: McpbTarget, appName: string): McpbTargetSpec =>
    McpbTarget.match(target, {
      "linux-x64": () =>
        McpbTargetSpec.make({
          target,
          launch: mcpbCompiledLaunch(target, appName),
          nativePackage: "node-bindings-linux-x64",
          platform: "linux",
        }),
      "windows-x64": () =>
        McpbTargetSpec.make({
          target,
          launch: {
            kind: "runtime-script",
            runtime: mcpbWindowsRuntime,
            runtimeArgs: ["--no-env-file"],
            script: `${appName}.js`,
          },
          nativePackage: "node-bindings-win32-x64",
          platform: "win32",
        }),
    })
);

/**
 * The full `manifest.json` object of one target: the app's fields plus the
 * shared author, repository, license, platform and binary-server settings.
 *
 * **Details**
 *
 * The server command is the target's launch: the compiled executable with no
 * arguments, or the bundled runtime with its arguments and the script path.
 * `entry_point` names the executable in both cases. `NODE_PATH` points at the
 * bundled `node_modules`: Bun-compiled executables resolve bare specifiers
 * against their embedded virtual root (`B:\\~BUN\\root`, `/$bunfs/root`),
 * never the adjacent `node_modules`, so the DuckDB native binding only loads
 * through `NODE_PATH`. A script bundle resolves it from its own folder and
 * keeps `NODE_PATH` as a second route. Environment keys are written in sorted
 * order.
 *
 * **Example** (Build the Linux manifest)
 *
 * ```ts
 * import { McpbManifestFields, mcpbManifest, mcpbTargetSpec } from "@beep/mcpb-kit"
 *
 * const fields = McpbManifestFields.make({
 *   name: "beep-example",
 *   displayName: "Beep Example",
 *   version: "0.1.0",
 *   description: "An example server.",
 *   env: {},
 *   userConfig: {},
 *   tools: [],
 * })
 * const manifest = mcpbManifest(fields, mcpbTargetSpec("linux-x64", "example-mcp"))
 * console.log(manifest.manifest_version) // "0.3"
 * ```
 *
 * @param fields - The app's manifest fields.
 * @param target - The target being packaged.
 * @category constructors
 * @since 0.0.0
 */
export const mcpbManifest: {
  (target: McpbTargetSpec): (fields: McpbManifestFields) => McpbManifest;
  (fields: McpbManifestFields, target: McpbTargetSpec): McpbManifest;
} = dual(2, (fields: McpbManifestFields, { launch, platform }: McpbTargetSpec): McpbManifest => {
  const { args, executable } = McpbLaunch.match(launch, {
    compiled: (compiled) => ({ executable: compiled.executable, args: A.empty<string>() }),
    "runtime-script": ({ runtime, runtimeArgs, script }) => ({
      executable: runtime.executable,
      args: [...runtimeArgs, `\${__dirname}/${script}`],
    }),
  });
  return McpbManifest.make({
    manifest_version: "0.3",
    name: fields.name,
    display_name: fields.displayName,
    version: fields.version,
    description: fields.description,
    author: { name: "Beep Effect contributors" },
    repository: { type: "git", url: "https://github.com/kriegcloud/beep-effect.git" },
    license: "MIT",
    compatibility: { platforms: [platform] },
    server: {
      type: "binary",
      entry_point: executable,
      mcp_config: {
        command: `\${__dirname}/${executable}`,
        ...(A.isReadonlyArrayNonEmpty(args) ? { args } : {}),
        env: F.pipe(
          R.set(fields.env, "NODE_PATH", "${__dirname}/node_modules"),
          R.toEntries,
          A.sort(Order.mapInput(Str.Order, ([key]: readonly [string, string]) => key)),
          R.fromEntries
        ),
      },
    },
    user_config: R.map(fields.userConfig, ({ description, required, title, type }) => ({
      type,
      title,
      description,
      required,
    })),
    tools: A.map(fields.tools, ({ description, name }) => ({ name, description })),
    ...(A.isReadonlyArrayNonEmpty(fields.prompts)
      ? { prompts: A.map(fields.prompts, ({ description, name, text }) => ({ name, description, text })) }
      : {}),
  });
});

const encodeManifest = S.encodeEffect(S.fromJsonString(McpbManifest, { space: 2 }));

const packageTarget = Effect.fn("McpbPackage.packageTarget")(function* (
  spec: McpbPackageSpec,
  target: McpbTarget,
  outputRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { appName, repoRoot } = spec;
  const targetSpec = mcpbTargetSpec(target, appName);
  const { launch, nativePackage, platform } = targetSpec;
  const resolvedOutputRoot = path.resolve(repoRoot, outputRoot);
  const bundleDir = path.resolve(resolvedOutputRoot, target);
  const archivePath = path.resolve(resolvedOutputRoot, `${appName}-${target}.mcpb`);
  const cacheDir = path.resolve(resolvedOutputRoot, ".cache");
  const entrypoint = `apps/${appName}/src/bin.ts`;
  const externals = A.flatMap(NativeAddonExternals, (external) => ["--external", external]);
  const nativeSource =
    target === "windows-x64"
      ? yield* ensureWindowsBindings(cacheDir, repoRoot)
      : path.resolve(repoRoot, "node_modules", "@duckdb", nativePackage);
  // Staging resolves the pinned runtime before the last bundle is removed, so
  // a pin or download failure leaves it in place.
  const staged = yield* McpbLaunch.match(launch, {
    compiled: ({ bunTarget, executable }) =>
      Effect.succeed({
        files: [executable],
        build: run(
          [
            "bun",
            "build",
            "--compile",
            `--target=${bunTarget}`,
            entrypoint,
            `--outfile=${path.join(bundleDir, executable)}`,
            "--asset-naming=[name].[ext]",
            ...externals,
          ],
          { cwd: repoRoot }
        ),
      }),
    "runtime-script": ({ runtime, script }) =>
      Effect.map(ensureRuntime(runtime, cacheDir, repoRoot), (runtimeSource) => ({
        files: [runtime.executable, script, ...spec.assets],
        build: run(
          [
            "bun",
            "build",
            "--target=bun",
            entrypoint,
            `--outdir=${bundleDir}`,
            `--entry-naming=${script}`,
            "--asset-naming=[name].[ext]",
            ...externals,
          ],
          { cwd: repoRoot }
        ).pipe(
          Effect.andThen(
            fs
              .copyFile(runtimeSource, path.join(bundleDir, runtime.executable))
              .pipe(
                Effect.mapError((cause) =>
                  McpbPackageFailure.make({ cause, message: `Failed copying ${runtime.executable} into the bundle.` })
                )
              )
          )
        ),
      })),
  });
  yield* fs.remove(bundleDir, { recursive: true, force: true });
  yield* fs.makeDirectory(bundleDir, { recursive: true });
  const manifest = yield* encodeManifest(mcpbManifest(McpbManifestFields.make(spec.manifest), targetSpec)).pipe(
    Effect.mapError((cause) => McpbPackageFailure.make({ cause, message: `Failed encoding the ${target} manifest.` }))
  );
  yield* fs.writeFileString(path.join(bundleDir, "manifest.json"), `${manifest}\n`);
  yield* staged.build;
  yield* copyDirectory(nativeSource, path.join(bundleDir, "node_modules", "@duckdb", nativePackage));
  // DuckDB publishes `duckdb.node` unsigned (`duckdb.dll` beside it is signed),
  // so it passes Windows application control on reputation only.
  yield* assertSignedBinaries({
    bundleDir,
    allowedUnsigned: [`node_modules/@duckdb/${nativePackage}/duckdb.node`],
  }).pipe(Effect.when(Effect.succeed(platform === "win32")));
  yield* fs.remove(archivePath, { force: true });
  yield* run(["zip", "-q", "-r", archivePath, "."], { cwd: bundleDir });
  yield* assertArchive({
    archivePath,
    files: staged.files,
    nativePackage,
    forbiddenFragments: spec.forbiddenArchiveFragments,
  });
  yield* Effect.logInfo("MCPB packaged", { archivePath, target });
});

/**
 * The `.mcpb` packaging command for one app, with `--target` and `--output`
 * flags.
 *
 * **Details**
 *
 * `--target` defaults to `all` (Linux then Windows); `--output` defaults to
 * `apps/<appName>/dist/mcpb`, resolved against the repository root. Each target
 * writes `<output>/<target>/` and `<output>/<appName>-<target>.mcpb`. The
 * Windows target downloads the pinned DuckDB win32 bindings and the pinned
 * Bun runtime into `<output>/.cache` once per pinned version, verifies their
 * digests before unpacking, and refuses to package an unsigned Windows
 * binary other than DuckDB's `duckdb.node`. The command needs a
 * `Digest` service; running it needs `bun`, `zip` and `unzip` (and `curl`,
 * `tar` for Windows) on `PATH`.
 *
 * **Example** (Build the command for an app)
 *
 * ```ts
 * import { makeMcpbPackageCommand, McpbManifestFields, McpbPackageSpec } from "@beep/mcpb-kit"
 *
 * const command = makeMcpbPackageCommand(
 *   McpbPackageSpec.make({
 *     appName: "example-mcp",
 *     commandName: "example-package",
 *     repoRoot: "/repo",
 *     forbiddenArchiveFragments: ["src/"],
 *     manifest: McpbManifestFields.make({
 *       name: "beep-example",
 *       displayName: "Beep Example",
 *       version: "0.1.0",
 *       description: "An example server.",
 *       env: {},
 *       userConfig: {},
 *       tools: [],
 *     }),
 *   })
 * )
 * console.log(command.name) // "example-package"
 * ```
 *
 * @param spec - The app's packaging spec.
 * @returns The app-specific command that packages the selected targets.
 * @category constructors
 * @since 0.0.0
 */
export const makeMcpbPackageCommand = (spec: McpbPackageSpec) =>
  Command.make(
    spec.commandName,
    {
      output: Flag.Directory("output").pipe(Flag.withDefault(`apps/${spec.appName}/dist/mcpb`)),
      target: Flag.Literals("target", McpbTargetSelection.literals).pipe(
        Flag.withDefault(McpbTargetSelection.Enum.all)
      ),
    },
    Effect.fnUntraced(function* ({ output, target }) {
      const targets = Match.value(target).pipe(
        Match.when("all", () => McpbTarget.literals),
        Match.when("linux-x64", () => [McpbTarget.Enum["linux-x64"]]),
        Match.when("windows-x64", () => [McpbTarget.Enum["windows-x64"]]),
        Match.exhaustive
      );
      yield* Effect.forEach(targets, (targetName) => packageTarget(spec, targetName, output), { discard: true });
    })
  );

/**
 * The app's packaging command, run against the process arguments, with the
 * Web Crypto `Digest` service it verifies downloads with.
 *
 * **Example** (Build the packaging program)
 *
 * ```ts
 * import { McpbManifestFields, McpbPackageSpec, mcpbPackageProgram } from "@beep/mcpb-kit"
 * import * as Effect from "effect/Effect"
 *
 * const program = mcpbPackageProgram(
 *   McpbPackageSpec.make({
 *     appName: "example-mcp",
 *     commandName: "example-package",
 *     repoRoot: "/repo",
 *     forbiddenArchiveFragments: ["src/"],
 *     manifest: McpbManifestFields.make({
 *       name: "beep-example",
 *       displayName: "Beep Example",
 *       version: "0.1.0",
 *       description: "An example server.",
 *       env: {},
 *       userConfig: {},
 *       tools: [],
 *     }),
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param spec - The app's packaging spec.
 * @category constructors
 * @since 0.0.0
 */
export const mcpbPackageProgram = flow(
  makeMcpbPackageCommand,
  Command.run({ version: "0.0.0" }),
  Effect.provide(Digest.layerWebCrypto)
);
