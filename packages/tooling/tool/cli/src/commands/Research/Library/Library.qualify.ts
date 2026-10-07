/** Source-bound operational qualification.
 * @packageDocumentation
 * @since 0.0.0 */
import { $RepoCliId } from "@beep/identity/packages";
import { DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { acquireLibrarySource, libraryAdapterFor, requiredLibraryAdapters } from "./Library.acquire.ts";
import { encodeLibraryJson, saveLibraryText } from "./Library.adapter.ts";
import { LibraryProbeEvidence, libraryQualificationValid } from "./Library.evidence.ts";
import { LibraryCatalog, LibraryQualification } from "./Library.schemas.ts";
import { hashBytes, loadCatalog, withCatalog } from "./Library.store.ts";
import type { LibrarySource } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.qualify");
/** Bound and select real adapter probes.
 * **Example** (Bound a targeted paper probe)
 * ```ts
 * import { LibraryQualifyOptions } from "@beep/repo-cli/commands/Research"
 * const options = LibraryQualifyOptions.make({adapters: ["paper"], sourceIds: [], maxProbes: 1})
 * console.log(options.maxProbes) // 1
 * ```
 *
 * @category models
 * @since 0.0.0 */
export class LibraryQualifyOptions extends S.Class<LibraryQualifyOptions>($I`LibraryQualifyOptions`)(
  {
    adapters: S.Array(S.String),
    sourceIds: S.Array(S.String),
    maxProbes: S.Int.check(S.isBetween({ minimum: 1, maximum: 3 })),
  },
  $I.annote("LibraryQualifyOptions", {
    description: "Explicit adapter/source selection and bounded alternate-source probes.",
  })
) {}

/** Probe the actual source adapters, recording route limitations without weakening sandbox policy.
 * **Example** (Build source qualification)
 * ```ts
 * import { qualifyLibrary } from "@beep/repo-cli/commands/Research"
 * console.log(qualifyLibrary("/library").pipe !== undefined)
 * ```
 *
 * @category use-cases
 *
 * @since 0.0.0
 */
export const qualifyLibrary = Effect.fn("Library.qualify")(function* (
  root: string,
  options = LibraryQualifyOptions.make({ adapters: [], sourceIds: [], maxProbes: 3 })
) {
  const catalog = yield* loadCatalog(root);
  const captureProbeCandidates = Effect.fn("Library.qualify.captureProbeCandidates")(function* (
    initial: LibrarySource,
    candidates: ReadonlyArray<LibrarySource>
  ) {
    let capturedSource = initial;
    let capture = yield* acquireLibrarySource(root, capturedSource);
    for (const candidate of A.drop(candidates, 1)) {
      if (capture.status === "readable" && capture.complete) break;
      capturedSource = candidate;
      capture = yield* acquireLibrarySource(root, candidate);
    }
    return { capturedSource, capture };
  });
  const probeAdapter = Effect.fn("Library.qualify.probeAdapter")(function* (adapter: string) {
    const recordedAt = DateTime.formatIso(yield* DateTime.now);
    const id = yield* hashBytes(new TextEncoder().encode(`${adapter}\n${recordedAt}`));
    const candidates = A.take(
      A.filter(
        catalog.sources,
        (s) =>
          (s.ownership === "external" || (s.ownership === "project" && libraryAdapterFor(s) === "github")) &&
          libraryAdapterFor(s) === adapter &&
          A.match(options.sourceIds, { onEmpty: () => true, onNonEmpty: (selected) => A.contains(selected, s.id) })
      ),
      options.maxProbes
    );
    const source = A.head(candidates);
    if (adapter === "grok-deep-research" || adapter === "grok-x-import" || O.isNone(source)) {
      const qualification = LibraryQualification.make({
        id,
        adapter,
        status: "failed",
        required: true,
        recordedAt,
        evidence: [],
        reason:
          adapter === "grok-deep-research"
            ? "Literal /deep-research workflow launch and completion require observed runtime evidence; no version/help substitute."
            : "Observed Grok X Search tool evidence must be imported before qualification.",
      });
      yield* withCatalog(root, (current) =>
        Effect.succeed(LibraryCatalog.make({ ...current, qualifications: [...current.qualifications, qualification] }))
      );
      return;
    }
    const { capturedSource, capture } = yield* captureProbeCandidates(source.value, candidates);
    const status = capture.status === "readable" && capture.complete ? "verified" : "failed";
    const probe = LibraryProbeEvidence.make({
      adapter,
      sourceId: capturedSource.id,
      sourceUrl: capturedSource.canonicalUrl,
      status,
      captureId: capture.id,
      complete: capture.complete,
      artifacts: capture.artifacts,
    });
    const evidence = yield* saveLibraryText(
      root,
      `qualifications/${id}/probe.json`,
      yield* encodeLibraryJson(probe),
      "application/json",
      "qualification-probe"
    );
    const qualification = LibraryQualification.make({
      id,
      adapter,
      status,
      required: true,
      recordedAt,
      evidence: [evidence],
      reason:
        status === "verified"
          ? "Actual source capture passed target, content, and completeness checks."
          : capture.reason,
    });
    yield* withCatalog(root, (current) =>
      Effect.succeed(LibraryCatalog.make({ ...current, qualifications: [...current.qualifications, qualification] }))
    );
  });
  for (const adapter of A.filter(requiredLibraryAdapters(catalog), (route) =>
    A.match(options.adapters, { onEmpty: () => true, onNonEmpty: (selected) => A.contains(selected, route) })
  )) {
    const previous = A.findLast(catalog.qualifications, (q) => q.adapter === adapter);
    if (O.isSome(previous) && (yield* libraryQualificationValid(root, catalog, previous.value))) continue;
    yield* probeAdapter(adapter);
  }
  return yield* loadCatalog(root);
});

export { LibraryProbeEvidence } from "./Library.evidence.ts";
