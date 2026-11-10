import { hashBytes, libraryStatus, renderLibrary } from "@beep/repo-cli/commands/Research";
import { migrateLibrary } from "@beep/repo-cli/commands/Research/Library/Library.migrate";
import { LibraryMigrationReceipt } from "@beep/repo-cli/commands/Research/Library/Library.schemas";
import { fcRuns } from "@beep/test-utils";
import { expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { fixture, fixtureDirectory, LibraryCatalogJson, replayServices } from "./support/ResearchLibraryReplay.ts";

const ReplayLines = S.Array(S.String);
const ReplayManifest = S.fromJsonString(S.Record(S.String, S.String));
const LibraryMigrationReceiptJson = S.fromJsonString(LibraryMigrationReceipt);

const written = Effect.fn("replay.written")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files: Record<string, string> = {};
  const walk = Effect.fn("replay.walk")(function* (
    directory: string
  ): Effect.fn.Return<
    void,
    import("effect/PlatformError").PlatformError | import("@beep/repo-cli/commands/Research").LibraryError,
    FileSystem.FileSystem | Path.Path | import("effect/crypto/Digest").Digest
  > {
    const entries = yield* fs.readDirectory(path.join(root, directory));
    for (const name of A.sort(entries, Str.Order)) {
      const relative = path.join(directory, name);
      const info = yield* fs.stat(path.join(root, relative));
      if (info.type === "Directory") yield* walk(relative);
      else {
        const bytes = yield* fs.readFile(path.join(root, relative));
        files[relative] = yield* hashBytes(bytes);
      }
    }
  });
  for (const directory of ["sources", "views"]) yield* walk(directory);
  for (const name of ["index.md", "index.html"]) {
    const bytes = yield* fs.readFile(path.join(root, name));
    files[name] = yield* hashBytes(bytes);
  }
  return files;
});

it.layer(replayServices, { timeout: "60 seconds" })("library legacy replay", (it) => {
  const replay = Effect.fn("replay.assert")(function* (date: string) {
    const { root, fs, path } = yield* fixture(date);
    yield* renderLibrary(root);
    const console = yield* TestConsole.make;
    yield* libraryStatus(root).pipe(Effect.provideService(Console.Console, console));
    const lines = yield* console.logLines;
    const strings = yield* S.decodeUnknownEffect(ReplayLines)(lines);
    const status = `${A.join(strings, "\n")}\n`;
    const index = yield* fs.readFileString(path.join(root, "index.md"));
    const manifest = yield* written(root);
    const goldenIndex = yield* fs.readFileString(`${fixtureDirectory}/index-${date}.md`);
    const goldenStatus = yield* fs.readFileString(`${fixtureDirectory}/status-${date}.txt`);
    const manifestText = yield* fs.readFileString(`${fixtureDirectory}/files-${date}.json`);
    const goldenManifest = yield* S.decodeEffect(ReplayManifest)(manifestText);
    expect(index).toBe(goldenIndex);
    const legacy = `${goldenStatus}private partition: documents=0 sources=0 artifacts=0 occurrences=0\n`;
    // Per-hop totals follow the October status byte for byte.
    expect(Str.slice(0, legacy.length)(status)).toBe(legacy);
    expect(A.map(Str.split(Str.trimEnd(Str.slice(legacy.length)(status)), "\n"), Str.slice(0, 6))).toEqual([
      "hop 0:",
      "hop 1:",
      "hop 2:",
    ]);
    expect(manifest).toEqual(goldenManifest);
    return root;
  });
  it.effect.each(["2026-10-06", "2026-10-14"])(
    "replays %s byte for byte",
    Effect.fnUntraced(function* (date) {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* replay(date);
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
    })
  );
  const migrationReplay = Effect.fn("replay.migration")(function* (date: string) {
    const { root, fs, path, catalog } = yield* fixture(date);
    yield* renderLibrary(root);
    const index = yield* fs.readFileString(path.join(root, "index.md"));
    const before = yield* fs.readFile(path.join(root, "catalog/library.json"));
    const beforeSha = yield* hashBytes(before);
    const dry = yield* migrateLibrary(root, true);
    expect(O.isSome(dry)).toBe(true);
    const stillBefore = yield* fs.readFile(path.join(root, "catalog/library.json"));
    expect(stillBefore).toEqual(before);
    const noBackup = yield* fs.exists(path.join(root, "catalog/history"));
    expect(noBackup).toBe(false);
    const receiptOption = yield* migrateLibrary(root);
    const receipt = O.getOrThrow(receiptOption);
    const receiptNames = yield* fs.readDirectory(path.join(root, "ops/migrations"));
    expect(receiptNames.length).toBe(1);
    const receiptText = yield* fs.readFileString(path.join(root, "ops/migrations", A.getUnsafe(receiptNames, 0)));
    const persisted = yield* S.decodeEffect(LibraryMigrationReceiptJson)(receiptText);
    expect(persisted).toEqual(receipt);
    expect(receipt.fromSchema).toBe("beep.research.library/v1");
    expect(receipt.toSchema).toBe("beep.research.library/v2");
    expect(receipt.validatorContract).toBe("research-library-shapes/1");
    expect(receipt.beforeCatalogSha256).toBe(beforeSha);
    expect(receipt.shaclViolations).toBe(0);
    expect(receipt.intakeIds).toEqual([date]);
    const after = yield* fs.readFile(path.join(root, "catalog/library.json"));
    const afterSha = yield* hashBytes(after);
    expect(receipt.afterCatalogSha256).toBe(afterSha);
    const next = yield* S.decodeEffect(LibraryCatalogJson)(new TextDecoder().decode(after));
    expect(next.schema).toBe("beep.research.library/v2");
    expect(next.sources).toEqual(catalog.sources);
    const backup = yield* fs.readFile(path.join(root, `catalog/history/${beforeSha}.json`));
    expect(backup).toEqual(before);
    const indexAfter = yield* fs.readFileString(path.join(root, "index.md"));
    expect(indexAfter).toBe(index);
    const noop = yield* migrateLibrary(root);
    expect(O.isNone(noop)).toBe(true);
    const afterNoop = yield* fs.readFile(path.join(root, "catalog/library.json"));
    expect(afterNoop).toEqual(after);
    const receiptNamesAfter = yield* fs.readDirectory(path.join(root, "ops/migrations"));
    expect(receiptNamesAfter).toEqual(receiptNames);
    return root;
  });
  it.effect.each(["2026-10-06", "2026-10-14"])(
    "migrates %s with exact backup and no-op replay",
    Effect.fnUntraced(function* (date) {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* migrationReplay(date);
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
    })
  );
});

it.effect.prop(
  "property: schema-generated LibraryMigrationReceipt retains every field through JSON",
  { value: Arbitrary.schema(LibraryMigrationReceipt) },
  Effect.fnUntraced(function* ({ value }) {
    const encoded = yield* S.encodeEffect(LibraryMigrationReceiptJson)(value);
    const decoded = yield* S.decodeEffect(LibraryMigrationReceiptJson)(encoded);
    expect(decoded).toEqual(value);
  }),
  { arbitrary: fcRuns(32) }
);
