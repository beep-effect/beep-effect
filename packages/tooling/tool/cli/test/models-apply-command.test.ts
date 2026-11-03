import {
  LocatorBinding,
  ModelId,
  ModelSyncTarget,
  ModelsLocatorWrite,
  ModelsManifest,
  modelsCommand,
  TargetId,
} from "@beep/repo-cli/commands/Models";
import { ModelsApply, ModelsApplyLive } from "@beep/repo-cli/commands/Models/Models.apply.service";
import { modelsEligibility, modelsWriteSpans } from "@beep/repo-cli/commands/Models/Models.spans";
import { jsonStringifyPretty } from "@beep/repo-utils/JsonUtils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { expect, layer } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as TestConsole from "effect/testing/TestConsole";
import { modelsTestExchangeLayer } from "./helpers/models-atomic-exchange.ts";
import type { Locator } from "@beep/repo-cli/commands/Models";

const run = Command.runWith(modelsCommand, { version: "0.0.0" });
const decodeManifest = S.decodeEffect(ModelsManifest);
const encodeManifest = S.encodeEffect(S.fromJsonString(ModelsManifest));
const native = '# synthetic native state\nmodel = "old"\n[projects.synthetic]\ntrust_level = "trusted"\n';

const fixture = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-command-" });
  const file = path.join(home, "config.toml");
  const manifestFile = path.join(home, "manifest.yaml");
  const manifest = yield* decodeManifest({
    version: "beep-models/v1",
    bindings: [
      {
        role: "codex.heavy",
        surface: "codex-cli",
        modelId: "gpt-6.1-sol",
        effort: "medium",
        supersedes: [],
      },
    ],
    targets: [
      {
        id: "synthetic.codex",
        root: "home",
        path: "$HOME/config.toml",
        optional: false,
        locators: [
          {
            _tag: "toml-top-level-key",
            binding: { role: "codex.heavy", surface: "codex-cli", field: "model" },
            render: { _tag: "verbatim" },
            key: "model",
          },
        ],
      },
      { id: "synthetic.optional", root: "home", path: "$HOME/absent.toml", optional: true, locators: [] },
      {
        id: "synthetic.doctrine",
        root: "repo",
        path: "AGENTS.md",
        optional: false,
        locators: [
          {
            _tag: "md-generated-block",
            blockId: "synthetic",
            filter: { roles: ["codex.heavy"], surfaces: ["codex-cli"] },
            includeSuperseded: false,
          },
        ],
      },
    ],
    superseded: [],
  });
  yield* fs.writeFileString(file, native);
  yield* fs.writeFileString(
    path.join(home, "AGENTS.md"),
    "intro\n<!-- beep-models:begin synthetic -->\nold\n<!-- beep-models:end synthetic -->\ntail\n"
  );
  const encodedManifest = yield* encodeManifest(manifest);
  yield* fs.writeFileString(manifestFile, encodedManifest);
  return Tuple.make(home, file, manifestFile, manifest);
});

