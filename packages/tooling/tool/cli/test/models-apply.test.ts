import {
  ModelsApply,
  ModelsApplyLive,
  ModelsAtomicExchange,
} from "@beep/repo-cli/commands/Models/Models.apply.service";
import { ModelsLocatorError } from "@beep/repo-cli/commands/Models/Models.errors";
import {
  BindingFilter,
  LocatorBinding,
  ModelsApplyJournal,
  ModelsLocatorWrite,
} from "@beep/repo-cli/commands/Models/Models.manifest.schemas";
import { modelsApplySpans, modelsCheckOnlyFormat, modelsWriteSpans } from "@beep/repo-cli/commands/Models/Models.spans";
import { jsonStringifyPretty } from "@beep/repo-utils/JsonUtils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { modelsTestExchangeLayer } from "./helpers/models-atomic-exchange.ts";
import type { Locator, LocatorRender } from "@beep/repo-cli/commands/Models/Models.manifest.schemas";

const binding: LocatorBinding = LocatorBinding.make({
  role: "codex.heavy",
  surface: "codex-cli",
  field: "model",
});
const encodeRecoveryJournal = S.encodeEffect(S.fromJsonString(ModelsApplyJournal));
const render: LocatorRender = { _tag: "verbatim" };
const write = (locator: Locator, expected = "gpt-6.1-sol") => ModelsLocatorWrite.make({ locator, expected });
const topLevel = write({
  _tag: "toml-top-level-key",
  binding,
  render,
  key: "model",
});
const native = A.join(
  [
    "# Unicode stays: café 🔑",
    'model  =  "old" # owned',
    "unknown = { retained = true }",
    ...A.flatMap(A.range(0, 493), (i) => [`[projects."synthetic-${i}"]`, 'trust_level = "trusted"']),
    ...A.flatMap(A.range(0, 310), (i) => [`[hooks.state."synthetic-${i}"]`, "enabled = true"]),
    "",
  ],
  "\r\n"
);

const writerWithFs = Effect.fn("ModelsApplyTest.writerWithFs")(function* (
  fs: FileSystem.FileSystem,
  exchange?: Context.Service.Shape<typeof ModelsAtomicExchange>
) {
  const capability = exchange === undefined ? yield* ModelsAtomicExchange : exchange;
  const services = yield* Layer.build(
    ModelsApplyLive.pipe(
      Layer.provide(
        Layer.mergeAll(Layer.succeed(FileSystem.FileSystem, fs), Layer.succeed(ModelsAtomicExchange, capability))
      )
    )
  );
  return Context.get(services, ModelsApply);
});

const restoreLinkRace = Effect.fnUntraced(function* (dangling: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({
    prefix: "restore-link-race-",
  });
  const file = path.join(root, "config.toml");
  const relocated = path.join(root, "relocated.toml");
  const backups = path.join(root, "backups");
  yield* fs.writeFileString(file, native);
  const writer = yield* writerWithFs(fs);
  const journal = O.getOrThrow(yield* writer.apply(file, [topLevel], "write", backups));
  const applied = yield* fs.readFileString(file);
  const modelsTestExchange = yield* ModelsAtomicExchange;
  let exchanges = 0;
  const wrapped = ModelsAtomicExchange.of({
    qualify: modelsTestExchange.qualify,
    exchange: Effect.fn("ModelsApplyTest.restoreLinkExchange")(function* (left, right) {
      exchanges += 1;
      if (exchanges === 1) {
        yield* fs.rename(file, relocated).pipe(ModelsLocatorError.mapError("Test interference failed."));
        yield* fs
          .symlink(dangling ? path.join(root, "absent.toml") : relocated, file)
          .pipe(ModelsLocatorError.mapError("Test interference failed."));
      }
      yield* modelsTestExchange.exchange(left, right);
    }),
  });
  const restoring = yield* writerWithFs(fs, wrapped);
  const error = yield* Effect.flip(restoring.restore(path.join(backups, `${journal.id}.json`), backups));
  expect(error._tag).toBe("ModelsLocatorError");
  expect(error.message).toContain(`Journal: ${journal.id}`);
  expect(yield* fs.readLink(file)).toBe(dangling ? path.join(root, "absent.toml") : relocated);
  if (!dangling) expect(yield* fs.readFileString(file)).toBe(applied);
  expect(yield* fs.readFileString(relocated)).toBe(applied);
  expect(exchanges).toBe(2);
});

