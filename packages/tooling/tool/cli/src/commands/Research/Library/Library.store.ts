/** Research library persistence with immutable artifacts and one catalog writer.
 * @packageDocumentation
 *
 * @since 0.0.0
 */
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LibraryError } from "./Library.errors.ts";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryOccurrence,
  LibrarySource,
  LibraryVersion,
} from "./Library.schemas.ts";

const mapFailure = (message: string) => Effect.mapError((cause: unknown) => LibraryError.make({ message, cause }));
const codec = S.fromJsonString(LibraryCatalog);

/** Hash bytes without interpreting or normalizing their content.
 * **Example** (Hash an empty artifact)
 * ```ts
 * import { hashBytes } from "@beep/repo-cli/commands/Research"
 * console.log(hashBytes(new Uint8Array()).pipe !== undefined)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export const hashBytes = Effect.fn("ResearchLibrary.hashBytes")(function* (bytes: Uint8Array) {
  const crypto = yield* Crypto.Crypto;
  return Hex.encode(yield* crypto.digest("SHA-256", bytes).pipe(mapFailure("Cannot hash library artifact.")));
});

/** Read a schema-validated catalog, or an empty catalog for a new library.
 * **Example** (Read a catalog)
 * ```ts
 * import { loadCatalog } from "@beep/repo-cli/commands/Research"
 * console.log(loadCatalog("/library").pipe !== undefined)
 * ```
 *
 * @category repositories
 *
 * @since 0.0.0
 */
export const loadCatalog = Effect.fn("ResearchLibrary.loadCatalog")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalTarget = path.join(root, "catalog/library.json");
  const legacyTarget = path.join(root, "catalog.json");
  const target = (yield* fs.exists(canonicalTarget).pipe(mapFailure("Cannot inspect canonical catalog.")))
    ? canonicalTarget
    : legacyTarget;
  if (!(yield* fs.exists(target).pipe(mapFailure("Cannot inspect library catalog.")))) {
    return LibraryCatalog.make({
      schema: "beep.research.library/v1",
      documents: [],
      sources: [],
      occurrences: [],
      captures: [],
      qualifications: [],
    });
  }
  const text = yield* fs.readFileString(target).pipe(mapFailure("Cannot read library catalog."));
  return yield* S.decodeEffect(codec)(text).pipe(mapFailure("Invalid library catalog."));
});

const pathEscapes = (path: Path.Path, relative: string) =>
  path.isAbsolute(relative) || relative === ".." || Str.startsWith(`..${path.sep}`)(relative);

const prepareArtifactParent = Effect.fn("ResearchLibrary.prepareArtifactParent")(function* (
  realRoot: string,
  target: string,
  relativePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let ancestor = path.dirname(target);
  while (!(yield* fs.exists(ancestor).pipe(mapFailure("Cannot inspect artifact ancestor."))))
    ancestor = path.dirname(ancestor);
  const realAncestor = yield* fs.realPath(ancestor).pipe(mapFailure("Cannot resolve artifact ancestor."));
  if (pathEscapes(path, path.relative(realRoot, realAncestor))) {
    return yield* LibraryError.make({ message: "Artifact ancestor escapes library via symlink.", cause: relativePath });
  }
  yield* fs
    .makeDirectory(path.dirname(target), { recursive: true })
    .pipe(mapFailure("Cannot create artifact directory."));
  // Recheck the resolved parent before writing bytes.
  const realParent = yield* fs.realPath(path.dirname(target)).pipe(mapFailure("Cannot resolve artifact parent."));
  if (pathEscapes(path, path.relative(realRoot, realParent))) {
    return yield* LibraryError.make({ message: "Artifact parent escapes library via symlink.", cause: relativePath });
  }
});

