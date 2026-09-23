/**
 * Focused tests for the layered Claude Code settings loader.
 *
 * @since 0.0.0
 */
import { expect, it } from "@effect/vitest";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as HashMap from "effect/HashMap";
import * as Ref from "effect/Ref";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";

import { SettingsDecodeError, SettingsParseError } from "../../../claudecode/Errors.ts";
import * as Loader from "../../../claudecode/Settings/Loader.ts";
import { SettingsFile, SettingsRaw } from "../../../claudecode/Settings/Schema.ts";

const HOME = "/home/user";
const CWD = "/repo";
const USER_PATH = `${HOME}/.claude/settings.json`;
const PROJECT_PATH = `${CWD}/.claude/settings.json`;
const LOCAL_PATH = `${CWD}/.claude/settings.local.json`;
const CLI_PATH = "/tmp/cli-settings.json";
const MANAGED_ROOT = "/managed/ClaudeCode";
const MANAGED_PATH = `${MANAGED_ROOT}/managed-settings.json`;
const MANAGED_DROP_IN_10 = `${MANAGED_ROOT}/managed-settings.d/10-base.json`;
const MANAGED_DROP_IN_20 = `${MANAGED_ROOT}/managed-settings.d/20-security.json`;
const MANAGED_HIDDEN_DROP_IN = `${MANAGED_ROOT}/managed-settings.d/.ignored.json`;

const notFoundError = (path: string) =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method: "readFileString",
    description: "No such file or directory",
    pathOrDescriptor: path,
  });

const directoryEntries = (files: HashMap.HashMap<string, string>, directory: string): Array<string> => {
  const prefix = `${directory}/`;
  const entries = files.pipe(
    HashMap.keys,
    A.fromIterable,
    A.filter(Str.startsWith(prefix)),
    A.map(Str.replace(prefix, ""))
  );
  return A.filter(entries, (entry) => !Str.includes("/")(entry));
};

const $I = $ScratchpadId.create("test/claudecode/Settings/Loader.test");

class TestFiles extends Context.Service<TestFiles, Ref.Ref<HashMap.HashMap<string, string>>>()($I`TestFiles`) {}

const TestFilesLayer = Layer.effect(TestFiles, Ref.make(HashMap.empty<string, string>()));
const TestFileSystemLayer = Layer.effect(FileSystem.FileSystem, Effect.gen(function* () {
  const files = yield* TestFiles;
  return FileSystem.makeNoop({
    exists: (path) => Ref.get(files).pipe(Effect.map((entries) => HashMap.has(entries, path) || A.isReadonlyArrayNonEmpty(directoryEntries(entries, path)))),
    readDirectory: (path) => Ref.get(files).pipe(Effect.map((entries) => directoryEntries(entries, path))),
    readFileString: (path) => Ref.get(files).pipe(Effect.flatMap((entries) => Effect.fromOption(HashMap.get(entries, path), () => notFoundError(path)))),
  });
})).pipe(Layer.provideMerge(TestFilesLayer));
const TestLayer = Layer.mergeAll(TestFileSystemLayer, Path.layer, ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME })));

const SettingsJson = S.fromJsonString(SettingsRaw);
const settingsJson = S.encodeEffect(SettingsJson);
const encodeSettings = S.encodeEffect(SettingsFile);

it.layer(TestLayer)("Settings paths", (it) => {
  it.effect("resolves user, project, and local settings paths", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([]));

      expect(yield* Loader.userSettingsPath).toBe(USER_PATH);
      expect(yield* Loader.projectSettingsPath(CWD)).toBe(PROJECT_PATH);
      expect(yield* Loader.localSettingsPath(CWD)).toBe(LOCAL_PATH);
    
})
  );
});

