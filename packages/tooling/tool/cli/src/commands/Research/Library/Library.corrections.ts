/** Immutable correction receipts for invalidated reading claims.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { encodeLibraryJson, saveLibraryText } from "./Library.adapter.ts";
import { libraryArtifactsValid, librarySourceEvidenceValid } from "./Library.evidence.ts";
import { LibraryArtifact, LibraryCapture, LibraryCatalog, LibrarySource } from "./Library.schemas.ts";
import { hashBytes } from "./Library.store.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.corrections");
/**
 * Immutable evidence describing an invalidated reading claim and its corrected state.
 *
 * **Example** (Decoding a saved correction)
 * ```ts
 * import { LibraryCaptureCorrection } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as S from "effect/Schema"
 * const decode = S.decodeEffect(S.fromJsonString(LibraryCaptureCorrection))
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class LibraryCaptureCorrection extends S.Class<LibraryCaptureCorrection>($I`LibraryCaptureCorrection`)(
  {
    schema: S.Literal("beep.research.capture-correction/v1"),
    captureId: S.String,
    sourceId: S.String,
    recordedAt: S.String,
    validator: S.Literal("librarySourceEvidenceValid"),
    reason: S.String,
    before: LibraryArtifact,
    after: LibraryCapture,
    afterSha256: S.String.check(S.isPattern(/^[0-9a-f]{64}$/)),
  },
  $I.annote("LibraryCaptureCorrection", {
    description:
      "Hash-bound before snapshot and demoted after state, excluding the correction artifact itself to avoid recursive hashes.",
  })
) {}

/**
 * Preserve the prior claim and explicitly demote invalid reading receipts inside a catalog writer callback.
 *
 * **Details**
 * The original catalog history remains immutable. Missing or corrupt old artifact claims remain in the
 * before snapshot; only verified original artifacts are retained on the demoted capture.
 *
 * **Example** (Correct before scheduling a retry)
 * ```ts
 * import { correctLibraryCaptures } from "@beep/repo-cli/test/ResearchLibrary"
 * import { withCatalog } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * const correction = withCatalog("/library", (catalog) => correctLibraryCaptures("/library", catalog))
 * console.log(Effect.isEffect(correction))
 * ```
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const correctLibraryCaptures = Effect.fn("Library.correctCaptures")(function* (
  root: string,
  catalog: LibraryCatalog
) {
  const captures: Array<LibraryCapture> = [];
  const recordCaptureCorrection = Effect.fn("Library.recordCaptureCorrection")(function* (capture: LibraryCapture) {
    const recordedAt = DateTime.formatIso(yield* DateTime.now);
    const reason =
      "Reading claim invalidated: original hashes, target identity, revision, or required source evidence failed current semantic validation; new source capture required.";
    const beforeText = yield* encodeLibraryJson(capture);
    const correctionId = yield* hashBytes(new TextEncoder().encode(`${capture.id}\n${recordedAt}\n${beforeText}`));
    const prefix = `corrections/${capture.id}/${correctionId}`;
    const before = yield* saveLibraryText(
      root,
      `${prefix}/before.json`,
      beforeText,
      "application/json",
      "invalidated-capture-snapshot"
    );
    const retained: Array<LibraryArtifact> = [];
    for (const artifact of capture.artifacts)
      if (yield* libraryArtifactsValid(root, [artifact])) retained.push(artifact);
    const after = LibraryCapture.make({
      ...capture,
      status: "blocked",
      complete: false,
      reason,
      artifacts: [...retained, before],
    });
    const afterText = yield* encodeLibraryJson(after);
    const receipt = LibraryCaptureCorrection.make({
      schema: "beep.research.capture-correction/v1",
      captureId: capture.id,
      sourceId: capture.sourceId,
      recordedAt,
      validator: "librarySourceEvidenceValid",
      reason,
      before,
      after,
      afterSha256: yield* hashBytes(new TextEncoder().encode(afterText)),
    });
    const evidence = yield* saveLibraryText(
      root,
      `${prefix}/correction.json`,
      yield* encodeLibraryJson(receipt),
      "application/json",
      "capture-correction"
    );
    return LibraryCapture.make({ ...after, artifacts: [...after.artifacts, evidence] });
  });
  const correctCapture = Effect.fn("Library.correctCapture")(function* (capture: LibraryCapture) {
    if (capture.status !== "readable") {
      return capture;
    }
    const source = A.findFirst(catalog.sources, (entry) => entry.id === capture.sourceId);
    if (O.isNone(source)) {
      return capture;
    }
    const version = A.findFirst(source.value.versions, (entry) => entry.revision === capture.requestedRevision);
    const target = O.isSome(version) ? LibrarySource.make({ ...source.value, ...version.value }) : source.value;
    const valid =
      capture.complete &&
      (yield* librarySourceEvidenceValid(root, target, capture).pipe(Effect.orElseSucceed(() => false)));
    if (valid) {
      return capture;
    }
    return yield* recordCaptureCorrection(capture);
  });
  for (const capture of catalog.captures) captures.push(yield* correctCapture(capture));
  return LibraryCatalog.make({ ...catalog, captures });
});
