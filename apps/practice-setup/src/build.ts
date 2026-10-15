#!/usr/bin/env bun

/**
 * Builds `practice-setup.exe`: a bun-compiled Windows executable that embeds
 * the practice gateway `.mcpb` it hands to Claude.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { mcpbTargetSpec } from "@beep/mcpb-kit";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { BESIDE_BUNDLE_FILE } from "./bin.ts";
import { SetupFailure } from "./Setup.errors.ts";
import { GatewayBundleManifest } from "./Setup.models.ts";

/**
 * The generated entry module that embeds the bundle and starts the
 * bootstrapper with it.
 *
 * **Details**
 *
 * `bun build --compile` embeds a file only through a static import, so the
 * build writes this module next to its copy of the bundle, under
 * `apps/practice-setup/dist/embed`, instead of importing a bundle that may not
 * exist from `src`. It also stamps in the bundle's manifest version, so the
 * bootstrapper can tell an up-to-date gateway install from an old one.
 *
 * **Example** (Render the entry)
 *
 * ```ts
 * import { embeddedEntrySource } from "@/build"
 *
 * console.log(embeddedEntrySource("../../src", "0.1.0").includes('type: "file"')) // true
 * ```
 *
 * @param srcImport - Import specifier of the app's `src` folder relative to the entry.
 * @param version - Manifest version of the embedded bundle.
 * @category constructors
 * @since 0.0.0
 */
export const embeddedEntrySource: {
  (version: string): (srcImport: string) => string;
  (srcImport: string, version: string): string;
} = dual(2, (srcImport: string, version: string): string =>
  [
    `import bundle from "./${BESIDE_BUNDLE_FILE}" with { type: "file" };`,
    `import * as O from "effect/Option";`,
    `import { main } from ${JSON.stringify(`${srcImport}/bin.ts`)};`,
    `import { EmbeddedGateway } from ${JSON.stringify(`${srcImport}/Setup.models.ts`)};`,
    "",
    `main(O.some(EmbeddedGateway.make({ bundle, version: ${JSON.stringify(version)} })));`,
    "",
  ].join("\n")
);

const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(GatewayBundleManifest));

const bundle = Flag.File("bundle", { mustExist: true }).pipe(
  Flag.withDescription("The practice gateway Windows .mcpb to embed (from `bun run package:mcpb:windows`).")
);
const output = Flag.Directory("output").pipe(
  Flag.withDescription("Output directory for practice-setup.exe."),
  Flag.withDefault("apps/practice-setup/dist")
);

const build = Command.make(
  "practice-setup-build",
  { bundle, output },
  Effect.fnUntraced(function* (flags) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const repoRoot = path.resolve(import.meta.dirname, "../../..");
    const outputDir = path.resolve(repoRoot, flags.output);
    // The generated entry stays inside the app so its imports resolve from the workspace.
    const embedDir = path.join(repoRoot, "apps/practice-setup/dist/embed");
    const { bunTarget, executable } = mcpbTargetSpec("windows-x64", "practice-setup");

    // mcpb-kit already needs unzip to audit its archives.
    const manifestJson = yield* Effect.scoped(
      spawner
        .spawn(
          ChildProcess.make("unzip", ["-p", path.resolve(flags.bundle), "manifest.json"], {
            stdin: "ignore",
            stdout: "pipe",
            stderr: "inherit",
          })
        )
        .pipe(
          Effect.flatMap((child) =>
            child.stdout.pipe(
              Stream.decodeText(),
              Stream.runFold(() => Str.empty, Str.concat)
            )
          )
        )
    );
    const { version } = yield* decodeManifest(manifestJson);

    yield* fs.makeDirectory(embedDir, { recursive: true });
    yield* fs.copyFile(path.resolve(flags.bundle), path.join(embedDir, BESIDE_BUNDLE_FILE));
    const entry = path.join(embedDir, "entry.ts");
    const srcImport = path.relative(embedDir, path.join(repoRoot, "apps/practice-setup/src"));
    yield* fs.writeFileString(entry, embeddedEntrySource(srcImport, version));

    const exitCode = yield* Effect.scoped(
      spawner
        .spawn(
          ChildProcess.make(
            "bun",
            ["build", "--compile", `--target=${bunTarget}`, entry, `--outfile=${path.join(outputDir, executable)}`],
            { cwd: repoRoot, stdin: "ignore", stdout: "inherit", stderr: "inherit" }
          )
        )
        .pipe(Effect.flatMap((child) => child.exitCode))
    );
    if (Number(exitCode) !== 0) {
      return yield* SetupFailure.make({ message: `bun build exited ${exitCode}.` });
    }
    yield* Effect.logInfo("practice-setup built", { executable: path.join(outputDir, executable), gateway: version });
  })
);

if (import.meta.main) {
  Command.run(build, { version: "0.0.0" }).pipe(
    Layer.effectDiscard,
    Layer.provide(BunServices.layer),
    Layer.build,
    Effect.scoped,
    BunRuntime.runMain
  );
}