const verifyImmutableTarget = Effect.fn("ResearchLibrary.verifyImmutableTarget")(function* (
  realRoot: string,
  target: string,
  relativePath: string,
  sha256: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const realTarget = yield* fs.realPath(target).pipe(mapFailure("Cannot resolve immutable artifact."));
  if (pathEscapes(path, path.relative(realRoot, realTarget))) {
    return yield* LibraryError.make({
      message: "Immutable artifact escapes library via symlink.",
      cause: relativePath,
    });
  }
  const existing = yield* fs.readFile(target).pipe(mapFailure("Cannot read immutable artifact."));
  if ((yield* hashBytes(existing)) !== sha256) {
    return yield* LibraryError.make({
      message: "Immutable artifact content differs; choose a new capture path.",
      cause: relativePath,
    });
  }
});

const publishImmutableLink = Effect.fn("ResearchLibrary.publishImmutableLink")(function* (
  realRoot: string,
  from: string,
  target: string,
  artifact: LibraryArtifact
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.link(from, target).pipe(
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "AlreadyExists"
        ? Effect.gen(function* () {
            const realTarget = yield* fs.realPath(target);
            if (pathEscapes(path, path.relative(realRoot, realTarget)))
              return yield* LibraryError.make({
                message: "Concurrent immutable artifact escapes library via symlink.",
                cause: artifact.path,
              });
            const winner = yield* fs.readFile(target);
            if ((yield* hashBytes(winner)) !== artifact.sha256)
              return yield* LibraryError.make({
                message: "Concurrent immutable artifact content differs.",
                cause: artifact.path,
              });
          })
        : Effect.fail(error)
    ),
    mapFailure("Cannot publish immutable artifact atomically.")
  );
});

const stageImmutableObject = Effect.fn("ResearchLibrary.stageImmutableObject")(function* (
  realRoot: string,
  target: string,
  bytes: Uint8Array,
  artifact: LibraryArtifact
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.scoped(
    Effect.gen(function* () {
      const staging = yield* fs
        .makeTempFileScoped({ directory: path.dirname(target), prefix: ".library-artifact-" })
        .pipe(mapFailure("Cannot stage immutable artifact."));
      yield* fs.writeFile(staging, bytes).pipe(mapFailure("Cannot write staged artifact."));
      yield* publishImmutableLink(realRoot, staging, target, artifact);
    })
  );
});

/** Save bytes once; reject path escapes and replacement of existing content.
 * **Example** (Save a snapshot)
 * ```ts
 * import { saveImmutable } from "@beep/repo-cli/commands/Research"
 * console.log(saveImmutable("/library", "snapshots/example.md", new TextEncoder().encode("example")).pipe !== undefined)
 * ```
 *
 * @category repositories
 *
 * @since 0.0.0
 */
export const saveImmutable = Effect.fn("ResearchLibrary.saveImmutable")(function* (
  root: string,
  relativePath: string,
  bytes: Uint8Array
): Effect.fn.Return<LibraryArtifact, LibraryError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), target);
  if (pathEscapes(path, relative) || relative === "") {
    return yield* LibraryError.make({ message: "Artifact path must stay inside the library.", cause: relativePath });
  }
  const realRoot = yield* fs.realPath(root).pipe(mapFailure("Cannot resolve library root."));
  yield* prepareArtifactParent(realRoot, target, relativePath);
  const sha256 = yield* hashBytes(bytes);
  const artifact = LibraryArtifact.make({
    path: relative,
    sha256,
    bytes: bytes.byteLength,
    mediaType: "application/octet-stream",
    role: "artifact",
  });
  const objectPath = `objects/sha256/${sha256}`;
  if (relative !== objectPath) yield* saveImmutable(root, objectPath, bytes);
  if (yield* fs.exists(target).pipe(mapFailure("Cannot inspect immutable artifact."))) {
    yield* verifyImmutableTarget(realRoot, target, relativePath, sha256);
  } else if (relative !== objectPath)
    yield* publishImmutableLink(realRoot, path.join(root, objectPath), target, artifact);
  else yield* stageImmutableObject(realRoot, target, bytes, artifact);
  return artifact;
});

