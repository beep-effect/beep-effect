import { Git } from "@beep/git/Git";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import {
  inventoryLibrary,
  inventoryLibraryWithHops,
  LibraryInventoryOptions,
  libraryStatus,
  renderLibrary,
  verifyLibrary,
} from "@beep/repo-cli/commands/Research";
import { ShaclValidationServiceLive } from "@beep/shacl";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { LibraryCatalog } from "@beep/repo-cli/commands/Research";

const InventoryPlatform = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  FetchHttpClient.layer,
  OxigraphSparqlQueryServiceLive,
  ShaclValidationServiceLive
);
const LibraryPlatform = Layer.provideMerge(Git.layer, InventoryPlatform);

const PUBLIC_REPORT = "# Public aggregation report\nSee https://example.com/public-paper for context.\n";
const PRIVATE_REPORT = "# Private intake report\nSee https://example.com/private-paper for context.\n";

// `<aggregation>/Research-11-5-26` sits inside the public `<aggregation>` root.
const nestedFixture = Effect.fn("test.privateInventory.nestedFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "library-private-" });
  const aggregation = path.join(temporary, "aggregation");
  const privateRoot = path.join(aggregation, "Research-11-5-26");
  const root = path.join(temporary, "library");
  yield* fs.makeDirectory(privateRoot, { recursive: true });
  yield* fs.writeFileString(path.join(aggregation, "public.md"), PUBLIC_REPORT);
  yield* fs.writeFileString(path.join(privateRoot, "private.md"), PRIVATE_REPORT);
  const options = LibraryInventoryOptions.make({
    libraryRoot: root,
    inputRoots: [aggregation],
    privateInputRoots: [privateRoot],
  });
  return { fs, path, temporary, aggregation, privateRoot, root, options };
});

const sourceAccess = (catalog: LibraryCatalog, url: string) =>
  O.map(
    A.findFirst(catalog.sources, (source) => source.canonicalUrl === url),
    (source) => source.accessClass
  );

