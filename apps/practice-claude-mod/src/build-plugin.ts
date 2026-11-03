#!/usr/bin/env bun
import { identity } from "effect/Function";

/**
 * Builds the practice plugin into `dist/`: a directory marketplace
 * (`dist/.claude-plugin/marketplace.json`) whose one plugin lives at
 * `dist/plugin` with its bundled hooks module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeClaudeModId } from "@beep/identity/packages";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PracticeClaudeModId.create("build-plugin");

const PluginName = "oip-practice";
const PluginVersion = "0.1.0";
const MarketplaceName = "oip-practice-local";

const TopLevelFunctionVar = /^var (\w+) = (async \(|\(|function\b)/gm;

/**
 * The bundler refused the hooks module.
 *
 * **Example** (Make a build failure)
 *
 * ```ts
 * import { PluginBuildFailed } from "@/build-plugin"
 *
 * console.log(PluginBuildFailed.make({ message: "bun build exited 1" })._tag) // "PluginBuildFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PluginBuildFailed extends S.TaggedError<PluginBuildFailed, { readonly brand: unique symbol }>(
  $I`PluginBuildFailed`
)(
  "PluginBuildFailed",
  { message: S.String },
  $I.annote("PluginBuildFailed", { description: "Bundling the plugin's hooks module failed." })
) {}

const json = (value: unknown): string =>
  `${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown, { space: 2 }))(value), identity)}\n`;

const bundle = (entry: string, outfile: string) =>
  Effect.tryPromise({
    try: () => {
      const child = Bun.spawn(
        // Unminified: the engine reads `$` and `on` by name in the bundled module.
        ["bun", "build", entry, "--target=browser", "--format=esm", `--outfile=${outfile}`],
        { stderr: "pipe", stdout: "pipe" }
      );
      return child.exited.then((code) =>
        code === 0
          ? undefined
          : new Response(child.stderr)
              .text()
              .then((stderr) => Promise.reject(PluginBuildFailed.make({ message: stderr })))
      );
    },
    catch: (cause) => (S.is(PluginBuildFailed)(cause) ? cause : PluginBuildFailed.make({ message: String(cause) })),
  });

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const appRoot = path.resolve(import.meta.dir, "..");
  const dist = path.join(appRoot, "dist");
  const plugin = path.join(dist, "plugin");

  yield* fs.remove(dist, { recursive: true, force: true });
  yield* fs.makeDirectory(path.join(plugin, ".claude-plugin"), { recursive: true });
  yield* fs.makeDirectory(path.join(plugin, "hooks"), { recursive: true });
  yield* fs.makeDirectory(path.join(dist, ".claude-plugin"), { recursive: true });

  // Claude Code reads the hooks module statically: `register` must be a
  // function declaration and every hook a function literal, so the entry is
  // generated here and calls the Effect-first bodies in PracticeMod.hooks.ts.
  const entryDir = path.join(dist, ".entry");
  const entry = path.join(entryDir, "register.js");
  const hooksJs = path.join(plugin, "hooks", "register.js");
  yield* fs.makeDirectory(entryDir, { recursive: true });
  yield* fs.writeFileString(
    entry,
    A.join(
      [
        "import {",
        "  configure,",
        "  matterCommand,",
        "  timeCommand,",
        "  practiceCommand,",
        "  registerCommands,",
        "  rememberAnswer,",
        "  toolRow,",
        "  verdictBand,",
        "  verdictCommand,",
        `} from "${path.join(appRoot, "src", "PracticeMod.hooks.ts")}";`,
        "",
        "export function register(on, options) {",
        "  configure(options);",
        '  on("session.start", async ($, e, next) => {',
        "    await registerCommands($)();",
        "    return next(e);",
        "  });",
        '  on("turn.complete", async ($, e, next) => {',
        "    await rememberAnswer($)(e);",
        "    return next(e);",
        "  });",
        '  on("command.run", { command: "matter" }, ($, e) => matterCommand($)(e.args));',
        '  on("command.run", { command: "time" }, ($, e) => timeCommand($)(e.args));',
        '  on("command.run", { command: "right" }, ($, e) => verdictCommand($)("right", e.args));',
        '  on("command.run", { command: "wrong" }, ($, e) => verdictCommand($)("wrong", e.args));',
        '  on("command.run", { command: "partly" }, ($, e) => verdictCommand($)("partly", e.args));',
        '  on("command.run", { command: "practice" }, ($, e) => practiceCommand($)(e.args));',
        '  on("ui.render", { component: "ToolUse" }, ($, e, next) => {',
        "    const row = toolRow($)(e);",
        "    return row === undefined ? next(e) : row;",
        "  });",
        '  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {',
        "    const band = verdictBand($)(e);",
        "    return band === undefined ? next(e) : band;",
        "  });",
        "}",
        "",
      ],
      "\n"
    )
  );
  yield* bundle(entry, hooksJs);
  yield* fs.remove(entryDir, { recursive: true });
  // The bundler emits top-level bindings as `var`; the engine follows `$`
  // only through functions bound by `const` or declared with `function`.
  // Function-valued bindings are never reassigned, so `const` is safe.
  const bundled = yield* fs.readFileString(hooksJs);
  yield* fs.writeFileString(hooksJs, Str.replace(TopLevelFunctionVar, "const $1 = $2")(bundled));

  yield* fs.writeFileString(
    path.join(plugin, ".claude-plugin", "plugin.json"),
    json({
      name: PluginName,
      version: PluginVersion,
      description:
        "Plain-language practice tool rows, Right/Wrong verdicts on answers, and firm skills for Oppold IP Law sessions.",
      homepage: "https://github.com/beep-effect/beep-effect/tree/main/apps/practice-claude-mod",
      author: { name: "Oppold IP Law" },
    })
  );
  yield* fs.writeFileString(path.join(plugin, "hooks", "hooks.json"), json({ modules: ["./register.js"] }));
  yield* fs.writeFileString(
    path.join(dist, ".claude-plugin", "marketplace.json"),
    json({
      name: MarketplaceName,
      owner: { name: "Oppold IP Law" },
      description: "Oppold IP Law's local plugins for Claude Code.",
      plugins: [{ name: PluginName, source: "./plugin", description: "Oppold IP Law practice mod" }],
    })
  );

  // The engine runs the plugin's *.test.ts with `claude plugin test`.
  yield* fs.makeDirectory(path.join(plugin, "test"), { recursive: true });
  const tests = yield* fs.readDirectory(path.join(appRoot, "plugin-test"));
  yield* Effect.forEach(
    tests,
    (name) => fs.copyFile(path.join(appRoot, "plugin-test", name), path.join(plugin, "test", name)),
    { discard: true }
  );

  // Skills are plugin components discovered from their directories.
  const skills = path.join(appRoot, "skills");
  const pluginSkills = path.join(plugin, "skills");
  yield* fs.makeDirectory(pluginSkills, { recursive: true });
  const skillEntries = yield* fs.readDirectory(skills);
  yield* Effect.forEach(skillEntries, (name) => fs.copy(path.join(skills, name), path.join(pluginSkills, name)), {
    discard: true,
  });

  const size = yield* fs.stat(hooksJs);
  yield* Effect.log(`built ${PluginName} ${PluginVersion}: hooks module ${size.size} bytes`);
});

BunRuntime.runMain(program.pipe(Layer.effectDiscard, Layer.provide(BunServices.layer), Layer.build, Effect.scoped));
