/**
 * Read-only preflight and hash-gated catalog v2 migration.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LibraryError } from "./Library.errors.ts";
import { assembleLibraryOntology, libraryShapes, libraryShapesDataset } from "./Library.ontology.ts";
import { libraryIndexMarkdown } from "./Library.render.ts";
import { LibraryCatalog, LibraryMigrationReceipt } from "./Library.schemas.ts";
import { hashBytes, loadCatalog, saveImmutable, withCatalog } from "./Library.store.ts";
import { libraryViewDataset } from "./Library.views.ts";

const encodeCatalog = S.encodeEffect(S.fromJsonString(LibraryCatalog));
const hashText = (text: string) => hashBytes(new TextEncoder().encode(text));
const failure = (message: string) => (cause: unknown) => LibraryError.make({ message, cause });

const prepare = Effect.fn("Library.prepareMigration")(function* (root: string, catalog: LibraryCatalog) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonical = path.join(root, "catalog/library.json");
  const target = (yield* fs.exists(canonical)) ? canonical : path.join(root, "catalog.json");
  const before = yield* fs.readFile(target);
  const beforeCatalogSha256 = yield* hashBytes(before);
  const next = LibraryCatalog.make({ ...catalog, schema: "beep.research.library/v2" });
  const afterText = yield* encodeCatalog(next).pipe(Effect.mapError(failure("Cannot encode migrated catalog")));
  const afterCatalogSha256 = yield* hashText(afterText);
  const ontology = yield* assembleLibraryOntology().pipe(
    Effect.mapError(failure("Cannot assemble migration ontology"))
  );
  const dataset = yield* libraryViewDataset(root, next);
  const shapes = libraryShapes(ontology);
  const validator = yield* ShaclValidationService;
  const validation = yield* validator
    .validate(ShaclValidationRequest.make({ dataset, shapes, shapesDataset: O.some(libraryShapesDataset(shapes)) }))
    .pipe(Effect.mapError(failure("Cannot validate migrated catalog")));
  const shaclViolations = validation.violations.length;
  yield* Console.log(`shacl: conforms=${validation.conforms} violations=${shaclViolations}`);
  if (!validation.conforms || shaclViolations !== 0)
    return yield* LibraryError.make({
      message: `Catalog migration rejected: shacl violations=${shaclViolations}`,
      cause: "Migration wrote nothing",
    });
  const rendered = yield* libraryIndexMarkdown(dataset);
  const indexMdSha256 = yield* hashText(rendered);
  const diskIndex = yield* fs.readFile(path.join(root, "index.md"));
  const diskIndexSha256 = yield* hashBytes(diskIndex);
  yield* Console.log(
    `migration hashes: before=${beforeCatalogSha256} after=${afterCatalogSha256} index=${indexMdSha256} diskIndex=${diskIndexSha256}`
  );
  if (indexMdSha256 !== diskIndexSha256)
    return yield* LibraryError.make({
      message: `Catalog migration index mismatch: rendered=${indexMdSha256} disk=${diskIndexSha256}`,
      cause: "Migration wrote nothing",
    });
  const now = yield* DateTime.now;
  const receipt = LibraryMigrationReceipt.make({
    fromSchema: catalog.schema,
    beforeCatalogSha256,
    afterCatalogSha256,
    indexMdSha256,
    intakeIds: A.sort(A.dedupe(A.map(catalog.intakes, (intake) => intake.date)), Str.Order),
    shaclViolations,
    recordedAt: DateTime.formatIso(now),
  });
  return { next, before, receipt };
});

/**
 * Migrate only after SHACL conformance and a byte-equal in-memory index preflight.
 * **Details**
 * Dry runs perform no filesystem mutation. A v2 catalog returns immediately.
 * The writer transaction rechecks the gate under the catalog lock; existing
 * identity and object-store migrations are deliberately disabled for this contract change.
 * **Example** (Prepare a dry run)
 * ```ts
 * import { migrateLibrary } from "@beep/repo-cli/commands/Research/Library/Library.migrate"
 * console.log(migrateLibrary("/library", true).pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const migrateLibrary = Effect.fn("Library.migrate")(function* (root: string, dryRun = false) {
  const catalog = yield* loadCatalog(root);
  if (catalog.schema === "beep.research.library/v2") {
    yield* Console.log("catalog migration: already v2; no-op (nothing written)");
    return O.none<LibraryMigrationReceipt>();
  }
  if (dryRun === true) {
    const prepared = yield* prepare(root, catalog);
    yield* Console.log("catalog migration: dry-run passed; nothing written");
    return O.some(prepared.receipt);
  }
  let receipt = O.none<LibraryMigrationReceipt>();
  yield* withCatalog(
    root,
    Effect.fnUntraced(function* (current) {
      if (current.schema === "beep.research.library/v2") return current;
      const prepared = yield* prepare(root, current);
      yield* saveImmutable(root, `catalog/history/${prepared.receipt.beforeCatalogSha256}.json`, prepared.before);
      receipt = O.some(prepared.receipt);
      return prepared.next;
    }),
    false
  );
  if (O.isSome(receipt)) {
    const encoded = yield* S.encodeEffect(S.fromJsonString(LibraryMigrationReceipt))(receipt.value).pipe(
      Effect.mapError(failure("Cannot encode migration receipt"))
    );
    yield* saveImmutable(
      root,
      `ops/migrations/${Str.replaceAll(":", "-")(receipt.value.recordedAt)}-catalog-v2.json`,
      new TextEncoder().encode(encoded)
    );
    yield* Console.log("catalog migration: v2 saved; backup and migration receipt recorded");
  }
  return receipt;
});