it.layer(TestLayer)("Settings.load", (it) => {
  it.effect("returns an Option-backed empty settings value", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([]));

      const settings = yield* Loader.load(CWD);
      expect(settings.model).toEqual(O.none());
      expect(settings.hooks).toEqual(O.none());
      expect(settings.permissions).toEqual(O.none());
      expect(settings.raw).toEqual(O.some({}));
      const encoded = yield* encodeSettings(settings);
      expect(encoded).toEqual({ raw: {} });
    
})
  );

  it.effect("loads a single user settings source", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              USER_PATH,
              (yield* settingsJson({
                model: "claude-opus-4-6",
                theme: "dark",
              })),
            ],
          ]));

      const settings = yield* Loader.load(CWD);
      expect(settings.model).toEqual(O.some("claude-opus-4-6"));
      expect(settings.theme).toEqual(O.some("dark"));
      expect(yield* encodeSettings(settings)).toMatchObject({
        model: "claude-opus-4-6",
        theme: "dark",
      });
    
})
  );

  it.effect("applies local over project over user precedence", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              USER_PATH,
              (yield* settingsJson({
                model: "claude-opus-4-6",
                language: "japanese",
              })),
            ],
            [PROJECT_PATH, (yield* settingsJson({ model: "claude-sonnet-4-6" }))],
            [LOCAL_PATH, (yield* settingsJson({ model: "claude-haiku-4-5" }))],
          ]));

      const settings = yield* Loader.load(CWD);
      expect(settings.model).toEqual(O.some("claude-haiku-4-5"));
      expect(settings.language).toEqual(O.some("japanese"));
    
})
  );

  it.effect("applies CLI settings above local settings", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              LOCAL_PATH,
              (yield* settingsJson({
                model: "claude-haiku-4-5",
                language: "spanish",
              })),
            ],
            [CLI_PATH, (yield* settingsJson({ model: "claude-opus-4-6" }))],
          ]));

      const settings = yield* Loader.load(CWD, {
        settingsPath: CLI_PATH,
      });
      expect(settings.model).toEqual(O.some("claude-opus-4-6"));
      expect(settings.language).toEqual(O.some("spanish"));
    
})
  );

  it.effect("merges managed base and sorted drop-ins above CLI settings", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              CLI_PATH,
              (yield* settingsJson({
                model: "claude-haiku-4-5",
                allowedHttpHookUrls: ["https://cli.example/*"],
              })),
            ],
            [
              MANAGED_PATH,
              (yield* settingsJson({
                model: "claude-opus-4-6",
                allowedHttpHookUrls: ["https://base.example/*"],
              })),
            ],
            [
              MANAGED_DROP_IN_20,
              (yield* settingsJson({
                model: "claude-sonnet-4-6",
                allowedHttpHookUrls: ["https://twenty.example/*"],
              })),
            ],
            [
              MANAGED_DROP_IN_10,
              (yield* settingsJson({
                allowedHttpHookUrls: ["https://ten.example/*"],
              })),
            ],
            [
              MANAGED_HIDDEN_DROP_IN,
              (yield* settingsJson({
                model: "ignored-model",
                allowedHttpHookUrls: ["https://ignored.example/*"],
              })),
            ],
          ]));

      const settings = yield* Loader.load(CWD, {
        settingsPath: CLI_PATH,
        managedSettingsRoot: MANAGED_ROOT,
      });
      expect(settings.model).toEqual(O.some("claude-sonnet-4-6"));
      expect(settings.allowedHttpHookUrls).toEqual(
        O.some(["https://cli.example/*", "https://base.example/*", "https://ten.example/*", "https://twenty.example/*"])
      );
    
})
  );

  it.effect("deep-merges objects and de-duplicates arrays", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              USER_PATH,
              (yield* settingsJson({
                permissions: {
                  defaultMode: "default",
                  allow: ["Read(./src/**)"],
                  deny: ["Read(./.env)"],
                  additionalDirectories: ["/shared"],
                },
                env: {
                  SHARED: "user",
                  USER_ONLY: "1",
                },
              })),
            ],
            [
              PROJECT_PATH,
              (yield* settingsJson({
                permissions: {
                  defaultMode: "manual",
                  allow: ["Read(./src/**)", "Write(./tmp/**)"],
                  additionalDirectories: ["/shared", "/project"],
                },
                env: {
                  SHARED: "project",
                  PROJECT_ONLY: "1",
                },
              })),
            ],
          ]));

      const settings = yield* Loader.load(CWD);
      expect(yield* encodeSettings(settings)).toMatchObject({
        permissions: {
          defaultMode: "manual",
          allow: ["Read(./src/**)", "Write(./tmp/**)"],
          deny: ["Read(./.env)"],
          additionalDirectories: ["/shared", "/project"],
        },
        env: {
          SHARED: "project",
          USER_ONLY: "1",
          PROJECT_ONLY: "1",
        },
      });
    
})
  );

  it.effect("preserves and deep-merges unknown top-level settings in raw", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              USER_PATH,
              (yield* settingsJson({
                futureClaudeCodeSetting: {
                  flags: ["user"],
                  userOnly: true,
                },
              })),
            ],
            [
              PROJECT_PATH,
              (yield* settingsJson({
                futureClaudeCodeSetting: {
                  flags: ["project"],
                  projectOnly: true,
                },
              })),
            ],
          ]));

      const settings = yield* Loader.load(CWD);
      expect(settings.raw).toEqual(
        O.some({
          futureClaudeCodeSetting: {
            flags: ["user", "project"],
            userOnly: true,
            projectOnly: true,
          },
        })
      );
    
})
  );

  it.effect("decodes current hooks and marketplace source shapes", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              PROJECT_PATH,
              (yield* settingsJson({
                hooks: {
                  PreToolUse: [
                    {
                      matcher: "Bash",
                      hooks: [
                        {
                          type: "command",
                          command: "bun hook.ts",
                          args: ["--strict"],
                          asyncRewake: true,
                        },
                        {
                          type: "mcp_tool",
                          server: "policy",
                          tool: "check",
                        },
                      ],
                    },
                  ],
                },
                extraKnownMarketplaces: {
                  company: {
                    autoUpdate: true,
                    source: {
                      source: "git",
                      url: "https://git.example.com/plugins.git",
                      skipLfs: true,
                    },
                  },
                  trustedHosts: {
                    source: {
                      source: "hostPattern",
                      hostPattern: "^plugins\\.example\\.com$",
                    },
                  },
                  inline: {
                    source: {
                      source: "settings",
                      name: "inline",
                      plugins: [],
                    },
                  },
                },
              })),
            ],
          ]));

      const settings = yield* Loader.load(CWD);
      expect(yield* encodeSettings(settings)).toMatchObject({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "bun hook.ts",
                  args: ["--strict"],
                  asyncRewake: true,
                },
                {
                  type: "mcp_tool",
                  server: "policy",
                  tool: "check",
                },
              ],
            },
          ],
        },
        extraKnownMarketplaces: {
          company: {
            autoUpdate: true,
            source: {
              source: "git",
              url: "https://git.example.com/plugins.git",
              skipLfs: true,
            },
          },
          trustedHosts: {
            source: {
              source: "hostPattern",
              hostPattern: "^plugins\\.example\\.com$",
            },
          },
          inline: {
            source: {
              source: "settings",
              name: "inline",
              plugins: [],
            },
          },
        },
      });
    
})
  );
});

