import {
  EffectVitestInventoryDocument,
  EffectVitestInventoryPath,
  EffectVitestLintOptions,
  isEffectVitestScopePath,
  lintEffectVitestCommand,
  runEffectVitestFilesLint,
} from "@beep/repo-cli/commands/Lint";
import { findRepoRoot } from "@beep/repo-utils";
import { FsUtils, FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { A, Str } from "@beep/utils";
import { expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";

// goals/compute-profile-gate-routing P3 (2026-11-13 dankserver acceptance finding 6): a worker
// host cannot run Lint Policy, but its effect-vitest pass over one file is one syntax parse
// (0.5 s, 166 MB there). `lint effect-vitest --files` exposes that pass with the full scan's
// detector and ratchet and no repository walk.

const TestLayer = Layer.mergeAll(
  NodeCommandTestLayer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeCommandTestLayer))
);

const encodeInventoryJson = S.encodeEffect(S.fromJsonString(EffectVitestInventoryDocument));
const runCommand = Command.runWith(lintEffectVitestCommand, { version: "0.0.0" });

const fixture = A.join(
  [
    'import { it, expect } from "@effect/vitest";',
    'import * as Effect from "effect/Effect";',
    'import { Option } from "effect";',
    'it("runs", () => Effect.runSync(Effect.void));',
    'it("none", () => expect(Option.isNone(value)).toBe(true));',
    "",
  ],
  "\n"
);
const nodeTest = "packages/tooling/tool/cli/test/__scoped_files_fixture__.test.ts";
const supportModule = "packages/tooling/tool/cli/test/support/__scoped_files_fixture__.ts";
// Under packages/drivers/graph-3d, whose vitest.browser.config.ts enables browser mode for
// test/browser/**: its `node:assert` replacement rows (EV006) are dropped as in the full scan.
const browserTest = "packages/drivers/graph-3d/test/browser/__scoped_files_fixture__.test.ts";
const rootTest = "packages/__scoped_files_fixture__.test.ts";
const infraTest = "infra/__scoped_files_fixture__.test.ts";
const outsideScope = "packages/tooling/tool/cli/src/bin.ts";

// The fixtures read as files, the inventory as `inventory` (None: absent), and a full-scan
// walk dies: the scoped mode must never glob the D9 scope or the vitest configs.
const scopedServices = Effect.fnUntraced(function* (inventory: O.Option<string>) {
  const fs = yield* FileSystem.FileSystem;
  const fsUtils = yield* FsUtils;
  const path = yield* Path.Path;
  const root = yield* findRepoRoot();
  const fixtures = HashMap.fromIterable(
    A.map(
      [nodeTest, supportModule, browserTest, rootTest, infraTest],
      (file) => [path.join(root, file), fixture] as const
    )
  );
  const inventoryPath = path.join(root, EffectVitestInventoryPath);
  const fileSystem = FileSystem.FileSystem.of({
    ...fs,
    exists: Effect.fn("FileSystem.FileSystem.exists")((file) =>
      file === inventoryPath ? inventory.pipe(O.isSome, Effect.succeed) : fs.exists(file)
    ),
    readFileString: Effect.fn("FileSystem.FileSystem.readFileString")((file, encoding) =>
      O.match(file === inventoryPath ? inventory : HashMap.get(fixtures, file), {
        onNone: () => fs.readFileString(file, encoding),
        onSome: Effect.succeed,
      })
    ),
  });
  const scanless = FsUtils.of({
    ...fsUtils,
    globFiles: Effect.fn("FsUtils.globFiles")(() => Effect.die("the scoped effect-vitest mode walked the repository")),
  });
  return { fileSystem, scanless };
});

const withScopedServices =
  (inventory: O.Option<string>) =>
  <Value, Failure, Requirements>(self: Effect.Effect<Value, Failure, Requirements>) =>
    Effect.flatMap(scopedServices(inventory), ({ fileSystem, scanless }) =>
      self.pipe(Effect.provideService(FileSystem.FileSystem, fileSystem), Effect.provideService(FsUtils, scanless))
    );

const scopedOptions = (files: ReadonlyArray<string>, overrides: { readonly write?: boolean } = {}) =>
  EffectVitestLintOptions.make({ census: false, write: false, rows: O.none(), files, ...overrides });

const consoleText = Effect.gen(function* () {
  const logged = yield* TestConsole.logLines;
  const errored = yield* TestConsole.errorLines;
  return { log: A.map(logged, String), error: A.map(errored, String) };
});

