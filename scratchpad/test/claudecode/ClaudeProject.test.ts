/** @effect-diagnostics strictEffectProvide:skip-file */
/**
 * Tests for the cached Claude project service.
 *
 * Uses a mutable in-memory file map so the tests can assert that cached values
 * stay stable until the explicit invalidation effects are run.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

import * as ClaudeProject from "../../claudecode/ClaudeProject.ts";

// ---------------------------------------------------------------------------
// Test layer builders
// ---------------------------------------------------------------------------

const HOME = "/home/user";
const CWD = "/repo";
const PROJECT_SETTINGS = `${CWD}/.claude/settings.json`;
const MCP_PATH = `${CWD}/.mcp.json`;
const SKILL_PATH = `${CWD}/skills/greet/SKILL.md`;
const encodeJson = S.encodeSync(S.fromJsonString(S.Unknown));

const notFoundError = (path: string, method: string) =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method,
    description: "No such file or directory",
    pathOrDescriptor: path,
  });

const hasEntry = (files: ReadonlyMap<string, string>, path: string): boolean =>
  files.has(path) || Array.from(files.keys()).some((key) => key.startsWith(`${path}/`));

const readDirectoryEntries = (files: ReadonlyMap<string, string>, dirPath: string): ReadonlyArray<string> => {
  const prefix = `${dirPath}/`;
  const entries = new Set<string>();

  for (const filePath of files.keys()) {
    if (!filePath.startsWith(prefix)) continue;
    const remainder = filePath.slice(prefix.length);
    const slashIndex = remainder.indexOf("/");
    entries.add(slashIndex === -1 ? remainder : remainder.slice(0, slashIndex));
  }

  return Array.from(entries).sort();
};

const makeTestLayer = (files: Map<string, string>) => {
  const fsLayer = FileSystem.layerNoop({
    exists: (path: string) => Effect.succeed(hasEntry(files, path)),
    readFileString: (path: string) => {
      const content = files.get(path);
      return content === undefined ? Effect.fail(notFoundError(path, "readFileString")) : Effect.succeed(content);
    },
    readDirectory: (path: string) =>
      hasEntry(files, path)
        ? Effect.succeed([...readDirectoryEntries(files, path)])
        : Effect.fail(notFoundError(path, "readDirectory")),
  });

  const baseLayer = Layer.mergeAll(fsLayer, Path.layer, ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME })));

  return ClaudeProject.layer({ cwd: CWD }).pipe(Layer.provide(baseLayer));
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClaudeProject", () => {
  it.effect("caches settings until invalidate.settings is run", () =>
    (() => {
      const files = new Map([[PROJECT_SETTINGS, encodeJson({ model: "claude-opus-4-6" })]]);
      return Effect.gen(function* () {
        const project = yield* ClaudeProject.Service;

        const first = yield* project.settings;
        expect(first.model).toEqual(O.some("claude-opus-4-6"));

        files.set(PROJECT_SETTINGS, encodeJson({ model: "claude-sonnet-4-6" }));

        const second = yield* project.settings;
        expect(second.model).toEqual(O.some("claude-opus-4-6"));

        yield* project.invalidate.settings;

        const third = yield* project.settings;
        expect(third.model).toEqual(O.some("claude-sonnet-4-6"));
      }).pipe(Effect.provide(makeTestLayer(files)));
    })()
  );

  it.effect("caches optional mcp config until invalidate.mcp is run", () =>
    (() => {
      const files = new Map<string, string>();
      return Effect.gen(function* () {
        const project = yield* ClaudeProject.Service;

        const first = yield* project.mcp;
        expect(O.isNone(first)).toBe(true);

        files.set(
          MCP_PATH,
          encodeJson({
            mcpServers: { fs: { type: "stdio", command: "mcp-fs" } },
          })
        );

        const second = yield* project.mcp;
        expect(O.isNone(second)).toBe(true);

        yield* project.invalidate.mcp;

        const third = yield* project.mcp;
        expect(O.isSome(third)).toBe(true);
      }).pipe(Effect.provide(makeTestLayer(files)));
    })()
  );

  it.effect("caches plugin data and refreshes name lookups after invalidate.plugin", () =>
    (() => {
      const files = new Map([[SKILL_PATH, "---\nname: greet\ndescription: Say hello\n---\n\n# Greet\n"]]);
      return Effect.gen(function* () {
        const project = yield* ClaudeProject.Service;

        const first = yield* project.skill("greet");
        expect(O.isSome(first)).toBe(true);
        if (O.isSome(first)) {
          expect(first.value.frontmatter.description).toEqual(O.some("Say hello"));
        }

        files.set(SKILL_PATH, "---\nname: greet\ndescription: Updated greeting\n---\n\n# Greet\n");

        const second = yield* project.skill("greet");
        expect(O.isSome(second)).toBe(true);
        if (O.isSome(second)) {
          expect(second.value.frontmatter.description).toEqual(O.some("Say hello"));
        }

        yield* project.invalidate.plugin;

        const third = yield* project.skill("greet");
        expect(O.isSome(third)).toBe(true);
        if (O.isSome(third)) {
          expect(third.value.frontmatter.description).toEqual(O.some("Updated greeting"));
        }
      }).pipe(Effect.provide(makeTestLayer(files)));
    })()
  );
});
