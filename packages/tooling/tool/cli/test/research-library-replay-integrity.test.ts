import { LibraryCatalog, libraryStatus, renderLibrary } from "@beep/repo-cli/commands/Research";
import { migrateLibrary } from "@beep/repo-cli/commands/Research/Library/Library.migrate";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryDocument,
  LibraryOccurrence,
  LibrarySource,
  LibrarySourceVersion,
} from "@beep/repo-cli/commands/Research/Library/Library.schemas";
import { fcRuns } from "@beep/test-utils";
import { expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { fixture, LibraryCatalogJson, replayServices } from "./support/ResearchLibraryReplay.ts";

it.layer(replayServices, { timeout: "60 seconds" })("library legacy replay integrity", (it) => {
  it.effect(
    "rejects a tampered index before writing catalog, backup or receipt",
    Effect.fnUntraced(function* () {
      const { root, fs, path } = yield* fixture("2026-10-06");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      yield* renderLibrary(root);
      const target = path.join(root, "catalog/library.json");
      const before = yield* fs.readFile(target);
      yield* fs.writeFileString(path.join(root, "index.md"), "tampered\n");
      const result = yield* Effect.exit(migrateLibrary(root));
      const message = Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" });
      expect(message).toContain("rendered=");
      expect(message).toContain("disk=");
      const after = yield* fs.readFile(target);
      expect(after).toEqual(before);
      const backupExists = yield* fs.exists(path.join(root, "catalog/history"));
      const receiptsExist = yield* fs.exists(path.join(root, "ops/migrations"));
      expect(backupExists).toBe(false);
      expect(receiptsExist).toBe(false);
    })
  );
  it.effect(
    "propagates private documents, sources and artifacts through every view",
    Effect.fnUntraced(function* () {
      const { root, fs, path, catalog } = yield* fixture("2026-10-14");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      const privateCatalog = LibraryCatalog.make({
        ...catalog,
        documents: A.map(catalog.documents, (d) =>
          LibraryDocument.make({ ...d, accessClass: d.id === "a" ? "private" : "public" })
        ),
        sources: A.map(catalog.sources, (source) =>
          LibrarySource.make({ ...source, accessClass: source.id === "s1" ? "private" : "public" })
        ),
        captures: A.map(catalog.captures, (capture) =>
          LibraryCapture.make({
            ...capture,
            artifacts: A.map(capture.artifacts, (artifact) =>
              LibraryArtifact.make({ ...artifact, accessClass: capture.id === "c0" ? "private" : "public" })
            ),
          })
        ),
      });
      const encoded = yield* S.encodeEffect(LibraryCatalogJson)(privateCatalog);
      yield* fs.writeFileString(path.join(root, "catalog/library.json"), encoded);
      yield* renderLibrary(root);
      const index = yield* fs.readFileString(path.join(root, "index.md"));
      expect(index).not.toContain("Report a");
      expect(index).not.toContain("Source 1");
      const privateReportExists = yield* fs.exists(path.join(root, "views/reports/a/REPORT.md"));
      const privateSourceExists = yield* fs.exists(path.join(root, "sources/s1/SOURCE.md"));
      expect(privateReportExists).toBe(false);
      expect(privateSourceExists).toBe(false);
      const source = yield* fs.readFileString(path.join(root, "sources/s0/SOURCE.md"));
      expect(source).not.toContain("[a]");
      expect(source).not.toContain("Readable raw-response](artifact-c0");
      const console = yield* TestConsole.make;
      yield* libraryStatus(root).pipe(Effect.provideService(Console.Console, console));
      const lines = yield* console.logLines;
      expect(lines).toContain("library status: reports=2 sources=2 occurrences=1");
      expect(lines).toContain("private partition: documents=1 sources=1 artifacts=3 occurrences=2");
      yield* renderLibrary(root, true);
      const allIndex = yield* fs.readFileString(path.join(root, "index.md"));
      expect(allIndex).toContain("Report a");
      expect(allIndex).toContain("Source 1");
    })
  );
  it.effect(
    "rejects SHACL violations without writing migration state",
    Effect.fnUntraced(function* () {
      const { root, fs, path, catalog } = yield* fixture("2026-10-06");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      const invalid = LibraryCatalog.make({
        ...catalog,
        occurrences: A.map(catalog.occurrences, (o) => LibraryOccurrence.make({ ...o, sourceId: "unknown-source" })),
      });
      const encoded = yield* S.encodeEffect(LibraryCatalogJson)(invalid);
      const target = path.join(root, "catalog/library.json");
      yield* fs.writeFileString(target, encoded);
      yield* renderLibrary(root);
      const result = yield* Effect.exit(migrateLibrary(root));
      const message = Exit.match(result, { onFailure: Cause.pretty, onSuccess: () => "" });
      expect(message).toContain("shacl violations=3");
      const unchanged = yield* fs.readFileString(target);
      expect(unchanged).toBe(encoded);
      const backup = yield* fs.exists(path.join(root, "catalog/history"));
      const receipt = yield* fs.exists(path.join(root, "ops/migrations"));
      expect(backup).toBe(false);
      expect(receipt).toBe(false);
    })
  );
  it.effect(
    "keeps distinct version locators at the same revision SHACL-conformant",
    Effect.fnUntraced(function* () {
      const { root, fs, path, catalog } = yield* fixture("2026-10-14");
      const canonical = yield* fs.realPath(root);
      expect(canonical).toBe(root);
      const versioned = LibraryCatalog.make({
        ...catalog,
        sources: A.map(catalog.sources, (source) =>
          LibrarySource.make({
            ...source,
            versions: A.map(["one", "two"], (suffix) =>
              LibrarySourceVersion.make({
                revision: "",
                canonicalUrl: `${source.canonicalUrl}/${suffix}`,
                locators: [source.canonicalUrl],
              })
            ),
          })
        ),
      });
      const encoded = yield* S.encodeEffect(LibraryCatalogJson)(versioned);
      yield* fs.writeFileString(path.join(root, "catalog/library.json"), encoded);
      yield* renderLibrary(root);
      const receipt = yield* migrateLibrary(root, true);
      expect(O.getOrThrow(receipt).shaclViolations).toBe(0);
    })
  );
});

const LibrarySourceVersionJson = S.fromJsonString(LibrarySourceVersion);

it.effect.prop(
  "property: schema-generated LibrarySourceVersion retains every field through JSON",
  { value: Arbitrary.schema(LibrarySourceVersion) },
  Effect.fnUntraced(function* ({ value }) {
    const encoded = yield* S.encodeEffect(LibrarySourceVersionJson)(value);
    const decoded = yield* S.decodeEffect(LibrarySourceVersionJson)(encoded);
    expect(decoded).toEqual(value);
  }),
  { arbitrary: fcRuns(32) }
);
