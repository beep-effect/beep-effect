/**
 * Resumable typed evidence acquisition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FirecrawlError } from "@beep/firecrawl";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { LibraryAdapterResult } from "./Library.adapter.ts";
import { correctLibraryCaptures } from "./Library.corrections.ts";
import { LibraryError } from "./Library.errors.ts";
import { libraryEffectiveCaptures, libraryQualificationValid, librarySourceEvidenceValid } from "./Library.evidence.ts";
import { acquireLibraryGithub } from "./Library.github.ts";
import { libraryDispositionValid } from "./Library.import.ts";
import { LibraryCapture, LibraryCatalog, LibrarySource } from "./Library.schemas.ts";
import { hashBytes, loadCatalog, withCatalog } from "./Library.store.ts";
import { acquireLibraryPaper, acquireLibraryWeb } from "./Library.web.ts";
import { acquireLibraryYoutube } from "./Library.youtube.ts";
import type { LibraryAcquireOptions } from "./Library.schemas.ts";

/**
 * Identify the actual acquisition route.
 * **Example** (Select the paper route)
 * ```ts
 * import { libraryAdapterFor, classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * import * as Effect from "effect/Effect";
 * const route = classifyLibraryReference("https://arxiv.org/abs/2610.00609", "report").pipe(Effect.map(libraryAdapterFor))
 * console.log(Effect.isEffect(route))
 * ```
 *
 * @param source - Classified reference whose kind determines its acquisition route.
 * @returns The adapter identifier required to acquire this reference.
 * @category utilities
 * @since 0.0.0
 */
export const libraryAdapterFor = (source: LibrarySource): string =>
  Match.value(source.kind).pipe(
    Match.when("paper", () => "paper"),
    Match.when("youtube", () => "youtube-captions"),
    Match.when("x", () => "grok-x-import"),
    Match.when(
      (kind) => Str.startsWith("github-")(kind),
      () => "github"
    ),
    Match.when(
      (kind) => A.contains(["endpoint", "internal", "unresolved"], kind),
      () => "disposition"
    ),
    Match.orElse(() => "firecrawl")
  );

/**
 * Required operational routes for a catalog.
 * **Example** (Keep deep research required for an empty catalog)
 * ```ts
 * import { requiredLibraryAdapters, LibraryCatalog } from "@beep/repo-cli/commands/Research"
 * const catalog = LibraryCatalog.make({schema: "beep.research.library/v1", documents: [], sources: [], occurrences: [], captures: [], qualifications: []})
 * console.log(requiredLibraryAdapters(catalog)) // ["grok-deep-research"]
 * ```
 *
 * @param catalog - Catalog whose required qualifications and source routes are combined.
 * @returns Unique adapter identifiers, with deep research always required.
 * @category utilities
 * @since 0.0.0
 */
export const requiredLibraryAdapters = (catalog: LibraryCatalog) =>
  A.dedupe([
    "grok-deep-research",
    ...A.map(
      A.filter(catalog.qualifications, (qualification) => qualification.required),
      (qualification) => qualification.adapter
    ),
    ...A.filter(
      A.map(
        A.filter(
          catalog.sources,
          (source) =>
            source.ownership === "external" ||
            (source.ownership === "project" && Str.startsWith("github-")(source.kind))
        ),
        libraryAdapterFor
      ),
      (route) => route !== "disposition"
    ),
  ]);

const disposition = (reason: string) =>
  Effect.succeed(
    LibraryAdapterResult.make({
      artifacts: [],
      revision: "",
      status: "unsupported",
      complete: false,
      reason,
    })
  );
const adapter = (root: string, source: LibrarySource, prefix: string) => {
  if (source.ownership !== "external" && !(source.ownership === "project" && Str.startsWith("github-")(source.kind)))
    return disposition(`Ownership ${source.ownership}; no external acquisition admitted.`);
  return Match.value(libraryAdapterFor(source)).pipe(
    Match.when("github", () => acquireLibraryGithub(root, source, prefix)),
    Match.when("paper", () => acquireLibraryPaper(root, source, prefix)),
    Match.when("youtube-captions", () => acquireLibraryYoutube(root, source, prefix)),
    Match.when("grok-x-import", () =>
      disposition("X requires imported raw evidence from an observed Grok X Search tool call.")
    ),
    Match.when("disposition", () =>
      disposition(`Source kind ${source.kind} requires an explicit resolution or operational disposition.`)
    ),
    Match.orElse(() => acquireLibraryWeb(root, source, prefix))
  );
};

