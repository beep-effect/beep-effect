/**
 * Focused tests for the layered Claude Code settings loader.
 *
 * @since 0.0.0
 */
import { describe, expect, it } from "@effect/vitest";
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

const directoryEntries = (files: ReadonlyMap<string, string>, directory: string): Array<string> => {
  const prefix = `${directory}/`;
  const entries = A.map(
    A.filter(A.fromIterable(files.keys()), (path) => Str.startsWith(prefix)(path)),
    Str.replace(prefix, "")
  );
  return A.filter(entries, (entry) => !Str.includes("/")(entry));
};

const makeFileSystemLayer = (files: ReadonlyMap<string, string>): Layer.Layer<FileSystem.FileSystem> =>
  FileSystem.layerNoop({
    exists: (path: string) =>
      Effect.succeed(files.has(path) || A.isReadonlyArrayNonEmpty(directoryEntries(files, path))),
    readDirectory: (path: string) => Effect.succeed(directoryEntries(files, path)),
    readFileString: (path: string) =>
      Effect.fromOption(O.fromNullishOr(files.get(path)), () => notFoundError(path)),
  });

const makeTestLayer = (files: ReadonlyMap<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
  Layer.mergeAll(makeFileSystemLayer(files), Path.layer, ConfigProvider.layer(ConfigProvider.fromUnknown({ HOME })));

const fsWith = (entries: ReadonlyArray<readonly [string, string]>): ReadonlyMap<string, string> => new Map(entries);

const SettingsJson = S.fromJsonString(SettingsRaw);
const settingsJson = S.encodeSync(SettingsJson);
const encodeSettings = S.encodeEffect(SettingsFile);

describe("Settings paths", () => {
  it.effect("resolves user, project, and local settings paths", () =>
    Effect.gen(function* () {
      expect(yield* Loader.userSettingsPath).toBe(USER_PATH);
      expect(yield* Loader.projectSettingsPath(CWD)).toBe(PROJECT_PATH);
      expect(yield* Loader.localSettingsPath(CWD)).toBe(LOCAL_PATH);
    }).pipe(Effect.provide(makeTestLayer(fsWith([]))))
  );
});

describe("Settings.load", () => {
  it.effect("returns an Option-backed empty settings value", () =>
    Effect.gen(function* () {
      const settings = yield* Loader.load(CWD);
      expect(settings.model).toEqual(O.none());
      expect(settings.hooks).toEqual(O.none());
      expect(settings.permissions).toEqual(O.none());
      expect(settings.raw).toEqual(O.some({}));
      const encoded = yield* encodeSettings(settings);
      expect(encoded).toEqual({ raw: {} });
    }).pipe(Effect.provide(makeTestLayer(fsWith([]))))
  );

  it.effect("loads a single user settings source", () =>
    Effect.gen(function* () {
      const settings = yield* Loader.load(CWD);
      expect(settings.model).toEqual(O.some("claude-opus-4-6"));
      expect(settings.theme).toEqual(O.some("dark"));
      expect(yield* encodeSettings(settings)).toMatchObject({
        model: "claude-opus-4-6",
        theme: "dark",
      });
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              USER_PATH,
              settingsJson({
                model: "claude-opus-4-6",
                theme: "dark",
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("applies local over project over user precedence", () =>
    Effect.gen(function* () {
      const settings = yield* Loader.load(CWD);
      expect(settings.model).toEqual(O.some("claude-haiku-4-5"));
      expect(settings.language).toEqual(O.some("japanese"));
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              USER_PATH,
              settingsJson({
                model: "claude-opus-4-6",
                language: "japanese",
              }),
            ],
            [PROJECT_PATH, settingsJson({ model: "claude-sonnet-4-6" })],
            [LOCAL_PATH, settingsJson({ model: "claude-haiku-4-5" })],
          ])
        )
      )
    )
  );

  it.effect("applies CLI settings above local settings", () =>
    Effect.gen(function* () {
      const settings = yield* Loader.load(CWD, {
        settingsPath: CLI_PATH,
      });
      expect(settings.model).toEqual(O.some("claude-opus-4-6"));
      expect(settings.language).toEqual(O.some("spanish"));
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              LOCAL_PATH,
              settingsJson({
                model: "claude-haiku-4-5",
                language: "spanish",
              }),
            ],
            [CLI_PATH, settingsJson({ model: "claude-opus-4-6" })],
          ])
        )
      )
    )
  );

  it.effect("merges managed base and sorted drop-ins above CLI settings", () =>
    Effect.gen(function* () {
      const settings = yield* Loader.load(CWD, {
        settingsPath: CLI_PATH,
        managedSettingsRoot: MANAGED_ROOT,
      });
      expect(settings.model).toEqual(O.some("claude-sonnet-4-6"));
      expect(settings.allowedHttpHookUrls).toEqual(
        O.some(["https://cli.example/*", "https://base.example/*", "https://ten.example/*", "https://twenty.example/*"])
      );
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              CLI_PATH,
              settingsJson({
                model: "claude-haiku-4-5",
                allowedHttpHookUrls: ["https://cli.example/*"],
              }),
            ],
            [
              MANAGED_PATH,
              settingsJson({
                model: "claude-opus-4-6",
                allowedHttpHookUrls: ["https://base.example/*"],
              }),
            ],
            [
              MANAGED_DROP_IN_20,
              settingsJson({
                model: "claude-sonnet-4-6",
                allowedHttpHookUrls: ["https://twenty.example/*"],
              }),
            ],
            [
              MANAGED_DROP_IN_10,
              settingsJson({
                allowedHttpHookUrls: ["https://ten.example/*"],
              }),
            ],
            [
              MANAGED_HIDDEN_DROP_IN,
              settingsJson({
                model: "ignored-model",
                allowedHttpHookUrls: ["https://ignored.example/*"],
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("deep-merges objects and de-duplicates arrays", () =>
    Effect.gen(function* () {
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
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              USER_PATH,
              settingsJson({
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
              }),
            ],
            [
              PROJECT_PATH,
              settingsJson({
                permissions: {
                  defaultMode: "manual",
                  allow: ["Read(./src/**)", "Write(./tmp/**)"],
                  additionalDirectories: ["/shared", "/project"],
                },
                env: {
                  SHARED: "project",
                  PROJECT_ONLY: "1",
                },
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("preserves and deep-merges unknown top-level settings in raw", () =>
    Effect.gen(function* () {
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
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              USER_PATH,
              settingsJson({
                futureClaudeCodeSetting: {
                  flags: ["user"],
                  userOnly: true,
                },
              }),
            ],
            [
              PROJECT_PATH,
              settingsJson({
                futureClaudeCodeSetting: {
                  flags: ["project"],
                  projectOnly: true,
                },
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("decodes current hooks and marketplace source shapes", () =>
    Effect.gen(function* () {
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
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              PROJECT_PATH,
              settingsJson({
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
              }),
            ],
          ])
        )
      )
    )
  );
});

describe("Settings.load errors", () => {
  it.effect("reports malformed JSON with its source path", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Loader.load(CWD));
      expect(error).toBeInstanceOf(SettingsParseError);
      expect(error).toMatchObject({
        _tag: "SettingsParseError",
        path: USER_PATH,
      });
    }).pipe(Effect.provide(makeTestLayer(fsWith([[USER_PATH, "this is not json"]]))))
  );

  it.effect("reports invalid known settings with their source path", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Loader.load(CWD));
      expect(error).toBeInstanceOf(SettingsDecodeError);
      expect(error).toMatchObject({
        _tag: "SettingsDecodeError",
        path: PROJECT_PATH,
      });
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [
              PROJECT_PATH,
              settingsJson({
                worktree: { bgIsolation: true },
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("aborts when a higher-priority source is malformed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Loader.load(CWD));
      expect(error).toBeInstanceOf(SettingsParseError);
      expect(error).toMatchObject({
        _tag: "SettingsParseError",
        path: LOCAL_PATH,
      });
    }).pipe(
      Effect.provide(
        makeTestLayer(
          fsWith([
            [USER_PATH, settingsJson({ model: "claude-opus-4-6" })],
            [LOCAL_PATH, "{ not valid"],
          ])
        )
      )
    )
  );
});
/** @effect-diagnostics strictEffectProvide:skip-file -- Vitest cases are application entry points; each provided Layer is composed immediately before the terminal Effect runner. */
