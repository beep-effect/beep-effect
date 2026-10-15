/**
 * Build `.mcpb` bundles: compile the app with `bun build --compile`, ship the
 * DuckDB native bindings beside it, zip, and audit the archive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { Command, Flag } from "effect/cli";
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
import { assertArchive, copyDirectory, ensureWindowsBindings, NativeAddonExternals, run } from "./internal/steps.ts";
import { McpbPackageFailure } from "./McpbKit.errors.ts";
import { McpbManifest, McpbManifestFields, McpbTarget, McpbTargetSelection, McpbTargetSpec } from "./McpbKit.models.ts";
import type { McpbPackageSpec } from "./McpbKit.models.ts";

/**
 * The compile and bindings settings of one target for an app's executable.
 *
 * **Example** (Read the Windows target)
 *
 * ```ts
 * import { mcpbTargetSpec } from "@beep/mcpb-kit"
 *
 * const spec = mcpbTargetSpec("windows-x64", "example-mcp")
 * console.log(spec.executable) // "example-mcp.exe"
 * ```
 *
 * @param target - Platform to build.
 * @param appName - Executable base name.
 * @category constructors
 * @since 0.0.0
 */
export const mcpbTargetSpec: {
  (appName: string): (target: McpbTarget) => McpbTargetSpec;
  (target: McpbTarget, appName: string): McpbTargetSpec;
} = dual(
  2,
  (target: McpbTarget, appName: string): McpbTargetSpec =>
    Match.value(target).pipe(
      Match.when("linux-x64", () =>
        McpbTargetSpec.make({
          target,
          bunTarget: "bun-linux-x64",
          executable: appName,
          nativePackage: "node-bindings-linux-x64",
          platform: "linux",
        })
      ),
      Match.when("windows-x64", () =>
        McpbTargetSpec.make({
          target,
          bunTarget: "bun-windows-x64",
          executable: `${appName}.exe`,
          nativePackage: "node-bindings-win32-x64",
          platform: "win32",
        })
      ),
      Match.exhaustive
    )
);

/**
 * The full `manifest.json` object of one target: the app's fields plus the
 * shared author, repository, license, platform and binary-server settings.
 *
 * **Details**
 *
 * The server command is the bundled executable, and `NODE_PATH` points at the
 * bundled `node_modules`: Bun-compiled executables resolve bare specifiers
 * against their embedded virtual root (`B:\\~BUN\\root`, `/$bunfs/root`),
 * never the adjacent `node_modules`, so the DuckDB native binding only loads
 * through `NODE_PATH`. Environment keys are written in sorted order.
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
} = dual(
  2,
  (fields: McpbManifestFields, { executable, platform }: McpbTargetSpec): McpbManifest =>
    McpbManifest.make({
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
    })
);

const encodeManifest = S.encodeEffect(S.fromJsonString(McpbManifest, { space: 2 }));

// fallow-ignore-next-line complexity -- operational packaging lane; exercised end-to-end by package:mcpb, not unit-covered
const packageTarget = Effect.fn("McpbPackage.packageTarget")(function* (
  spec: McpbPackageSpec,
  target: McpbTarget,
  outputRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { appName, repoRoot } = spec;
  const targetSpec = mcpbTargetSpec(target, appName);
  const { bunTarget, executable, nativePackage } = targetSpec;
  const resolvedOutputRoot = path.resolve(repoRoot, outputRoot);
  const bundleDir = path.resolve(resolvedOutputRoot, target);
  const archivePath = path.resolve(resolvedOutputRoot, `${appName}-${target}.mcpb`);
  const cacheDir = path.resolve(resolvedOutputRoot, ".cache");
  const nativeSource =
    target === "windows-x64"
      ? yield* ensureWindowsBindings(cacheDir, repoRoot)
      : path.resolve(repoRoot, "node_modules", "@duckdb", nativePackage);
  yield* fs.remove(bundleDir, { recursive: true, force: true });
  yield* fs.makeDirectory(bundleDir, { recursive: true });
  const manifest = yield* encodeManifest(mcpbManifest(McpbManifestFields.make(spec.manifest), targetSpec)).pipe(
    Effect.mapError((cause) => McpbPackageFailure.make({ cause, message: `Failed encoding the ${target} manifest.` }))
  );
  yield* fs.writeFileString(path.join(bundleDir, "manifest.json"), `${manifest}\n`);
  yield* run(
    [
      "bun",
      "build",
      "--compile",
      `--target=${bunTarget}`,
      `apps/${appName}/src/bin.ts`,
      `--outfile=${path.join(bundleDir, executable)}`,
      "--asset-naming=[name].[ext]",
      ...A.flatMap(NativeAddonExternals, (external) => ["--external", external]),
    ],
    { cwd: repoRoot }
  );
  yield* copyDirectory(nativeSource, path.join(bundleDir, "node_modules", "@duckdb", nativePackage));
  yield* fs.remove(archivePath, { force: true });
  yield* run(["zip", "-q", "-r", archivePath, "."], { cwd: bundleDir });
  yield* assertArchive({
    archivePath,
    appName,
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
 * writes `<output>/<target>/` and `<output>/<appName>-<target>.mcpb`; the
 * Windows target downloads the pinned DuckDB win32 bindings into
 * `<output>/.cache` once and verifies their sha512 before unpacking. Running it
 * needs `bun`, `zip` and `unzip` (and `curl`, `tar` for Windows) on `PATH`.
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
 * The app's packaging command, run against the process arguments.
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
export const mcpbPackageProgram = flow(makeMcpbPackageCommand, Command.run({ version: "0.0.0" }));