const consoleLayer = Layer.effect(Console.Console, TestConsole.make);
const commandServices = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer, consoleLayer);
layer(ModelsApplyLive.pipe(Layer.provideMerge(modelsTestExchangeLayer), Layer.provideMerge(commandServices)), {
  timeout: "30 seconds",
})((it) => {
  it.effect("reports tagged native eligibility through offline JSON checks", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const binding = LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" });
      const render = { _tag: "verbatim" } as const;
      const toml: Locator = { _tag: "toml-top-level-key", key: "model", binding, render };
      const json: Locator = { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render };
      const cases: ReadonlyArray<readonly [string, Locator, string, string]> = [
        ["io.toml", toml, 'model="gpt-6.1-sol"\n', "io-error"],
        ["clean.toml", toml, 'model="gpt-6.1-sol"\n', "eligible"],
        ["missing.toml", toml, 'native="keep"\n', "absent-owned-path"],
        ["missing.json", json, '{"native":"keep"}', "absent-owned-path"],
        ["bad.txt", toml, 'model="gpt-6.1-sol"\n', "ineligible-format"],
        ["bytes.toml", toml, 'model="gpt-6.1-sol"\nnative="?"\n', "invalid-bytes"],
        ["parse.toml", toml, 'model="gpt-6.1-sol"\nbroken=[', "parse-error"],
        ["parse.json", json, '{"model":"gpt-6.1-sol","broken":}', "parse-error"],
        ["link.toml", toml, 'model="gpt-6.1-sol"\n', "not-canonical"],
      ];
      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ([name, locator, content, tag]) {
          const file = path.join(home, name);
          const actual = name === "link.toml" ? path.join(home, "canonical.sh") : file;
          const bytes = new TextEncoder().encode(content);
          if (tag === "invalid-bytes") bytes[bytes.indexOf(63)] = 0xff;
          yield* fs.writeFile(actual, bytes);
          if (file !== actual) {
            yield* fs.symlink(actual, file);
          }
          const reader = FileSystem.FileSystem.of({
            ...fs,
            readFile: Effect.fn("ModelsEligibilityTest.readFile")((target) =>
              fs.readFile(tag === "io-error" && target === actual ? path.join(home, "unreadable-source") : target)
            ),
          });
          const result = yield* modelsEligibility(file, [
            ModelsLocatorWrite.make({ locator, expected: "gpt-6.1-sol" }),
          ]).pipe(Effect.provideService(FileSystem.FileSystem, reader));
          expect(result._tag).toBe(tag);
          const encodedManifest1 = yield* encodeManifest(
            ModelsManifest.make({
              ...manifest,
              targets: [
                ModelSyncTarget.make({
                  id: TargetId.make("synthetic.tagged"),
                  root: "home",
                  path: `$HOME/${name}`,
                  optional: false,
                  locators: [locator],
                }),
              ],
            })
          );
          yield* fs.writeFileString(manifestFile, encodedManifest1);
          yield* run(["check", "--home", home, "--repo", home, "--manifest", manifestFile, "--offline", "--json"]).pipe(
            Effect.provideService(FileSystem.FileSystem, reader),
            Effect.result
          );
          const logLines2 = yield* TestConsole.logLines;
          const report = A.last(logLines2).pipe(O.getOrThrow);
          const readFile3 = yield* fs.readFile(actual);
          expect(A.fromIterable(readFile3)).toEqual(A.fromIterable(bytes));
          const exists4 = yield* fs.exists(path.join(home, ".config-backups"));
          expect(exists4).toBe(false);
          if (tag === "eligible") {
            expect(report).toContain('"findings": []');
            expect(report).toContain('"hasDrift": false');
            return;
          }
          expect(report).toContain('"targetId": "synthetic.tagged"');
          expect(report).toContain(`"kind": "${tag === "absent-owned-path" ? "missing-locator" : "stale"}"`);
          if (tag === "absent-owned-path") expect(report).not.toContain('"current":');
          else expect(report).toContain(`form: ${tag}:`);
        }),
        { concurrency: 1, discard: true }
      );
    })
  );

  it.effect("round nine canonical extensions and fatal bytes agree across actual CLI modes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const binding = LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" });
      const render = { _tag: "verbatim" } as const;
      const cases: ReadonlyArray<readonly [string, string, Locator, string]> = [
        [
          "link.toml",
          "start.sh",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'model="gpt-6.1-sol"\n',
        ],
        [
          "link.json",
          "config.yaml",
          { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
          '{"model":"gpt-6.1-sol"}',
        ],
        [
          "invalid.toml",
          "invalid.toml",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'model="gpt-6.1-sol"\nnative="?"\n',
        ],
        [
          "invalid.json",
          "invalid.json",
          { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
          '{"model":"gpt-6.1-sol","native":"?"}',
        ],
      ];
      for (const [name, destination, locator, content] of cases) {
        const actual = path.join(home, destination);
        const requested = path.join(home, name);
        const bytes = new TextEncoder().encode(content);
        if (name === destination) bytes[bytes.indexOf(63)] = 0xff;
        yield* fs.writeFile(actual, bytes);
        if (name !== destination) {
          yield* fs.symlink(actual, requested);
        }
        const encodedManifest5 = yield* encodeManifest(
          ModelsManifest.make({
            ...manifest,
            targets: [
              ModelSyncTarget.make({
                id: TargetId.make("synthetic.r9"),
                root: "home",
                path: `$HOME/${name}`,
                optional: false,
                locators: [locator],
              }),
            ],
          })
        );
        yield* fs.writeFileString(manifestFile, encodedManifest5);
        const flags = ["--home", home, "--repo", home, "--manifest", manifestFile];
        yield* Effect.flip(run(["check", ...flags, "--offline", "--json"]));
        const logLines6 = yield* TestConsole.logLines;
        expect(A.last(logLines6).pipe(O.getOrThrow)).toContain('"hasDrift": true');
        for (const mode of ["--check", "--write"]) {
          yield* Effect.flip(run(["apply", ...flags, mode]));
        }
        const readFile7 = yield* fs.readFile(actual);
        expect(A.fromIterable(readFile7)).toEqual(A.fromIterable(bytes));
        const exists8 = yield* fs.exists(path.join(home, ".config-backups"));
        expect(exists8).toBe(false);
      }
    })
  );

  it.effect("certifies clean TOML/JSON and refuses duplicate JSON keys as drift", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const binding = LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" });
      const render = { _tag: "verbatim" } as const;
      const cases: ReadonlyArray<readonly [string, Locator, string]> = [
        ["clean.toml", { _tag: "toml-top-level-key", key: "model", binding, render }, 'model="gpt-6.1-sol"\n'],
        [
          "clean.json",
          { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
          '{"model":"gpt-6.1-sol","native":true}',
        ],
      ];
      for (const [name, locator, content] of cases) {
        yield* fs.writeFileString(path.join(home, name), content);
        const encodedManifest9 = yield* encodeManifest(
          ModelsManifest.make({
            ...manifest,
            targets: [
              ModelSyncTarget.make({
                id: TargetId.make("synthetic.clean"),
                root: "home",
                path: `$HOME/${name}`,
                optional: false,
                locators: [locator],
              }),
            ],
          })
        );
        yield* fs.writeFileString(manifestFile, encodedManifest9);
        const flags: ReadonlyArray<string> = ["--home", home, "--repo", home, "--manifest", manifestFile];
        yield* run(["apply", ...flags, "--check"]);
        yield* run(["check", ...flags, "--json"]);
        const logLines10 = yield* TestConsole.logLines;
        const report = A.last(logLines10).pipe(O.getOrThrow);
        expect(report).toContain('"hasDrift": false');
        expect(report).toContain('"manual": []');
        if (name === "clean.json") {
          yield* fs.writeFileString(path.join(home, name), '{"model":"wrong","model":"gpt-6.1-sol"}');
          yield* Effect.flip(run(["check", ...flags, "--json"]));
          yield* Effect.flip(run(["apply", ...flags, "--check"]));
        }
        const exists11 = yield* fs.exists(path.join(home, ".config-backups"));
        expect(exists11).toBe(false);
      }
    })
  );

  it.effect("round nine fallback-only JSON and matching Unicode symlinks stay checkable", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const binding = LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" });
      const render = { _tag: "verbatim" } as const;
      for (const [name, locator, content] of [
        [
          "unicode.toml",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'model="gpt-6.1-sol"\nnative="café 🔑"\n',
        ],
        [
          "unicode.json",
          { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
          '{"model":"gpt-6.1-sol","native":"café 🔑"}',
        ],
        [
          "fallback.json",
          {
            _tag: "json-key",
            pointer: ["modelSettings", "gpt-6.1-sol", "effortLevel"],
            fallbacks: [["effortLevel"]],
            binding: LocatorBinding.make({ ...binding, field: "effort" }),
            render,
          },
          '{"effortLevel":"medium"}',
        ],
      ] satisfies ReadonlyArray<readonly [string, Locator, string]>) {
        const file = path.join(home, name);
        const actual = path.join(home, `canonical-${name}`);
        yield* fs.writeFileString(actual, content);
        yield* fs.symlink(actual, file);
        const encodedManifest12 = yield* encodeManifest(
          ModelsManifest.make({
            ...manifest,
            targets: [
              ModelSyncTarget.make({
                id: TargetId.make("synthetic.positive"),
                root: "home",
                path: `$HOME/${name}`,
                optional: false,
                locators: [locator],
              }),
            ],
          })
        );
        yield* fs.writeFileString(manifestFile, encodedManifest12);
        const flags = ["--home", home, "--repo", home, "--manifest", manifestFile];
        yield* run(["check", ...flags, "--offline", "--json"]);
        const logLines13 = yield* TestConsole.logLines;
        expect(A.last(logLines13).pipe(O.getOrThrow)).toContain('"hasDrift": false');
        yield* run(["apply", ...flags, "--check"]);
        if (name !== "fallback.json") {
          yield* run(["apply", ...flags, "--write"]);
        }
        const readFileString14 = yield* fs.readFileString(actual);
        expect(readFileString14).toBe(content);
        const readLink15 = yield* fs.readLink(file);
        expect(readLink15).toBe(actual);
        const exists16 = yield* fs.exists(path.join(home, ".config-backups"));
        expect(exists16).toBe(false);
      }
    })
  );

  it.effect("round eight checks and writes agree on parsed TOML and JSON values", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const binding = LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" });
      const render = { _tag: "verbatim" } as const;
      const cases: ReadonlyArray<readonly [string, Locator, string, boolean]> = [
        [
          "escaped.toml",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'model="gpt-6.1-\\u0073ol"\n',
          true,
        ],
        [
          "trailing.toml",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'model="gpt-6.1-sol"\nthis is invalid\n',
          false,
        ],
        [
          "duplicate.toml",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'model="gpt-6.1-sol"\nmodel="wrong"\n',
          false,
        ],
        [
          "table.toml",
          { _tag: "toml-table-key", table: "agent", key: "model", binding, render },
          '[agent]\nmodel="gpt-6.1-sol"\nmodel="wrong"\n',
          false,
        ],
        [
          "multiline.toml",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'x="""\nmodel="gpt-6.1-sol"\n"""\nmodel="wrong"\n',
          false,
        ],
        [
          "quoted-trap.toml",
          { _tag: "toml-top-level-key", key: "model", binding, render },
          'x="""\nmodel="gpt-6.1-sol"\n"""\n"model"="wrong"\n',
          false,
        ],
        [
          "escaped.json",
          { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
          '{"model":"gpt-6.1-\\u0073ol","native":true}',
          true,
        ],
        [
          "invalid.json",
          { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
          '{"model":"gpt-6.1-sol"} trailing',
          false,
        ],
        ["start.sh", { _tag: "toml-top-level-key", key: "model", binding, render }, 'model="gpt-6.1-sol"\n', false],
        [
          "config.yaml",
          { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
          '{"model":"gpt-6.1-sol"}',
          false,
        ],
      ];
      for (const [name, locator, content, clean] of cases) {
        const file = path.join(home, name);
        yield* fs.writeFileString(file, content);
        const encodedManifest17 = yield* encodeManifest(
          ModelsManifest.make({
            ...manifest,
            targets: [
              ModelSyncTarget.make({
                id: TargetId.make("synthetic.parsed"),
                root: "home",
                path: `$HOME/${name}`,
                optional: false,
                locators: [locator],
              }),
            ],
          })
        );
        yield* fs.writeFileString(manifestFile, encodedManifest17);
        const flags: ReadonlyArray<string> = ["--home", home, "--repo", home, "--manifest", manifestFile];
        if (clean) {
          yield* run(["check", ...flags, "--offline", "--json"]);
          const logLines18 = yield* TestConsole.logLines;
          expect(A.last(logLines18).pipe(O.getOrThrow)).toContain('"hasDrift": false');
          yield* run(["apply", ...flags, "--check"]);
          const logLines19 = yield* TestConsole.logLines;
          expect(A.some(logLines19, (line) => P.isString(line) && Str.includes("change=false")(line))).toBe(true);
          yield* run(["apply", ...flags, "--write"]);
        } else {
          yield* Effect.flip(run(["check", ...flags, "--offline", "--json"]));
          const logLines20 = yield* TestConsole.logLines;
          expect(A.last(logLines20).pipe(O.getOrThrow)).toContain('"hasDrift": true');
          yield* Effect.flip(run(["apply", ...flags, "--check"]));
          if (name === "quoted-trap.toml") {
            const logLines1 = yield* TestConsole.logLines;
            expect(
              A.last(
                A.filter(
                  logLines1,
                  (line) => P.isString(line) && Str.startsWith("models: preview synthetic.parsed")(line)
                )
              ).pipe(O.getOrThrow)
            ).toBe("models: preview synthetic.parsed [toml-top-level-key] change=true expected=gpt-6.1-sol");
          }
        }
        const readFileString21 = yield* fs.readFileString(file);
        expect(readFileString21).toBe(content);
        const exists22 = yield* fs.exists(path.join(home, ".config-backups"));
        expect(exists22).toBe(false);
      }
    })
  );

  it.effect("refuses an empty-ownership shell recovery journal without target or backup access", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile] = yield* fixture();
      const file = path.join(home, "start.sh");
      const directory = path.join(home, ".config-backups");
      const backup = path.join(directory, "models-empty.backup");
      yield* fs.makeDirectory(directory);
      yield* fs.writeFileString(file, "MODEL=new\n");
      yield* fs.writeFileString(backup, "MODEL=old\n");
      const argument = path.join(directory, "models-empty.json");
      const jsonStringifyPretty2 = yield* jsonStringifyPretty({
        id: "models-empty",
        file,
        requestedFile: file,
        backup,
        beforeHash: "before",
        afterHash: "after",
        mode: 420,
        writes: [],
      });
      yield* fs.writeFileString(argument, jsonStringifyPretty2);
      const accesses: Array<string> = [];
      const recording = FileSystem.FileSystem.of({
        ...fs,
        realPath: Effect.fn("EmptyJournalTest.realPath")((target) => {
          if (target === file || target === backup) accesses.push(target);
          return fs.realPath(target);
        }),
        readFileString: Effect.fn("EmptyJournalTest.readFileString")((target, options) => {
          if (target === file || target === backup) accesses.push(target);
          return fs.readFileString(target, options);
        }),
      });
      const error = yield* Effect.flip(
        run(["restore", "--home", home, "--repo", home, "--manifest", manifestFile, "--journal", "models-empty"]).pipe(
          Effect.provideService(FileSystem.FileSystem, recording)
        )
      );
      expect(error._tag).toBe("ModelsCommandError");
      expect(accesses).toEqual([]);
      const readFileString23 = yield* fs.readFileString(file);
      expect(readFileString23).toBe("MODEL=new\n");
      const readFileString24 = yield* fs.readFileString(backup);
      expect(readFileString24).toBe("MODEL=old\n");
    })
  );

  for (const state of ["existing", "absent", "dangling"])
    it.effect(`preflights excluded ${state} targets before all target access`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const [home, , manifestFile, manifest] = yield* fixture();
        const file = path.join(home, "start.sh");
        const locator: Locator = {
          _tag: "shell-assign",
          variable: "MODEL",
          within: O.none(),
          binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
          render: { _tag: "verbatim" },
        };
        if (state === "existing") {
          yield* fs.writeFileString(file, "MODEL=gpt-6.1-sol\n");
        }
        if (state === "dangling") {
          yield* fs.symlink(path.join(home, "missing"), file);
        }
        const encodedManifest25 = yield* encodeManifest(
          ModelsManifest.make({
            ...manifest,
            targets: [
              ModelSyncTarget.make({
                id: TargetId.make("synthetic.preflight"),
                root: "home",
                path: "$HOME/start.sh",
                optional: true,
                locators: [locator],
              }),
            ],
          })
        );
        yield* fs.writeFileString(manifestFile, encodedManifest25);
        const accesses: Array<string> = [];
        const record = (name: string, target: string) => {
          if (target === file) accesses.push(name);
        };
        const recording = FileSystem.FileSystem.of({
          ...fs,
          exists: Effect.fn("ModelsCommandTest.exists")((target) => {
            record("exists", target);
            return fs.exists(target);
          }),
          realPath: Effect.fn("ModelsCommandTest.realPath")((target) => {
            record("realPath", target);
            return fs.realPath(target);
          }),
          readLink: Effect.fn("ModelsCommandTest.readLink")((target) => {
            record("readLink", target);
            return fs.readLink(target);
          }),
          readFileString: Effect.fn("ModelsCommandTest.readFileString")((target, options) => {
            record("readFileString", target);
            return fs.readFileString(target, options);
          }),
        });
        if (state === "existing") {
          yield* run(["apply", "--home", home, "--repo", home, "--manifest", manifestFile, "--check"]).pipe(
            Effect.provideService(FileSystem.FileSystem, recording)
          );
          expect(accesses).toContain("exists");
          accesses.length = 0;
        }
        const error = yield* Effect.flip(
          run(["apply", "--home", home, "--repo", home, "--manifest", manifestFile, "--write"]).pipe(
            Effect.provideService(FileSystem.FileSystem, recording)
          )
        );
        expect(error._tag).toBe("ModelsCommandError");
        expect(accesses).toEqual([]);
        const errorLines26 = yield* TestConsole.errorLines;
        expect(errorLines26).toContain(
          "models: refused synthetic.preflight: Shell targets are check-only; edit by hand."
        );
        const exists27 = yield* fs.exists(path.join(home, ".config-backups"));
        expect(exists27).toBe(false);
      })
    );

  it.effect("round seven shell and nested XML evidence always requires manual verification", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const binding = LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" });
      const render = { _tag: "verbatim" } as const;
      const cases: ReadonlyArray<readonly [Locator, string]> = [
        [
          { _tag: "shell-assign", variable: "MODEL", within: O.none(), binding, render },
          "export MOD\\EL=wrong\nMODEL=gpt-6.1-sol\n",
        ],
        [
          { _tag: "xml-attribute", elementSelector: 'option[name="model"]', attribute: "value", binding, render },
          '<root><option name="native" value="keep"><option name="model" value="wrong"/></option><option name="model" value="gpt-6.1-sol"/></root>',
        ],
        [{ _tag: "yaml-path", path: ["model"], binding, render }, "model: gpt-6.1-sol\n"],
      ];
      for (const [locator, content] of cases) {
        const target = ModelSyncTarget.make({
          id: TargetId.make("synthetic.manual"),
          root: "home",
          path: "$HOME/manual",
          optional: false,
          locators: [locator],
        });
        yield* fs.writeFileString(path.join(home, "manual"), content);
        const encodedManifest28 = yield* encodeManifest(ModelsManifest.make({ ...manifest, targets: [target] }));
        yield* fs.writeFileString(manifestFile, encodedManifest28);
        const flags: ReadonlyArray<string> = ["--home", home, "--repo", home, "--manifest", manifestFile];
        yield* run(["apply", ...flags, "--check"]);
        yield* run(["check", ...flags, "--json"]);
        const logLines29 = yield* TestConsole.logLines;
        const report = A.last(logLines29).pipe(O.getOrThrow);
        expect(report).toContain('"manual": [');
        expect(report).toContain('"status": "manual verification required"');
        expect(report).toContain(`"_tag": "${locator._tag}"`);
        expect(report).toContain('"current": "gpt-6.1-sol"');
        expect(report).toContain('"hasDrift": false');
        const readFileString30 = yield* fs.readFileString(path.join(home, "manual"));
        expect(readFileString30).toBe(content);
        const exists31 = yield* fs.exists(path.join(home, ".config-backups"));
        expect(exists31).toBe(false);
      }
    })
  );

  it.effect("refuses non-scalar removals consistently before backup in every removal mode", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const directory = path.join(home, ".codex");
      yield* fs.makeDirectory(directory);
      const file = path.join(directory, "config.toml");
      const locator: Locator = {
        _tag: "toml-top-level-key",
        key: "sandbox_mode",
        binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
        render: { _tag: "verbatim" },
      };
      const writer = yield* ModelsApply;
      const encodedManifest32 = yield* encodeManifest(
        ModelsManifest.make({
          ...manifest,
          targets: [
            ModelSyncTarget.make({
              id: TargetId.make("home.codex.config"),
              root: "home",
              path: "$HOME/.codex/config.toml",
              optional: false,
              locators: [locator],
            }),
          ],
        })
      );
      yield* fs.writeFileString(manifestFile, encodedManifest32);
      const flags = ["--home", home, "--repo", home, "--manifest", manifestFile];
      for (const content of [
        '[sandbox_mode]\nsandbox_mode.foo = "native"\n',
        'sandbox_mode.foo = "native"\n',
        'sandbox_mode = ["native"]\n',
        '[[sandbox_mode]]\nfoo = "native"\n',
      ]) {
        yield* fs.writeFileString(file, content);
        const eligible = yield* modelsEligibility(file, [
          ModelsLocatorWrite.make({ locator, remove: true, expected: "" }),
        ]);
        expect(eligible._tag).toBe("unsupported-removal-shape");
        const spanError = yield* Effect.flip(
          modelsWriteSpans(content, ModelsLocatorWrite.make({ locator, remove: true, expected: "" }))
        );
        expect(spanError.message).toBe("Unsupported removal shape: owned leaf must be a scalar TOML assignment.");
        for (const mode of ["check", "dry-run", "write"] as const) {
          const refused = yield* Effect.flip(
            writer.apply(
              file,
              [ModelsLocatorWrite.make({ locator, remove: true, expected: "" })],
              mode,
              path.join(home, ".config-backups")
            )
          );
          expect(refused.message).toBe(
            "Ineligible native target: Unsupported removal shape: owned leaf must be a scalar TOML assignment."
          );
          const readFileString33 = yield* fs.readFileString(file);
          expect(readFileString33).toBe(content);
          const exists34 = yield* fs.exists(path.join(home, ".config-backups"));
          expect(exists34).toBe(false);
        }
        for (const mode of ["--check", "--dry-run", "--write"]) {
          const refused = yield* Effect.flip(run(["codex-permissions", ...flags, mode]));
          expect(refused.message).toBe(
            "Ineligible native target: Unsupported removal shape: owned leaf must be a scalar TOML assignment."
          );
          const readFileString35 = yield* fs.readFileString(file);
          expect(readFileString35).toBe(content);
          const exists36 = yield* fs.exists(path.join(home, ".config-backups"));
          expect(exists36).toBe(false);
        }
      }
    })
  );

  it.effect("previews and removes every supported scalar shape from parsed ownership", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifest] = yield* fixture();
      const directory = path.join(home, ".codex");
      yield* fs.makeDirectory(directory);
      const file = path.join(directory, "config.toml");
      const flags = ["--home", home, "--repo", home, "--manifest", manifest];
      for (const scalar of ['"native"', "true", "42", "1.5"]) {
        const content = `sandbox_mode = ${scalar}\n${native}`;
        yield* fs.writeFileString(file, content);
        yield* run(["codex-permissions", ...flags, "--dry-run"]);
        const logLines37 = yield* TestConsole.logLines;
        expect(A.takeRight(logLines37, 2)).toEqual([
          "models: preview home.codex.config [toml-top-level-key] change=true expected=<absent>",
          "models: codex-permissions dry-run complete; no file written",
        ]);
        yield* Effect.flip(run(["codex-permissions", ...flags, "--check"]));
        const readFileString38 = yield* fs.readFileString(file);
        expect(readFileString38).toBe(content);
        yield* run(["codex-permissions", ...flags, "--write"]);
        const readFileString39 = yield* fs.readFileString(file);
        expect(readFileString39).toBe(native);
        yield* run(["codex-permissions", ...flags, "--check"]);
      }
    })
  );

  it.effect("checks legacy Codex permission drift, preserves pins, and journals removal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifest] = yield* fixture();
      const dir = path.join(home, ".codex");
      yield* fs.makeDirectory(dir);
      const file = path.join(dir, "config.toml");
      const before = `sandbox_mode="danger-full-access"\n${native}`;
      yield* fs.writeFileString(file, before);
      const flags = ["--home", home, "--repo", home, "--manifest", manifest];
      yield* run(["codex-permissions", ...flags]);
      const readFileString40 = yield* fs.readFileString(file);
      expect(readFileString40).toBe(before);
      const logLines41 = yield* TestConsole.logLines;
      expect(logLines41).toContain(
        "models: preview home.codex.config [toml-top-level-key] change=true expected=<absent>"
      );
      yield* Effect.flip(run(["codex-permissions", ...flags, "--check"]));
      yield* Effect.flip(run(["codex-permissions", ...flags, "--check", "--write"]));
      yield* run(["codex-permissions", ...flags, "--write"]);
      const readFileString42 = yield* fs.readFileString(file);
      expect(readFileString42).toBe(native);
      for (const mode of ["--check", "--dry-run", "--write"]) {
        yield* run(["codex-permissions", ...flags, mode]);
      }
      const logLines43 = yield* TestConsole.logLines;
      expect(logLines43).toContain(
        "models: preview home.codex.config [toml-top-level-key] change=false expected=<absent>"
      );
      const readFileString44 = yield* fs.readFileString(file);
      expect(readFileString44).toBe(native);
      const backups = path.join(home, ".config-backups");
      const entries = yield* fs.readDirectory(backups);
      expect(entries).toHaveLength(2);
      const backup = A.findFirst(entries, Str.endsWith(".backup")).pipe(O.getOrThrow);
      const readFileString45 = yield* fs.readFileString(path.join(backups, backup));
      expect(readFileString45).toBe(before);
    })
  );

  it.effect("previews quoted legacy keys as removals", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const key of ['"sandbox_mode"', "'sandbox_mode'"]) {
        const [home, , manifest] = yield* fixture();
        yield* fs.makeDirectory(path.join(home, ".codex"));
        const file = path.join(home, ".codex", "config.toml");
        const before = `${key}="danger-full-access"\n${native}`;
        yield* fs.writeFileString(file, before);
        yield* run(["codex-permissions", "--home", home, "--repo", home, "--manifest", manifest, "--dry-run"]);
        const logLines46 = yield* TestConsole.logLines;
        expect(logLines46).toContain(
          "models: preview home.codex.config [toml-top-level-key] change=true expected=<absent>"
        );
        const readFileString47 = yield* fs.readFileString(file);
        expect(readFileString47).toBe(before);
      }
    })
  );

  it.effect("previews every owned target, writes one target idempotently, and restores its journal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, file, manifest] = yield* fixture();
      const flags = ["--home", home, "--repo", home, "--manifest", manifest];
      yield* run(["apply", ...flags]);
      const readFileString48 = yield* fs.readFileString(file);
      expect(readFileString48).toBe(native);
      const exists49 = yield* fs.exists(path.join(home, ".config-backups"));
      expect(exists49).toBe(false);
      yield* Effect.flip(run(["apply", ...flags, "--check", "--target", "synthetic.codex"]));
      yield* run(["apply", ...flags, "--write", "--target", "synthetic.codex"]);
      const readFileString50 = yield* fs.readFileString(file);
      expect(readFileString50).toContain('model = "gpt-6.1-sol"');
      yield* run(["apply", ...flags, "--check", "--target", "synthetic.codex"]);
      yield* run(["apply", ...flags, "--write", "--target", "synthetic.codex"]);
      const files = yield* fs.readDirectory(path.join(home, ".config-backups"));
      expect(files).toHaveLength(2);
      const journalFile = O.getOrThrow(A.findFirst(files, Str.endsWith(".json")));
      yield* run(["restore", ...flags, "--journal", Str.replace(/\.json$/, "")(journalFile)]);
      const readFileString51 = yield* fs.readFileString(file);
      expect(readFileString51).toBe(native);
      yield* Effect.flip(run(["restore", ...flags, "--journal", "../unsafe"]));
    })
  );

  it.effect("reports operator-adjacent assignments and unsupported forms through both check commands", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const shellFile = path.join(home, ".zshrc");
      const shellManifest = ModelsManifest.make({
        ...manifest,
        bindings: A.map(manifest.bindings, (entry) => ({ ...entry, modelId: ModelId.make("gpt-6-luna") })),
        targets: [
          ModelSyncTarget.make({
            id: TargetId.make("synthetic.shell"),
            root: "home",
            path: "$HOME/.zshrc",
            optional: false,
            locators: [
              {
                _tag: "shell-assign",
                variable: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
                within: O.none(),
                binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
                render: { _tag: "verbatim" },
              },
            ],
          }),
        ],
      });
      const encodedManifest52 = yield* encodeManifest(shellManifest);
      yield* fs.writeFileString(manifestFile, encodedManifest52);
      const flags: ReadonlyArray<string> = ["--home", home, "--repo", home, "--manifest", manifestFile];
      yield* fs.writeFileString(shellFile, "ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n");
      yield* run(["apply", ...flags, "--check"]);
      yield* run(["check", ...flags]);
      for (const operator of [";", "&&", "||", "|", "&", "(", "\n"]) {
        const text = `:${operator}ANTHROPIC_DEFAULT_HAIKU_MODEL=wrong claude\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n`;
        yield* fs.writeFileString(shellFile, text);
        yield* Effect.flip(run(["apply", ...flags, "--check"]));
        yield* Effect.flip(run(["check", ...flags]));
        const readFileString53 = yield* fs.readFileString(shellFile);
        expect(readFileString53).toBe(text);
      }
      for (const text of [
        "export 'ANTHROPIC_DEFAULT_HAIKU_MODEL=wrong'; claude\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n",
        'export "ANTHROPIC_DEFAULT_HAIKU_MODEL=wrong"; claude\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n',
        "ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\nANTHROPIC_DEFAULT_HAIKU_MODEL+=wrong\n",
        ":;ANTHROPIC_DEFAULT_HAIKU_MODEL+=wrong\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\n",
        "# ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\n",
        "x\\ ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\n",
        "cat <<'EOF'\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\nEOF\n",
      ]) {
        yield* fs.writeFileString(shellFile, text);
        yield* Effect.flip(run(["apply", ...flags, "--check"]));
        yield* Effect.flip(run(["check", ...flags]));
        const readFileString54 = yield* fs.readFileString(shellFile);
        expect(readFileString54).toBe(text);
      }
      const errorLines55 = yield* TestConsole.errorLines;
      expect(
        A.some(
          errorLines55,
          (line) =>
            P.isString(line) &&
            /models: refused synthetic.shell: Unsupported shell form: line [0-9]+: owned configuration drift detected/.test(
              line
            )
        )
      ).toBe(true);
      const exists56 = yield* fs.exists(path.join(home, ".config-backups"));
      expect(exists56).toBe(false);
    })
  );

  it.effect("checks and previews YAML/XML targets while refusing writes without backups", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifestFile, manifest] = yield* fixture();
      const binding = LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" });
      const render = { _tag: "verbatim" } as const;
      const cases: ReadonlyArray<readonly [Locator, string, string, string]> = [
        [
          { _tag: "yaml-path", binding, render, path: ["model"] },
          "model: gpt-6.1-sol\n",
          "model: wrong\n",
          "# model: gpt-6.1-sol\n",
        ],
        [
          { _tag: "xml-attribute", binding, render, elementSelector: 'option[name="model"]', attribute: "value" },
          '<root><option name="model" value="gpt-6.1-sol"/></root>',
          '<root><option name="model" value="wrong"/></root>',
          '<root><!-- <option name="model" value="gpt-6.1-sol"/> --></root>',
        ],
      ];
      for (const [locator, clean, drift, unsupported] of cases) {
        const file = path.join(home, "check-only");
        const target = ModelSyncTarget.make({
          id: TargetId.make("synthetic.check-only"),
          root: "home",
          path: "$HOME/check-only",
          optional: false,
          locators: [locator],
        });
        const encodedManifest57 = yield* encodeManifest(ModelsManifest.make({ ...manifest, targets: [target] }));
        yield* fs.writeFileString(manifestFile, encodedManifest57);
        const flags: ReadonlyArray<string> = ["--home", home, "--repo", home, "--manifest", manifestFile];
        yield* fs.writeFileString(file, clean);
        yield* run(["apply", ...flags, "--check"]);
        yield* run(["check", ...flags]);
        yield* Effect.flip(run(["apply", ...flags, "--write"]));
        for (const text of [drift, unsupported]) {
          yield* fs.writeFileString(file, text);
          yield* run(["apply", ...flags, "--dry-run"]);
          yield* Effect.flip(run(["apply", ...flags, "--check"]));
          yield* Effect.flip(run(["check", ...flags]));
          const readFileString58 = yield* fs.readFileString(file);
          expect(readFileString58).toBe(text);
        }
        const exists59 = yield* fs.exists(path.join(home, ".config-backups"));
        expect(exists59).toBe(false);
      }
    })
  );

  it.effect("previews shell drift after continuations and reports every target after a refusal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, file, manifestFile, manifest] = yield* fixture();
      const shellFile = path.join(home, ".zshrc");
      const shellText = 'X=1 \\\n  command\nlightweight() {\n  claude --model "old"\n}\n';
      yield* fs.writeFileString(shellFile, shellText);
      const shellManifest = ModelsManifest.make({
        ...manifest,
        targets: [
          ModelSyncTarget.make({
            id: TargetId.make("synthetic.shell"),
            root: "home",
            path: "$HOME/.zshrc",
            optional: false,
            locators: [
              {
                _tag: "shell-assign",
                variable: "--model",
                within: O.some("lightweight"),
                binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
                render: { _tag: "verbatim" },
              },
            ],
          }),
          ...manifest.targets,
        ],
      });
      const encodedManifest60 = yield* encodeManifest(shellManifest);
      yield* fs.writeFileString(manifestFile, encodedManifest60);
      const flags: ReadonlyArray<string> = ["--home", home, "--repo", home, "--manifest", manifestFile];
      yield* run(["apply", ...flags]);
      const logLines61 = yield* TestConsole.logLines;
      expect(logLines61).toContain(
        "models: preview synthetic.shell [shell-assign] manual verification required; recognized drift=true expected=gpt-6.1-sol"
      );
      const logLines62 = yield* TestConsole.logLines;
      expect(logLines62).toContain(
        "models: preview synthetic.codex [toml-top-level-key] change=true expected=gpt-6.1-sol"
      );
      const exists63 = yield* fs.exists(path.join(home, ".config-backups"));
      expect(exists63).toBe(false);
      yield* Effect.flip(run(["apply", ...flags, "--check"]));
      const errorLines64 = yield* TestConsole.errorLines;
      expect(
        A.some(
          errorLines64,
          (line) => P.isString(line) && /models: refused synthetic.shell: Owned configuration drift detected/.test(line)
        )
      ).toBe(true);
      const errorLines65 = yield* TestConsole.errorLines;
      expect(errorLines65).toContain("models: refused synthetic.codex: Owned configuration drift detected.");
      yield* Effect.flip(run(["apply", ...flags, "--write", "--target", "synthetic.shell"]));
      const errorLines66 = yield* TestConsole.errorLines;
      expect(errorLines66).toContain("models: refused synthetic.shell: Shell targets are check-only; edit by hand.");
      yield* Effect.flip(run(["check", ...flags]));
      const readFileString67 = yield* fs.readFileString(shellFile);
      expect(readFileString67).toBe(shellText);
      const readFileString68 = yield* fs.readFileString(file);
      expect(readFileString68).toBe(native);
      const exists69 = yield* fs.exists(path.join(home, ".config-backups"));
      expect(exists69).toBe(false);
    })
  );

  it.effect("refuses dangling optional model destinations without backups", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, , manifest] = yield* fixture();
      const link = path.join(home, "absent.toml");
      const missing = path.join(home, "missing.toml");
      yield* fs.symlink(missing, link);
      yield* Effect.flip(
        run([
          "apply",
          "--home",
          home,
          "--repo",
          home,
          "--manifest",
          manifest,
          "--write",
          "--target",
          "synthetic.optional",
        ])
      );
      const readLink70 = yield* fs.readLink(link);
      expect(readLink70).toBe(missing);
      const exists71 = yield* fs.exists(path.join(home, ".config-backups"));
      expect(exists71).toBe(false);
    })
  );

  it.effect("rejects conflicting modes, unmatched ids, and symlink escapes without native writes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const [home, file, manifest] = yield* fixture();
      const flags = ["--home", home, "--repo", home, "--manifest", manifest];
      yield* Effect.flip(run(["apply", ...flags, "--check", "--write"]));
      yield* Effect.flip(run(["apply", ...flags, "--target", "absent"]));
      const outside = yield* fs.makeTempFileScoped({ directory: path.dirname(home), prefix: "outside-models-" });
      yield* fs.writeFileString(outside, native);
      yield* fs.remove(file);
      yield* fs.symlink(outside, file);
      yield* Effect.flip(run(["apply", ...flags, "--write", "--target", "synthetic.codex"]));
      const readFileString72 = yield* fs.readFileString(outside);
      expect(readFileString72).toBe(native);
      const exists73 = yield* fs.exists(path.join(home, ".config-backups"));
      expect(exists73).toBe(false);
    })
  );

  it.effect("rejects unresolved bindings before a writer can apply them", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const [home, file, manifestFile, manifest] = yield* fixture();
      const encodedManifest74 = yield* encodeManifest(ModelsManifest.make({ ...manifest, bindings: [] }));
      yield* fs.writeFileString(manifestFile, encodedManifest74);
      yield* Effect.flip(
        run([
          "apply",
          "--home",
          home,
          "--repo",
          home,
          "--manifest",
          manifestFile,
          "--write",
          "--target",
          "synthetic.codex",
        ])
      );
      const readFileString75 = yield* fs.readFileString(file);
      expect(readFileString75).toBe(native);
    })
  );
});