it.layer(LibraryPlatform, { timeout: "60 seconds" })("research library private inventory", (it) => {
  it.effect("inventories a nested private root once and classifies its subtree private", () =>
    Effect.gen(function* () {
      const { path, aggregation, privateRoot, options } = yield* nestedFixture();
      const catalog = yield* inventoryLibrary(options);
      expect(catalog.documents).toHaveLength(2);
      const byTitle = (title: string) =>
        O.getOrThrow(A.findFirst(catalog.documents, (document) => document.title === title));
      expect(byTitle("Public aggregation report").accessClass).toBe("public");
      expect(byTitle("Private intake report").accessClass).toBe("private");
      const intake = O.getOrThrow(A.last(catalog.intakes));
      // The private file is listed once, through the public root walk, with its private class.
      expect(A.map(intake.files, (file) => [file.originalPath, file.accessClass])).toEqual([
        [path.join(privateRoot, "private.md"), "private"],
        [path.join(aggregation, "public.md"), "public"],
      ]);
      expect(A.map(intake.inputRoots, (root) => [root.path, root.accessClass])).toEqual([
        [aggregation, "public"],
        [privateRoot, "private"],
      ]);
      const manifest = O.getOrThrow(
        A.findFirst(catalog.artifacts, (artifact) => artifact.path === intake.manifestPath)
      );
      expect(manifest.accessClass).toBe("private");
      deepStrictEqual(sourceAccess(catalog, "https://example.com/public-paper"), O.some("public"));
      deepStrictEqual(sourceAccess(catalog, "https://example.com/private-paper"), O.some("private"));
    })
  );

  it.effect("hashes video in place as referenced media and never snapshots its bytes", () =>
    Effect.gen(function* () {
      const { fs, path, aggregation, root, options } = yield* nestedFixture();
      const video = path.join(aggregation, "Videos", "channel", "talk.mkv");
      yield* fs.makeDirectory(path.dirname(video), { recursive: true });
      yield* fs.writeFileString(video, "not really matroska");
      const catalog = yield* inventoryLibrary(options);
      const intake = O.getOrThrow(A.last(catalog.intakes));
      const entry = O.getOrThrow(A.findFirst(intake.files, (file) => file.originalPath === video));
      expect([entry.retention, entry.snapshotPath, entry.bytes, entry.parseable]).toEqual([
        "referenced",
        "",
        19,
        false,
      ]);
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      const raw = yield* fs.readDirectory(path.join(root, "intakes", intake.date, "raw"));
      expect(A.some(raw, Str.endsWith(".mkv"))).toBe(false);
      expect(
        A.every(
          A.filter(intake.files, (file) => file.originalPath !== video),
          (file) => file.retention === "snapshot"
        )
      ).toBe(true);
    })
  );

  it.effect("flags referenced media whose size changed after the intake census", () =>
    Effect.gen(function* () {
      const { fs, path, aggregation, root, options } = yield* nestedFixture();
      const video = path.join(aggregation, "Videos", "talk.mp4");
      yield* fs.makeDirectory(path.dirname(video), { recursive: true });
      yield* fs.writeFileString(video, "short");
      yield* inventoryLibrary(options);
      const issue = `${video}: referenced media size changed since the intake census`;
      const before = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(before, { onFailure: Cause.pretty, onSuccess: () => "" })).not.toContain(issue);
      yield* fs.writeFileString(video, "a longer recording");
      const after = yield* Effect.exit(verifyLibrary(root));
      expect(Exit.match(after, { onFailure: Cause.pretty, onSuccess: () => "" })).toContain(issue);
    })
  );

  it.effect("turns a privately cited source public once a public document cites it", () =>
    Effect.gen(function* () {
      const { fs, path, aggregation, privateRoot, options } = yield* nestedFixture();
      const shared = "https://github.com/owner/shared/issues/7";
      yield* fs.writeFileString(path.join(privateRoot, "private.md"), `# Private intake report\nTracks ${shared}.\n`);
      const first = yield* inventoryLibrary(options);
      deepStrictEqual(sourceAccess(first, shared), O.some("private"));
      // The repository identity a private citation implies is private context too.
      deepStrictEqual(sourceAccess(first, "https://github.com/owner/shared"), O.some("private"));
      yield* fs.writeFileString(path.join(aggregation, "public.md"), `# Public aggregation report\nAlso ${shared}.\n`);
      const second = yield* inventoryLibrary(options);
      deepStrictEqual(sourceAccess(second, shared), O.some("public"));
      deepStrictEqual(sourceAccess(second, "https://github.com/owner/shared"), O.some("public"));
    })
  );

  it.effect("keeps byte-identical public and private copies in their own partitions", () =>
    Effect.gen(function* () {
      const { fs, path, aggregation, privateRoot, options } = yield* nestedFixture();
      yield* fs.writeFileString(path.join(aggregation, "copy.md"), PRIVATE_REPORT);
      const catalog = yield* inventoryLibrary(options);
      const copies = A.filter(catalog.documents, (document) => document.title === "Private intake report");
      expect(A.map(copies, (document) => [document.originalPath, document.accessClass])).toEqual([
        [path.join(privateRoot, "private.md"), "private"],
        [path.join(aggregation, "copy.md"), "public"],
      ]);
      expect(A.dedupe(A.map(copies, (document) => document.snapshotPath))).toHaveLength(1);
      // The public copy cites the same source, so the source stays public.
      deepStrictEqual(sourceAccess(catalog, "https://example.com/private-paper"), O.some("public"));
    })
  );

  it.effect("records a new intake snapshot when the private classification changes", () =>
    Effect.gen(function* () {
      const { aggregation, root, options } = yield* nestedFixture();
      const asPublic = LibraryInventoryOptions.make({ libraryRoot: root, inputRoots: [aggregation] });
      const first = yield* inventoryLibrary(asPublic);
      const repeated = yield* inventoryLibrary(asPublic);
      expect(repeated.intakes).toHaveLength(first.intakes.length);
      const privateRun = yield* inventoryLibrary(options);
      expect(privateRun.intakes).toHaveLength(first.intakes.length + 1);
      expect(A.map(privateRun.documents, (document) => [document.title, document.accessClass])).toEqual([
        ["Private intake report", "private"],
        ["Public aggregation report", "public"],
      ]);
    })
  );

  it.effect("reports the private partition in status and excludes it from rendered views", () =>
    Effect.gen(function* () {
      const { fs, path, root, options } = yield* nestedFixture();
      const catalog = yield* inventoryLibraryWithHops(options);
      expect(A.filter(catalog.derivations, (derivation) => derivation.hopDepth === 1)).toHaveLength(2);
      const console = yield* TestConsole.make;
      yield* libraryStatus(root).pipe(Effect.provideService(Console.Console, console));
      const lines = yield* console.logLines;
      expect(lines).toContain("library status: reports=1 sources=1 occurrences=1");
      expect(lines).toContain("private partition: documents=1 sources=1 artifacts=1 occurrences=1");
      const privateDocument = O.getOrThrow(
        A.findFirst(catalog.documents, (document) => document.accessClass === "private")
      );
      yield* renderLibrary(root);
      const index = yield* fs.readFileString(path.join(root, "index.md"));
      expect(index).toContain("Public aggregation report");
      expect(index).not.toContain("Private intake report");
      expect(index).not.toContain("private-paper");
      const privateView = yield* fs.exists(path.join(root, "views/reports", privateDocument.id));
      expect(privateView).toBe(false);
      yield* renderLibrary(root, true);
      const allIndex = yield* fs.readFileString(path.join(root, "index.md"));
      expect(allIndex).toContain("Private intake report");
    })
  );
});