it.layer(TestLayer)("Settings.load errors", (it) => {
  it.effect("reports malformed JSON with its source path", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([[USER_PATH, "this is not json"]]));

      const error = yield* Effect.flip(Loader.load(CWD));
      expect(error).toBeInstanceOf(SettingsParseError);
      expect(error).toMatchObject({
        _tag: "SettingsParseError",
        path: USER_PATH,
      });
    
})
  );

  it.effect("reports invalid known settings with their source path", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [
              PROJECT_PATH,
              (yield* settingsJson({
                worktree: { bgIsolation: true },
              })),
            ],
          ]));

      const error = yield* Effect.flip(Loader.load(CWD));
      expect(error).toBeInstanceOf(SettingsDecodeError);
      expect(error).toMatchObject({
        _tag: "SettingsDecodeError",
        path: PROJECT_PATH,
      });
    
})
  );

  it.effect("aborts when a higher-priority source is malformed", () => Effect.gen(function* () {
 const files = yield* TestFiles;
 yield* Ref.set(files, HashMap.fromIterable([
            [USER_PATH, (yield* settingsJson({ model: "claude-opus-4-6" }))],
            [LOCAL_PATH, "{ not valid"],
          ]));

      const error = yield* Effect.flip(Loader.load(CWD));
      expect(error).toBeInstanceOf(SettingsParseError);
      expect(error).toMatchObject({
        _tag: "SettingsParseError",
        path: LOCAL_PATH,
      });
    
})
  );
});