layer(modelsTestExchangeLayer.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))), {
  timeout: "30 seconds",
})((it) => {
  it.effect("round nine synthetic nonempty journals cannot establish parsed ownership", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "r9-journal-" });
      const backups = path.join(root, "backups");
      yield* fs.makeDirectory(backups);
      const writer = yield* writerWithFs(fs);
      const crypto = yield* Digest.Digest;
      const cases: ReadonlyArray<readonly [string, string, string, ModelsLocatorWrite]> = [
        [
          "config.json",
          '{"native":"applied"}',
          '{"native":"original"}',
          ModelsLocatorWrite.make({
            locator: { _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render },
            expected: "",
            remove: true,
          }),
        ],
        ["config.toml", 'x="""\nmodel="gpt-6.1-sol"\n"""\n', 'x="original"\n', topLevel],
        ["backup.toml", 'model="gpt-6.1-sol"\n', 'x="original"\n', topLevel],
        ["invalid-backup.toml", 'model="gpt-6.1-sol"\n', 'model="old"\nnative="?"\n', topLevel],
        [
          "invalid-backup.json",
          '{"model":"gpt-6.1-sol"}',
          '{"model":"old","native":"?"}',
          write({ _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render }),
        ],
        ["malformed-backup.toml", 'model="gpt-6.1-sol"\n', 'model="old"\ninvalid', topLevel],
      ];
      for (const [name, current, original, request] of cases) {
        const file = path.join(root, name);
        const backup = path.join(backups, "models-synthetic.backup");
        const journalFile = path.join(backups, "models-synthetic.json");
        yield* fs.writeFileString(file, current);
        const originalBytes = new TextEncoder().encode(original);
        if (originalBytes.includes(63)) originalBytes[originalBytes.indexOf(63)] = 0xff;
        yield* fs.writeFile(backup, originalBytes);
        const journal = ModelsApplyJournal.make({
          id: "models-synthetic",
          file,
          backup,
          beforeHash: Hex.encode(yield* crypto.digest(Digest.sha256, originalBytes)),
          afterHash: Hex.encode(yield* crypto.digest(Digest.sha256, new TextEncoder().encode(current))),
          mode: (yield* fs.stat(file)).mode,
          writes: O.some([request]),
          requestedFile: O.some(file),
          requestedLink: O.none(),
        });
        yield* fs.writeFileString(journalFile, yield* encodeRecoveryJournal(journal));
        const refusal = yield* Effect.flip(writer.restore(journalFile, backups));
        expect(refusal.message).toContain("Ineligible native target");
        expect(refusal.reason).toBe("ineligible");
        expect(yield* fs.readFileString(file)).toBe(current);
        expect(A.fromIterable(yield* fs.readFile(backup))).toEqual(A.fromIterable(originalBytes));
      }
    })
  );

  it.effect("empty ownership refuses every recovery format before target access", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "empty-ownership-" });
      const backups = path.join(root, "backups");
      yield* fs.makeDirectory(backups);
      for (const extension of ["sh", "yaml", "xml", "json"]) {
        const file = path.join(root, `config.${extension}`);
        const backup = path.join(backups, "models-empty.backup");
        const journalFile = path.join(backups, "models-empty.json");
        yield* fs.writeFileString(file, "invalid native state");
        yield* fs.writeFileString(backup, "old native state");
        yield* fs.writeFileString(
          journalFile,
          yield* jsonStringifyPretty({
            id: "models-empty",
            file,
            requestedFile: file,
            backup,
            beforeHash: "before",
            afterHash: "after",
            mode: 420,
            writes: [],
          })
        );
        const accesses: Array<string> = [];
        const recording = FileSystem.FileSystem.of({
          ...fs,
          realPath: Effect.fn("EmptyOwnership.realPath")((target) => {
            if (target === file || target === backup) accesses.push(target);
            return fs.realPath(target);
          }),
          readFileString: Effect.fn("EmptyOwnership.readFileString")((target, options) => {
            if (target === file || target === backup) accesses.push(target);
            return fs.readFileString(target, options);
          }),
        });
        const writer = yield* writerWithFs(recording);
        const error = yield* Effect.flip(writer.restore(journalFile, backups));
        expect(error._tag).toBe("ModelsLocatorError");
        expect(error.message).toBe("Invalid recovery journal.");
        expect(accesses).toEqual([]);
        expect(yield* fs.readFileString(file)).toBe("invalid native state");
        expect(yield* fs.readFileString(backup)).toBe("old native state");
      }
    })
  );

  it.effect("parsed-equal JSON preserves spelling without creating a journal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "parsed-equal-" });
      const file = path.join(root, "config.json");
      const backups = path.join(root, "backups");
      const content = '{"model":"gpt-6.1-\\u0073ol","native":true}';
      yield* fs.writeFileString(file, content);
      const writer = yield* writerWithFs(fs);
      const request = write({ _tag: "json-key", pointer: ["model"], fallbacks: [], binding, render });
      for (const mode of ["check", "write"] as const) {
        assertNone(yield* writer.apply(file, [request], mode, backups));
        expect(yield* fs.readFileString(file)).toBe(content);
        expect(yield* fs.exists(backups)).toBe(false);
      }
    })
  );

  it.effect("refuses locator and canonical extension mismatches in apply and historical restore", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "format-refusal-" });
      const writer = yield* writerWithFs(fs);
      const cases = [
        ["start.sh", 'MODEL="old"\n', write({ _tag: "toml-top-level-key", binding, render, key: "MODEL" })],
        [
          "config.yaml",
          '{"model":"old","native":true}',
          write({ _tag: "json-key", binding, render, pointer: ["model"], fallbacks: [] }),
        ],
      ] as const;
      for (const [name, text, request] of cases) {
        const file = path.join(root, name);
        const backups = path.join(root, `${name}-backups`);
        yield* fs.writeFileString(file, text);
        const error = yield* Effect.flip(writer.apply(file, [request], "write", backups));
        expect(error._tag).toBe("ModelsLocatorError");
        expect(error.message).toContain("Target format mismatch");
        expect(yield* fs.exists(backups)).toBe(false);
        expect(yield* fs.readFileString(file)).toBe(text);
        // Historical journals can carry a writable tag for an excluded destination.
        yield* fs.makeDirectory(backups);
        const journalFile = path.join(backups, "historical.json");
        yield* fs.writeFileString(
          journalFile,
          yield* encodeRecoveryJournal(
            ModelsApplyJournal.make({
              id: "historical",
              file,
              backup: path.join(backups, "historical.backup"),
              beforeHash: "unused",
              afterHash: "unused",
              mode: 0o644,
              writes: O.some([request]),
              requestedFile: O.some(file),
              requestedLink: O.none(),
            })
          )
        );
        const restoreError = yield* Effect.flip(writer.restore(journalFile, backups));
        expect(restoreError.message).toContain("Target format mismatch");
        expect(yield* fs.readFileString(file)).toBe(text);
        expect(yield* fs.readDirectory(backups)).toEqual(["historical.json"]);
        // A matching visible extension cannot hide a mismatched canonical target.
        const link = path.join(root, `${name}${request.locator._tag === "json-key" ? ".json" : ".toml"}`);
        yield* fs.symlink(file, link);
        expect((yield* Effect.flip(writer.apply(link, [request], "write", backups))).message).toContain(
          "Target format mismatch"
        );
        expect(yield* fs.readFileString(file)).toBe(text);
      }
    })
  );

  it.effect("preserves every native byte outside a top-level scalar with 494 projects and 311 hook states", () =>
    Effect.gen(function* () {
      const spans = yield* modelsWriteSpans(native, topLevel);
      expect(spans).toHaveLength(1);
      expect(yield* modelsApplySpans(native, spans)).toBe(Str.replace('"old"', '"gpt-6.1-sol"')(native));
    })
  );

  it.effect("resolves every supported grammar without changing unowned text", () =>
    Effect.gen(function* () {
      const cases: ReadonlyArray<readonly [string, Locator, string]> = [
        [
          '[models]\ndefault = "old" # tail\n[native]\nkeep = true\n',
          {
            _tag: "toml-table-key",
            binding,
            render,
            table: "models",
            key: "default",
          },
          '[models]\ndefault = "gpt-6.1-sol" # tail\n[native]\nkeep = true\n',
        ],
        [
          '{"model":"old", "unknown":{"keep":true}}',
          {
            _tag: "json-key",
            binding,
            render,
            pointer: ["model"],
            fallbacks: [],
          },
          '{"model":"gpt-6.1-sol", "unknown":{"keep":true}}',
        ],
        [
          "models:\n  default: old # tail\nunknown: yes\n",
          { _tag: "yaml-path", binding, render, path: ["models", "default"] },
          'models:\n  default: "gpt-6.1-sol" # tail\nunknown: yes\n',
        ],
        [
          'export MODEL="old" # tail\nKEEP=1\n',
          { _tag: "env-key", binding, render, key: "MODEL" },
          'export MODEL="gpt-6.1-sol" # tail\nKEEP=1\n',
        ],
        ["MODEL=old # tail\n", { _tag: "env-key", binding, render, key: "MODEL" }, 'MODEL="gpt-6.1-sol" # tail\n'],
        [
          'export const model = "old"; // tail\n',
          { _tag: "ts-literal", binding, render, symbol: "model" },
          'export const model = "gpt-6.1-sol"; // tail\n',
        ],
        [
          ' * model: "old"\nunowned model: "old"\n',
          {
            _tag: "line-value",
            binding,
            render,
            linePrefix: " *",
            before: 'model: "',
            after: '"',
          },
          ' * model: "gpt-6.1-sol"\nunowned model: "old"\n',
        ],
        [
          '<root><option name="model" value="old" keep="yes"/></root>',
          {
            _tag: "xml-attribute",
            binding,
            render,
            elementSelector: 'option[name="model"]',
            attribute: "value",
          },
          '<root><option name="model" value="gpt-6.1-sol" keep="yes"/></root>',
        ],
        [
          '<root><option name="options" value="[{&quot;model&quot;:&quot;old&quot;,&quot;keep&quot;:true}]"/></root>',
          {
            _tag: "xml-escaped-json-attribute",
            binding,
            render,
            elementSelector: 'option[name="options"]',
            attribute: "value",
            jsonPointer: ["0", "model"],
          },
          '<root><option name="options" value="[{&quot;model&quot;:&quot;gpt-6.1-sol&quot;,&quot;keep&quot;:true}]"/></root>',
        ],
        [
          "intro\n<!-- beep-models:begin x -->\nold\n<!-- beep-models:end x -->\ntail",
          {
            _tag: "md-generated-block",
            blockId: "x",
            filter: BindingFilter.make({ roles: [], surfaces: [] }),
            includeSuperseded: false,
          },
          "intro\n<!-- beep-models:begin x -->\ngpt-6.1-sol\n<!-- beep-models:end x -->\ntail",
        ],
      ];
      for (const [content, locator, expected] of cases) {
        if (O.isSome(modelsCheckOnlyFormat(locator))) {
          const error = yield* Effect.flip(modelsWriteSpans(content, write(locator)));
          expect(error.message).toContain("targets are check-only; edit by hand.");
        } else
          expect(yield* modelsApplySpans(content, yield* modelsWriteSpans(content, write(locator)))).toBe(expected);
      }
    })
  );

  it.effect("takes an exclusive backup, restores exactly, and rejects stale recovery", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.makeDirectory(path.resolve(".beep"), { recursive: true });
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "models-fixture-",
      });
      const file = path.join(root, "config.toml");
      const backupDirectory = path.join(root, ".config-backups");
      yield* fs.writeFileString(file, native, { mode: 0o644 });
      const writer = yield* writerWithFs(fs);
      assertNone(yield* writer.apply(file, [topLevel], "dry-run", backupDirectory));
      expect(yield* fs.exists(backupDirectory)).toBe(false);
      const journal = O.getOrThrow(yield* writer.apply(file, [topLevel], "write", backupDirectory));
      expect(yield* fs.readFileString(journal.backup)).toBe(native);
      expect((yield* fs.stat(file)).mode & 0o777).toBe(0o644);
      const journalFile = path.join(backupDirectory, `${journal.id}.json`);
      yield* writer.restore(journalFile, backupDirectory);
      expect(yield* fs.readFileString(file)).toBe(native);
      expect((yield* fs.stat(file)).mode & 0o777).toBe(0o644);
      yield* Effect.flip(writer.restore(journalFile, backupDirectory));
      const second = O.getOrThrow(yield* writer.apply(file, [topLevel], "write", backupDirectory));
      for (const changed of [`${native}\n# external native write\n`, "unknown = true\n", "this is invalid\n"]) {
        yield* fs.writeFileString(file, changed);
        const error = yield* Effect.flip(
          writer.restore(path.join(backupDirectory, `${second.id}.json`), backupDirectory)
        );
        expect(error.message).toContain(`Journal: ${second.id}`);
        expect(yield* fs.readFileString(file)).toBe(changed);
      }
    })
  );

  it.effect("removes only an owned legacy key and refuses recovery when live ownership is absent", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "remove-fixture-",
      });
      const file = path.join(root, "config.toml");
      const backups = path.join(root, "backups");
      for (const key of ["sandbox_mode", '"sandbox_mode"', "'sandbox_mode'"]) {
        const before = `${key} = "danger-full-access" # legacy\r\n${native}`;
        yield* fs.writeFileString(file, before);
        const request = ModelsLocatorWrite.make({
          locator: {
            _tag: "toml-top-level-key",
            binding,
            render,
            key: "sandbox_mode",
          },
          expected: "",
          remove: true,
        });
        const writer = yield* writerWithFs(fs);
        yield* Effect.flip(writer.apply(file, [request], "check", backups));
        const journal = O.getOrThrow(yield* writer.apply(file, [request], "write", backups));
        expect(yield* fs.readFileString(file)).toBe(native);
        assertNone(yield* writer.apply(file, [request], "check", backups));
        assertNone(yield* writer.apply(file, [request], "write", backups));
        const refusal = yield* Effect.flip(writer.restore(path.join(backups, `${journal.id}.json`), backups));
        expect(refusal.message).toContain("Owned path is absent");
        expect(yield* fs.readFileString(file)).toBe(native);
        expect(yield* fs.readFileString(journal.backup)).toBe(before);
        assertNone(yield* writer.apply(file, [request], "check", backups));
      }
      const request = ModelsLocatorWrite.make({
        locator: {
          _tag: "toml-top-level-key",
          binding,
          render,
          key: "sandbox_mode",
        },
        expected: "",
        remove: true,
      });
      yield* Effect.flip(modelsWriteSpans('sandbox_mode="a"\nsandbox_mode="b"\n', request));
      yield* Effect.flip(
        modelsWriteSpans(
          "{}",
          ModelsLocatorWrite.make({
            locator: {
              _tag: "json-key",
              binding,
              render,
              pointer: ["sandbox_mode"],
              fallbacks: [],
            },
            expected: "",
            remove: true,
          })
        )
      );
    })
  );

  it.effect("keeps equal env, YAML plain, TOML literal, scalars without a write", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "equal-scalars-",
      });
      const cases: ReadonlyArray<readonly [string, string, Locator]> = [
        ["env", "MODEL=gpt-6.1-sol\n", { _tag: "env-key", binding, render, key: "MODEL" }],
        ["yaml", "model: gpt-6.1-sol\n", { _tag: "yaml-path", binding, render, path: ["model"] }],
        ["toml", "model = 'gpt-6.1-sol'\n", { _tag: "toml-top-level-key", binding, render, key: "model" }],
      ];
      const writer = yield* writerWithFs(fs);
      for (const [extension, text, locator] of cases) {
        const file = path.join(root, `config.${extension}`);
        yield* fs.writeFileString(file, text);
        assertNone(yield* writer.apply(file, [write(locator)], "check", path.join(root, "backups")));
        if (locator._tag === "toml-top-level-key")
          assertNone(yield* writer.apply(file, [write(locator)], "write", path.join(root, "backups")));
        else
          expect(
            (yield* Effect.flip(writer.apply(file, [write(locator)], "write", path.join(root, "backups")))).message
          ).toContain("check-only");
        expect(yield* fs.readFileString(file)).toBe(text);
      }
      expect(yield* fs.exists(path.join(root, "backups"))).toBe(false);
    })
  );

  for (const phase of ["planned", "in-place", "post", "replace", "restore", "recovery"]) {
    const competitor = 'model = "competitor"\nnew_native_key = true\n';
    const newest = 'model = "newest"\nnewest_native_key = true\n';
    const expected = phase === "recovery" ? newest : competitor;
    const expectedMarkers = A.contains(["planned", "post"], phase) ? 0 : 1;
    const expectedRetained = phase === "planned" ? 0 : 1;
    it.effect(`preserves the competing writer and journal during ${phase}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "native-race-",
        });
        const file = path.join(root, "config.toml");
        const backups = path.join(root, "backups");
        yield* fs.writeFileString(file, 'model = "old"\n', { mode: 0o644 });
        const writer = yield* writerWithFs(fs);
        const journal =
          phase === "restore" ? O.getOrThrow(yield* writer.apply(file, [topLevel], "write", backups)) : undefined;
        const modelsTestExchange = yield* ModelsAtomicExchange;
        let exchanges = 0;
        const replace = Effect.fnUntraced(function* (bytes: string) {
          const other = path.join(root, "competitor");
          yield* fs.writeFileString(other, bytes);
          yield* fs.rename(other, file);
        });
        const initial =
          phase === "in-place"
            ? fs.writeFileString(file, competitor)
            : A.contains(["replace", "restore", "recovery"], phase)
              ? replace(competitor)
              : Effect.void;
        const subsequent = phase === "recovery" ? replace(newest) : Effect.void;
        const post = phase === "post" ? fs.writeFileString(file, competitor) : Effect.void;
        const interferences = [Effect.void, initial, subsequent];
        const wrappedFs = FileSystem.FileSystem.of({
          ...fs,
          chmod: Effect.fn("ModelsApplyTest.chmod")((target, mode) =>
            fs
              .chmod(target, mode)
              .pipe(
                Effect.andThen(phase === "planned" && Str.endsWith(".tmp")(target) ? replace(competitor) : Effect.void)
              )
          ),
        });
        const wrappedExchange = ModelsAtomicExchange.of({
          qualify: modelsTestExchange.qualify,
          exchange: Effect.fnUntraced(function* (left, right) {
            const publication = left === file || right === file;
            if (publication) {
              exchanges += 1;
              yield* O.getOrElse(A.get(interferences, exchanges), () => Effect.void).pipe(
                ModelsLocatorError.mapError("Test interference failed.")
              );
            }
            yield* modelsTestExchange.exchange(left, right);
            if (publication && exchanges === 1)
              yield* post.pipe(ModelsLocatorError.mapError("Test interference failed."));
          }),
        });
        const racer = yield* writerWithFs(wrappedFs, wrappedExchange);
        const error = yield* Effect.flip(
          journal === undefined
            ? racer.apply(file, [topLevel], "write", backups)
            : racer.restore(path.join(backups, `${journal.id}.json`), backups)
        );
        expect(error._tag).toBe("ModelsLocatorError");
        const entries = yield* fs.readDirectory(backups);
        const journals = A.filter(entries, (entry) => Str.endsWith(".json")(entry));
        expect(journals).toHaveLength(1);
        expect(error.message).toContain(journals[0] === undefined ? undefined : Str.slice(0, -5)(journals[0]));
        expect(A.fromIterable(Str.matchAll(/Journal:/g)(error.message))).toHaveLength(1);
        expect(
          A.filter(
            entries,
            (entry) =>
              Str.startsWith((journals[0] === undefined ? undefined : Str.slice(0, -5)(journals[0])) ?? "missing")(
                entry
              ) && Str.endsWith(".concurrent")(entry)
          )
        ).toHaveLength(expectedMarkers);
        expect(yield* fs.readFileString(file)).toBe(expected);
        expect(A.filter(yield* fs.readDirectory(root), (entry) => Str.endsWith(".preimage")(entry))).toHaveLength(
          expectedRetained
        );
      })
    );
  }

  it.effect("preserves canonical model symlinks and refuses dangling links before backup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "model-link-",
      });
      const target = path.join(root, "target.toml");
      const link = path.join(root, "config.toml");
      const backups = path.join(root, "backups");
      yield* fs.writeFileString(target, native, { mode: 0o644 });
      yield* fs.symlink(target, link);
      const writer = yield* writerWithFs(fs);
      const applied = yield* writer.apply(link, [topLevel], "write", backups);
      applied.pipe(O.isSome, assertTrue);
      const journal = O.getOrThrow(applied);
      expect(yield* fs.readLink(link)).toBe(target);
      expect(yield* fs.readFileString(target)).toContain('"gpt-6.1-sol"');
      expect(yield* fs.readFileString(journal.backup)).toBe(native);
      yield* writer.restore(path.join(backups, `${journal.id}.json`), backups);
      expect(yield* fs.readFileString(target)).toBe(native);
      expect(yield* fs.readLink(link)).toBe(target);
      const dangling = path.join(root, "dangling.toml");
      yield* fs.symlink(path.join(root, "absent"), dangling);
      yield* Effect.flip(writer.apply(dangling, [topLevel], "write", path.join(root, "absent-backups")));
      expect(yield* fs.exists(path.join(root, "absent-backups"))).toBe(false);
    })
  );

  it.effect("checks operator-adjacent shell assignments and refuses unsupported forms without backups", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "shell-drift-",
      });
      const file = path.join(root, "launcher");
      const backups = path.join(root, "backups");
      const writer = yield* writerWithFs(fs);
      const assignment = write(
        {
          _tag: "shell-assign",
          binding,
          render,
          variable: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
          within: O.none(),
        },
        "gpt-6-luna"
      );
      for (const operator of [";", "&&", "||", "|", "&", "(", "\n"]) {
        const text = `:${operator}ANTHROPIC_DEFAULT_HAIKU_MODEL=wrong claude\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n`;
        yield* fs.writeFileString(file, text);
        const error = yield* Effect.flip(writer.apply(file, [assignment], "check", backups));
        expect(error._tag).toBe("ModelsLocatorError");
        expect(error.message).toContain("drift detected");
        yield* Effect.flip(writer.apply(file, [write(assignment.locator, "wrong, gpt-6-luna")], "check", backups));
        expect(yield* fs.readFileString(file)).toBe(text);
      }
      for (const text of [
        "export 'ANTHROPIC_DEFAULT_HAIKU_MODEL=wrong'; claude\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n",
        'export "ANTHROPIC_DEFAULT_HAIKU_MODEL=wrong"; claude\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna claude\n',
        "ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\nANTHROPIC_DEFAULT_HAIKU_MODEL+=wrong\n",
        ":;ANTHROPIC_DEFAULT_HAIKU_MODEL+=wrong\nANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\n",
        "# ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-6-luna\n",
      ]) {
        yield* fs.writeFileString(file, text);
        const error = yield* Effect.flip(writer.apply(file, [assignment], "check", backups));
        expect(error.message).toContain("Unsupported shell form: line");
        expect(yield* fs.readFileString(file)).toBe(text);
      }
      const flag = write(
        {
          _tag: "shell-assign",
          binding,
          render,
          variable: "--model",
          within: O.none(),
        },
        "old"
      );
      for (const text of [
        "claude x\\ --model old\n",
        "cat <<'EOF'\nclaude --model old\nEOF\n",
        'claude --model old "$@"\n',
        "claude --model 'old\n",
        "printf native \\\nclaude --model old\n",
      ]) {
        yield* fs.writeFileString(file, text);
        const error = yield* Effect.flip(writer.apply(file, [flag], "check", backups));
        expect(error.message).toContain("Unsupported shell form");
        // Unsupported evidence is never an in-sync scalar, even if a caller
        // supplies the diagnostic marker itself as the expected value.
        yield* Effect.flip(writer.apply(file, [write(flag.locator, "Unsupported shell form")], "check", backups));
        expect(yield* fs.readFileString(file)).toBe(text);
      }
      yield* fs.writeFileString(file, 'claude --model "old" # native\n');
      assertNone(yield* writer.apply(file, [flag], "check", backups));
      expect(yield* fs.exists(backups)).toBe(false);
    })
  );

  it.effect("refuses every YAML and XML write before filesystem access or backup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "check-only-" });
      const file = path.join(root, "config");
      const backups = path.join(root, "backups");
      const writer = yield* writerWithFs(fs);
      const yaml = write({ _tag: "yaml-path", binding, render, path: ["model"] });
      const xml = write({
        _tag: "xml-attribute",
        binding,
        render,
        elementSelector: 'option[name="model"]',
        attribute: "value",
      });
      const escaped = write({
        _tag: "xml-escaped-json-attribute",
        binding,
        render,
        elementSelector: 'option[name="options"]',
        attribute: "value",
        jsonPointer: ["0", "model"],
      });
      const cases = [
        ["model: gpt-6.1-sol\n", yaml],
        ["model: &shared old\nnative: *shared\n", yaml],
        ["model: {nested: old}\n", yaml],
        ['<root><option-extra name="model" value="native"/></root>', xml],
        ["<root><!-- <option name=\"model\" value=\"native\"/> --><option name='model' value='wrong'/></root>", xml],
        ['<root><q:option name="model" value="wrong"/></root>', xml],
        ['<root><option name="model" value="gpt-6.1-sol"/></root>', xml],
        ['<root><option name="options" value="[]"/></root>', escaped],
      ] as const;
      for (const [text, request] of cases) {
        yield* fs.writeFileString(file, text);
        const error = yield* Effect.flip(writer.apply(file, [request], "write", backups));
        expect(error._tag).toBe("ModelsLocatorError");
        expect(error.message).toBe(
          `${request.locator._tag === "yaml-path" ? "YAML" : "XML"} targets are check-only; edit by hand.`
        );
        expect(yield* fs.readFileString(file)).toBe(text);
        expect(yield* fs.exists(backups)).toBe(false);
      }
      yield* fs.remove(file);
      for (const request of [yaml, xml, escaped])
        expect((yield* Effect.flip(writer.apply(file, [request], "write", backups))).message).toContain("check-only");
    })
  );

  it.effect("refuses every shell write before backup, including escaped separators and earlier panel inputs", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "check-only-shell-",
      });
      const file = path.join(root, "launcher");
      const backups = path.join(root, "backups");
      const request = write({
        _tag: "shell-assign",
        binding,
        render,
        variable: "--model",
        within: O.none(),
      });
      const writer = yield* writerWithFs(fs);
      for (const text of [
        "claude x\\ --model old\n",
        "x\\ MODEL=old\n",
        "claude --model old&&printf native\n",
        "claude --model old> /dev/null\n",
        "claude --model 'old'-suffix\n",
        "claude --model old||true\n",
        "claude --model old;printf native\n",
        "claude --model 'old\n",
        "claude --model old\\\n-suffix\n",
        "claude --model # native\n",
        "cat <<'EOF'\nclaude --model old\nEOF\n",
        "claude --model old # native\n",
        "claude --model old $(printf native)\n",
        "claude --model old `printf native`\n",
        "claude --model ${MODEL}\n",
        "claude --model old{,suffix}\n",
        "printf native \\\nclaude --model old\n",
        "MODEL=old\nfoo \\\n  bar\nMODEL=old\n",
        "claude --model old\nif\n",
        ...A.map(
          ["old", "'old'", '"old"', "o\\ld", "gpt-6.1-sol(medium)", "'gpt-6.1-sol(medium)'", '"gpt-6.1-sol(medium)"'],
          (word) => `claude --model ${word} "$@"\n`
        ),
        'MODEL="gpt-6.1-sol"\n',
      ]) {
        yield* fs.writeFileString(file, text);
        for (const variable of ["--model", "MODEL"]) {
          const owned = write({
            ...request.locator,
            _tag: "shell-assign",
            binding,
            render,
            variable,
            within: O.none(),
          });
          const error = yield* Effect.flip(writer.apply(file, [owned], "write", backups));
          expect(error._tag).toBe("ModelsLocatorError");
          expect(error.message).toBe("Shell targets are check-only; edit by hand.");
          expect(yield* fs.readFileString(file)).toBe(text);
          expect(yield* fs.exists(backups)).toBe(false);
        }
      }
      const text = "claude --model old\n";
      yield* fs.writeFileString(file, text);
      assertNone(yield* writer.apply(file, [request], "dry-run", backups));
      yield* Effect.flip(writer.apply(file, [request], "check", backups));
      const current = write(
        {
          ...request.locator,
          _tag: "shell-assign",
          binding,
          render,
          variable: "--model",
          within: O.none(),
        },
        "old"
      );
      assertNone(yield* writer.apply(file, [current], "check", backups));
      yield* Effect.flip(modelsWriteSpans(text, request));
      expect(yield* fs.exists(backups)).toBe(false);
    })
  );

  for (const phase of ["introduced-link", "moved-target", "parent-link", "replaced-link", "retargeted-link"]) {
    it.effect(`refuses restore before staging when destination identity changes: ${phase}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({
          prefix: "restore-identity-",
        });
        const directory = path.join(root, "native");
        yield* fs.makeDirectory(directory);
        const file = path.join(directory, "config.toml");
        const link = path.join(root, "config-link.toml");
        const relocated = path.join(directory, "relocated.toml");
        const backups = path.join(root, "backups");
        yield* fs.writeFileString(file, native);
        const linked = phase === "replaced-link" || phase === "retargeted-link";
        if (linked) yield* fs.symlink(file, link);
        const writer = yield* writerWithFs(fs);
        const journal = O.getOrThrow(yield* writer.apply(linked ? link : file, [topLevel], "write", backups));
        const applied = yield* fs.readFileString(file);
        yield* Match.value(phase).pipe(
          Match.when("parent-link", () => {
            const moved = path.join(root, "moved");
            return fs.rename(directory, moved).pipe(Effect.andThen(fs.symlink(moved, directory)));
          }),
          Match.when("replaced-link", () => fs.remove(link).pipe(Effect.andThen(fs.writeFileString(link, applied)))),
          Match.when("retargeted-link", () =>
            fs
              .writeFileString(relocated, applied)
              .pipe(Effect.andThen(fs.remove(link)), Effect.andThen(fs.symlink(relocated, link)))
          ),
          Match.when("introduced-link", () =>
            fs.rename(file, relocated).pipe(Effect.andThen(fs.symlink(relocated, file)))
          ),
          Match.orElse(() => fs.rename(file, relocated))
        );
        const error = yield* Effect.flip(writer.restore(path.join(backups, `${journal.id}.json`), backups));
        expect(error._tag).toBe("ModelsLocatorError");
        expect(error.message).toContain(`Journal: ${journal.id}`);
        expect(yield* fs.readDirectory(backups)).toHaveLength(2);
        if (phase !== "moved-target") expect(yield* fs.readFileString(file)).toBe(applied);
        if (phase === "introduced-link") expect(yield* fs.readLink(file)).toBe(relocated);
        if (A.contains(["introduced-link", "moved-target", "retargeted-link"], phase))
          expect(yield* fs.readFileString(relocated)).toBe(applied);
        expect(
          A.filter(
            yield* fs.readDirectory(directory),
            (entry) => Str.endsWith(".tmp")(entry) || Str.endsWith(".preimage")(entry)
          )
        ).toHaveLength(0);
      })
    );
  }

  it.effect("returns a live symlink introduced inside the restore exchange window", () => restoreLinkRace(false));
  it.effect("returns a dangling symlink introduced inside the restore exchange window", () => restoreLinkRace(true));

  it.effect("refuses shell and legacy recovery journals before staging", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "shell-restore-",
      });
      const file = path.join(root, "config.toml");
      const backups = path.join(root, "backups");
      yield* fs.writeFileString(file, native);
      const writer = yield* writerWithFs(fs);
      const journal = O.getOrThrow(yield* writer.apply(file, [topLevel], "write", backups));
      const journalFile = path.join(backups, `${journal.id}.json`);
      const applied = yield* fs.readFileString(file);
      const shell = write({
        _tag: "shell-assign",
        binding,
        render,
        variable: "MODEL",
        within: O.none(),
      });
      for (const writes of [
        undefined,
        [shell],
        [write({ _tag: "yaml-path", binding, render, path: ["model"] })],
        [
          write({
            _tag: "xml-attribute",
            binding,
            render,
            elementSelector: 'option[name="model"]',
            attribute: "value",
          }),
        ],
        [
          write({
            _tag: "xml-escaped-json-attribute",
            binding,
            render,
            elementSelector: 'option[name="options"]',
            attribute: "value",
            jsonPointer: ["model"],
          }),
        ],
      ]) {
        const { writes: _owned, ...legacy } = journal;
        yield* fs.writeFileString(
          journalFile,
          yield* encodeRecoveryJournal(
            ModelsApplyJournal.make({
              ...legacy,
              writes: O.flatMap(O.fromUndefinedOr(writes), A.head).pipe(O.map((first) => [first])),
            })
          )
        );
        const error = yield* Effect.flip(writer.restore(journalFile, backups));
        expect(Str.toLowerCase(error.message)).toContain("targets are check-only");
        expect(error.message).toContain(`Journal: ${journal.id}`);
        expect(yield* fs.readFileString(file)).toBe(applied);
        expect(yield* fs.readDirectory(backups)).toHaveLength(2);
      }
    })
  );

  it.effect("removes the retained hard link when its stat fails before staging", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "preimage-stat-" });
      const file = path.join(root, "config.toml");
      const backups = path.join(root, "backups");
      yield* fs.writeFileString(file, native);
      const wrapped = FileSystem.FileSystem.of({
        ...fs,
        stat: Effect.fn("ModelsApplyTest.stat")((target) =>
          fs.stat(Str.endsWith(".preimage")(target) ? path.join(root, "missing") : target)
        ),
      });
      const writer = yield* writerWithFs(wrapped);
      const error = yield* Effect.flip(writer.apply(file, [topLevel], "write", backups));
      expect(error._tag).toBe("ModelsLocatorError");
      expect(error.message).toContain("Journal:");
      expect(yield* fs.readFileString(file)).toBe(native);
      expect(
        A.filter(
          yield* fs.readDirectory(root),
          (entry) => Str.endsWith(".preimage")(entry) || Str.endsWith(".tmp")(entry)
        )
      ).toHaveLength(0);
    })
  );

  it.effect("refuses a text target before its delimiter could be rewritten", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "unstable-span-",
      });
      const file = path.join(root, "example.txt");
      const text = 'model: "old"\n';
      yield* fs.writeFileString(file, text);
      const writer = yield* writerWithFs(fs);
      const request = write(
        {
          _tag: "line-value",
          binding,
          render,
          linePrefix: "model:",
          before: 'model: "',
          after: '"',
        },
        'new"tail'
      );
      const error = yield* Effect.flip(writer.apply(file, [request], "write", path.join(root, "backups")));
      expect(error.message).toBe("Text targets are check-only; edit by hand.");
      expect(yield* fs.readFileString(file)).toBe(text);
      expect(yield* fs.exists(path.join(root, "backups"))).toBe(false);
    })
  );

  it.effect("refuses a tampered recovery backup without replacing the live file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "backup-tamper-",
      });
      const file = path.join(root, "config.toml");
      const backups = path.join(root, "backups");
      yield* fs.writeFileString(file, 'model = "old"\n');
      const writer = yield* writerWithFs(fs);
      const journal = O.getOrThrow(yield* writer.apply(file, [topLevel], "write", backups));
      const applied = yield* fs.readFileString(file);
      yield* fs.writeFileString(journal.backup, "tampered");
      const error = yield* Effect.flip(writer.restore(path.join(backups, `${journal.id}.json`), backups));
      expect(error.message).toContain("Ineligible native target");
      expect(yield* fs.readFileString(file)).toBe(applied);
    })
  );

  it.effect("refuses table removal and preserves an absent literal dotted key", () =>
    Effect.gen(function* () {
      const request = ModelsLocatorWrite.make({
        ...topLevel,
        locator: {
          _tag: "toml-top-level-key",
          binding,
          render,
          key: "sandbox_mode",
        },
        remove: true,
      });
      for (const text of ['sandbox_mode.foo = "native"\n', '[sandbox_mode]\nfoo = "native"\n']) {
        const refusal = yield* Effect.flip(modelsWriteSpans(text, request));
        expect(refusal.message).toBe("Unsupported removal shape: owned leaf must be a scalar TOML assignment.");
      }
      const absent = '"sandbox_mode.foo" = "native"\n';
      const spans = yield* modelsWriteSpans(absent, request);
      expect(spans).toHaveLength(0);
      expect(yield* modelsApplySpans(absent, spans)).toBe(absent);
    })
  );

  it.effect("rejects absent and duplicate scalar addresses and overlapping ownership", () =>
    Effect.gen(function* () {
      yield* Effect.flip(modelsWriteSpans("unknown = true\n", topLevel));
      yield* Effect.flip(modelsWriteSpans('model = "a"\nmodel = "b"\n', topLevel));
      const spans = yield* modelsWriteSpans(native, topLevel);
      yield* Effect.flip(modelsApplySpans(native, [...spans, ...spans]));
    })
  );

  it.effect("rejects duplicate JSON keys and a top-level key hidden in a commented native table", () =>
    Effect.gen(function* () {
      const json = write({
        _tag: "json-key",
        binding,
        render,
        pointer: ["model"],
        fallbacks: [],
      });
      yield* Effect.flip(modelsWriteSpans('{"model":"one","model":"two"}', json));
      yield* Effect.flip(modelsWriteSpans('[native] # retained\nmodel = "native-value"\n', topLevel));
    })
  );

  it.effect("refuses XML-embedded JSON span generation without rewriting entity spelling", () =>
    Effect.gen(function* () {
      const request = write({
        _tag: "xml-escaped-json-attribute",
        binding,
        render,
        elementSelector: 'option[name="options"]',
        attribute: "value",
        jsonPointer: ["0", "model"],
      });
      const text = '<root><option name="options" value="[{&quot;model&quot;:&quot;old&quot;}]"/></root>';
      const error = yield* Effect.flip(modelsWriteSpans(text, request));
      expect(error.message).toBe("XML targets are check-only; edit by hand.");
    })
  );

  it.effect("keeps native parser input out of validation errors", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "private-parser-",
      });
      const file = path.join(root, "config.json");
      yield* fs.writeFileString(file, '{"model":"old", "unownedCredential":"__SYNTHETIC_PRIVATE__", malformed');
      const request = write({
        _tag: "json-key",
        binding,
        render,
        pointer: ["model"],
        fallbacks: [],
      });
      const writer = yield* writerWithFs(fs);
      const error = yield* Effect.flip(writer.apply(file, [request], "write", path.join(root, "backups")));
      expect(error.message).toBe("Ineligible native target: Invalid JSON target.");
      expect(error.cause).toBeUndefined();
      expect(yield* fs.exists(path.join(root, "backups"))).toBe(false);
    })
  );

  it.effect("refuses invalid UTF-8 without changing or backing up normalized bytes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "native-bytes-",
      });
      const file = path.join(root, "config.toml");
      const bytes = new Uint8Array([0xff, 0xfe, 0x23]);
      yield* fs.writeFile(file, bytes);
      const writer = yield* writerWithFs(fs);
      yield* Effect.flip(writer.apply(file, [topLevel], "write", path.join(root, "backups")));
      expect(A.fromIterable(yield* fs.readFile(file))).toEqual(A.fromIterable(bytes));
      expect(yield* fs.exists(path.join(root, "backups"))).toBe(false);
    })
  );
});