/** Union locators for the same explicit version without losing alias evidence.
 * **Example** (Preserve locator aliases for one revision)
 * ```ts
 * import { mergeLibraryVersions } from "@beep/repo-cli/test/ResearchLibrary"
 * import { LibraryVersion } from "@beep/repo-cli/commands/Research"
 * const version = LibraryVersion.make({revision: "v1", canonicalUrl: "https://arxiv.org/abs/2610.00609v1", locators: ["arXiv:2610.00609v1"]})
 * console.log(mergeLibraryVersions([version, version]).length) // 1
 * ```
 *
 * @internal
 *
 * @category normalization
 *
 * @since 0.0.0
 */
export const mergeLibraryVersions = (versions: ReadonlyArray<LibraryVersion>): ReadonlyArray<LibraryVersion> =>
  A.reduce(versions, A.empty<LibraryVersion>(), (merged, version) => {
    const existing = A.findFirst(
      merged,
      (item) => item.revision === version.revision && item.canonicalUrl === version.canonicalUrl
    );
    return O.isNone(existing)
      ? A.append(merged, version)
      : A.map(merged, (item) =>
          item === existing.value
            ? LibraryVersion.make({ ...item, locators: A.dedupe([...item.locators, ...version.locators]) })
            : item
        );
  });

const releaseRevision = (url: string) =>
  O.getOrElse(O.fromNullishOr(url.match(/\/releases\/tag\/([^?#]+)/)?.[1]), () => "");

const repairedCitationUrl = (url: string) => {
  const withoutSeparator = Str.replace(/(?:，|%EF%BC%8C).*/i, "")(url);
  const target = O.getOrElse(
    O.fromNullishOr(withoutSeparator.match(/\]\((https?:\/\/.+)$/)?.[1]),
    () => withoutSeparator
  );
  return Str.replace(
    /^https?:\/\/(?:www\.)?arxiv\.org\/(?:html|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?$/i,
    "https://arxiv.org/abs/$1"
  )(target);
};

const migratedGithubIdentity = Effect.fn("ResearchLibrary.migratedGithubIdentity")(function* (
  source: LibrarySource,
  identity: string
) {
  if (source.kind !== "github-code" || !Str.startsWith("http")(identity)) return identity;
  const parsed = yield* Effect.try({
    try: () => new URL(source.canonicalUrl),
    catch: (cause) => LibraryError.make({ message: "Cannot migrate legacy GitHub citation identity.", cause }),
  }).pipe(Effect.option);
  if (O.isNone(parsed)) return identity;
  const parts = A.filter(Str.split(parsed.value.pathname, "/"), Str.isNonEmpty);
  const section = O.getOrElse(A.get(parts, 2), () => "");
  return section === "blob" || section === "tree"
    ? `github:${source.repository}:${section}:${A.join(A.drop(parts, 4), "/")}`
    : identity;
});

const matchedGroup = (match: RegExpMatchArray, index: number) =>
  O.getOrElse(O.flatMap(A.get(match, index), O.fromNullishOr), () => "");

const migratedSourceRevision = (source: LibrarySource, paper: O.Option<RegExpMatchArray>) => {
  if (source.kind === "youtube") return Str.replace(/^youtube:/, "")(source.identity);
  if (source.kind === "github-release") return releaseRevision(source.canonicalUrl);
  return O.isSome(paper) ? matchedGroup(paper.value, 2) : source.revision;
};

const migratedVersion = (source: LibrarySource, revision: string, originalVersion: LibraryVersion) => {
  const version = LibraryVersion.make({
    ...originalVersion,
    canonicalUrl: repairedCitationUrl(originalVersion.canonicalUrl),
  });
  const paper = Str.match(/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}(v\d+)?$/i)(version.canonicalUrl);
  if (O.isSome(paper)) return LibraryVersion.make({ ...version, revision: matchedGroup(paper.value, 1) });
  if (source.kind === "youtube" && version.revision === "") return LibraryVersion.make({ ...version, revision });
  if (source.kind === "github-release")
    return LibraryVersion.make({ ...version, revision: releaseRevision(version.canonicalUrl) });
  return version;
};

const migratedSource = Effect.fn("ResearchLibrary.migratedSource")(function* (source: LibrarySource) {
  const canonicalUrl = repairedCitationUrl(source.canonicalUrl);
  const paper = Str.match(/^https:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5})(v\d+)?$/i)(canonicalUrl);
  const originalIdentity = O.isSome(paper)
    ? `arxiv:${matchedGroup(paper.value, 1)}`
    : source.identity === source.canonicalUrl
      ? canonicalUrl
      : source.identity;
  const identity = yield* migratedGithubIdentity(source, originalIdentity);
  const id = yield* hashBytes(new TextEncoder().encode(identity));
  const revision = migratedSourceRevision(source, paper);
  const originals = A.match(source.versions, {
    onEmpty: () => [
      LibraryVersion.make({ revision: source.revision, canonicalUrl: source.canonicalUrl, locators: source.locators }),
    ],
    onNonEmpty: A.fromIterable,
  });
  return LibrarySource.make({
    ...source,
    id,
    identity,
    canonicalUrl,
    kind: O.isSome(paper) ? "paper" : source.kind,
    ownership: O.isSome(paper) ? "external" : source.ownership,
    locators: A.dedupe([...source.locators, canonicalUrl]),
    revision,
    versions: mergeLibraryVersions(A.map(originals, (version) => migratedVersion(source, revision, version))),
    aliasIds: A.dedupe([...source.aliasIds, ...(source.id === id ? [] : [source.id])]),
  });
});

const mergeMigratedSource = (sources: ReadonlyArray<LibrarySource>, migrated: LibrarySource) => {
  const existing = A.findFirst(sources, (item) => item.id === migrated.id);
  if (O.isNone(existing)) return A.append(sources, migrated);
  return A.map(sources, (item) =>
    item.id === migrated.id
      ? LibrarySource.make({
          ...item,
          locators: A.dedupe([...item.locators, ...migrated.locators]),
          aliasIds: A.dedupe([...item.aliasIds, ...migrated.aliasIds]),
          versions: mergeLibraryVersions([...item.versions, ...migrated.versions]),
        })
      : item
  );
};

const reboundSource = (sources: ReadonlyArray<LibrarySource>, oldId: string) =>
  A.findFirst(sources, (source) => source.id === oldId || A.contains(source.aliasIds, oldId));

const migrationUsesSourceRevision = (oldSource: O.Option<LibrarySource>, source: LibrarySource) =>
  source.kind === "youtube" ||
  (O.isSome(oldSource) && oldSource.value.id !== source.id && oldSource.value.versions.length === 0);

const reboundOccurrenceRevision = (
  occurrence: LibraryOccurrence,
  oldSource: O.Option<LibrarySource>,
  source: LibrarySource
) => {
  if (source.kind === "github-release")
    return O.getOrElse(
      O.map(
        A.findFirst(source.versions, (version) => A.contains(version.locators, occurrence.locator)),
        (version) => version.revision
      ),
      () => source.revision
    );
  return occurrence.revision === "" && migrationUsesSourceRevision(oldSource, source)
    ? source.revision
    : occurrence.revision;
};

const reboundOccurrence = (
  oldSources: ReadonlyArray<LibrarySource>,
  sources: ReadonlyArray<LibrarySource>,
  occurrence: LibraryOccurrence
) => {
  const oldSource = A.findFirst(oldSources, (source) => source.id === occurrence.sourceId);
  const source = reboundSource(sources, occurrence.sourceId);
  return O.isSome(source)
    ? LibraryOccurrence.make({
        ...occurrence,
        sourceId: source.value.id,
        revision: reboundOccurrenceRevision(occurrence, oldSource, source.value),
      })
    : occurrence;
};

const reboundCapture = (
  oldSources: ReadonlyArray<LibrarySource>,
  sources: ReadonlyArray<LibrarySource>,
  capture: LibraryCapture
) => {
  const oldSource = A.findFirst(oldSources, (source) => source.id === capture.sourceId);
  const source = reboundSource(sources, capture.sourceId);
  return O.isSome(source)
    ? LibraryCapture.make({
        ...capture,
        sourceId: source.value.id,
        requestedRevision:
          capture.requestedRevision === "" && migrationUsesSourceRevision(oldSource, source.value)
            ? source.value.revision
            : capture.requestedRevision,
      })
    : capture;
};

const migrateCatalogIdentities = Effect.fn("ResearchLibrary.migrateCatalogIdentities")(function* (
  catalog: LibraryCatalog
) {
  let sources: ReadonlyArray<LibrarySource> = [];
  for (const source of catalog.sources) sources = mergeMigratedSource(sources, yield* migratedSource(source));
  return LibraryCatalog.make({
    ...catalog,
    sources,
    occurrences: A.map(catalog.occurrences, (occurrence) => reboundOccurrence(catalog.sources, sources, occurrence)),
    captures: A.map(catalog.captures, (capture) => reboundCapture(catalog.sources, sources, capture)),
  });
});

/** Serialize catalog mutations under an exclusive directory lock.
 * **Details**
 * The callback runs while the writer owns `.writer-lock`; lock contention fails
 * visibly. A process killed before release leaves a lock requiring inspection.
 * Catalog generations are immutable, and the current pointer replaces atomically.
 * **Example** (Preserve the catalog)
 * ```ts
 * import { withCatalog } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * console.log(withCatalog("/library", Effect.succeed).pipe !== undefined)
 * ```
 *
 * @category repositories
 *
 * @since 0.0.0
 */
export const withCatalog = Effect.fn("ResearchLibrary.withCatalog")(function* <E, R>(
  root: string,
  update: (catalog: LibraryCatalog) => Effect.Effect<LibraryCatalog, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(root, { recursive: true }).pipe(mapFailure("Cannot create library root."));
  const lock = path.join(root, ".writer-lock");
  return yield* Effect.acquireUseRelease(
    fs
      .makeDirectory(lock)
      .pipe(
        mapFailure(
          "Library writer already active, or an interrupted writer left .writer-lock; inspect before removing it."
        )
      ),
    () =>
      Effect.gen(function* () {
        const migrated = yield* migrateCatalogIdentities(yield* loadCatalog(root));
        const artifacts = [
          ...migrated.artifacts,
          ...A.flatMap(migrated.captures, (capture) => capture.artifacts),
          ...A.flatMap(migrated.qualifications, (qualification) => qualification.evidence),
        ];
        // Legacy aliases predate the object store. Admit their bytes only against the recorded digest.
        for (const artifact of artifacts) {
          if (yield* fs.exists(path.join(root, "objects/sha256", artifact.sha256))) continue;
          const bytes = yield* fs
            .readFile(path.resolve(root, artifact.path))
            .pipe(mapFailure("Cannot read legacy artifact for object migration."));
          if (bytes.length !== artifact.bytes || (yield* hashBytes(bytes)) !== artifact.sha256)
            return yield* LibraryError.make({
              message: "Legacy artifact differs from its immutable receipt.",
              cause: artifact.path,
            });
          yield* saveImmutable(root, artifact.path, bytes);
        }
        const catalog = yield* update(migrated);
        const encoded = yield* S.encodeEffect(codec)(catalog).pipe(mapFailure("Cannot encode library catalog."));
        const bytes = new TextEncoder().encode(encoded);
        const hash = yield* hashBytes(bytes);
        yield* saveImmutable(root, `catalog/history/${hash}.json`, bytes);
        const temporary = path.join(lock, "catalog.next.json");
        yield* fs.writeFile(temporary, bytes, { flag: "wx" }).pipe(mapFailure("Cannot stage library catalog."));
        yield* fs
          .makeDirectory(path.join(root, "catalog"), { recursive: true })
          .pipe(mapFailure("Cannot create canonical catalog directory."));
        yield* fs
          .rename(temporary, path.join(root, "catalog/library.json"))
          .pipe(mapFailure("Cannot replace library catalog atomically."));
        return catalog;
      }),
    () => fs.remove(lock, { recursive: true }).pipe(Effect.orDie)
  );
});