/**
 * Capture one source with a durable start receipt and terminal receipt.
 * **Example** (Prepare a source-bound acquisition)
 * ```ts
 * import { acquireLibrarySource } from "@beep/repo-cli/test/ResearchLibrary"
 * import { classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * import * as Effect from "effect/Effect";
 * const acquisition = classifyLibraryReference("https://arxiv.org/abs/2610.00609", "report").pipe(Effect.flatMap((source) => acquireLibrarySource("/library", source)))
 * console.log(Effect.isEffect(acquisition))
 * ```
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const acquireLibrarySource = Effect.fn("Library.acquireSource")(function* (
  root: string,
  source: LibrarySource,
  writer?: Semaphore.Semaphore
) {
  const serialize = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
    writer === undefined ? operation : writer.withPermit(operation);
  const recordedAt = DateTime.formatIso(yield* DateTime.now);
  const id = yield* hashBytes(new TextEncoder().encode(`${source.id}\n${source.revision}\n${recordedAt}`));
  const method = libraryAdapterFor(source);
  const start = LibraryCapture.make({
    id,
    sourceId: source.id,
    requestedRevision: source.revision,
    method,
    recordedAt,
    status: "running",
    capturedRevision: "",
    complete: false,
    artifacts: [],
    reason: "Acquisition started; terminal receipt required.",
  });
  yield* serialize(
    withCatalog(root, (catalog) =>
      Effect.succeed(LibraryCatalog.make({ ...catalog, captures: [...catalog.captures, start] }))
    )
  );
  const outcome = yield* adapter(root, source, `captures/${source.id}/${id}`).pipe(
    Effect.timeout("10 minutes"),
    Effect.mapError((error) =>
      LibraryError.make({
        message: S.is(LibraryError)(error)
          ? error.message
          : S.is(FirecrawlError)(error)
            ? `Firecrawl ${error.reason}; status ${O.getOrElse(error.status, () => 0)}; retryable ${O.getOrElse(error.retryable, () => false)}.`
            : `${method} acquisition failed or timed out; original start receipt retained.`,
        cause: "adapter-failure",
      })
    ),
    Effect.result
  );
  const result = Result.getOrElse(outcome, (error) =>
    LibraryAdapterResult.make({
      artifacts: [],
      revision: "",
      status: "failed",
      complete: false,
      reason: error.message,
    })
  );
  const completed = LibraryCapture.make({
    ...start,
    status: result.status,
    capturedRevision: result.revision,
    complete: result.complete,
    artifacts: result.artifacts,
    reason: result.reason,
  });
  yield* serialize(
    withCatalog(root, (catalog) =>
      Effect.succeed(
        LibraryCatalog.make({
          ...catalog,
          captures: A.map(catalog.captures, (capture) => (capture.id === id ? completed : capture)),
        })
      )
    )
  );
  return completed;
});

/**
 * Acquire sources after route qualification, retaining failures for explicit retries.
 * **Details**
 * Valid reviewed dispositions remain intact during blanket retries. Explicit source selection permits
 * retrying reviewed network sources; internal, non-reference, operational, and X import-only routes
 * continue to require a new reviewed or provider import instead of automatic reacquisition.
 *
 * **Example** (Build an acquisition effect)
 * ```ts
 * import { acquireLibrary, LibraryAcquireOptions } from "@beep/repo-cli/commands/Research"
 * console.log(acquireLibrary("/library", LibraryAcquireOptions.make({sourceIds: [], concurrency: 2, retryFailed: false})).pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const acquireLibrary = Effect.fn("Library.acquire")(function* (root: string, options: LibraryAcquireOptions) {
  if (!S.is(S.Int)(options.concurrency) || options.concurrency < 1 || options.concurrency > 8) {
    return yield* LibraryError.make({
      message: "Acquisition concurrency must be an integer from 1 through 8.",
      cause: "options",
    });
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const writer = yield* Semaphore.make(1);
  yield* fs.makeDirectory(root, { recursive: true });
  const lock = path.join(root, ".acquisition-lock");
  return yield* Effect.acquireUseRelease(
    fs.makeDirectory(lock).pipe(
      Effect.mapError(() =>
        LibraryError.make({
          message: "Acquisition active or interrupted; inspect .acquisition-lock before recovery.",
          cause: "lock",
        })
      )
    ),
    Effect.fnUntraced(function* () {
      const catalog = yield* withCatalog(root, (original) =>
        correctLibraryCaptures(root, original).pipe(
          Effect.map((current) =>
            LibraryCatalog.make({
              ...current,
              captures: A.map(current.captures, (capture) =>
                capture.status === "running"
                  ? LibraryCapture.make({
                      ...capture,
                      status: "interrupted",
                      reason: "Previous acquisition stopped before a terminal receipt.",
                    })
                  : capture
              ),
            })
          )
        )
      );
      const versions = A.flatMap(catalog.sources, (source) =>
        A.match(source.versions, {
          onEmpty: () => [source],
          onNonEmpty: (entries) =>
            A.map(entries, (version) =>
              LibrarySource.make({
                ...source,
                revision: version.revision,
                canonicalUrl: version.canonicalUrl,
                locators: version.locators,
              })
            ),
        })
      );
      const targets: Array<LibrarySource> = [];
      const preserveReviewedTarget = Effect.fn("Library.acquire.preserveReviewedTarget")(function* (
        source: LibrarySource
      ) {
        const effective = yield* libraryEffectiveCaptures(root, catalog, source);
        const current = A.findFirst(effective, (item) => item.revision === source.revision);
        const reviewed = current.pipe(
          O.flatMap((item) => (item.category !== "readable" && item.capture !== null ? O.some(item.capture) : O.none()))
        );
        const forceReviewedRetry =
          A.isReadonlyArrayNonEmpty(options.sourceIds) &&
          !A.contains(["disposition", "grok-x-import"], libraryAdapterFor(source));
        if (
          O.isSome(reviewed) &&
          !forceReviewedRetry &&
          (yield* libraryDispositionValid(root, catalog, source, reviewed.value))
        )
          return true;
        return false;
      });
      const reusableCapture = Effect.fn("Library.acquire.reusableCapture")(function* (
        source: LibrarySource,
        latest: O.Option<LibraryCapture>
      ) {
        const reusable =
          O.isSome(latest) &&
          latest.value.status === "readable" &&
          latest.value.complete &&
          (yield* librarySourceEvidenceValid(root, source, latest.value));
        return reusable;
      });
      const selectTarget = Effect.fn("Library.acquire.selectTarget")(function* (source: LibrarySource) {
        const selected = A.match(options.sourceIds, {
          onEmpty: () => true,
          onNonEmpty: (ids) => A.contains(ids, source.id),
        });
        const latest = A.findLast(
          catalog.captures,
          (capture) => capture.sourceId === source.id && capture.requestedRevision === source.revision
        );
        if (!selected) return;
        if (yield* preserveReviewedTarget(source)) return;
        const reusable = yield* reusableCapture(source, latest);
        if (O.isNone(latest) || latest.value.status === "interrupted" || (options.retryFailed && !reusable))
          targets.push(source);
      });
      for (const source of versions) yield* selectTarget(source);
      const admitted: Array<LibrarySource> = [];
      let qualificationValidity = Record.empty<string, boolean>();
      for (const method of A.dedupe(A.map(targets, libraryAdapterFor))) {
        const qualification = A.findLast(catalog.qualifications, (q) => q.adapter === method && q.required);
        const valid =
          O.isSome(qualification) &&
          (yield* libraryQualificationValid(root, catalog, qualification.value).pipe(
            Effect.orElseSucceed(() => false)
          ));
        qualificationValidity = Record.set(qualificationValidity, method, valid);
      }
      const admitTarget = Effect.fn("Library.acquire.admitTarget")(function* (source: LibrarySource) {
        const method = libraryAdapterFor(source);
        if (method === "disposition" || O.getOrElse(Record.get(qualificationValidity, method), () => false)) {
          admitted.push(source);
        } else {
          const recordedAt = DateTime.formatIso(yield* DateTime.now);
          const id = yield* hashBytes(
            new TextEncoder().encode(`${source.id}\n${source.revision}\nblocked\n${recordedAt}`)
          );
          const blocked = LibraryCapture.make({
            id,
            sourceId: source.id,
            status: "blocked",
            method,
            recordedAt,
            capturedRevision: "",
            requestedRevision: source.revision,
            complete: false,
            artifacts: [],
            reason: `Adapter ${method} lacks operational qualification; acquisition was not attempted.`,
          });
          yield* withCatalog(root, (current) =>
            Effect.succeed(LibraryCatalog.make({ ...current, captures: [...current.captures, blocked] }))
          );
        }
      });
      for (const source of targets) yield* admitTarget(source);
      // GitHub sources sharing a clone are serialized; other adapters honor the bounded fan-out.
      const github = A.filter(admitted, (source) => libraryAdapterFor(source) === "github");
      const other = A.filter(admitted, (source) => libraryAdapterFor(source) !== "github");
      const groups = Record.values(
        A.groupBy(github, (source) =>
          Str.toLowerCase(
            Str.isEmpty(source.repository)
              ? A.join(A.take(Str.split(source.canonicalUrl, "/"), 5), "/")
              : source.repository
          )
        )
      );
      yield* Effect.all(
        [
          ...A.map(groups, (group) =>
            Effect.forEach(group, (source) => acquireLibrarySource(root, source, writer), { concurrency: 1 })
          ),
          ...A.map(other, (source) => acquireLibrarySource(root, source, writer)),
        ],
        { concurrency: options.concurrency, discard: true }
      );
      return yield* loadCatalog(root);
    }),
    () => fs.remove(lock, { recursive: true }).pipe(Effect.orDie)
  );
});
