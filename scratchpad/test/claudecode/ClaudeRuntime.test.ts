/** @effect-diagnostics strictEffectProvide:skip-file */
/**
 * Tests for the shared Claude runtime.
 *
 * Verifies that the default runtime prewires the platform services the
 * library needs, and that callers can replace the platform layer in tests
 * while merging in additional services of their own.
 *
 * @since 0.1.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

import * as ClaudeProject from "../../claudecode/ClaudeProject.ts";
import * as ClaudeRuntime from "../../claudecode/ClaudeRuntime.ts";
import * as Plugin from "../../claudecode/Plugin.ts";
import * as Settings from "../../claudecode/Settings.ts";
import * as Testing from "../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface WriteCapture {
  readonly writes: Map<string, string>;
  readonly dirs: Set<string>;
  readonly layer: Layer.Layer<FileSystem.FileSystem | Path.Path>;
}

const HOME = "/home/user";
const CWD = "/repo";
const PROJECT_SETTINGS = `${CWD}/.claude/settings.json`;
const PLUGIN_ROOT = "/plugin";
const SKILL_PATH = `${PLUGIN_ROOT}/skills/review/SKILL.md`;
const $I = $ScratchpadId.create("test/claudecode/ClaudeRuntime.test");
const encodeJson = S.encodeSync(S.fromJsonString(S.Unknown));

const permissionDeniedError = (path: string) =>
  PlatformError.systemError({
    _tag: "PermissionDenied",
    module: "FileSystem",
    method: "writeFileString",
    description: "Permission denied",
    pathOrDescriptor: path,
  });

const makeCapture = (options?: { readonly failOn?: (path: string) => boolean }): WriteCapture => {
  const writes = new Map<string, string>();
  const dirs = new Set<string>();
  const shouldFail = options?.failOn ?? (() => false);

  const fsLayer = FileSystem.layerNoop({
    writeFileString: (path: string, content: string) =>
      shouldFail(path)
        ? Effect.fail(permissionDeniedError(path))
        : Effect.sync(() => {
            writes.set(path, content);
          }),
    makeDirectory: (path: string) =>
      shouldFail(path)
        ? Effect.fail(permissionDeniedError(path))
        : Effect.sync(() => {
            dirs.add(path);
          }),
  });

  return {
    writes,
    dirs,
    layer: Layer.mergeAll(fsLayer, Path.layer),
  };
};

class ExtraService extends Context.Service<
  ExtraService,
  {
    readonly value: string;
  }
>()($I`ExtraService`) {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClaudeRuntime", () => {
  it("prewires the default platform services", () => {
    const runtime = ClaudeRuntime.default();
    return runtime
      .runPromise(Settings.projectSettingsPath("/repo"))
      .then((path) => expect(path).toBe("/repo/.claude/settings.json"))
      .finally(() => runtime.dispose());
  });

  it("project preset adds ClaudeProject and exposes its configured layer", () => {
    const fileSystem = Testing.makeMockFileSystem({
      [PROJECT_SETTINGS]: encodeJson({ model: "claude-sonnet-4-6" }),
    });
    const runtime = ClaudeRuntime.project({
      cwd: CWD,
      platformLayer: fileSystem.layer,
      layer: ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME })),
    });

    const result = runtime.runPromise(
      Effect.gen(function* () {
        const project = yield* ClaudeProject.Service;
        const settings = yield* project.settings;
        return {
          cwd: project.cwd,
          model: settings.model,
        };
      })
    );

    const viaLayer = Effect.runPromise(
      Effect.gen(function* () {
        const project = yield* ClaudeProject.Service;
        return project.cwd;
      }).pipe(Effect.provide(runtime.layer))
    );

    return Promise.all([result, viaLayer])
      .then(([projectResult, layerResult]) => {
        expect(projectResult).toEqual({ cwd: CWD, model: O.some("claude-sonnet-4-6") });
        expect(layerResult).toBe(CWD);
      })
      .finally(() => runtime.dispose());
  });

  it("plugin preset uses pluginRoot for named component lookups", () => {
    const fileSystem = Testing.makeMockFileSystem({
      [SKILL_PATH]: "---\nname: review\ndescription: Review staged diffs\n---\n\n# Review\n",
    });
    const runtime = ClaudeRuntime.plugin({
      cwd: CWD,
      pluginRoot: PLUGIN_ROOT,
      platformLayer: fileSystem.layer,
      layer: ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME })),
    });

    return runtime
      .runPromise(
        Effect.gen(function* () {
          const project = yield* ClaudeProject.Service;
          const skill = yield* project.skill("review");
          return {
            cwd: project.cwd,
            pluginRoot: project.pluginRoot,
            hasReviewSkill: O.isSome(skill),
          };
        })
      )
      .then((result) =>
        expect(result).toEqual({
          cwd: CWD,
          pluginRoot: PLUGIN_ROOT,
          hasReviewSkill: true,
        })
      )
      .finally(() => runtime.dispose());
  });

  it("accepts a replacement platform layer and merged extra services", () => {
    const capture = makeCapture();
    const runtime = ClaudeRuntime.default({
      platformLayer: capture.layer,
      layer: Layer.succeed(ExtraService, ExtraService.of({ value: "extra-runtime-service" })),
    });

    return runtime
      .runPromise(
        Effect.gen(function* () {
          const extra = yield* ExtraService;
          yield* Plugin.write(
            Plugin.define({
              manifest: { name: "runtime-plugin", version: "0.1.0" },
            }),
            "/dest"
          );
          return extra.value;
        })
      )
      .then((extraValue) => {
        expect(extraValue).toBe("extra-runtime-service");
        expect(capture.dirs.has("/dest/.claude-plugin")).toBe(true);
        expect(capture.writes.get("/dest/.claude-plugin/plugin.json")).toContain('"name": "runtime-plugin"');
      })
      .finally(() => runtime.dispose());
  });

  it("suppresses logs when logger is none", () => {
    const messages: Array<string> = [];
    const runtime = ClaudeRuntime.default({
      layer: Logger.layer([
        Logger.make((options) => {
          messages.push(String(options.message));
        }),
      ]),
      logger: "none",
    });

    return runtime
      .runPromise(Effect.log("hidden log entry"))
      .then(() => expect(messages).toEqual([]))
      .finally(() => runtime.dispose());
  });
});