it.layer(TestLayer, { timeout: "60 seconds" })("lint effect-vitest --files", (it) => {
  it("keeps the D9 scope without a walk", () => {
    assertTrue(isEffectVitestScopePath(nodeTest));
    assertTrue(isEffectVitestScopePath(supportModule));
    expect(
      A.map(
        [outsideScope, "packages/a/dist/test/a.test.ts", "packages/a/.turbo/test/a.ts", "README.md"],
        isEffectVitestScopePath
      )
    ).toEqual([false, false, false, false]);
  });

  it.effect("fails on new rows in the named files, names each by rule and line, and never walks the repository", () =>
    Effect.gen(function* () {
      const failure = yield* runEffectVitestFilesLint(
        scopedOptions([nodeTest, supportModule, `./${browserTest}`, outsideScope, nodeTest])
      ).pipe(withScopedServices(O.none()), Effect.flip);
      expect(failure._tag).toBe("CliReportedExit");
      expect(failure.message).toBe("effect-vitest: ratchet failed on new instances.");
      const { log, error } = yield* consoleText;
      expect(log).toContain(`[effect-vitest] skipped 1 file(s) outside the scan scope: ${outsideScope}`);
      expect(A.some(log, Str.includes("files=3 "))).toBe(true);
      expect(A.some(log, Str.includes("(scoped, no repository scan)"))).toBe(true);
      const details = A.filter(error, Str.startsWith("[effect-vitest]   packages/"));
      const ruleIn = (file: string) =>
        A.map(
          A.filter(details, (line) => Str.startsWith(`[effect-vitest]   ${file}:`)(line)),
          (line) => Str.split(line, " ")[4]
        );
      // The support module keeps only resource-wrapper (EV003) rows, which it has none of.
      expect(ruleIn(supportModule)).toEqual([]);
      expect(ruleIn(nodeTest)).toEqual(expect.arrayContaining(["EV001", "EV006"]));
      expect(ruleIn(browserTest)).toContain("EV001");
      expect(ruleIn(browserTest)).not.toContain("EV006");
      expect(A.some(error, Str.startsWith("[effect-vitest] total: "))).toBe(true);
    })
  );

  it.effect("passes a file whose rows the committed baseline already holds", () =>
    Effect.gen(function* () {
      // A checked-in test whose native-subject EV010 row is a reviewed exception.
      const timing = yield* runEffectVitestFilesLint(
        scopedOptions(["packages/tooling/tool/cli/test/basic-ftp-compatibility.test.ts"])
      );
      expect(timing.fileCount).toBe(1);
      assertTrue(timing.findingCount >= 1);
      const { log } = yield* consoleText;
      expect(log).toContain("[effect-vitest] introduced=0 resolved=0");
    })
  );

  it.effect("refuses a baseline written under another graph pin, and a scoped run that would write", () =>
    Effect.gen(function* () {
      const stale = yield* encodeInventoryJson(
        EffectVitestInventoryDocument.make({
          schemaVersion: "effect-vitest-inventory/v1",
          effectVitestVersion: "4.0.0-rc.111",
          scope: [],
          findings: [],
        })
      );
      const pinned = yield* runEffectVitestFilesLint(scopedOptions([nodeTest])).pipe(
        withScopedServices(O.some(stale)),
        Effect.flip
      );
      expect(pinned._tag).toBe("EffectVitestLintError");
      expect(pinned.message).toContain("Baseline pin 4.0.0-rc.111 does not match graph pin");
      const writing = yield* runEffectVitestFilesLint(scopedOptions([nodeTest], { write: true })).pipe(Effect.flip);
      expect(writing.message).toBe(
        "--files checks only the named files; it cannot be combined with --census, --write or --rows."
      );
    })
  );

  it.effect("handles empty scope, unowned files, unreadable files and incompatible flag modes", () =>
    Effect.gen(function* () {
      const empty = yield* runEffectVitestFilesLint(scopedOptions([outsideScope]));
      expect(empty.fileCount).toBe(0);
      const unowned = yield* runEffectVitestFilesLint(scopedOptions([rootTest, infraTest])).pipe(
        withScopedServices(O.none()),
        Effect.flip
      );
      expect(unowned._tag).toBe("CliReportedExit");
      const unreadable = yield* runEffectVitestFilesLint(
        scopedOptions(["packages/tooling/tool/cli/test/__missing_scoped__.test.ts"])
      ).pipe(Effect.flip);
      expect(unreadable._tag).toBe("EffectVitestLintError");
      for (const mode of [{ census: true }, { rows: O.some("/tmp/unused-scoped-rows") }]) {
        const incompatible = yield* runEffectVitestFilesLint(
          EffectVitestLintOptions.make({ ...scopedOptions([nodeTest]), ...mode })
        ).pipe(Effect.flip);
        expect(incompatible._tag).toBe("EffectVitestLintError");
      }
    })
  );

  it.effect("routes --files through the scoped mode and keeps the flagless command a full scan", () =>
    Effect.gen(function* () {
      const scoped = yield* runCommand(["--files", nodeTest]).pipe(withScopedServices(O.none()), Effect.flip);
      expect(scoped.message).toBe("effect-vitest: ratchet failed on new instances.");
      const full = yield* runCommand([]).pipe(withScopedServices(O.none()), Effect.exit);
      // The flagless command walks the D9 scope, which the scanless double refuses.
      expect(full._tag).toBe("Failure");
    })
  );
});
